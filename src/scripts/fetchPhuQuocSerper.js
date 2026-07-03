require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ trung tâm Phú Quốc (10.23°N, 103.97°E)
const PHU_QUOC_CENTER = { lat: 10.23, lng: 103.97 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinPhuQuoc(lat, lng) {
  const latDiff = Math.abs(lat - PHU_QUOC_CENTER.lat);
  const lngDiff = Math.abs(lng - PHU_QUOC_CENTER.lng);
  return latDiff <= RADIUS && lngDiff <= RADIUS;
}

function determineCategory(title, category) {
  const titleLower = title.toLowerCase();
  const categoryLower = category ? category.toLowerCase() : '';
  
  if (titleLower.includes('khách sạn') || titleLower.includes('hotel') || 
      titleLower.includes('resort') || titleLower.includes('homestay') || 
      categoryLower.includes('khách sạn') || categoryLower.includes('hotel')) {
    return 'hotel';
  } else if (titleLower.includes('nhà hàng') || titleLower.includes('quán ăn') || 
             titleLower.includes('restaurant') || titleLower.includes('quán') ||
             categoryLower.includes('nhà hàng') || categoryLower.includes('restaurant')) {
    return 'restaurant';
  } else if (titleLower.includes('chùa') || titleLower.includes('đền') || 
             titleLower.includes('miếu') || titleLower.includes('temple') ||
             titleLower.includes('di tích')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('biển') || titleLower.includes('đảo') ||
             titleLower.includes('island')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchPhuQuocWithSerper() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Phú Quốc data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Các khu vui chơi giải trí SIÊU NỔI TIẾNG
      'Grand World Phú Quốc',
      'Vinpearl Safari Phú Quốc',
      'Aquatopia Water Park Phú Quốc',
      
      // Bãi biển đẹp nhất
      'Bãi Gành Dầu Phú Quốc',
      'Bãi Rạch Vẹm Phú Quốc',
      
      // Điểm tham quan văn hóa quan trọng
      'Nhà tù Phú Quốc',
      'Nhà thùng nước mắm Phú Quốc',
      'Đền Nguyễn Trung Trực Phú Quốc',
      
      // Thiên nhiên
      'Suối Đá Bàn Phú Quốc',
      
      // Các đảo nhỏ đẹp
      'Hòn Móng Tay Phú Quốc',
      'Hòn Gầm Ghì Phú Quốc',
      
      // Resort 5 sao nổi tiếng
      'JW Marriott Phú Quốc',
      'InterContinental Phú Quốc',
      'La Veranda Resort Phú Quốc',
      
      // Nhà hàng nổi tiếng
      'Nhà hàng Hưng Phát Phú Quốc',
      'Nhà hàng Winston Phú Quốc',
      
      // Khu vực đặc biệt
      'Làng chài Rạch Vẹm Phú Quốc',
      'Cảng An Thới Phú Quốc'
    ];

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const query of queries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
      try {
        // Tìm kiếm địa điểm
        const placesData = await serperManager.searchPlaces(query);
        
        if (!placesData.places || placesData.places.length === 0) {
          console.log(`   ⚠️  No places found`);
          continue;
        }

        // Xử lý từng địa điểm
        for (const place of placesData.places) {
          // Validate coordinates
          if (!place.latitude || !place.longitude) {
            console.log(`   ⏭️  Skipped "${place.title}" - No GPS coordinates`);
            skippedCount++;
            continue;
          }

          // Check if within Phú Quốc boundaries
          if (!isWithinPhuQuoc(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Phú Quốc (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          // Check if already exists
          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Kiên Giang'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          // Fetch images
          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Phú Quốc`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          // Determine category
          const category = determineCategory(place.title, place.category);

          // Create destination
          const destination = {
            name: place.title,
            description: `${place.title} tại Phú Quốc - ${place.address || ''}`,
            category: category,
            location: {
              city: 'Kiên Giang',
              address: place.address || 'Phú Quốc, Kiên Giang',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 800000 : category === 'restaurant' ? 150000 : 0
          };

          // Save to database
          try {
            await Destination.create(destination);
            savedCount++;
            console.log(`   ✅ Added "${place.title}" (${category}) - ${images.length} images - Rating: ${place.rating || 'N/A'}`);
          } catch (error) {
            console.log(`   ⚠️  Error saving "${place.title}": ${error.message}`);
            errorCount++;
          }
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing "${query}":`, error.message);
        errorCount++;
      }
    }

    // Final summary
    const totalPhuQuoc = await Destination.countDocuments({ 
      'location.city': 'Kiên Giang',
      'location.coordinates.lat': { $gte: PHU_QUOC_CENTER.lat - RADIUS, $lte: PHU_QUOC_CENTER.lat + RADIUS },
      'location.coordinates.lng': { $gte: PHU_QUOC_CENTER.lng - RADIUS, $lte: PHU_QUOC_CENTER.lng + RADIUS }
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 PHÚ QUỐC DATA COLLECTION WITH SERPER.DEV COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`🏝️  Total Phú Quốc destinations in database: ${totalPhuQuoc}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchPhuQuocWithSerper();
