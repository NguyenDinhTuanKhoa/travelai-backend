require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

// Tọa độ trung tâm Cà Mau (9.18°N, 105.15°E)
const CA_MAU_CENTER = { lat: 9.18, lng: 105.15 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinCaMau(lat, lng) {
  const latDiff = Math.abs(lat - CA_MAU_CENTER.lat);
  const lngDiff = Math.abs(lng - CA_MAU_CENTER.lng);
  return latDiff <= RADIUS && lngDiff <= RADIUS;
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

async function fetchGoogleMaps(query, type = 'tourist_attraction') {
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

      // Check if within Cà Mau boundaries
      if (!isWithinCaMau(lat, lng)) {
        console.log(`   ⏭️  Skipped "${place.title}" - Outside Cà Mau (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        continue;
      }

      // Check if already exists
      const existing = await Destination.findOne({
        name: place.title,
        'location.city': 'Cà Mau'
      });

      if (existing) {
        console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
        continue;
      }

      // Fetch images
      console.log(`   📸 Fetching images for "${place.title}"...`);
      const images = await fetchGoogleImages(`${place.title} Cà Mau`, 3);

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
      } else if (title.includes('bãi biển') || title.includes('beach') || title.includes('biển')) {
        category = 'beach';
      } else if (title.includes('vườn') || title.includes('garden') || title.includes('farm') ||
                 title.includes('làng') || title.includes('village')) {
        category = 'countryside';
      } else if (title.includes('chợ') || title.includes('market') || title.includes('trung tâm')) {
        category = 'city';
      }

      results.push({
        name: place.title,
        description: place.description || `${place.title} tại Cà Mau - ${place.address || ''}`,
        category: category,
        location: {
          city: 'Cà Mau',
          address: place.address || 'Cà Mau',
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

async function fetchCaMauDestinations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Cà Mau data collection...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Điểm du lịch nổi tiếng
      { q: 'Mũi Cà Mau', type: 'tourist_attraction' },
      { q: 'Khu du lịch Mũi Cà Mau', type: 'tourist_attraction' },
      { q: 'Cột mốc tọa độ quốc gia Mũi Cà Mau', type: 'tourist_attraction' },
      { q: 'Rừng tràm Trà Sư Cà Mau', type: 'tourist_attraction' },
      { q: 'Vườn Quốc gia U Minh Hạ', type: 'tourist_attraction' },
      { q: 'Khu bảo tồn sinh quyển Cà Mau', type: 'tourist_attraction' },
      { q: 'Chợ nổi Cà Mau', type: 'tourist_attraction' },
      { q: 'Bãi biển Khai Long Cà Mau', type: 'tourist_attraction' },
      { q: 'Bãi biển Hòn Khoai Cà Mau', type: 'tourist_attraction' },
      { q: 'Đảo Hòn Khoai', type: 'tourist_attraction' },
      
      // Chùa chiền, di tích
      { q: 'Chùa Cà Mau', type: 'tourist_attraction' },
      { q: 'Nhà thờ Cà Mau', type: 'tourist_attraction' },
      { q: 'Đình thần Cà Mau', type: 'tourist_attraction' },
      { q: 'Di tích lịch sử Cà Mau', type: 'tourist_attraction' },
      
      // Vườn trái cây, làng nghề
      { q: 'Vườn trái cây Cà Mau', type: 'tourist_attraction' },
      { q: 'Làng nghề Cà Mau', type: 'tourist_attraction' },
      { q: 'Vườn sinh thái Cà Mau', type: 'tourist_attraction' },
      
      // Nhà hàng
      { q: 'Nhà hàng hải sản Cà Mau', type: 'restaurant' },
      { q: 'Quán ăn ngon Cà Mau', type: 'restaurant' },
      { q: 'Nhà hàng Cà Mau', type: 'restaurant' },
      { q: 'Quán cà phê Cà Mau', type: 'cafe' },
      { q: 'Quán ăn đặc sản Cà Mau', type: 'restaurant' },
      
      // Khách sạn
      { q: 'Khách sạn Cà Mau', type: 'hotel' },
      { q: 'Resort Cà Mau', type: 'hotel' },
      { q: 'Homestay Cà Mau', type: 'hotel' },
      { q: 'Nhà nghỉ Cà Mau', type: 'hotel' }
    ];

    let allDestinations = [];
    let savedCount = 0;

    for (const query of queries) {
      const destinations = await fetchGoogleMaps(query.q, query.type);
      
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
    const total = await Destination.countDocuments({ 'location.city': 'Cà Mau' });
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 CÀ MAU DATA COLLECTION COMPLETED!');
    console.log(`📊 Total destinations collected: ${allDestinations.length}`);
    console.log(`💾 Total saved to database: ${savedCount}`);
    console.log(`📍 Total Cà Mau destinations in database: ${total}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchCaMauDestinations();
