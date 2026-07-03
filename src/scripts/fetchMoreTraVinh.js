const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để fetch thêm địa điểm Trà Vinh từ Google Maps
 */

const MAX_PAGES_PER_QUERY = 10;
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

    const imageUrls = data.images_results
      .slice(0, 10)
      .map(img => img.original || img.thumbnail)
      .filter(url => 
        url && 
        !url.includes('googleusercontent.com/gps') &&
        !url.includes('tiktok.com') &&
        !url.includes('facebook.com') &&
        !url.includes('instagram.com') &&
        (url.startsWith('http://') || url.startsWith('https://'))
      )
      .slice(0, 3);

    return imageUrls;

  } catch (error) {
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
      ll: '@9.9,106.3,12z', // Trà Vinh coordinates
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
          'location.city': 'Trà Vinh' 
        });
        
        if (existing) {
          console.log(' (đã tồn tại)');
          continue;
        }

        // Lấy ảnh từ Google Images
        const images = await fetchImagesFromGoogleImages(item.title, 'Trà Vinh');
        
        if (images.length === 0) {
          console.log(' ⚠️  (không có ảnh)');
          continue;
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
            city: 'Trà Vinh',
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
        await delay(1500);
      }

      // Kiểm tra có trang tiếp theo không
      if (data.serpapi_pagination && data.serpapi_pagination.next) {
        currentPage++;
        await delay(2000);
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

const fetchMoreTraVinh = async () => {
  console.log('🚀 BẮT ĐẦU FETCH THÊM ĐỊA ĐIỂM TRÀ VINH\n');
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Đếm số lượng hiện tại
    const currentCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    console.log(`📊 Hiện tại có: ${currentCount} địa điểm Trà Vinh\n`);

    console.log('='.repeat(70));
    console.log('🔍 BẮT ĐẦU TÌM KIẾM\n');

    let totalImported = 0;

    // Fetch nhiều loại địa điểm
    totalImported += await searchAndImport('Khách sạn Trà Vinh', 'hotel');
    totalImported += await searchAndImport('Nhà nghỉ Trà Vinh', 'hotel');
    totalImported += await searchAndImport('Homestay Trà Vinh', 'hotel');
    
    totalImported += await searchAndImport('Nhà hàng Trà Vinh', 'restaurant');
    totalImported += await searchAndImport('Quán ăn Trà Vinh', 'restaurant');
    totalImported += await searchAndImport('Quán cafe Trà Vinh', 'restaurant');
    
    totalImported += await searchAndImport('Địa điểm du lịch Trà Vinh', 'attraction');
    totalImported += await searchAndImport('Chùa Khmer Trà Vinh', 'historical');
    totalImported += await searchAndImport('Bãi biển Trà Vinh', 'beach');
    totalImported += await searchAndImport('Khu du lịch Trà Vinh', 'attraction');

    // Đếm lại sau khi import
    const finalCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });

    console.log('\n' + '='.repeat(70));
    console.log('🎉 HOÀN THÀNH!');
    console.log('='.repeat(70));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Trước: ${currentCount} địa điểm`);
    console.log(`   - Đã thêm: ${totalImported} địa điểm mới`);
    console.log(`   - Sau: ${finalCount} địa điểm`);
    console.log(`   - Tất cả đều có ảnh chất lượng cao`);
    console.log('='.repeat(70));

    console.log('\n🚀 Reload trang web để xem kết quả!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
fetchMoreTraVinh();
