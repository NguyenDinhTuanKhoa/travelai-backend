require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Quảng Ngãi';

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
             titleLower.includes('dinh')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('bãi tắm') || titleLower.includes('biển')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('thác') ||
             titleLower.includes('đảo') || titleLower.includes('hòn') ||
             titleLower.includes('núi') || titleLower.includes('đèo')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchQuangNgai() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Quảng Ngãi data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Đảo Lý Sơn
      'Đảo Lý Sơn Quảng Ngãi',
      'Cổng Tò Vò Lý Sơn',
      'Hang Câu Lý Sơn',
      'Thới Lới Lý Sơn',
      'Núi Thới Lới',
      'Chùa Hang Lý Sơn',
      'Bãi Đá Nhảy Lý Sơn',
      'Bãi Mũi Yến Lý Sơn',
      
      // Bãi biển
      'Bãi biển Mỹ Khê Quảng Ngãi',
      'Bãi Biển Sa Huỳnh',
      'Bãi Xép Quảng Ngãi',
      
      // Di tích lịch sử
      'Sơn Mỹ Quảng Ngãi',
      'Di tích Sơn Mỹ',
      'Bảo tàng Sơn Mỹ',
      
      // Núi và thác
      'Núi Thiên Ấn Quảng Ngãi',
      'Thác Đá Bia Quảng Ngãi',
      
      // Khách sạn resort
      'Khách sạn Quảng Ngãi',
      'Resort Quảng Ngãi',
      'Hotel Quảng Ngãi',
      'Khách sạn Lý Sơn',
      
      // Nhà hàng đặc sản
      'Nhà hàng Quảng Ngãi',
      'Quán ăn Quảng Ngãi',
      'Hải sản Quảng Ngãi',
      'Bánh xèo Quảng Ngãi',
      'Mì Quảng Quảng Ngãi',
      'Tỏi Lý Sơn',
      
      // Cafe
      'Cafe Quảng Ngãi',
      'Cà phê Quảng Ngãi',
      
      // Chợ
      'Chợ Quảng Ngãi',
      'Chợ Đầm Quảng Ngãi'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Quảng Ngãi (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Quảng Ngãi`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Quảng Ngãi - ${place.address || 'Duyên hải Nam Trung Bộ'}`,
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
            price: category === 'hotel' ? 1000000 : category === 'restaurant' ? 120000 : 0
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

    const totalQuangNgai = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 QUẢNG NGÃI DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Quảng Ngãi destinations in database: ${totalQuangNgai}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchQuangNgai();
