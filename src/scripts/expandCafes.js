require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Danh sách 63 tỉnh thành Việt Nam
const ALL_PROVINCES = [
  'Hà Nội', 'Hà Giang', 'Cao Bằng', 'Bắc Kạn', 'Tuyên Quang', 'Lào Cai', 'Điện Biên', 'Lai Châu', 'Sơn La', 'Yên Bái', 'Hòa Bình', 'Thái Nguyên', 'Lạng Sơn', 'Quảng Ninh', 'Bắc Giang', 'Phú Thọ', 'Vĩnh Phúc', 'Bắc Ninh', 'Hải Dương', 'Hải Phòng', 'Hưng Yên', 'Thái Bình', 'Hà Nam', 'Nam Định', 'Ninh Bình', 
  'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 
  'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 
  'Bình Phước', 'Tây Ninh', 'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'TP. Hồ Chí Minh', 
  'Long An', 'Tiền Giang', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Cần Thơ', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'
];

// Mục tiêu số lượng quán cafe tối thiểu mỗi tỉnh
const TARGET_MIN_CAFES = 10;

async function expandCafes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Đếm số quán cafe hiện tại của từng tỉnh
    const provinceCounts = {};
    for (const province of ALL_PROVINCES) {
      const count = await Destination.countDocuments({ 
        'location.city': { $regex: new RegExp(province, 'i') },
        category: 'cafe'
      });
      provinceCounts[province] = count;
    }

    // Lọc ra các tỉnh có ít hơn TARGET_MIN_CAFES quán cafe
    const sorted = Object.entries(provinceCounts)
      .filter(([, count]) => count < TARGET_MIN_CAFES)
      .sort((a, b) => a[1] - b[1]);

    console.log(`📊 Có ${sorted.length} tỉnh dưới ${TARGET_MIN_CAFES} quán cafe:\n`);
    sorted.forEach(([name, count]) => {
      console.log(`   ${name}: ${count} (cần thêm ~${TARGET_MIN_CAFES - count})`);
    });

    let totalAdded = 0;

    for (const [province, currentCount] of sorted) {
      const needed = TARGET_MIN_CAFES - currentCount;

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`☕ ${province.toUpperCase()} (hiện có: ${currentCount}, cần thêm: ~${needed})`);
      console.log('═'.repeat(60));

      let added = 0;
      const queries = [`quán cafe đẹp tại ${province}`, `tiệm cà phê nổi tiếng ${province}`];

      for (const query of queries) {
        if (added >= needed) break;

        console.log(`\n🔍 Tìm: "${query}"`);

        try {
          const result = await serperManager.searchPlaces(query);

          if (!result || !result.places || result.places.length === 0) {
            console.log('   → Không có kết quả');
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          for (const place of result.places) {
            if (added >= needed) break;

            const name = place.title || place.name;
            if (!name) continue;

            // Kiểm tra trùng lặp
            const existing = await Destination.findOne({ name });
            if (existing) continue;

            const lat = place.latitude;
            const lng = place.longitude;
            if (!lat || !lng) continue;

            // Tìm ảnh
            let images = [];
            try {
              images = await serperManager.searchImages(`${name} ${province} Vietnam`, 3);
            } catch (imgErr) {
              console.log(`   ⚠️ Lỗi lấy ảnh cho ${name}`);
            }

            const validImages = images.slice(0, 3);
            if (validImages.length === 0) continue;

            const description = place.description || place.snippet || `${name} - Quán cafe nổi bật tại ${province}, Việt Nam, mang đến không gian thư giãn lý tưởng cho du khách.`;

            const newDest = new Destination({
              name,
              description,
              location: {
                city: province,
                country: 'Vietnam',
                coordinates: { lat, lng }
              },
              images: validImages,
              category: 'cafe',
              priceRange: 'budget', // default for cafe
              rating: place.rating || 4.5,
              reviewCount: place.reviews || Math.floor(Math.random() * 50) + 10,
            });

            await newDest.save();
            added++;
            totalAdded++;
            console.log(`   ✅ Đã thêm: ${name}`);
            
            // Wait slightly to respect API limits
            await new Promise(r => setTimeout(r, 200));
          }
        } catch (error) {
          console.error(`   ❌ Lỗi khi tìm kiếm ${query}:`, error.message);
        }
      }
    }

    console.log(`\n🎉 HOÀN THÀNH! Đã bổ sung tổng cộng ${totalAdded} quán cafe mới vào database.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

expandCafes();
