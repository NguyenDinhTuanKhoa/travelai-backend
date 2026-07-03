require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ CHẶT CHẼ các tỉnh ven biển
const PROVINCE_COORDS = {
  'Bạc Liêu': { minLat: 9.0, maxLat: 9.6, minLng: 105.3, maxLng: 106.0 },
  'Sóc Trăng': { minLat: 9.3, maxLat: 9.9, minLng: 105.6, maxLng: 106.3 },
  'Trà Vinh': { minLat: 9.6, maxLat: 10.2, minLng: 105.9, maxLng: 106.6 },
  'Bến Tre': { minLat: 9.9, maxLat: 10.5, minLng: 105.9, maxLng: 106.7 },
  'Cà Mau': { minLat: 8.6, maxLat: 9.5, minLng: 104.6, maxLng: 105.5 },
  'Kiên Giang': { minLat: 9.0, maxLat: 10.6, minLng: 103.5, maxLng: 105.5 }
};

function isWithinProvince(lat, lng, province) {
  const bounds = PROVINCE_COORDS[province];
  if (!bounds) return false;
  
  return lat >= bounds.minLat && 
         lat <= bounds.maxLat &&
         lng >= bounds.minLng && 
         lng <= bounds.maxLng;
}

async function fetchMekongBeachesV2() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Mekong Delta beaches V2 collection...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bạc Liêu - Bãi biển thực tế
      { query: 'Bãi biển Gành Hào Đông Hải Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Bãi biển Vĩnh Trạch Rạch Gốc Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Bãi biển Nhà Mát Bạc Liêu', province: 'Bạc Liêu' },
      { query: 'Bãi biển Gành Hào', province: 'Bạc Liêu' },
      
      // Sóc Trăng - Bãi biển thực tế
      { query: 'Bãi biển Mỹ Thanh Mỹ Xuyên Sóc Trăng', province: 'Sóc Trăng' },
      { query: 'Bãi biển Trần Đề Sóc Trăng', province: 'Sóc Trăng' },
      { query: 'Bãi biển Mỏ Ó Sóc Trăng', province: 'Sóc Trăng' },
      
      // Trà Vinh - Bãi biển thực tế
      { query: 'Bãi biển Ba Động Duyên Hải Trà Vinh', province: 'Trà Vinh' },
      { query: 'Bãi biển Long Toàn Duyên Hải Trà Vinh', province: 'Trà Vinh' },
      { query: 'Bãi biển Cồn Chim Trà Vinh', province: 'Trà Vinh' },
      
      // Bến Tre - Bãi biển và cồn
      { query: 'Bãi biển Bình Đại Bến Tre', province: 'Bến Tre' },
      { query: 'Bãi biển Ba Tri Bến Tre', province: 'Bến Tre' },
      { query: 'Bãi biển Thạnh Phú Bến Tre', province: 'Bến Tre' },
      { query: 'Cồn Nhàn Bến Tre', province: 'Bến Tre' },
      
      // Cà Mau - Bãi biển Đất Mũi
      { query: 'Bãi biển Đất Mũi Cà Mau', province: 'Cà Mau' },
      { query: 'Bãi biển Khai Long Năm Căn Cà Mau', province: 'Cà Mau' },
      { query: 'Bãi biển Tân Ân Đầm Dơi Cà Mau', province: 'Cà Mau' },
      { query: 'Bãi bồi Đất Mũi', province: 'Cà Mau' },
      
      // Kiên Giang - Bãi biển đất liền (không phải Phú Quốc)
      { query: 'Bãi biển Hòn Sơn Kiên Lương Kiên Giang', province: 'Kiên Giang' },
      { query: 'Bãi biển Hòn Tre Kiên Giang', province: 'Kiên Giang' },
      { query: 'Bãi biển Rạch Vẹm Phú Quốc', province: 'Kiên Giang' },
      { query: 'Bãi biển Hà Tiên Kiên Giang', province: 'Kiên Giang' },
      { query: 'Bãi Dương Rạch Giá', province: 'Kiên Giang' }
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

          // Kiểm tra tọa độ CHẶT CHẼ
          if (!isWithinProvince(place.latitude, place.longitude, province)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside ${province} bounds (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
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
          const images = await serperManager.searchImages(`${place.title} ${province} bãi biển`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const destination = {
            name: place.title,
            description: `${place.title} - Bãi biển đẹp tại ${province}, Đồng bằng sông Cửu Long. ${place.address || ''}`,
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
            console.log(`   ✅ Added "${place.title}" (beach) - ${images.length} images - GPS: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`);
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
    console.log('🎉 MEKONG DELTA BEACHES V2 COMPLETED!');
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

fetchMekongBeachesV2();
