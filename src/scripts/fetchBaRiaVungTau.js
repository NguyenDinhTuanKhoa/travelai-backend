require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Bà Rịa - Vũng Tàu';

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
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('bãi tắm') || titleLower.includes('bãi sau') ||
             titleLower.includes('bãi trước') || titleLower.includes('bãi dứa')) {
    return 'beach';
  } else if (titleLower.includes('chùa') || titleLower.includes('đền') || 
             titleLower.includes('miếu') || titleLower.includes('temple') ||
             titleLower.includes('di tích') || titleLower.includes('tượng')) {
    return 'historical';
  } else if (titleLower.includes('núi') || titleLower.includes('mountain') ||
             titleLower.includes('hải đăng') || titleLower.includes('lighthouse')) {
    return 'attraction';
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

async function fetchBaRiaVungTau() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Bà Rịa - Vũng Tàu data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bãi biển nổi tiếng
      'Bãi Sau Vũng Tàu',
      'Bãi Trước Vũng Tàu',
      'Bãi Dứa Vũng Tàu',
      'Bãi Dài Vũng Tàu',
      'Bãi Hồ Cốc Vũng Tàu',
      'Bãi Hồ Tràm Vũng Tàu',
      'Bãi Long Hải Vũng Tàu',
      
      // Điểm du lịch nổi tiếng
      'Tượng Chúa Kitô Vũng Tàu',
      'Ngọn Hải Đăng Vũng Tàu',
      'Bạch Dinh Vũng Tàu',
      'Dinh Thắng Tam Vũng Tàu',
      'Núi Nhỏ Vũng Tàu',
      'Núi Lớn Vũng Tàu',
      'Mũi Nghinh Phong Vũng Tàu',
      
      // Chùa và di tích
      'Chùa Thích Ca Phật Đài',
      'Chùa Hang Vũng Tàu',
      'Đền Thắng Tam Vũng Tàu',
      'Lăng Ông Nam Hải',
      
      // Khu vui chơi
      'Hồ Mây Park Vũng Tàu',
      'Khu du lịch Hồ Cốc',
      'Khu du lịch Hồ Tràm',
      'The Grand Hồ Tràm Strip',
      
      // Khách sạn và resort
      'Khách sạn Vũng Tàu',
      'Resort Vũng Tàu',
      'Khách sạn Hồ Tràm',
      'Resort Hồ Cốc',
      
      // Nhà hàng và ẩm thực
      'Nhà hàng hải sản Vũng Tàu',
      'Quán ăn Vũng Tàu',
      'Cafe Vũng Tàu',
      'Bánh khọt Vũng Tàu',
      
      // Bà Rịa
      'Khu du lịch Bà Rịa',
      'Khách sạn Bà Rịa',
      'Nhà hàng Bà Rịa'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside BRVT (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Vũng Tàu`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Bà Rịa - Vũng Tàu - ${place.address || 'Đông Nam Bộ'}`,
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
            price: category === 'hotel' ? 800000 : category === 'restaurant' ? 150000 : 0
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

    const totalBRVT = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 BÀ RỊA - VŨNG TÀU DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Bà Rịa - Vũng Tàu destinations in database: ${totalBRVT}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchBaRiaVungTau();
