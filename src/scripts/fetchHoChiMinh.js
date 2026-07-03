require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'TP. Hồ Chí Minh';

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
             titleLower.includes('di tích') || titleLower.includes('nhà thờ') ||
             titleLower.includes('dinh') || titleLower.includes('bảo tàng')) {
    return 'historical';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('rừng') ||
             titleLower.includes('khu sinh thái')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom') ||
             titleLower.includes('landmark') || titleLower.includes('bitexco')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchHoChiMinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting TP. Hồ Chí Minh data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Địa điểm du lịch nổi tiếng
      'Nhà Thờ Đức Bà Sài Gòn',
      'Bưu Điện Trung Tâm Sài Gòn',
      'Dinh Độc Lập',
      'Bảo tàng Chứng tích Chiến tranh',
      'Bảo tàng Thành phố Hồ Chí Minh',
      'Chợ Bến Thành',
      'Phố đi bộ Nguyễn Huệ',
      'Bitexco Financial Tower',
      'Landmark 81',
      'Công viên Tao Đàn',
      'Công viên 23/9',
      
      // Chùa và đền
      'Chùa Vĩnh Nghiêm',
      'Chùa Giác Lâm',
      'Chùa Xá Lợi',
      'Chùa Bà Thiên Hậu',
      'Đền Hùng Vương Sài Gòn',
      
      // Địa đạo Củ Chi
      'Địa đạo Củ Chi',
      'Khu du lịch Địa đạo Củ Chi',
      
      // Khu vui chơi giải trí
      'Thảo Cầm Viên Sài Gòn',
      'Đầm Sen',
      'Suối Tiên',
      'Khu du lịch Cần Giờ',
      'Rừng Sác Cần Giờ',
      
      // Khách sạn cao cấp
      'Khách sạn Sài Gòn',
      'Hotel Saigon',
      'Resort Sài Gòn',
      'Khách sạn Quận 1',
      'Khách sạn Phú Nhuận',
      
      // Nhà hàng nổi tiếng
      'Nhà hàng Sài Gòn',
      'Quán ăn Sài Gòn',
      'Cafe Sài Gòn',
      'Nhà hàng Quận 1',
      'Quán ăn Quận 3',
      
      // Ẩm thực đặc trưng
      'Bánh mì Sài Gòn',
      'Phở Sài Gòn',
      'Cơm tấm Sài Gòn',
      'Hủ tiếu Sài Gòn',
      'Bún bò Huế Sài Gòn',
      
      // Chợ và trung tâm thương mại
      'Chợ Bình Tây',
      'Chợ An Đông',
      'Vincom Center Sài Gòn',
      'Saigon Centre',
      'Takashimaya Sài Gòn'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside HCMC (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Sài Gòn`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại TP. Hồ Chí Minh - ${place.address || 'Đông Nam Bộ'}`,
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
            price: category === 'hotel' ? 1000000 : category === 'restaurant' ? 150000 : 0
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

    const totalHCMC = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 TP. HỒ CHÍ MINH DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total TP. Hồ Chí Minh destinations in database: ${totalHCMC}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchHoChiMinh();
