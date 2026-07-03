require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Đắk Lắk';

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
             titleLower.includes('hồ') || titleLower.includes('buôn')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchDakLak() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Đắk Lắk (Buôn Ma Thuột) data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Thác nước
      'Thác Dray Nur',
      'Thác Dray Sap',
      'Thác Gia Long',
      'Thác Trinh Nữ',
      
      // Hồ
      'Hồ Lắk',
      'Hồ Ea Kao',
      'Hồ Ea Súp',
      
      // Làng buôn
      'Buôn Đôn',
      'Buôn Triết',
      'Buôn Jun',
      'Làng cà phê',
      
      // Vườn quốc gia
      'Vườn Quốc gia Yok Đôn',
      
      // Bảo tàng
      'Bảo tàng Đắk Lắk',
      'Bảo tàng Thế giới Cà phê',
      'Bảo tàng Khánh Hòa',
      
      // Nhà thờ và chùa
      'Nhà thờ Gỗ Kon Tum',
      'Chùa Khải Đoan',
      
      // Trang trại cà phê
      'Trang trại cà phê Buôn Ma Thuột',
      'Vườn cà phê Trung Nguyên',
      'Cà phê Mê Trang',
      
      // Khách sạn resort
      'Khách sạn Buôn Ma Thuột',
      'Resort Buôn Ma Thuột',
      'Hotel Buôn Ma Thuột',
      
      // Nhà hàng đặc sản
      'Nhà hàng Buôn Ma Thuột',
      'Quán ăn Buôn Ma Thuột',
      'Cơm lam Đắk Lắk',
      'Gà nướng Đắk Lắk',
      
      // Cafe
      'Cafe Buôn Ma Thuột',
      'Cà phê Buôn Ma Thuột',
      'Trung Nguyên Legend Cafe',
      
      // Chợ
      'Chợ Buôn Ma Thuột',
      'Chợ Ea Kao'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Đắk Lắk (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Đắk Lắk`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Đắk Lắk - ${place.address || 'Tây Nguyên'}`,
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

    const totalDakLak = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 ĐẮK LẮK (BUÔN MA THUỘT) DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Đắk Lắk destinations in database: ${totalDakLak}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchDakLak();
