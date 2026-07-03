require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ các tỉnh ven biển
const PROVINCE_COORDS = {
  'Bạc Liêu': { centerLat: 9.29, centerLng: 105.72, minLat: 8.8, maxLat: 9.8, minLng: 105.2, maxLng: 106.2 },
  'Sóc Trăng': { centerLat: 9.6, centerLng: 105.98, minLat: 9.1, maxLat: 10.1, minLng: 105.5, maxLng: 106.5 },
  'Trà Vinh': { centerLat: 9.95, centerLng: 106.34, minLat: 9.4, maxLat: 10.4, minLng: 105.8, maxLng: 106.8 },
  'Bến Tre': { centerLat: 10.24, centerLng: 106.38, minLat: 9.7, maxLat: 10.7, minLng: 105.8, maxLng: 106.8 },
  'Cà Mau': { centerLat: 9.18, centerLng: 105.15, minLat: 8.6, maxLat: 9.7, minLng: 104.5, maxLng: 105.7 },
  'Kiên Giang': { centerLat: 10.01, centerLng: 105.08, minLat: 8.5, maxLat: 10.8, minLng: 103.0, maxLng: 105.8 }
};

function isWithinProvince(lat, lng, province) {
  const bounds = PROVINCE_COORDS[province];
  if (!bounds) return false;
  
  return lat >= bounds.minLat && 
         lat <= bounds.maxLat &&
         lng >= bounds.minLng && 
         lng <= bounds.maxLng;
}

async function fetchMekongBeaches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Mekong Delta beaches collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bạc Liêu
      { query: 'Bãi biển Gành Hào Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Bãi biển Vĩnh Trạch Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Bãi biển Nhà Mát Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Du lịch biển Bạc Liêu', province: 'Bạc Liêu' },
      
      // Sóc Trăng
      { query: 'Bãi biển Mỹ Thanh Sóc Trăng', province: 'Sóc Trăng' },
      { query: 'Bãi biển Trần Đề Sóc Trăng', province: 'Sóc Trăng' },
      { query: 'Du lịch biển Sóc Trăng', province: 'Sóc Trăng' },
      
      // Trà Vinh
      { query: 'Bãi biển Ba Động Trà Vinh', province: 'Trà Vinh' },
      { query: 'Bãi biển Cồn Chim Trà Vinh', province: 'Trà Vinh' },
      { query: 'Bãi biển Duyên Hải Trà Vinh', province: 'Trà Vinh' },
      { query: 'Du lịch biển Trà Vinh', province: 'Trà Vinh' },
      
      // Bến Tre
      { query: 'Bãi biển Bình Đại Bến Tre', province: 'Bến Tre' },
      { query: 'Bãi biển Ba Tri Bến Tre', province: 'Bến Tre' },
      { query: 'Du lịch biển Bến Tre', province: 'Bến Tre' },
      
      // Cà Mau
      { query: 'Bãi biển Khai Long Cà Mau', province: 'Cà Mau' },
      { query: 'Bãi biển Đất Mũi Cà Mau', province: 'Cà Mau' },
      { query: 'Bãi biển Tân Ân Cà Mau', province: 'Cà Mau' },
      { query: 'Du lịch biển Cà Mau', province: 'Cà Mau' },
      
      // Kiên Giang (mainland - không phải Phú Quốc)
      { query: 'Bãi biển Hòn Sơn Kiên Giang', province: 'Kiên Giang' },
      { query: 'Bãi biển Hòn Tre Kiên Giang', province: 'Kiên Giang' },
      { query: 'Bãi biển Rạch Giá', province: 'Kiên Giang' },
      { query: 'Bãi biển Hà Tiên', province: 'Kiên Giang' }
    ];

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const { query, province } of queries) {
      console.log(`\n🔍 Searching: "${query}" (${province})`);
      
      try {
        const placesData = await serperManager.searchPlaces(query);
        
        if (!placesData.places || placesData.places.length === 0) {
          console.log(`   ⚠️  No places found`);
          continue;
        }

        for (const place of placesData.places) {
          if (!place.latitude || !place.longitude) {
            console.log(`   ⏭️  Skipped "${place.title}" - No GPS coordinates`);
            skippedCount++;
            continue;
          }

          if (!isWithinProvince(place.latitude, place.longitude, province)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside ${province} (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          // Check if already exists
          const existing = await Destination.findOne({
            name: place.title,
            'location.city': province
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} ${province}`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const destination = {
            name: place.title,
            description: `${place.title} tại ${province} - ${place.address || 'Bãi biển đẹp ở Đồng bằng sông Cửu Long'}`,
            category: 'beach',
            location: {
              city: province,
              address: place.address || province,
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: 0
          };

          try {
            await Destination.create(destination);
            savedCount++;
            console.log(`   ✅ Added "${place.title}" (beach) - ${images.length} images - Rating: ${place.rating || 'N/A'}`);
          } catch (error) {
            console.log(`   ⚠️  Error saving "${place.title}": ${error.message}`);
            errorCount++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing "${query}":`, error.message);
        errorCount++;
      }
    }

    // Count beaches by province
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🏖️  BÃI BIỂN THEO TỈNH:');
    
    for (const province of Object.keys(PROVINCE_COORDS)) {
      const count = await Destination.countDocuments({ 
        'location.city': province,
        'category': 'beach'
      });
      console.log(`   ${province}: ${count} bãi biển`);
    }
    
    const totalBeaches = await Destination.countDocuments({ category: 'beach' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 MEKONG DELTA BEACHES COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} beaches`);
    console.log(`⏭️  Skipped: ${skippedCount} places`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`🏖️  Total beaches in database: ${totalBeaches}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchMekongBeaches();
