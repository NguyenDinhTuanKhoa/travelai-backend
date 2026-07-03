require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince, getClosestProvince } = require('../utils/gpsValidator');

const PROVINCE_NAME = 'Ninh Thuận';

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
             titleLower.includes('suối') || titleLower.includes('đồi') ||
             titleLower.includes('núi') || titleLower.includes('nho')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm') || titleLower.includes('vincom')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchNinhThuan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Ninh Thuận data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Bãi biển
      'Bãi biển Ninh Chữ',
      'Bãi Cà Ná Ninh Thuận',
      'Bãi Sỏi Ninh Thuận',
      'Bãi Mỹ Hòa Ninh Thuận',
      'Bãi Vĩnh Hy Ninh Thuận',
      
      // Vườn nho nổi tiếng
      'Vườn nho Thái An',
      'Vườn nho Ninh Thuận',
      'Làng nho Thái An',
      'Vườn nho Phan Rang',
      'Trang trại nho Ninh Thuận',
      
      // Tháp Chăm
      'Tháp Chăm Pô Klong Garai',
      'Tháp Chăm Pô Rô Mê',
      'Tháp Chăm Hòa Lai',
      'Tháp Chăm Ninh Thuận',
      
      // Núi và đồi
      'Núi Chúa Ninh Thuận',
      'Vườn quốc gia Núi Chúa',
      'Đồi cát Nam Cương',
      'Đồi cát Phương Mai',
      
      // Vịnh và làng chài
      'Vịnh Vĩnh Hy',
      'Làng chài Vĩnh Hy',
      'Vịnh Ninh Chữ',
      'Cảng cá Phan Rang',
      
      // Khách sạn resort
      'Khách sạn Phan Rang',
      'Resort Ninh Thuận',
      'Hotel Ninh Thuận',
      'Amanoi Resort Ninh Thuận',
      'Khách sạn Ninh Chữ',
      
      // Nhà hàng đặc sản
      'Nhà hàng Phan Rang',
      'Quán ăn Ninh Thuận',
      'Bánh căn Phan Rang',
      'Bánh xèo Phan Rang',
      'Bún chả cá Phan Rang',
      'Hải sản Ninh Chữ',
      'Nhà hàng hải sản Ninh Thuận',
      
      // Cafe
      'Cafe Phan Rang',
      'Cafe view biển Ninh Thuận',
      'Cà phê Ninh Thuận',
      
      // Chợ và trung tâm
      'Chợ Phan Rang',
      'Chợ Đầm Ninh Thuận',
      'Vincom Ninh Thuận',
      
      // Đặc sản và làng nghề
      'Làng gốm Bàu Trúc',
      'Làng dệt Mỹ Nghiệp',
      'Nước mắm Phan Rang',
      'Rượu nho Ninh Thuận'
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
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Ninh Thuận (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}) - Closer to ${closest.province}`);
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
          const images = await serperManager.searchImages(`${place.title} Ninh Thuận`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Ninh Thuận - ${place.address || 'Duyên hải Nam Trung Bộ'}`,
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

    const totalNinhThuan = await Destination.countDocuments({ 'location.city': PROVINCE_NAME });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 NINH THUẬN DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Ninh Thuận destinations in database: ${totalNinhThuan}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchNinhThuan();
