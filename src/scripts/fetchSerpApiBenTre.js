const mongoose = require('mongoose');
const serpApiManager = require('../utils/serpApiManager');
const Destination = require('../models/Destination');

const MAX_PAGES_PER_QUERY = 20; // 20 trang = 400 địa điểm mỗi loại

const searchAndImport = async (queryText, categoryStr) => {
  console.log(`\n🔍 Đang tìm kiếm: "${queryText}" trên Google Maps...`);
  
  let currentPage = 1;
  let totalImported = 0;

  while (currentPage <= MAX_PAGES_PER_QUERY) {
    console.log(`- Đang lấy trang ${currentPage}...`);
    
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
      console.log(`  => Tìm thấy ${localResults.length} kết quả ở trang này.`);

      if (localResults.length === 0) {
        console.log('  => Đã hết dữ liệu (Không còn kết quả).');
        break;
      }

      for (const item of localResults) {
        if (!item.title) continue;

        let amenities = [];
        let descriptionParts = [];

        if (item.address) descriptionParts.push(`Địa chỉ: ${item.address}`);
        if (item.phone) descriptionParts.push(`SĐT: ${item.phone}`);
        if (item.website) descriptionParts.push(`Website: ${item.website}`);
        if (item.operating_hours) {
          const hours = Object.values(item.operating_hours)[0];
          if (hours) descriptionParts.push(`Giờ mở cửa: ${hours}`);
        }

        // Lấy nhiều nguồn ảnh từ SerpAPI
        let images = [];
        if (item.thumbnail) images.push(item.thumbnail);
        if (item.photos && Array.isArray(item.photos)) {
          // Lấy tối đa 3 ảnh từ photos array
          const photoUrls = item.photos.slice(0, 3).map(p => p.thumbnail || p.image).filter(url => url);
          images.push(...photoUrls);
        }
        // Loại bỏ ảnh trùng lặp
        images = [...new Set(images)];

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
          amenities: amenities,
          images: images
        };

        const existing = await Destination.findOne({ name: dest.name, 'location.city': 'Bến Tre' });
        if (!existing) {
          await Destination.create(dest);
          totalImported++;
        }
      }

      // Kiểm tra xem SerpApi có trả về link next không
      if (data.serpapi_pagination && data.serpapi_pagination.next) {
        currentPage++;
      } else {
        console.log('  => Đã hết dữ liệu (Không còn trang tiếp theo).');
        break;
      }

    } catch (err) {
      console.error('❌ Lỗi khi lấy dữ liệu:', err.message);
      break;
    }
  }

  console.log(`✅ Đã import thành công thêm ${totalImported} địa điểm cho "${queryText}".`);
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Chạy các query với SerpApi
    await searchAndImport('Khách sạn Bến Tre', 'hotel');
    await searchAndImport('Nhà hàng Bến Tre', 'restaurant');
    await searchAndImport('Địa điểm du lịch Bến Tre', 'attraction');

    console.log('\n🎉 Đã hoàn tất quá trình cào dữ liệu Google Maps!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi hệ thống:', error.message);
    process.exit(1);
  }
};

run();
