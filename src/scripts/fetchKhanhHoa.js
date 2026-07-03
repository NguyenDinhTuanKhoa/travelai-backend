require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Khánh Hòa';

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
             titleLower.includes('tháp') || titleLower.includes('dinh')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('bãi tắm') || titleLower.includes('biển')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('thác') ||
             titleLower.includes('đảo') || titleLower.includes('hòn')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchKhanhHoa() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Khánh Hòa (Nha Trang) data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bãi biển nổi tiếng
      'Bãi biển Nha Trang',
      'Bãi Dài Nha Trang',
      'Bãi Trần Phú Nha Trang',
      'Bãi Dốc Lết Nha Trang',
      'Bãi Bãi Tiên Nha Trang',
      'Bãi Ninh Vân Nha Trang',
      
      // Đảo và hòn
      'Hòn Mun Nha Trang',
      'Hòn Tằm Nha Trang',
      'Hòn Tre Nha Trang',
      'Hòn Miễu Nha Trang',
      'Hòn Một Nha Trang',
      'Đảo Khỉ Nha Trang',
      
      // Khu du lịch
      'VinWonders Nha Trang',
      'Vinpearl Land Nha Trang',
      'Vinpearl Safari Nha Trang',
      'Thủy cung Trí Nguyên',
      'Công viên Biển Nha Trang',
      'Tháp Bà Ponagar',
      'Chùa Long Sơn Nha Trang',
      
      // Suối và thác
      'Suối Đổ Nha Trang',
      'Suối Tiên Cam Lâm',
      'Thác Yangbay Khánh Hòa',
      'Suối Hoa Lan Nha Trang',
      
      // Làng và vườn
      'Làng chài Vĩnh Lương',
      'Làng Yến Nha Trang',
      'Vườn nho Ninh Thuận',
      
      // Khách sạn cao cấp
      'Khách sạn Nha Trang',
      'Resort Nha Trang',
      'Hotel Nha Trang',
      'Vinpearl Resort Nha Trang',
      'InterContinental Nha Trang',
      'Sheraton Nha Trang',
      'Mia Resort Nha Trang',
      
      // Nhà hàng hải sản
      'Nhà hàng hải sản Nha Trang',
      'Quán ăn Nha Trang',
      'Hải sản tươi sống Nha Trang',
      'Nhà hàng Nha Trang',
      'Quán bánh canh Nha Trang',
      'Bún chả cá Nha Trang',
      
      // Cafe view đẹp
      'Cafe Nha Trang',
      'Cafe view biển Nha Trang',
      'Cà phê Nha Trang',
      
      // Chợ và trung tâm
      'Chợ Đầm Nha Trang',
      'Chợ Xóm Mới Nha Trang',
      'Vincom Plaza Nha Trang',
      'Lotte Mart Nha Trang'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Khánh Hòa (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Nha Trang`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Khánh Hòa - ${place.address || 'Duyên hải Nam Trung Bộ'}`,
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
            price: category === 'hotel' ? 1500000 : category === 'restaurant' ? 200000 : 0
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

    const totalKhanhHoa = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 KHÁNH HÒA (NHA TRANG) DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Khánh Hòa destinations in database: ${totalKhanhHoa}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchKhanhHoa();
