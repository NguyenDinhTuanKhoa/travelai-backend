require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Ranh giới Tây Ninh thực tế (theo bản đồ hành chính)
// Tây Ninh: 10.9° - 11.7°N, 105.7° - 106.5°E
const TAY_NINH_BOUNDS = {
  minLat: 10.9,
  maxLat: 11.7,
  minLng: 105.7,
  maxLng: 106.5
};

// Tọa độ trung tâm để tính khoảng cách
const TAY_NINH_CENTER = { lat: 11.31, lng: 106.10 };
const HCMC_CENTER = { lat: 10.82, lng: 106.63 };

function isWithinTayNinh(lat, lng) {
  // Kiểm tra trong ranh giới hành chính
  const withinBounds = lat >= TAY_NINH_BOUNDS.minLat && 
                       lat <= TAY_NINH_BOUNDS.maxLat &&
                       lng >= TAY_NINH_BOUNDS.minLng && 
                       lng <= TAY_NINH_BOUNDS.maxLng;
  
  if (!withinBounds) return false;
  
  // Kiểm tra gần Tây Ninh hơn TP.HCM (tránh vùng chồng lấn)
  const distToTayNinh = Math.sqrt(
    Math.pow(lat - TAY_NINH_CENTER.lat, 2) + 
    Math.pow(lng - TAY_NINH_CENTER.lng, 2)
  );
  const distToHCMC = Math.sqrt(
    Math.pow(lat - HCMC_CENTER.lat, 2) + 
    Math.pow(lng - HCMC_CENTER.lng, 2)
  );
  
  return distToTayNinh < distToHCMC;
}

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
             titleLower.includes('di tích') || titleLower.includes('thánh địa') ||
             titleLower.includes('địa đạo')) {
    return 'historical';
  } else if (titleLower.includes('núi') || titleLower.includes('mountain')) {
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

async function fetchTayNinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Tây Ninh data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Núi Bà Đen - Điểm nổi tiếng nhất
      'Núi Bà Đen Tây Ninh',
      'Cáp treo Núi Bà Đen',
      'Chùa Bà Đen Tây Ninh',
      'Khu du lịch Núi Bà Đen',
      
      // Thánh địa Cao Đài
      'Thánh Thất Cao Đài Tây Ninh',
      'Tòa Thánh Cao Đài',
      
      // Thành phố Tây Ninh
      'Khách sạn Tây Ninh',
      'Nhà hàng Tây Ninh',
      'Quán ăn Tây Ninh',
      'Cafe Tây Ninh',
      
      // Địa đạo
      'Địa đạo Củ Chi Tây Ninh',
      
      // Các điểm du lịch khác
      'Khu du lịch Tây Ninh',
      'Vườn Quốc gia Lò Gò Xa Mát',
      'Hồ Dầu Tiếng Tây Ninh',
      'Chùa Tây Ninh',
      
      // Ẩm thực
      'Bánh tráng Tây Ninh',
      'Cơm tấm Tây Ninh'
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

          if (!isWithinTayNinh(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Tây Ninh (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Tây Ninh'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Tây Ninh`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const category = determineCategory(place.title, place.category);

          const destination = {
            name: place.title,
            description: `${place.title} tại Tây Ninh - ${place.address || 'Đông Nam Bộ'}`,
            category: category,
            location: {
              city: 'Tây Ninh',
              address: place.address || 'Tây Ninh',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 500000 : category === 'restaurant' ? 100000 : 0
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

    const totalTayNinh = await Destination.countDocuments({ 'location.city': 'Tây Ninh' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 TÂY NINH DATA COLLECTION COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Tây Ninh destinations in database: ${totalTayNinh}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchTayNinh();
