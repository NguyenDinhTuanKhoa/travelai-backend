require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ trung tâm An Giang (10.52°N, 105.13°E)
const AN_GIANG_CENTER = { lat: 10.52, lng: 105.13 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinAnGiang(lat, lng) {
  const latDiff = Math.abs(lat - AN_GIANG_CENTER.lat);
  const lngDiff = Math.abs(lng - AN_GIANG_CENTER.lng);
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

async function fetchAnGiang() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting An Giang data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Long Xuyên - Thành phố chính
      'Khách sạn Long Xuyên',
      'Nhà hàng Long Xuyên',
      'Chợ Long Xuyên',
      'Nhà thờ Long Xuyên',
      'Công viên Long Xuyên',
      
      // Châu Đốc - Thành phố du lịch
      'Núi Sam Châu Đốc',
      'Chùa Châu Đốc',
      'Miếu Bà Chúa Xứ',
      'Tây An Cổ Tự Châu Đốc',
      'Chợ nổi Châu Đốc',
      'Khách sạn Châu Đốc',
      'Nhà hàng Châu Đốc',
      'Làng nổi Châu Đốc',
      
      // Núi Cấm - Tịnh Biên
      'Núi Cấm An Giang',
      'Chùa Núi Cấm',
      'Tháp Tây An',
      'Chùa Phước Điền',
      
      // Núi Tô - Tri Tôn
      'Núi Tô An Giang',
      'Chùa Núi Tô',
      
      // Rừng tràm Trà Sư
      'Rừng tràm Trà Sư',
      'Du lịch sinh thái Trà Sư',
      
      // Các điểm du lịch khác
      'Bảo tàng An Giang',
      'Chợ Châu Đốc',
      'Chợ Tịnh Biên',
      'Vườn trái cây An Giang',
      'Homestay An Giang',
      'Resort An Giang',
      
      // Ẩm thực
      'Quán ăn An Giang',
      'Bánh xèo An Giang',
      'Lẩu mắm An Giang',
      'Cơm tấm An Giang'
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

          // Check if within An Giang boundaries
          if (!isWithinAnGiang(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside An Giang (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          // Check if already exists
          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'An Giang'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          // Fetch images
          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} An Giang`, 3);

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
            description: `${place.title} tại An Giang - ${place.address || ''}`,
            category: category,
            location: {
              city: 'An Giang',
              address: place.address || 'An Giang',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 500000 : category === 'restaurant' ? 100000 : 0
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
    const totalAnGiang = await Destination.countDocuments({ 'location.city': 'An Giang' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 AN GIANG DATA COLLECTION WITH SERPER.DEV COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total An Giang destinations in database: ${totalAnGiang}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchAnGiang();
