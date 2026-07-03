require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Lâm Đồng';

function determineCategory(title, category) {
  const titleLower = title.toLowerCase();
  const categoryLower = category ? category.toLowerCase() : '';
  
  if (titleLower.includes('khách sạn') || titleLower.includes('hotel') || 
      titleLower.includes('resort') || titleLower.includes('homestay') || 
      titleLower.includes('villa') ||
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
             titleLower.includes('museum') || titleLower.includes('lăng')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('bãi tắm') || titleLower.includes('biển')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('thác') ||
             titleLower.includes('đảo') || titleLower.includes('hòn') ||
             titleLower.includes('núi') || titleLower.includes('rừng') ||
             titleLower.includes('hồ') || titleLower.includes('đồi') ||
             titleLower.includes('thung lũng') || titleLower.includes('đèo')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchLamDong() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Lâm Đồng (Đà Lạt) data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Hồ và thác nước
      'Hồ Xuân Hương Đà Lạt',
      'Hồ Tuyền Lâm',
      'Thác Datanla',
      'Thác Pongour',
      'Thác Prenn',
      'Thác Cam Ly',
      'Thác Voi',
      'Thác Liên Khương',
      
      // Đồi và thung lũng
      'Đồi Mộng Mơ',
      'Đồi chè Cầu Đất',
      'Thung lũng Tình Yêu',
      'Thung lũng Vàng',
      'Đồi Robin',
      'Đồi Thiên Phúc Đức',
      
      // Vườn hoa
      'Vườn hoa Đà Lạt',
      'Vườn hoa thành phố',
      'Vườn hoa Hồ Xuân Hương',
      
      // Chùa và nhà thờ
      'Nhà thờ Con Gà',
      'Nhà thờ Domain de Marie',
      'Chùa Linh Phước',
      'Thiền viện Trúc Lâm',
      
      // Điểm tham quan
      'Ga Đà Lạt',
      'Dinh Bảo Đại',
      'Crazy House',
      'Quảng trường Lâm Viên',
      'Chợ Đà Lạt',
      'Chợ đêm Đà Lạt',
      
      // Làng và trang trại
      'Làng Cù Lần',
      'Làng Lát',
      'Trang trại rau Đà Lạt',
      'Vườn dâu Đà Lạt',
      
      // Bảo Lộc
      'Thác Dambri Bảo Lộc',
      'Thác Đạ Thiên',
      'Hồ Bảo Lộc',
      'Vườn chè Bảo Lộc',
      
      // Khách sạn resort
      'Khách sạn Đà Lạt',
      'Resort Đà Lạt',
      'Hotel Đà Lạt',
      'Villa Đà Lạt',
      
      // Nhà hàng đặc sản
      'Nhà hàng Đà Lạt',
      'Quán ăn Đà Lạt',
      'Lẩu Đà Lạt',
      'Bánh tráng nướng Đà Lạt',
      'Bánh mì xíu mại Đà Lạt',
      'Nem nướng Đà Lạt',
      
      // Cafe
      'Cafe Đà Lạt',
      'Cafe view đẹp Đà Lạt',
      'Cà phê Đà Lạt'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Lâm Đồng (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Đà Lạt`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Lâm Đồng - ${place.address || 'Tây Nguyên'}`,
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

    const totalLamDong = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 LÂM ĐỒNG (ĐÀ LẠT) DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Lâm Đồng destinations in database: ${totalLamDong}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchLamDong();
