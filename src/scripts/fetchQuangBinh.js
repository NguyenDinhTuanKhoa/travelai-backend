require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Quảng Bình';
const CITY_CENTER = 'Đồng Hới';

// Danh sách địa điểm du lịch Quảng Bình
const destinations = [
  // Di sản thiên nhiên UNESCO
  { name: 'Động Phong Nha', category: 'attraction' },
  { name: 'Động Thiên Đường', category: 'attraction' },
  { name: 'Hang Sơn Đoòng', category: 'attraction' },
  { name: 'Hang Én', category: 'attraction' },
  { name: 'Suối Nước Moóc', category: 'attraction' },
  { name: 'Vườn Quốc gia Phong Nha-Kẻ Bàng', category: 'attraction' },
  { name: 'Động Tú Làn', category: 'attraction' },
  { name: 'Hang Tối', category: 'attraction' },
  { name: 'Hang Tiên', category: 'attraction' },
  
  // Biển và đảo
  { name: 'Bãi biển Nhật Lệ', category: 'beach' },
  { name: 'Bãi biển Đá Nhảy', category: 'beach' },
  { name: 'Bãi biển Quảng Bình', category: 'beach' },
  { name: 'Đảo Yến', category: 'attraction' },
  
  // Lịch sử - văn hóa
  { name: 'Thành cổ Quảng Trị', category: 'historical' },
  { name: 'Nhà thờ Đồng Hới', category: 'historical' },
  { name: 'Bảo tàng Quảng Bình', category: 'historical' },
  { name: 'Thành Nhà Hồ', category: 'historical' },
  { name: 'Đền Bà Triệu', category: 'historical' },
  
  // Núi và thác
  { name: 'Núi Phong Nha', category: 'attraction' },
  { name: 'Thác Gió', category: 'attraction' },
  { name: 'Thác Mơ', category: 'attraction' },
  
  // Khách sạn resort
  { name: 'Phong Nha Lake House Resort', category: 'hotel' },
  { name: 'Chay Lap Farmstay', category: 'hotel' },
  { name: 'Victory Road Villas', category: 'hotel' },
  { name: 'Phong Nha Coco House', category: 'hotel' },
  { name: 'Oxalis Adventure Camp', category: 'hotel' },
  { name: 'Sun Spa Resort Quảng Bình', category: 'hotel' },
  { name: 'Muong Thanh Luxury Nhat Le Hotel', category: 'hotel' },
  { name: 'Gold Coast Hotel Resort', category: 'hotel' },
  { name: 'Sai Gon Quang Binh Hotel', category: 'hotel' },
  { name: 'Phong Nha Farmstay', category: 'hotel' },
  
  // Nhà hàng đặc sản
  { name: 'Nhà hàng Phong Nha', category: 'restaurant' },
  { name: 'Quán Cô Ba Quảng Bình', category: 'restaurant' },
  { name: 'Nhà hàng Bamboo Cafe', category: 'restaurant' },
  { name: 'Pub with Cold Beer', category: 'restaurant' },
  { name: 'Easy Tiger Hostel Restaurant', category: 'restaurant' },
  { name: 'Nhà hàng Riverside Phong Nha', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Quảng Bình', category: 'restaurant' },
  { name: 'Nhà hàng Hải Sản Đồng Hới', category: 'restaurant' },
  { name: 'Quán Bánh Xèo Quảng Bình', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển', category: 'restaurant' },
  
  // Cafe
  { name: 'Phong Nha Coffee Station', category: 'restaurant' },
  { name: 'Jungle Bar Phong Nha', category: 'restaurant' },
  { name: 'Capture Vietnam Cafe', category: 'restaurant' },
  { name: 'Cafe Nhật Lệ', category: 'restaurant' },
  { name: 'The Pub with Cold Beer Phong Nha', category: 'restaurant' },
  
  // Chợ và mua sắm
  { name: 'Chợ Đồng Hới', category: 'city' },
  { name: 'Chợ Phong Nha', category: 'city' },
  { name: 'Chợ Quảng Trạch', category: 'city' },
  
  // Làng nghề và nông thôn
  { name: 'Làng Phong Nha', category: 'countryside' },
  { name: 'Làng Chày Lập', category: 'countryside' },
  { name: 'Làng Bản Đoòng', category: 'countryside' },
  { name: 'Làng Tân Hóa', category: 'countryside' }
];

async function fetchQuangBinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏔️  BẮT ĐẦU THU THẬP DỮ LIỆU: ${PROVINCE.toUpperCase()}`);
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

      // Kiểm tra đã tồn tại chưa
      const existing = await Destination.findOne({
        name: dest.name,
        'location.city': PROVINCE
      });

      if (existing) {
        console.log(`   ⏭️  Đã tồn tại, bỏ qua`);
        skipped++;
        continue;
      }

      try {
        // Tìm kiếm địa điểm
        const query = `${dest.name} ${CITY_CENTER} ${PROVINCE}`;
        const placeResult = await serperManager.searchPlaces(query);

        if (!placeResult.places || placeResult.places.length === 0) {
          console.log(`   ❌ Không tìm thấy địa điểm`);
          failed++;
          continue;
        }

        const place = placeResult.places[0];

        // Validate GPS
        if (!place.latitude || !place.longitude) {
          console.log(`   ❌ Không có tọa độ GPS`);
          failed++;
          continue;
        }

        const lat = place.latitude;
        const lng = place.longitude;

        if (!isWithinProvince(lat, lng, PROVINCE)) {
          console.log(`   ❌ Tọa độ ngoài ${PROVINCE}: [${lng.toFixed(4)}, ${lat.toFixed(4)}]`);
          failed++;
          continue;
        }

        console.log(`   ✅ GPS hợp lệ: [${lng.toFixed(4)}, ${lat.toFixed(4)}]`);

        // Tìm hình ảnh
        console.log(`   🖼️  Đang tìm hình ảnh...`);
        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          console.log(`   ⚠️  Không tìm thấy hình ảnh`);
        } else {
          console.log(`   ✅ Tìm thấy ${validImages.length} hình ảnh`);
        }

        // Tạo destination mới
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
        console.log(`   💾 Đã lưu thành công!`);

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        failed++;
      }

      // Delay để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 KẾT QUẢ:');
    console.log('═'.repeat(60));
    console.log(`✅ Đã lưu: ${saved}`);
    console.log(`⏭️  Bỏ qua (đã tồn tại): ${skipped}`);
    console.log(`❌ Thất bại: ${failed}`);
    console.log(`📍 Tổng: ${saved + skipped}/${destinations.length}`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

fetchQuangBinh();
