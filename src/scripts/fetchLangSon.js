require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Lạng Sơn';
const CITY_CENTER = 'Lạng Sơn';

const destinations = [
  // Cửa khẩu và biên giới
  { name: 'Cửa khẩu Hữu Nghị', category: 'city', lat: 21.8500, lng: 106.7167 },
  { name: 'Cửa khẩu Tân Thanh', category: 'city', lat: 21.8667, lng: 106.7333 },
  { name: 'Chợ Đồng Đăng', category: 'city', lat: 21.8500, lng: 106.7167 },
  
  // Hang động
  { name: 'Động Tam Thanh', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  { name: 'Động Nhị Thanh', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  { name: 'Động Nhất Thanh', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  { name: 'Động Tiên', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  
  // Núi và đèo
  { name: 'Núi Mẫu Sơn', category: 'attraction', lat: 21.8833, lng: 106.9167 },
  { name: 'Đèo Mẫu Sơn', category: 'attraction', lat: 21.8833, lng: 106.9167 },
  { name: 'Thác Mẫu Sơn', category: 'attraction', lat: 21.8833, lng: 106.9167 },
  { name: 'Núi Vọng Phu', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  
  // Lịch sử
  { name: 'Thành Nhà Mạc', category: 'historical', lat: 21.8500, lng: 106.7500 },
  { name: 'Đền Mẫu Đồng Đăng', category: 'historical', lat: 21.8500, lng: 106.7167 },
  { name: 'Đền Kỳ Cùng', category: 'historical', lat: 21.8500, lng: 106.7500 },
  { name: 'Bảo tàng Lạng Sơn', category: 'historical', lat: 21.8500, lng: 106.7500 },
  
  // Thành phố Lạng Sơn
  { name: 'Chợ Lạng Sơn', category: 'city', lat: 21.8500, lng: 106.7500 },
  { name: 'Công viên Kỳ Lừa', category: 'city', lat: 21.8500, lng: 106.7500 },
  { name: 'Cầu Kỳ Cùng', category: 'city', lat: 21.8500, lng: 106.7500 },
  
  // Hồ và suối
  { name: 'Hồ Khuôn Thần', category: 'attraction', lat: 21.8833, lng: 106.9167 },
  { name: 'Suối Lạng Sơn', category: 'attraction', lat: 21.8500, lng: 106.7500 },
  
  // Làng bản
  { name: 'Bản Lũng Phình', category: 'countryside', lat: 21.8667, lng: 106.8000 },
  { name: 'Làng văn hóa Lạng Sơn', category: 'countryside', lat: 21.8500, lng: 106.7500 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Lang Son Hotel', category: 'hotel' },
  { name: 'Lang Son Hotel', category: 'hotel' },
  { name: 'Mau Son Resort', category: 'hotel' },
  { name: 'Dong Dang Hotel', category: 'hotel' },
  { name: 'Lang Son Plaza Hotel', category: 'hotel' },
  { name: 'Huu Nghi Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Lạng Sơn', category: 'restaurant' },
  { name: 'Quán Cơm Đồng Đăng', category: 'restaurant' },
  { name: 'Nhà hàng Mẫu Sơn', category: 'restaurant' },
  { name: 'Quán Phở Lạng Sơn', category: 'restaurant' },
  { name: 'Nhà hàng Cửa Khẩu', category: 'restaurant' },
  { name: 'Quán Ăn Hữu Nghị', category: 'restaurant' }
];

async function fetchLangSon() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏔️  ${PROVINCE.toUpperCase()} - CỬA KHẨU HỮU NGHỊ`);
    console.log('═'.repeat(60));

    let saved = 0, skipped = 0, failed = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      console.log(`\n[${i + 1}/${destinations.length}] ${dest.name}...`);

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
        let lat, lng;
        
        if (dest.lat && dest.lng) {
          lat = dest.lat;
          lng = dest.lng;
        } else {
          const query = `${dest.name} ${CITY_CENTER} ${PROVINCE}`;
          const placeResult = await serperManager.searchPlaces(query);

          if (!placeResult.places || placeResult.places.length === 0) {
            console.log(`   ❌ Không tìm thấy tọa độ`);
            failed++;
            continue;
          }

          const place = placeResult.places[0];
          if (!place.latitude || !place.longitude) {
            console.log(`   ❌ Không có tọa độ`);
            failed++;
            continue;
          }

          lat = place.latitude;
          lng = place.longitude;
          
          // Validate Lạng Sơn coordinates (21.5 - 22.2 N, 106.5 - 107.2 E)
          if (lat < 21.5 || lat > 22.2 || lng < 106.5 || lng > 107.2) {
            console.log(`   ❌ Tọa độ ngoài Lạng Sơn: ${lat}, ${lng}`);
            failed++;
            continue;
          }
        }

        const images = await serperManager.searchImages(`${dest.name} ${PROVINCE}`, 5);
        const validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          console.log(`   ❌ Không có hình ảnh`);
          failed++;
          continue;
        }

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${PROVINCE} - Đông Bắc`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: 4.5
        });

        await newDestination.save();
        saved++;
        console.log(`   ✅ Đã lưu (${validImages.length} ảnh)`);

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 KẾT QUẢ:`);
    console.log(`   ✅ Đã lưu: ${saved}`);
    console.log(`   ⏭️  Bỏ qua: ${skipped}`);
    console.log(`   ❌ Thất bại: ${failed}`);
    
    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`\n🎯 TỔNG ${PROVINCE}: ${total} địa điểm`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchLangSon();
