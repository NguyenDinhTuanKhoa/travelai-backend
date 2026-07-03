require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Nam Định';
const CITY_CENTER = 'Nam Định';

const destinations = [
  // Nhà thờ - Iconic
  { name: 'Nhà thờ Phủ Cam', category: 'historical', lat: 20.4333, lng: 106.1667 },
  { name: 'Nhà thờ Kẻ Sặt', category: 'historical', lat: 20.4500, lng: 106.1833 },
  { name: 'Nhà thờ Xuân Ngọc', category: 'historical', lat: 20.4167, lng: 106.1500 },
  
  // Chùa và đền
  { name: 'Chùa Cổ Lễ', category: 'historical', lat: 20.4333, lng: 106.1667 },
  { name: 'Đền Trần', category: 'historical', lat: 20.4333, lng: 106.1667 },
  { name: 'Đền Thiên Trường', category: 'historical', lat: 20.4333, lng: 106.1667 },
  { name: 'Chùa Phổ Minh', category: 'historical', lat: 20.4333, lng: 106.1667 },
  
  // Biển
  { name: 'Bãi biển Thịnh Long', category: 'beach', lat: 20.2000, lng: 106.4000 },
  { name: 'Bãi biển Quất Lâm', category: 'beach', lat: 20.2167, lng: 106.4167 },
  { name: 'Bãi biển Hải Hậu', category: 'beach', lat: 20.2333, lng: 106.4333 },
  
  // Rừng và vườn quốc gia
  { name: 'Vườn quốc gia Xuân Thủy', category: 'attraction', lat: 20.2500, lng: 106.5000 },
  { name: 'Rừng ngập mặn Xuân Thủy', category: 'attraction', lat: 20.2500, lng: 106.5000 },
  
  // Thành phố Nam Định
  { name: 'Chợ Nam Định', category: 'city', lat: 20.4333, lng: 106.1667 },
  { name: 'Công viên Nam Định', category: 'city', lat: 20.4333, lng: 106.1667 },
  { name: 'Bảo tàng Nam Định', category: 'historical', lat: 20.4333, lng: 106.1667 },
  { name: 'Phố đi bộ Nam Định', category: 'city', lat: 20.4333, lng: 106.1667 },
  
  // Làng nghề
  { name: 'Làng nghề Cồn Thoi', category: 'countryside', lat: 20.4500, lng: 106.2000 },
  { name: 'Làng nghề Nam Định', category: 'countryside', lat: 20.4333, lng: 106.1667 },
  
  // Hồ và sông
  { name: 'Sông Đào', category: 'attraction', lat: 20.4333, lng: 106.1667 },
  { name: 'Hồ Nam Định', category: 'attraction', lat: 20.4333, lng: 106.1667 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Nam Dinh Hotel', category: 'hotel' },
  { name: 'Nam Dinh Hotel', category: 'hotel' },
  { name: 'Nam Cuong Hotel Nam Dinh', category: 'hotel' },
  { name: 'Nam Dinh Plaza Hotel', category: 'hotel' },
  { name: 'Xuan Thuy Ecolodge', category: 'hotel' },
  { name: 'Nam Dinh Riverside Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Nam Định', category: 'restaurant' },
  { name: 'Quán Cơm Nam Định', category: 'restaurant' },
  { name: 'Nhà hàng Hải Sản Thịnh Long', category: 'restaurant' },
  { name: 'Quán Phở Nam Định', category: 'restaurant' },
  { name: 'Nhà hàng Xuân Thủy', category: 'restaurant' },
  { name: 'Quán Ăn Đền Trần', category: 'restaurant' }
];

async function fetchNamDinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`⛪ ${PROVINCE.toUpperCase()} - NHÀ THỜ PHỦ CAM`);
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
          
          // Validate Nam Định coordinates (20.0 - 20.6 N, 106.0 - 106.6 E)
          if (lat < 20.0 || lat > 20.6 || lng < 106.0 || lng > 106.6) {
            console.log(`   ❌ Tọa độ ngoài Nam Định: ${lat}, ${lng}`);
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
          description: `${dest.name} tại ${PROVINCE} - Đồng Bằng Sông Hồng`,
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

fetchNamDinh();
