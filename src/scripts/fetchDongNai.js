require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Đồng Nai';

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
             titleLower.includes('di tích') || titleLower.includes('đình')) {
    return 'historical';
  } else if (titleLower.includes('núi') || titleLower.includes('mountain') ||
             titleLower.includes('thác') || titleLower.includes('hồ')) {
    return 'attraction';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('rừng') ||
             titleLower.includes('khu sinh thái')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchDongNai() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Đồng Nai data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Khu du lịch nổi tiếng
      'Khu du lịch Giang Điền Đồng Nai',
      'Khu du lịch Bửu Long Đồng Nai',
      'Khu du lịch Trị An Đồng Nai',
      'Hồ Trị An Đồng Nai',
      'Thác Giang Điền',
      
      // Khu sinh thái
      'Khu sinh thái Đồng Nai',
      'Vườn Quốc gia Cát Tiên',
      'Khu du lịch sinh thái Bửu Long',
      'Suối Mơ Đồng Nai',
      
      // Chùa và di tích
      'Chùa Bửu Long Đồng Nai',
      'Chùa Bửu Phong',
      'Đình Tân Hiệp',
      'Đền Ông Đồng Nai',
      
      // Biên Hòa
      'Khách sạn Biên Hòa',
      'Nhà hàng Biên Hòa',
      'Cafe Biên Hòa',
      'Chợ Biên Hòa',
      'Trung tâm Biên Hòa',
      
      // Long Thành
      'Khu du lịch Long Thành',
      'Khách sạn Long Thành',
      
      // Ẩm thực
      'Quán ăn Đồng Nai',
      'Bánh tráng phơi sương Đồng Nai',
      'Nem nướng Đồng Nai'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Đồng Nai (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Đồng Nai`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Đồng Nai - ${place.address || 'Đông Nam Bộ'}`,
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
            price: category === 'hotel' ? 600000 : category === 'restaurant' ? 100000 : 0
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

    const totalDongNai = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 ĐỒNG NAI DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Đồng Nai destinations in database: ${totalDongNai}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchDongNai();
