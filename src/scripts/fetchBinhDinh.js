require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Bình Định';

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

async function fetchBinhDinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Bình Định (Quy Nhơn) data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bãi biển nổi tiếng
      'Bãi biển Quy Nhơn',
      'Bãi Xép Quy Nhơn',
      'Bãi Kỳ Co Quy Nhơn',
      'Bãi Hoàng Hậu Quy Nhơn',
      'Bãi Trứng Quy Nhơn',
      'Bãi Rạng Quy Nhơn',
      'Bãi Tràm Quy Nhơn',
      
      // Đảo và hòn
      'Hòn Khô Quy Nhơn',
      'Đảo Hòn Khô',
      'Eo Gió Quy Nhơn',
      
      // Tháp Chăm
      'Tháp Đôi Quy Nhơn',
      'Tháp Bánh Ít Bình Định',
      'Tháp Dương Long Bình Định',
      'Tháp Chăm Bình Định',
      
      // Chùa và đền
      'Chùa Ông Núi Bình Định',
      'Chùa Long Khánh Quy Nhơn',
      
      // Núi và đèo
      'Núi Vũng Chua',
      'Đèo Cù Mông Bình Định',
      
      // Khách sạn resort
      'Khách sạn Quy Nhơn',
      'Resort Quy Nhơn',
      'Hotel Quy Nhơn',
      'Khách sạn Bình Định',
      'FLC Quy Nhơn',
      'Avani Quy Nhơn',
      
      // Nhà hàng đặc sản
      'Nhà hàng Quy Nhơn',
      'Quán ăn Quy Nhơn',
      'Hải sản Quy Nhơn',
      'Nhà hàng hải sản Quy Nhơn',
      'Bánh xèo tôm nhảy Quy Nhơn',
      'Bánh ít lá gai Bình Định',
      'Bún chả cá Quy Nhơn',
      'Nem chợ Huyện Bình Định',
      
      // Cafe
      'Cafe Quy Nhơn',
      'Cafe view biển Quy Nhơn',
      'Cà phê Quy Nhơn',
      
      // Chợ và trung tâm
      'Chợ Quy Nhơn',
      'Chợ Đầm Bình Định',
      'Vincom Quy Nhơn'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Bình Định (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Quy Nhơn`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Bình Định - ${place.address || 'Duyên hải Nam Trung Bộ'}`,
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
            price: category === 'hotel' ? 1200000 : category === 'restaurant' ? 150000 : 0
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

    const totalBinhDinh = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 BÌNH ĐỊNH (QUY NHƠN) DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Bình Định destinations in database: ${totalBinhDinh}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchBinhDinh();
