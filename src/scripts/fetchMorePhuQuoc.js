require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

// Tọa độ trung tâm Phú Quốc (10.23°N, 103.97°E)
const PHU_QUOC_CENTER = { lat: 10.23, lng: 103.97 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinPhuQuoc(lat, lng) {
  const latDiff = Math.abs(lat - PHU_QUOC_CENTER.lat);
  const lngDiff = Math.abs(lng - PHU_QUOC_CENTER.lng);
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

      // Check if within Phú Quốc boundaries
      if (!isWithinPhuQuoc(lat, lng)) {
        console.log(`   ⏭️  Skipped "${place.title}" - Outside Phú Quốc (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
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
      const images = await fetchGoogleImages(`${place.title} Phú Quốc`, 3);

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
                 title.includes('làng') || title.includes('village') || title.includes('suối')) {
        category = 'countryside';
      } else if (title.includes('chợ') || title.includes('market') || title.includes('trung tâm')) {
        category = 'city';
      }

      results.push({
        name: place.title,
        description: place.description || `${place.title} tại Phú Quốc - ${place.address || ''}`,
        category: category,
        location: {
          city: 'Kiên Giang',
          address: place.address || 'Phú Quốc, Kiên Giang',
          coordinates: {
            lat: lat,
            lng: lng
          }
        },
        images: images,
        rating: place.rating || 4.0,
        price: category === 'hotel' ? 800000 : category === 'restaurant' ? 150000 : 0
      });

      console.log(`   ✅ Added "${place.title}" (${category}) - ${images.length} images`);
    }

    return results;
  } catch (error) {
    console.error(`Error fetching "${query}":`, error.message);
    return [];
  }
}

async function fetchMorePhuQuoc() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Phú Quốc additional data collection...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Các khu vui chơi giải trí SIÊU NỔI TIẾNG (must-visit)
      'Grand World Phú Quốc',
      'Vinpearl Safari Phú Quốc',
      'Aquatopia Water Park Phú Quốc',
      
      // Bãi biển đẹp nhất
      'Bãi Gành Dầu Phú Quốc',
      'Bãi Rạch Vẹm Phú Quốc',
      
      // Điểm tham quan văn hóa quan trọng
      'Nhà tù Phú Quốc',
      'Nhà thùng nước mắm Phú Quốc',
      'Đền Nguyễn Trung Trực Phú Quốc',
      
      // Thiên nhiên
      'Suối Đá Bàn Phú Quốc',
      
      // Các đảo nhỏ đẹp
      'Hòn Móng Tay Phú Quốc',
      'Hòn Gầm Ghì Phú Quốc',
      
      // Resort 5 sao nổi tiếng
      'JW Marriott Phú Quốc',
      'InterContinental Phú Quốc',
      'La Veranda Resort Phú Quốc',
      
      // Nhà hàng nổi tiếng
      'Nhà hàng Hưng Phát Phú Quốc',
      'Nhà hàng Winston Phú Quốc',
      
      // Khu vực đặc biệt
      'Làng chài Rạch Vẹm Phú Quốc',
      'Cảng An Thới Phú Quốc'
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
    const total = await Destination.countDocuments({ 
      'location.city': 'Kiên Giang',
      'location.coordinates.lat': { $gte: PHU_QUOC_CENTER.lat - RADIUS, $lte: PHU_QUOC_CENTER.lat + RADIUS },
      'location.coordinates.lng': { $gte: PHU_QUOC_CENTER.lng - RADIUS, $lte: PHU_QUOC_CENTER.lng + RADIUS }
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 PHÚ QUỐC ADDITIONAL DATA COLLECTION COMPLETED!');
    console.log(`📊 Total destinations collected: ${allDestinations.length}`);
    console.log(`💾 Total saved to database: ${savedCount}`);
    console.log(`🏝️  Total Phú Quốc destinations in database: ${total}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchMorePhuQuoc();
