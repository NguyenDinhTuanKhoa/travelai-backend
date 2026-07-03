require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Đà Nẵng';

function determineCategory(title, category) {
  const titleLower = title.toLowerCase();
  const categoryLower = category ? category.toLowerCase() : '';
  
  if (titleLower.includes('khách sạn') || titleLower.includes('hotel') || 
      titleLower.includes('resort') || titleLower.includes('homestay') || 
      categoryLower.includes('khách sạn') || categoryLower.includes('hotel')) {
    return 'hotel';
  } else if (titleLower.includes('nhà hàng') || titleLower.includes('quán ăn') || 
             titleLower.includes('restaurant') || titleLower.includes('quán') ||
             titleLower.includes('cafe') || titleLower.includes('cà phê') ||
             categoryLower.includes('nhà hàng') || categoryLower.includes('restaurant')) {
    return 'restaurant';
  } else if (titleLower.includes('chùa') || titleLower.includes('đền') || 
             titleLower.includes('miếu') || titleLower.includes('temple') ||
             titleLower.includes('di tích') || titleLower.includes('tháp') ||
             titleLower.includes('dinh') || titleLower.includes('bảo tàng') ||
             titleLower.includes('museum')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('bãi tắm') || titleLower.includes('biển')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('thác') ||
             titleLower.includes('đảo') || titleLower.includes('hòn') ||
             titleLower.includes('núi') || titleLower.includes('rừng') ||
             titleLower.includes('bà nà')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchDaNang() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Đà Nẵng data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bà Nà Hills
      'Bà Nà Hills',
      'Cầu Vàng Bà Nà',
      'Golden Bridge Đà Nẵng',
      'Cáp treo Bà Nà',
      'Làng Pháp Bà Nà',
      'Vườn hoa Le Jardin Bà Nà',
      
      // Bãi biển
      'Bãi biển Mỹ Khê',
      'Bãi biển Non Nước',
      'Bãi biển Phạm Văn Đồng',
      'Bãi biển Thanh Bình',
      
      // Bán đảo Sơn Trà
      'Bán đảo Sơn Trà',
      'Chùa Linh Ứng Sơn Trà',
      'Đỉnh Bàn Cờ Sơn Trà',
      'Bãi Bụt Sơn Trà',
      
      // Cầu và địa danh
      'Cầu Rồng Đà Nẵng',
      'Cầu Tình Yêu Đà Nẵng',
      'Cầu Trần Thị Lý',
      'Cầu Thuận Phước',
      
      // Bảo tàng và di tích
      'Bảo tàng Điêu khắc Chăm',
      'Bảo tàng Đà Nẵng',
      'Ngũ Hành Sơn',
      'Chùa Tam Thai Ngũ Hành Sơn',
      'Chùa Linh Ứng Ngũ Hành Sơn',
      
      // Công viên
      'Công viên Châu Á',
      'Công viên 29/3',
      'Công viên Biển Đông',
      
      // Khách sạn resort
      'Khách sạn Đà Nẵng',
      'Resort Đà Nẵng',
      'Hotel Đà Nẵng',
      
      // Nhà hàng hải sản
      'Nhà hàng hải sản Đà Nẵng',
      'Quán ăn Đà Nẵng',
      'Bún chả cá Đà Nẵng',
      'Mì Quảng Đà Nẵng',
      'Bánh tráng cuốn thịt heo Đà Nẵng',
      
      // Cafe
      'Cafe Đà Nẵng',
      'Cafe view biển Đà Nẵng',
      'Cà phê Đà Nẵng',
      
      // Chợ
      'Chợ Hàn Đà Nẵng',
      'Chợ Cồn Đà Nẵng'
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

          if (!isWithinProvince(place.latitude, place.longitude, PROVINCE_NAME)) {
            const closest = getClosestProvince(place.latitude, place.longitude);
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Đà Nẵng (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
            skippedCount++;
            continue;
          }

          const existing = await Destination.findOne({
            name: place.title,
            'location.city': PROVINCE_NAME
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Đà Nẵng`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Đà Nẵng - ${place.address || 'Duyên hải Nam Trung Bộ'}`,
            category: category,
            location: {
              city: PROVINCE_NAME,
              address: place.address || PROVINCE_NAME,
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 1500000 : category === 'restaurant' ? 150000 : 0
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

    const totalDaNang = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 ĐÀ NẴNG DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Đà Nẵng destinations in database: ${totalDaNang}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchDaNang();
