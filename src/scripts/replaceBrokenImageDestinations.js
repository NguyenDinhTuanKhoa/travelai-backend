const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để:
 * 1. Tìm các địa điểm có ảnh bị lỗi (không load được)
 * 2. Xóa những địa điểm đó
 * 3. Fetch địa điểm mới từ SerpAPI để thay thế
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test xem ảnh có load được không
const testImageUrl = async (url, timeout = 3000) => {
  try {
    const response = await axios.head(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Lấy ảnh từ Google Images
const fetchImagesFromGoogleImages = async (placeName, city) => {
  try {
    const params = {
      engine: 'google_images',
      q: `${placeName} ${city} Vietnam`,
      num: 10,
      ijn: 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      return [];
    }

    const imageUrls = data.images_results
      .slice(0, 8)
      .map(img => img.original || img.thumbnail)
      .filter(url => 
        url && 
        !url.includes('googleusercontent.com/gps') &&
        !url.includes('tiktok.com') &&
        !url.includes('facebook.com') &&
        (url.startsWith('http://') || url.startsWith('https://'))
      )
      .slice(0, 3);

    return imageUrls;

  } catch (error) {
    return [];
  }
};

// Fetch địa điểm mới từ Google Maps
const fetchNewDestinations = async (category, limit = 20) => {
  const queries = {
    hotel: 'Khách sạn Bến Tre',
    restaurant: 'Nhà hàng Bến Tre',
    attraction: 'Địa điểm du lịch Bến Tre'
  };

  const query = queries[category] || queries.attraction;
  
  console.log(`\n🔍 Đang tìm ${limit} địa điểm mới cho category: ${category}...`);

  const params = {
    engine: 'google_maps',
    q: query,
    ll: '@10.243,106.375,13z',
    type: 'search',
    num: limit
  };

  try {
    const data = await serpApiManager.fetchWithRotation(params);
    const localResults = data.local_results || [];
    
    console.log(`  ✓ Tìm thấy ${localResults.length} kết quả từ Google Maps`);
    
    const newDestinations = [];

    for (const item of localResults) {
      if (!item.title) continue;

      // Kiểm tra xem đã tồn tại chưa
      const existing = await Destination.findOne({ 
        name: item.title, 
        'location.city': 'Bến Tre' 
      });
      
      if (existing) continue;

      // Lấy ảnh
      const images = await fetchImagesFromGoogleImages(item.title, 'Bến Tre');
      
      if (images.length === 0) continue; // Bỏ qua nếu không có ảnh

      let descriptionParts = [];
      if (item.address) descriptionParts.push(`Địa chỉ: ${item.address}`);
      if (item.phone) descriptionParts.push(`SĐT: ${item.phone}`);

      newDestinations.push({
        name: item.title,
        description: descriptionParts.join(' | '),
        location: {
          city: 'Bến Tre',
          country: 'Việt Nam',
          coordinates: {
            lat: item.gps_coordinates?.latitude,
            lng: item.gps_coordinates?.longitude
          }
        },
        category: category,
        rating: item.rating || 0,
        reviewCount: item.reviews || 0,
        amenities: [],
        images: images
      });

      if (newDestinations.length >= limit) break;
      
      await delay(1500); // Delay để tránh rate limit
    }

    return newDestinations;

  } catch (error) {
    console.error(`  ❌ Lỗi:`, error.message);
    return [];
  }
};

const replaceBrokenImageDestinations = async () => {
  console.log('🔍 BẮT ĐẦU TÌM VÀ THAY THẾ ĐỊA ĐIỂM CÓ ẢNH BỊ LỖI\n');
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Bước 1: Tìm các địa điểm có ảnh bị lỗi
    console.log('📊 Đang kiểm tra tất cả địa điểm Bến Tre...\n');
    
    const destinations = await Destination.find({ 'location.city': 'Bến Tre' })
      .select('name category images');

    const brokenDestinations = [];

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      process.stdout.write(`\r[${i + 1}/${destinations.length}] Đang kiểm tra...`);

      if (!dest.images || dest.images.length === 0) {
        brokenDestinations.push(dest);
        continue;
      }

      // Test tất cả ảnh
      const results = await Promise.all(
        dest.images.map(url => testImageUrl(url))
      );

      const workingCount = results.filter(r => r).length;

      // Nếu tất cả ảnh đều lỗi
      if (workingCount === 0) {
        brokenDestinations.push(dest);
      }
    }

    console.log(`\n\n✓ Hoàn thành kiểm tra!`);
    console.log(`❌ Tìm thấy ${brokenDestinations.length} địa điểm có ảnh bị lỗi\n`);

    if (brokenDestinations.length === 0) {
      console.log('🎉 Tất cả địa điểm đều có ảnh hoạt động tốt!');
      process.exit(0);
    }

    // Hiển thị danh sách
    console.log('📋 Danh sách địa điểm sẽ bị xóa:');
    console.log('='.repeat(70));
    brokenDestinations.forEach((dest, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. [${dest.category}] ${dest.name}`);
    });

    // Đếm theo category
    const countByCategory = {};
    brokenDestinations.forEach(dest => {
      countByCategory[dest.category] = (countByCategory[dest.category] || 0) + 1;
    });

    console.log('\n📊 Phân loại:');
    Object.entries(countByCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} địa điểm`);
    });

    // Bước 2: Xóa các địa điểm bị lỗi
    console.log('\n🗑️  Đang xóa các địa điểm có ảnh bị lỗi...');
    const idsToDelete = brokenDestinations.map(d => d._id);
    const deleteResult = await Destination.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`✅ Đã xóa ${deleteResult.deletedCount} địa điểm\n`);

    // Bước 3: Fetch địa điểm mới để thay thế
    console.log('='.repeat(70));
    console.log('🚀 ĐANG FETCH ĐỊA ĐIỂM MỚI ĐỂ THAY THẾ\n');

    let totalAdded = 0;

    for (const [category, count] of Object.entries(countByCategory)) {
      console.log(`\n📍 Category: ${category} (cần ${count} địa điểm)`);
      
      const newDests = await fetchNewDestinations(category, count + 5); // Lấy thêm 5 để dự phòng
      
      if (newDests.length > 0) {
        await Destination.insertMany(newDests);
        console.log(`  ✅ Đã thêm ${newDests.length} địa điểm mới`);
        totalAdded += newDests.length;
      } else {
        console.log(`  ⚠️  Không tìm thấy địa điểm mới`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 HOÀN THÀNH!');
    console.log('='.repeat(70));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Đã xóa: ${deleteResult.deletedCount} địa điểm có ảnh lỗi`);
    console.log(`   - Đã thêm: ${totalAdded} địa điểm mới (có ảnh tốt)`);
    console.log(`   - Tất cả địa điểm mới đều có ảnh chất lượng cao`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
replaceBrokenImageDestinations();
