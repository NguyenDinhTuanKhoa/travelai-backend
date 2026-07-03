require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ trung tâm Long An (10.56°N, 106.65°E)
const LONG_AN_CENTER = { lat: 10.56, lng: 106.65 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinLongAn(lat, lng) {
  const latDiff = Math.abs(lat - LONG_AN_CENTER.lat);
  const lngDiff = Math.abs(lng - LONG_AN_CENTER.lng);
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
             titleLower.includes('island')) {
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

async function fetchLongAn() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Long An data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Tân An - Thành phố chính
      'Khách sạn Tân An Long An',
      'Nhà hàng Tân An Long An',
      'Chợ Tân An',
      
      // Các điểm du lịch nổi tiếng
      'Khu du lịch Đồng Tháp Mười Long An',
      'Vườn trái cây Long An',
      'Chùa Long An',
      'Đình Long An',
      
      // Đức Hòa
      'Du lịch Đức Hòa Long An',
      'Nhà hàng Đức Hòa',
      
      // Cần Giuộc
      'Du lịch Cần Giuộc Long An',
      
      // Ẩm thực
      'Quán ăn Long An',
      'Bánh tráng Long An',
      'Cơm tấm Long An'
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

          if (!isWithinLongAn(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Long An (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Long An'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Long An`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Long An - ${place.address || ''}`,
            category: category,
            location: {
              city: 'Long An',
              address: place.address || 'Long An',
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

    const totalLongAn = await Destination.countDocuments({ 'location.city': 'Long An' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 LONG AN DATA COLLECTION WITH SERPER.DEV COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Long An destinations in database: ${totalLongAn}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchLongAn();
