require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Quảng Trị';
const CITY_CENTER = 'Đông Hà';

const destinations = [
  // Lịch sử chiến tranh
  { name: 'Thành cổ Quảng Trị', category: 'historical' },
  { name: 'Địa đạo Vĩnh Mốc', category: 'historical' },
  { name: 'Nghĩa trang Trường Sơn', category: 'historical' },
  { name: 'Cầu Hiền Lương', category: 'historical' },
  { name: 'Bến Hải', category: 'historical' },
  { name: 'Căn cứ Khe Sanh', category: 'historical' },
  { name: 'Đường Hồ Chí Minh', category: 'historical' },
  { name: 'Bảo tàng Quảng Trị', category: 'historical' },
  { name: 'Nhà thờ La Vang', category: 'historical' },
  
  // Biển và đảo
  { name: 'Bãi biển Cửa Tùng', category: 'beach' },
  { name: 'Bãi biển Cửa Việt', category: 'beach' },
  { name: 'Bãi biển Mỹ Thủy', category: 'beach' },
  { name: 'Đảo Cồn Cỏ', category: 'attraction' },
  
  // Núi và thác
  { name: 'Núi Tà Rụt', category: 'attraction' },
  { name: 'Thác Khe Nước Trong', category: 'attraction' },
  
  // Khách sạn
  { name: 'Sepon Hotel Quảng Trị', category: 'hotel' },
  { name: 'Muong Thanh Quang Tri Hotel', category: 'hotel' },
  { name: 'Cua Tung Beach Hotel', category: 'hotel' },
  { name: 'Saigon Quang Tri Hotel', category: 'hotel' },
  { name: 'Dong Ha Hotel', category: 'hotel' },
  { name: 'Vinh Moc Homestay', category: 'hotel' },
  { name: 'Cua Viet Beach Resort', category: 'hotel' },
  { name: 'Quang Tri Citadel Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Cửa Tùng', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Quảng Trị', category: 'restaurant' },
  { name: 'Nhà hàng Đông Hà', category: 'restaurant' },
  { name: 'Quán Bánh Bột Lọc Quảng Trị', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển Cửa Việt', category: 'restaurant' },
  { name: 'Quán Bún Bò Huế Quảng Trị', category: 'restaurant' },
  { name: 'Nhà hàng Sông Bến Hải', category: 'restaurant' },
  
  // Cafe
  { name: 'Cafe Cửa Tùng', category: 'restaurant' },
  { name: 'Cafe Đông Hà', category: 'restaurant' },
  { name: 'Cafe Hiền Lương', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Đông Hà', category: 'city' },
  { name: 'Chợ Quảng Trị', category: 'city' },
  { name: 'Chợ Cửa Việt', category: 'city' }
];

async function fetchQuangTri() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏛️  BẮT ĐẦU THU THẬP DỮ LIỆU: ${PROVINCE.toUpperCase()}`);
    console.log('═'.repeat(60));
    console.log(`📍 Tỉnh: ${PROVINCE}`);
    console.log(`🎯 Trung tâm: ${CITY_CENTER}`);
    console.log(`📊 Tổng địa điểm: ${destinations.length}`);
    console.log('═'.repeat(60));

    let saved = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      const progress = `[${i + 1}/${destinations.length}]`;

      console.log(`\n${progress} 🔍 ${dest.name}...`);

      const existing = await Destination.findOne({
        name: dest.name,
        'location.city': PROVINCE
      });

      if (existing) {
        console.log(`   ⏭️  Đã tồn tại`);
        skipped++;
        continue;
      }

      try {
        const query = `${dest.name} ${CITY_CENTER} ${PROVINCE}`;
        const placeResult = await serperManager.searchPlaces(query);

        if (!placeResult.places || placeResult.places.length === 0) {
          console.log(`   ❌ Không tìm thấy`);
          failed++;
          continue;
        }

        const place = placeResult.places[0];

        if (!place.latitude || !place.longitude) {
          console.log(`   ❌ Không có tọa độ`);
          failed++;
          continue;
        }

        const lat = place.latitude;
        const lng = place.longitude;

        if (!isWithinProvince(lat, lng, PROVINCE)) {
          console.log(`   ❌ Ngoài ${PROVINCE}`);
          failed++;
          continue;
        }

        console.log(`   ✅ GPS: [${lng.toFixed(4)}, ${lat.toFixed(4)}]`);

        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${PROVINCE} - Bắc Trung Bộ`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: place.rating || 4.5,
          reviewCount: 0,
          amenities: [],
          bestTimeToVisit: [],
          activities: []
        });

        await newDestination.save();
        saved++;
        console.log(`   💾 Đã lưu!`);

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 KẾT QUẢ:');
    console.log('═'.repeat(60));
    console.log(`✅ Đã lưu: ${saved}`);
    console.log(`⏭️  Bỏ qua: ${skipped}`);
    console.log(`❌ Thất bại: ${failed}`);
    console.log(`📍 Tổng: ${saved + skipped}/${destinations.length}`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

fetchQuangTri();
