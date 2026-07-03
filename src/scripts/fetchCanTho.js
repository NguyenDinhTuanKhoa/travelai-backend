require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

// Các loại địa điểm du lịch cho Cần Thơ
const SEARCH_QUERIES = [
  // Điểm tham quan chính - Cần Thơ nổi tiếng
  { query: 'Chợ nổi Cái Răng Cần Thơ', category: 'attraction', limit: 15 },
  { query: 'Bến Ninh Kiều Cần Thơ', category: 'attraction', limit: 10 },
  { query: 'Điểm du lịch Cần Thơ', category: 'attraction', limit: 30 },
  { query: 'Chùa Cần Thơ', category: 'historical', limit: 20 },
  { query: 'Vườn trái cây Cần Thơ', category: 'countryside', limit: 25 },
  { query: 'Cồn Cần Thơ', category: 'countryside', limit: 15 },
  { query: 'Bảo tàng Cần Thơ', category: 'historical', limit: 10 },
  { query: 'Cầu Cần Thơ', category: 'attraction', limit: 5 },
  
  // Ẩm thực - Cần Thơ có ẩm thực phong phú
  { query: 'Nhà hàng Cần Thơ', category: 'restaurant', limit: 30 },
  { query: 'Quán ăn ngon Cần Thơ', category: 'restaurant', limit: 25 },
  { query: 'Quán cà phê Cần Thơ', category: 'restaurant', limit: 20 },
  { query: 'Bánh xèo Cần Thơ', category: 'restaurant', limit: 10 },
  { query: 'Bún riêu Cần Thơ', category: 'restaurant', limit: 10 },
  { query: 'Ăn vặt Cần Thơ', category: 'restaurant', limit: 15 },
  
  // Lưu trú - vừa phải
  { query: 'Khách sạn Cần Thơ', category: 'hotel', limit: 15 },
  { query: 'Nhà nghỉ Cần Thơ', category: 'hotel', limit: 10 },
  { query: 'Homestay Cần Thơ', category: 'hotel', limit: 10 },
];

async function fetchGoogleImages(placeName, location) {
  try {
    console.log(`  📸 Fetching images for: ${placeName}`);
    
    const searchQuery = `${placeName} Cần Thơ Vietnam`;
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

    // Filter and get high-quality images
    const validImages = response.images_results
      .filter(img => {
        const url = img.original || img.thumbnail;
        if (!url) return false;
        
        // Skip unwanted domains
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
    
    const places = [];
    for (const place of response.local_results) {
      // Check if already exists
      const existing = await Destination.findOne({ 
        name: place.title,
        'location.city': 'Cần Thơ'
      });
      
      if (existing) {
        console.log(`  ⏭️  Skipping existing: ${place.title}`);
        continue;
      }

      // Fetch images
      const images = await fetchGoogleImages(place.title, place.gps_coordinates);
      
      if (images.length === 0) {
        console.log(`  ⚠️  Skipping ${place.title} - no valid images`);
        continue;
      }

      // Determine price range based on category and rating
      let priceRange = 'budget';
      if (category === 'hotel') {
        priceRange = place.rating >= 4.0 ? 'mid-range' : 'budget';
      } else if (category === 'restaurant') {
        priceRange = place.rating >= 4.5 ? 'mid-range' : 'budget';
      }

      const destination = {
        name: place.title,
        description: place.description || `${place.title} tại Cần Thơ - ${place.type || 'Điểm đến du lịch'}`,
        location: {
          coordinates: {
            lat: place.gps_coordinates?.latitude || 0,
            lng: place.gps_coordinates?.longitude || 0
          },
          city: 'Cần Thơ',
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
          name: place.type || 'Ẩm thực Cần Thơ',
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
    console.log('🚀 Starting Cần Thơ data fetch...\n');
    
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

      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ COMPLETED! Added ${totalAdded} new destinations for Cần Thơ`);
    console.log('='.repeat(60));

    // Show final stats
    const canThoCount = await Destination.countDocuments({ 'location.city': 'Cần Thơ' });
    const vinhLongCount = await Destination.countDocuments({ 'location.city': 'Vĩnh Long' });
    const traVinhCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    const benTreCount = await Destination.countDocuments({ 'location.city': 'Bến Tre' });
    const totalCount = await Destination.countDocuments();

    console.log('\n📊 FINAL STATISTICS:');
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
