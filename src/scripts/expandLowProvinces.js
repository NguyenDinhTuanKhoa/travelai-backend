require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Các tỉnh có ít hơn 50 địa điểm, cần bổ sung
// Các tỉnh có ít hơn 80 địa điểm, cần bổ sung
// Mục tiêu: mỗi tỉnh đạt ít nhất 80 địa điểm
const TARGET_MIN = 80;

// Các query tìm kiếm theo category cho mỗi tỉnh
const SEARCH_QUERIES = [
  { q: 'địa điểm du lịch nổi tiếng', category: 'attraction' },
  { q: 'khu du lịch sinh thái', category: 'attraction' },
  { q: 'bảo tàng di tích lịch sử', category: 'historical' },
  { q: 'chùa đền đình nổi tiếng', category: 'historical' },
  { q: 'nhà hàng ngon nổi tiếng', category: 'restaurant' },
  { q: 'quán ăn đặc sản địa phương', category: 'restaurant' },
  { q: 'khách sạn resort', category: 'hotel' },
  { q: 'homestay nhà nghỉ', category: 'hotel' },
  { q: 'quán cafe đẹp', category: 'restaurant' },
  { q: 'chợ trung tâm mua sắm', category: 'city' },
  { q: 'công viên hồ nước', category: 'attraction' },
  { q: 'núi thác nước suối', category: 'mountain' },
  { q: 'biển bãi tắm', category: 'beach' },
  { q: 'làng nghề truyền thống', category: 'countryside' },
];

// Province bounds from gpsValidator
const PROVINCE_BOUNDS = {
  'Hà Tĩnh': { minLat: 17.8, maxLat: 18.7, minLng: 105.3, maxLng: 106.3, center: 'Hà Tĩnh' },
  'Thái Bình': { minLat: 20.3, maxLat: 20.7, minLng: 106.2, maxLng: 106.6, center: 'Thái Bình' },
  'Thanh Hóa': { minLat: 19.3, maxLat: 20.5, minLng: 104.5, maxLng: 106.0, center: 'Thanh Hóa' },
  'Tuyên Quang': { minLat: 21.4, maxLat: 22.7, minLng: 104.8, maxLng: 105.6, center: 'Tuyên Quang' },
  'Hà Giang': { minLat: 22.4, maxLat: 23.4, minLng: 104.3, maxLng: 105.5, center: 'Hà Giang' },
  'Hưng Yên': { minLat: 20.5, maxLat: 21.1, minLng: 105.9, maxLng: 106.3, center: 'Hưng Yên' },
  'Lai Châu': { minLat: 21.8, maxLat: 22.8, minLng: 102.1, maxLng: 103.7, center: 'Lai Châu' },
  'Bắc Kạn': { minLat: 21.8, maxLat: 22.6, minLng: 105.4, maxLng: 106.2, center: 'Bắc Kạn' },
  'Bắc Giang': { minLat: 21.1, maxLat: 21.7, minLng: 106.0, maxLng: 107.0, center: 'Bắc Giang' },
  'Hà Nam': { minLat: 20.3, maxLat: 20.7, minLng: 105.8, maxLng: 106.1, center: 'Phủ Lý' },
  'Hải Dương': { minLat: 20.7, maxLat: 21.2, minLng: 106.1, maxLng: 106.7, center: 'Hải Dương' },
  'Vĩnh Phúc': { minLat: 21.1, maxLat: 21.6, minLng: 105.3, maxLng: 105.9, center: 'Vĩnh Yên' },
  'Yên Bái': { minLat: 21.3, maxLat: 22.2, minLng: 104.2, maxLng: 105.2, center: 'Yên Bái' },
  'Bắc Ninh': { minLat: 20.9, maxLat: 21.3, minLng: 105.9, maxLng: 106.4, center: 'Bắc Ninh' },
  'Nam Định': { minLat: 20.0, maxLat: 20.6, minLng: 105.9, maxLng: 106.5, center: 'Nam Định' },
  'Ninh Bình': { minLat: 19.9, maxLat: 20.5, minLng: 105.7, maxLng: 106.2, center: 'Ninh Bình' },
  'Lạng Sơn': { minLat: 21.4, maxLat: 22.3, minLng: 106.3, maxLng: 107.4, center: 'Lạng Sơn' },
  'Thái Nguyên': { minLat: 21.3, maxLat: 22.0, minLng: 105.5, maxLng: 106.2, center: 'Thái Nguyên' },
  'Cao Bằng': { minLat: 22.3, maxLat: 23.1, minLng: 105.5, maxLng: 106.8, center: 'Cao Bằng' },
  'Quảng Trị': { minLat: 16.3, maxLat: 17.2, minLng: 106.3, maxLng: 107.5, center: 'Đông Hà' },
  'Hòa Bình': { minLat: 20.3, maxLat: 21.1, minLng: 104.8, maxLng: 105.8, center: 'Hòa Bình' },
  'Sơn La': { minLat: 20.6, maxLat: 21.7, minLng: 103.3, maxLng: 105.0, center: 'Sơn La' },
  'Phú Thọ': { minLat: 21.1, maxLat: 21.7, minLng: 104.8, maxLng: 105.5, center: 'Việt Trì' },
  'Lào Cai': { minLat: 21.8, maxLat: 22.9, minLng: 103.5, maxLng: 104.7, center: 'Lào Cai' },
  'Đồng Nai': { minLat: 10.5, maxLat: 11.4, minLng: 106.7, maxLng: 107.6, center: 'Biên Hòa' },
  'Điện Biên': { minLat: 20.9, maxLat: 22.0, minLng: 102.5, maxLng: 103.5, center: 'Điện Biên Phủ' },
  'Hải Phòng': { minLat: 20.6, maxLat: 21.0, minLng: 106.4, maxLng: 107.1, center: 'Hải Phòng' },
  'Đắk Nông': { minLat: 11.8, maxLat: 12.8, minLng: 107.3, maxLng: 108.2, center: 'Gia Nghĩa' },
  'Hậu Giang': { minLat: 9.5, maxLat: 10.1, minLng: 105.4, maxLng: 106.0, center: 'Vị Thanh' },
  'Nghệ An': { minLat: 18.3, maxLat: 19.8, minLng: 104.0, maxLng: 105.8, center: 'Vinh' },
  'Quảng Bình': { minLat: 17.0, maxLat: 18.2, minLng: 105.6, maxLng: 107.0, center: 'Đồng Hới' },
};

async function expandLowProvinces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Đếm số địa điểm hiện tại của từng tỉnh
    const provinceCounts = {};
    for (const province of Object.keys(PROVINCE_BOUNDS)) {
      const count = await Destination.countDocuments({ 'location.city': province });
      provinceCounts[province] = count;
    }

    // Sắp xếp theo số lượng ít nhất
    const sorted = Object.entries(provinceCounts)
      .filter(([, count]) => count < TARGET_MIN)
      .sort((a, b) => a[1] - b[1]);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     BỔ SUNG DỮ LIỆU CHO CÁC TỈNH ÍT ĐỊA ĐIỂM          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Có ${sorted.length} tỉnh dưới ${TARGET_MIN} địa điểm:\n`);
    sorted.forEach(([name, count]) => {
      console.log(`   ${name}: ${count} (cần thêm ~${TARGET_MIN - count})`);
    });

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question(`\n🔄 Bắt đầu bổ sung? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Đã hủy.');
      process.exit(0);
      return;
    }

    let totalAdded = 0;
    let totalApiCalls = 0;

    for (const [province, currentCount] of sorted) {
      const needed = TARGET_MIN - currentCount;
      const bounds = PROVINCE_BOUNDS[province];

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📍 ${province.toUpperCase()} (hiện có: ${currentCount}, cần thêm: ~${needed})`);
      console.log('═'.repeat(60));

      let added = 0;

      for (const searchQuery of SEARCH_QUERIES) {
        if (added >= needed) break;

        const query = `${searchQuery.q} tại ${province}`;
        console.log(`\n🔍 Tìm: "${query}"`);

        try {
          // Dùng Serper Places API
          const result = await serperManager.searchPlaces(query);
          totalApiCalls++;

          if (!result || !result.places || result.places.length === 0) {
            console.log('   → Không có kết quả');
            await new Promise(r => setTimeout(r, 300));
            continue;
          }

          for (const place of result.places) {
            if (added >= needed) break;

            const name = place.title || place.name;
            if (!name) continue;

            // Kiểm tra trùng lặp
            const existing = await Destination.findOne({ name });
            if (existing) {
              continue;
            }

            // Kiểm tra tọa độ
            const lat = place.latitude;
            const lng = place.longitude;

            if (!lat || !lng) continue;

            // Kiểm tra nằm trong bounds tỉnh (lỏng hơn 1 chút)
            if (lat < bounds.minLat - 0.2 || lat > bounds.maxLat + 0.2 ||
                lng < bounds.minLng - 0.2 || lng > bounds.maxLng + 0.2) {
              continue;
            }

            // Tìm ảnh
            let images = [];
            try {
              images = await serperManager.searchImages(`${name} ${province} Vietnam`, 5);
              totalApiCalls++;
            } catch (imgErr) {
              // Nếu hết credit cho images, skip
            }

            const validImages = images.slice(0, 3);
            if (validImages.length === 0) {
              continue;
            }

            // Xác định category
            let category = searchQuery.category;
            const addr = (place.address || '').toLowerCase();
            const titleLower = name.toLowerCase();
            if (titleLower.includes('khách sạn') || titleLower.includes('hotel') || titleLower.includes('resort') || titleLower.includes('homestay')) {
              category = 'hotel';
            } else if (titleLower.includes('nhà hàng') || titleLower.includes('quán') || titleLower.includes('restaurant') || titleLower.includes('cafe') || titleLower.includes('cà phê')) {
              category = 'restaurant';
            } else if (titleLower.includes('chùa') || titleLower.includes('đền') || titleLower.includes('đình') || titleLower.includes('miếu') || titleLower.includes('bảo tàng')) {
              category = 'historical';
            }

            // Tạo description
            const description = place.description || place.snippet || `${name} - ${searchQuery.q} tại ${province}, Việt Nam`;

            const newDest = new Destination({
              name,
              description,
              location: {
                city: province,
                country: 'Vietnam',
                coordinates: { lat, lng }
              },
              images: validImages,
              category,
              rating: place.rating || 4.0,
              reviewCount: place.reviews || 0,
            });

            await newDest.save();
            added++;
            totalAdded++;
            console.log(`   ✅ [${added}/${needed}] ${name} (${category})`);

            await new Promise(r => setTimeout(r, 400));
          }
        } catch (err) {
          if (err.message && err.message.includes('Not enough credits')) {
            console.log('\n⚠️ HẾT CREDIT SERPER API! Dừng lại.');
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`🎯 TỔNG KẾT: Đã thêm ${totalAdded} địa điểm mới (${totalApiCalls} API calls)`);
            console.log('═'.repeat(60));
            process.exit(0);
            return;
          }
          console.log(`   ❌ Lỗi: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, 300));
      }

      const newTotal = await Destination.countDocuments({ 'location.city': province });
      console.log(`\n📊 ${province}: ${currentCount} → ${newTotal} (+${added})`);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎉 HOÀN THÀNH: Đã thêm tổng cộng ${totalAdded} địa điểm mới!`);
    console.log(`📡 Tổng API calls: ${totalApiCalls}`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

expandLowProvinces();
