require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

// Các loại địa điểm du lịch cho Sóc Trăng - tập trung du lịch
const SEARCH_QUERIES = [
  // Điểm tham quan chính - Sóc Trăng nổi tiếng với chùa Khmer và Chùa Dơi
  { query: 'Chùa Dơi Sóc Trăng', category: 'historical', limit: 10 },
  { query: 'Chùa Khmer Sóc Trăng', category: 'historical', limit: 20 },
  { query: 'Điểm du lịch Sóc Trăng', category: 'attraction', limit: 30 },
  { query: 'Chùa Sóc Trăng', category: 'historical', limit: 15 },
  { query: 'Bảo tàng Sóc Trăng', category: 'historical', limit: 5 },
  { query: 'Vườn trái cây Sóc Trăng', category: 'countryside', limit: 20 },
  { query: 'Biển Sóc Trăng', category: 'beach', limit: 10 },
  
  // Ẩm thực
  { query: 'Nhà hàng Sóc Trăng', category: 'restaurant', limit: 25 },
  { query: 'Quán ăn ngon Sóc Trăng', category: 'restaurant', limit: 20 },
  { query: 'Quán cà phê Sóc Trăng', category: 'restaurant', limit: 20 },
  { query: 'Bánh Sóc Trăng', category: 'restaurant', limit: 10 },
  { query: 'Ăn vặt Sóc Trăng', category: 'restaurant', limit: 10 },
  
  // Lưu trú - ít hơn
  { query: 'Khách sạn Sóc Trăng', category: 'hotel', limit: 12 },
  { query: 'Nhà nghỉ Sóc Trăng', category: 'hotel', limit: 10 },
];

async function fetchGoogleImages(placeName, location) {
  try {
    console.log(`  📸 Fetching images for: ${placeName}`);
    
    const searchQuery = `${placeName} Sóc Trăng Vietnam`;
    const params = {
      engine: 'google_images',
      q: searchQuery,
      num: 10,
      gl: 'vn',
      hl: 'vi'
    };

    const response = await serpApiManager.fetchWithRotation(params);
    
    if (!response.images_results || response.images_results.length === 0) {
      console.log(`  ⚠️  No images found for ${placeName}`);
      return [];
    }

    const validImages = response.images_results
      .filter(img => {
        const url = img.original || img.thumbnail;
        if (!url) return false;
        
        const skipDomains = [
          'googleusercontent.com/gps',
          'tiktok.com',
          'facebook.com',
          'instagram.com',
          'fbcdn.net',
          'cdninstagram.com'
        ];
        
        return !skipDomains.some(domain => url.includes(domain));
      })
      .map(img => img.original || img.thumbnail)
      .slice(0, 3);

    console.log(`  ✅ Found ${validImages.length} images`);
    return validImages;

  } catch (error) {
    console.error(`  ❌ Error fetching images for ${placeName}:`, error.message);
    return [];
  }
}

async function fetchPlacesFromSerpApi(query, category, limit) {
  try {
    console.log(`\n🔍 Searching: "${query}" (limit: ${limit})`);
    
    const params = {
      engine: 'google_maps',
      q: query,
      type: 'search',
      num: limit,
      gl: 'vn',
      hl: 'vi'
    };

    const response = await serpApiManager.fetchWithRotation(params);
    
    if (!response.local_results || response.local_results.length === 0) {
      console.log(`  ⚠️  No results found for "${query}"`);
      return [];
    }

    console.log(`  📍 Found ${response.local_results.length} places`);
    
    // Tọa độ Sóc Trăng: khoảng 9.6°N, 105.98°E (±0.5 độ ~ 50km)
    const SOC_TRANG_LAT = 9.6;
    const SOC_TRANG_LNG = 105.98;
    const RADIUS = 0.5;
    
    const places = [];
    for (const place of response.local_results) {
      // Kiểm tra tọa độ có nằm trong Sóc Trăng không
      const lat = place.gps_coordinates?.latitude || 0;
      const lng = place.gps_coordinates?.longitude || 0;
      
      const latDiff = Math.abs(lat - SOC_TRANG_LAT);
      const lngDiff = Math.abs(lng - SOC_TRANG_LNG);
      
      if (latDiff > RADIUS || lngDiff > RADIUS) {
        console.log(`  ⏭️  Skipping ${place.title} - outside Sóc Trăng (${lat.toFixed(2)}, ${lng.toFixed(2)})`);
        continue;
      }
      
      const existing = await Destination.findOne({ 
        name: place.title,
        'location.city': 'Sóc Trăng'
      });
      
      if (existing) {
        console.log(`  ⏭️  Skipping existing: ${place.title}`);
        continue;
      }

      const images = await fetchGoogleImages(place.title, place.gps_coordinates);
      
      if (images.length === 0) {
        console.log(`  ⚠️  Skipping ${place.title} - no valid images`);
        continue;
      }

      let priceRange = 'budget';
      if (category === 'hotel') {
        priceRange = place.rating >= 4.0 ? 'mid-range' : 'budget';
      } else if (category === 'restaurant') {
        priceRange = place.rating >= 4.5 ? 'mid-range' : 'budget';
      }

      const destination = {
        name: place.title,
        description: place.description || `${place.title} tại Sóc Trăng - ${place.type || 'Điểm đến du lịch'}`,
        location: {
          coordinates: {
            lat: place.gps_coordinates?.latitude || 0,
            lng: place.gps_coordinates?.longitude || 0
          },
          city: 'Sóc Trăng',
          country: 'Việt Nam'
        },
        images: images,
        category: category,
        priceRange: priceRange,
        rating: place.rating || 0,
        reviewCount: place.reviews || 0,
        amenities: place.service_options ? Object.keys(place.service_options) : [],
        bestTimeToVisit: ['Cả năm'],
        activities: [],
        cuisine: category === 'restaurant' ? {
          name: place.type || 'Ẩm thực Sóc Trăng',
          description: 'Đặc sản và món ăn địa phương'
        } : undefined
      };

      places.push(destination);
      console.log(`  ✅ Added: ${place.title} (${images.length} images)`);
    }

    return places;

  } catch (error) {
    console.error(`❌ Error fetching places for "${query}":`, error.message);
    return [];
  }
}

async function main() {
  try {
    console.log('🚀 Starting Sóc Trăng data fetch...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let totalAdded = 0;

    for (const searchQuery of SEARCH_QUERIES) {
      const places = await fetchPlacesFromSerpApi(
        searchQuery.query,
        searchQuery.category,
        searchQuery.limit
      );

      if (places.length > 0) {
        await Destination.insertMany(places);
        totalAdded += places.length;
        console.log(`  💾 Saved ${places.length} destinations from "${searchQuery.query}"`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ COMPLETED! Added ${totalAdded} new destinations for Sóc Trăng`);
    console.log('='.repeat(60));

    // Show final stats
    const socTrangCount = await Destination.countDocuments({ 'location.city': 'Sóc Trăng' });
    const canThoCount = await Destination.countDocuments({ 'location.city': 'Cần Thơ' });
    const vinhLongCount = await Destination.countDocuments({ 'location.city': 'Vĩnh Long' });
    const traVinhCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    const benTreCount = await Destination.countDocuments({ 'location.city': 'Bến Tre' });
    const totalCount = await Destination.countDocuments();

    console.log('\n📊 FINAL STATISTICS:');
    console.log(`   Sóc Trăng: ${socTrangCount} destinations`);
    console.log(`   Cần Thơ: ${canThoCount} destinations`);
    console.log(`   Vĩnh Long: ${vinhLongCount} destinations`);
    console.log(`   Trà Vinh: ${traVinhCount} destinations`);
    console.log(`   Bến Tre: ${benTreCount} destinations`);
    console.log(`   Total: ${totalCount} destinations`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
