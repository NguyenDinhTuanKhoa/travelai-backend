require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ trung tâm Tiền Giang (10.42°N, 106.17°E)
const TIEN_GIANG_CENTER = { lat: 10.42, lng: 106.17 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinTienGiang(lat, lng) {
  const latDiff = Math.abs(lat - TIEN_GIANG_CENTER.lat);
  const lngDiff = Math.abs(lng - TIEN_GIANG_CENTER.lng);
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
             titleLower.includes('di tích') || titleLower.includes('tháp')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('biển') || titleLower.includes('đảo') ||
             titleLower.includes('island') || titleLower.includes('cồn')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('rừng')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchTienGiang() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Tiền Giang data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Mỹ Tho - Thành phố chính
      'Khách sạn Mỹ Tho',
      'Nhà hàng Mỹ Tho',
      'Chợ Mỹ Tho',
      'Chùa Vĩnh Tràng Mỹ Tho',
      
      // Các cồn nổi tiếng
      'Cồn Thới Sơn Mỹ Tho',
      'Cồn Phụng Mỹ Tho',
      'Cồn Tân Phong Mỹ Tho',
      'Cồn Lân Mỹ Tho',
      
      // Gò Công
      'Du lịch Gò Công Tiền Giang',
      'Biển Gò Công',
      'Khách sạn Gò Công',
      
      // Cai Lậy
      'Du lịch Cai Lậy Tiền Giang',
      'Chùa Cai Lậy',
      
      // Vườn trái cây
      'Vườn trái cây Tiền Giang',
      
      // Ẩm thực
      'Quán ăn Tiền Giang',
      'Hủ tiếu Mỹ Tho',
      'Bánh tráng Tiền Giang'
    ];

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const query of queries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
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

          if (!isWithinTienGiang(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Tiền Giang (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Tiền Giang'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Tiền Giang`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Tiền Giang - ${place.address || ''}`,
            category: category,
            location: {
              city: 'Tiền Giang',
              address: place.address || 'Tiền Giang',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 400000 : category === 'restaurant' ? 80000 : 0
          };

          try {
            await Destination.create(destination);
            savedCount++;
            console.log(`   ✅ Added "${place.title}" (${category}) - ${images.length} images - Rating: ${place.rating || 'N/A'}`);
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

    const totalTienGiang = await Destination.countDocuments({ 'location.city': 'Tiền Giang' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 TIỀN GIANG DATA COLLECTION WITH SERPER.DEV COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Tiền Giang destinations in database: ${totalTienGiang}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchTienGiang();
