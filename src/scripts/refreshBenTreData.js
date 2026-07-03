const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để xóa toàn bộ dữ liệu Bến Tre và fetch lại từ SerpAPI
 * với cách lấy ảnh tốt hơn
 */

const MAX_PAGES_PER_QUERY = 20;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Lấy ảnh chất lượng cao, loại bỏ các nguồn không ổn định
    const imageUrls = data.images_results
      .slice(0, 8)
      .map(img => img.original || img.thumbnail)
      .filter(url => 
        url && 
        !url.includes('googleusercontent.com/gps') && // Google proxy
        !url.includes('tiktok.com') && // TikTok bị 403
        !url.includes('facebook.com') && // Facebook bị chặn
        (url.startsWith('http://') || url.startsWith('https://'))
      )
      .slice(0, 3); // Lấy 3 ảnh tốt nhất

    return imageUrls;

  } catch (error) {
    console.error(`    ❌ Lỗi lấy ảnh:`, error.message);
    return [];
  }
};

const searchAndImport = async (queryText, categoryStr) => {
  console.log(`\n🔍 Đang tìm kiếm: "${queryText}" trên Google Maps...`);
  
  let currentPage = 1;
  let totalImported = 0;

  while (currentPage <= MAX_PAGES_PER_QUERY) {
    console.log(`\n📄 Trang ${currentPage}/${MAX_PAGES_PER_QUERY}...`);
    
    const params = {
      engine: 'google_maps',
      q: queryText,
      ll: '@10.243,106.375,13z',
      type: 'search',
      start: (currentPage - 1) * 20
    };

    try {
      const data = await serpApiManager.fetchWithRotation(params);
      
      const localResults = data.local_results || [];
      console.log(`  ✓ Tìm thấy ${localResults.length} kết quả`);

      if (localResults.length === 0) {
        console.log('  → Đã hết dữ liệu');
        break;
      }

      for (let i = 0; i < localResults.length; i++) {
        const item = localResults[i];
        if (!item.title) continue;

        process.stdout.write(`  [${i + 1}/${localResults.length}] ${item.title.substring(0, 40)}...`);

        // Kiểm tra xem đã tồn tại chưa
        const existing = await Destination.findOne({ 
          name: item.title, 
          'location.city': 'Bến Tre' 
        });
        
        if (existing) {
          console.log(' (đã tồn tại)');
          continue;
        }

        // Lấy ảnh từ Google Images
        const images = await fetchImagesFromGoogleImages(item.title, 'Bến Tre');
        
        if (images.length === 0) {
          console.log(' ⚠️  (không có ảnh)');
          continue; // Bỏ qua địa điểm không có ảnh
        }

        // Tạo description
        let descriptionParts = [];
        if (item.address) descriptionParts.push(`Địa chỉ: ${item.address}`);
        if (item.phone) descriptionParts.push(`SĐT: ${item.phone}`);
        if (item.website) descriptionParts.push(`Website: ${item.website}`);

        const dest = {
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
          category: categoryStr,
          rating: item.rating || 0,
          reviewCount: item.reviews || 0,
          amenities: [],
          images: images
        };

        await Destination.create(dest);
        totalImported++;
        console.log(` ✅ (${images.length} ảnh)`);

        // Delay nhỏ giữa các địa điểm
        await delay(1000);
      }

      // Kiểm tra có trang tiếp theo không
      if (data.serpapi_pagination && data.serpapi_pagination.next) {
        currentPage++;
        await delay(2000); // Delay giữa các trang
      } else {
        console.log('  → Không còn trang tiếp theo');
        break;
      }

    } catch (err) {
      console.error(`\n❌ Lỗi:`, err.message);
      break;
    }
  }

  console.log(`\n✅ Đã import ${totalImported} địa điểm mới cho "${queryText}"`);
  return totalImported;
};

const refreshBenTreData = async () => {
  console.log('🔄 BẮT ĐẦU REFRESH DỮ LIỆU BẾN TRE\n');
  console.log('=' .repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Bước 1: Đếm số lượng hiện tại
    const currentCount = await Destination.countDocuments({ 'location.city': 'Bến Tre' });
    console.log(`📊 Hiện tại có: ${currentCount} địa điểm Bến Tre\n`);

    // Bước 2: Xóa toàn bộ dữ liệu Bến Tre
    console.log('🗑️  Đang xóa dữ liệu cũ...');
    const deleteResult = await Destination.deleteMany({ 'location.city': 'Bến Tre' });
    console.log(`✅ Đã xóa ${deleteResult.deletedCount} địa điểm\n`);

    console.log('=' .repeat(70));
    console.log('🚀 BẮT ĐẦU FETCH DỮ LIỆU MỚI\n');

    // Bước 3: Fetch dữ liệu mới với ảnh chất lượng cao
    let totalImported = 0;

    totalImported += await searchAndImport('Khách sạn Bến Tre', 'hotel');
    totalImported += await searchAndImport('Nhà hàng Bến Tre', 'restaurant');
    totalImported += await searchAndImport('Địa điểm du lịch Bến Tre', 'attraction');
    totalImported += await searchAndImport('Quán ăn Bến Tre', 'restaurant');
    totalImported += await searchAndImport('Homestay Bến Tre', 'hotel');

    console.log('\n' + '='.repeat(70));
    console.log('🎉 HOÀN THÀNH!');
    console.log('='.repeat(70));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Đã xóa: ${deleteResult.deletedCount} địa điểm cũ`);
    console.log(`   - Đã thêm: ${totalImported} địa điểm mới`);
    console.log(`   - Tất cả đều có ảnh chất lượng cao từ Google Images`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
refreshBenTreData();
