require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Tọa độ trung tâm Đồng Tháp (10.46°N, 105.63°E)
const DONG_THAP_CENTER = { lat: 10.46, lng: 105.63 };
const RADIUS = 0.5; // ±0.5 độ ~ 50km

function isWithinDongThap(lat, lng) {
  const latDiff = Math.abs(lat - DONG_THAP_CENTER.lat);
  const lngDiff = Math.abs(lng - DONG_THAP_CENTER.lng);
  return latDiff <= RADIUS && lngDiff <= RADIUS;
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
             categoryLower.includes('nhà hàng') || categoryLower.includes('restaurant')) {
    return 'restaurant';
  } else if (titleLower.includes('chùa') || titleLower.includes('đền') || 
             titleLower.includes('miếu') || titleLower.includes('temple') ||
             titleLower.includes('di tích') || titleLower.includes('tháp')) {
    return 'historical';
  } else if (titleLower.includes('bãi biển') || titleLower.includes('beach') || 
             titleLower.includes('biển') || titleLower.includes('đảo') ||
             titleLower.includes('island')) {
    return 'beach';
  } else if (titleLower.includes('vườn') || titleLower.includes('garden') || 
             titleLower.includes('farm') || titleLower.includes('làng') ||
             titleLower.includes('suối') || titleLower.includes('rừng') ||
             titleLower.includes('đồng')) {
    return 'countryside';
  } else if (titleLower.includes('chợ') || titleLower.includes('market') || 
             titleLower.includes('trung tâm')) {
    return 'city';
  }
  
  return 'attraction';
}

async function fetchDongThap() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Starting Đồng Tháp data collection with Serper.dev...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const queries = [
      // Cao Lãnh - Thành phố chính
      'Khách sạn Cao Lãnh',
      'Nhà hàng Cao Lãnh',
      'Chợ Cao Lãnh',
      'Công viên Cao Lãnh',
      
      // Vườn Quốc gia Tràm Chim - Điểm nổi tiếng nhất
      'Vườn Quốc gia Tràm Chim',
      'Du lịch sinh thái Tràm Chim',
      
      // Sa Đéc - Thành phố hoa
      'Vườn hoa Sa Đéc',
      'Nhà cổ Huỳnh Thủy Lê',
      'Chợ Sa Đéc',
      'Khách sạn Sa Đéc',
      'Nhà hàng Sa Đéc',
      'Làng hoa Sa Đéc',
      
      // Đồng Tháp Mười
      'Đồng Tháp Mười',
      'Rừng tràm Đồng Tháp',
      
      // Các điểm du lịch khác
      'Chùa Đồng Tháp',
      'Đình Đồng Tháp',
      'Bảo tàng Đồng Tháp',
      'Vườn trái cây Đồng Tháp',
      'Homestay Đồng Tháp',
      
      // Ẩm thực
      'Quán ăn Đồng Tháp',
      'Lẩu mắm Đồng Tháp',
      'Cơm tấm Đồng Tháp',
      'Bánh xèo Đồng Tháp',
      
      // Các huyện khác
      'Du lịch Hồng Ngự',
      'Du lịch Tam Nông',
      'Du lịch Tân Hồng'
    ];

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const query of queries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
      try {
        // Tìm kiếm địa điểm
        const placesData = await serperManager.searchPlaces(query);
        
        if (!placesData.places || placesData.places.length === 0) {
          console.log(`   ⚠️  No places found`);
          continue;
        }

        // Xử lý từng địa điểm
        for (const place of placesData.places) {
          // Validate coordinates
          if (!place.latitude || !place.longitude) {
            console.log(`   ⏭️  Skipped "${place.title}" - No GPS coordinates`);
            skippedCount++;
            continue;
          }

          // Check if within Đồng Tháp boundaries
          if (!isWithinDongThap(place.latitude, place.longitude)) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Đồng Tháp (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`);
            skippedCount++;
            continue;
          }

          // Check if already exists
          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Đồng Tháp'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          // Fetch images
          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Đồng Tháp`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          // Determine category
          const category = determineCategory(place.title, place.category);

          // Create destination
          const destination = {
            name: place.title,
            description: `${place.title} tại Đồng Tháp - ${place.address || ''}`,
            category: category,
            location: {
              city: 'Đồng Tháp',
              address: place.address || 'Đồng Tháp',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.0,
            price: category === 'hotel' ? 400000 : category === 'restaurant' ? 80000 : 0
          };

          // Save to database
          try {
            await Destination.create(destination);
            savedCount++;
            console.log(`   ✅ Added "${place.title}" (${category}) - ${images.length} images - Rating: ${place.rating || 'N/A'}`);
          } catch (error) {
            console.log(`   ⚠️  Error saving "${place.title}": ${error.message}`);
            errorCount++;
          }
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing "${query}":`, error.message);
        errorCount++;
      }
    }

    // Final summary
    const totalDongThap = await Destination.countDocuments({ 'location.city': 'Đồng Tháp' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 ĐỒNG THÁP DATA COLLECTION WITH SERPER.DEV COMPLETED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📍 Total Đồng Tháp destinations in database: ${totalDongThap}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchDongThap();
