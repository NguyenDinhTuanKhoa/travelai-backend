require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

// Tọa độ trung tâm Kiên Giang (10.01°N, 105.08°E)
// Phú Quốc (10.23°N, 103.97°E)
const KIEN_GIANG_CENTER = { lat: 10.01, lng: 105.08 };
const PHU_QUOC_CENTER = { lat: 10.23, lng: 103.97 };
const RADIUS = 0.7; // ±0.7 độ ~ 70km (rộng hơn vì Kiên Giang có Phú Quốc xa)

function isWithinKienGiang(lat, lng) {
  // Check if within main Kiên Giang area
  const kgLatDiff = Math.abs(lat - KIEN_GIANG_CENTER.lat);
  const kgLngDiff = Math.abs(lng - KIEN_GIANG_CENTER.lng);
  
  // Check if within Phú Quốc area
  const pqLatDiff = Math.abs(lat - PHU_QUOC_CENTER.lat);
  const pqLngDiff = Math.abs(lng - PHU_QUOC_CENTER.lng);
  
  return (kgLatDiff <= RADIUS && kgLngDiff <= RADIUS) || 
         (pqLatDiff <= 0.5 && pqLngDiff <= 0.5);
}

async function fetchGoogleImages(query, maxResults = 3) {
  try {
    const response = await serpApiManager.fetchWithRotation({
      engine: 'google_images',
      q: query,
      num: maxResults,
      gl: 'vn',
      hl: 'vi'
    });

    if (response.images_results) {
      return response.images_results
        .slice(0, maxResults)
        .map(img => img.original)
        .filter(url => {
          const lower = url.toLowerCase();
          return !lower.includes('facebook.com') && 
                 !lower.includes('instagram.com') &&
                 !lower.includes('tiktok.com') &&
                 !lower.includes('googleusercontent.com');
        });
    }
    return [];
  } catch (error) {
    console.error(`Error fetching images for "${query}":`, error.message);
    return [];
  }
}

async function fetchGoogleMaps(query) {
  try {
    console.log(`\n🔍 Searching: "${query}"`);
    
    const response = await serpApiManager.fetchWithRotation({
      engine: 'google_maps',
      q: query,
      gl: 'vn',
      hl: 'vi'
    });

    if (!response.local_results) {
      console.log(`   ⚠️  No results found`);
      return [];
    }

    const results = [];
    for (const place of response.local_results.slice(0, 15)) {
      // Validate coordinates
      if (!place.gps_coordinates || !place.gps_coordinates.latitude || !place.gps_coordinates.longitude) {
        console.log(`   ⏭️  Skipped "${place.title}" - No GPS coordinates`);
        continue;
      }

      const lat = place.gps_coordinates.latitude;
      const lng = place.gps_coordinates.longitude;

      // Check if within Kiên Giang or Phú Quốc boundaries
      if (!isWithinKienGiang(lat, lng)) {
        console.log(`   ⏭️  Skipped "${place.title}" - Outside Kiên Giang (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        continue;
      }

      // Check if already exists
      const existing = await Destination.findOne({
        name: place.title,
        'location.city': 'Kiên Giang'
      });

      if (existing) {
        console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
        continue;
      }

      // Fetch images
      console.log(`   📸 Fetching images for "${place.title}"...`);
      const images = await fetchGoogleImages(`${place.title} Kiên Giang`, 3);

      if (images.length === 0) {
        console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
        continue;
      }

      // Determine category
      let category = 'attraction';
      const title = place.title.toLowerCase();
      const placeType = place.type ? place.type.toLowerCase() : '';
      
      if (title.includes('khách sạn') || title.includes('hotel') || title.includes('resort') || 
          title.includes('homestay') || title.includes('nhà nghỉ') || placeType.includes('hotel')) {
        category = 'hotel';
      } else if (title.includes('nhà hàng') || title.includes('quán ăn') || title.includes('restaurant') ||
                 title.includes('quán') || title.includes('food') || placeType.includes('restaurant')) {
        category = 'restaurant';
      } else if (title.includes('chùa') || title.includes('đền') || title.includes('miếu') ||
                 title.includes('temple') || title.includes('di tích')) {
        category = 'historical';
      } else if (title.includes('bãi biển') || title.includes('beach') || title.includes('biển') ||
                 title.includes('đảo') || title.includes('island')) {
        category = 'beach';
      } else if (title.includes('vườn') || title.includes('garden') || title.includes('farm') ||
                 title.includes('làng') || title.includes('village')) {
        category = 'countryside';
      } else if (title.includes('chợ') || title.includes('market') || title.includes('trung tâm')) {
        category = 'city';
      }

      results.push({
        name: place.title,
        description: place.description || `${place.title} tại Kiên Giang - ${place.address || ''}`,
        category: category,
        location: {
          city: 'Kiên Giang',
          address: place.address || 'Kiên Giang',
          coordinates: {
            lat: lat,
            lng: lng
          }
        },
        images: images,
        rating: place.rating || 4.0,
        price: category === 'hotel' ? 500000 : category === 'restaurant' ? 100000 : 0
      });

      console.log(`   ✅ Added "${place.title}" (${category}) - ${images.length} images`);
    }

    return results;
  } catch (error) {
    console.error(`Error fetching "${query}":`, error.message);
    return [];
  }
}

async function fetchKienGiangDestinations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Kiên Giang data collection...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Phú Quốc - Đảo ngọc
      'Bãi Sao Phú Quốc',
      'Bãi Dài Phú Quốc',
      'Bãi Trường Phú Quốc',
      'Bãi Ông Lang Phú Quốc',
      'Bãi Khem Phú Quốc',
      'Vinpearl Safari Phú Quốc',
      'VinWonders Phú Quốc',
      'Dinh Cậu Phú Quốc',
      'Chợ đêm Phú Quốc',
      'Sunset Sanato Beach Club Phú Quốc',
      'Hòn Thơm Phú Quốc',
      'Cáp treo Hòn Thơm',
      'Nhà thờ Phú Quốc',
      'Suối Tranh Phú Quốc',
      'Vườn tiêu Phú Quốc',
      'Làng chài Hàm Ninh Phú Quốc',
      'Khách sạn Phú Quốc',
      'Resort Phú Quốc',
      'Nhà hàng hải sản Phú Quốc',
      'Quán ăn Phú Quốc',
      
      // Rạch Giá - Thành phố
      'Chùa Rạch Giá',
      'Nhà thờ Rạch Giá',
      'Chợ Rạch Giá',
      'Bãi biển Rạch Giá',
      'Khách sạn Rạch Giá',
      'Nhà hàng Rạch Giá',
      'Quán cà phê Rạch Giá',
      
      // Hà Tiên
      'Hà Tiên Kiên Giang',
      'Biển Mũi Nai Hà Tiên',
      'Chùa Phù Dung Hà Tiên',
      'Đông Hồ Hà Tiên',
      'Khách sạn Hà Tiên',
      'Nhà hàng Hà Tiên',
      
      // Hòn Sơn, Hòn Đất
      'Hòn Sơn Kiên Giang',
      'Bãi biển Hòn Sơn',
      'Hòn Đất Kiên Giang',
      
      // Điểm du lịch khác
      'Vườn Quốc gia U Minh Thượng',
      'Chùa Kiên Giang',
      'Di tích lịch sử Kiên Giang',
      'Vườn trái cây Kiên Giang',
      'Homestay Kiên Giang'
    ];

    let allDestinations = [];
    let savedCount = 0;

    for (const query of queries) {
      const destinations = await fetchGoogleMaps(query);
      
      // Save immediately after each query
      if (destinations.length > 0) {
        for (const dest of destinations) {
          try {
            await Destination.create(dest);
            savedCount++;
          } catch (error) {
            console.log(`   ⚠️  Error saving "${dest.name}": ${error.message}`);
          }
        }
      }
      
      allDestinations = allDestinations.concat(destinations);
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final summary
    const total = await Destination.countDocuments({ 'location.city': 'Kiên Giang' });
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 KIÊN GIANG DATA COLLECTION COMPLETED!');
    console.log(`📊 Total destinations collected: ${allDestinations.length}`);
    console.log(`💾 Total saved to database: ${savedCount}`);
    console.log(`📍 Total Kiên Giang destinations in database: ${total}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchKienGiangDestinations();
