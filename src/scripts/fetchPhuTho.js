require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Phú Thọ';
const CITY_CENTER = 'Việt Trì';

const destinations = [
  // Đền Hùng - Iconic
  { name: 'Đền Hùng', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Thượng', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Trung', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Hạ', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Khu di tích Đền Hùng', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Núi Nghĩa Lĩnh', category: 'historical', lat: 21.3667, lng: 105.2167 },
  
  // Hồ và suối
  { name: 'Hồ Đầm Vạc', category: 'attraction', lat: 21.3000, lng: 105.1500 },
  { name: 'Suối Mỡ Phú Thọ', category: 'attraction', lat: 21.3500, lng: 105.2000 },
  { name: 'Hồ Văn Lang', category: 'attraction', lat: 21.3667, lng: 105.2167 },
  
  // Rừng và núi
  { name: 'Rừng quốc gia Xuân Sơn', category: 'attraction', lat: 21.1167, lng: 104.9500 },
  { name: 'Thác Mơ Xuân Sơn', category: 'attraction', lat: 21.1167, lng: 104.9500 },
  { name: 'Thác Bạc Xuân Sơn', category: 'attraction', lat: 21.1167, lng: 104.9500 },
  
  // Thành phố Việt Trì
  { name: 'Chợ Việt Trì', category: 'city', lat: 21.3167, lng: 105.4167 },
  { name: 'Công viên Hùng Vương', category: 'city', lat: 21.3167, lng: 105.4167 },
  { name: 'Bảo tàng Phú Thọ', category: 'historical', lat: 21.3167, lng: 105.4167 },
  { name: 'Cầu Việt Trì', category: 'city', lat: 21.3167, lng: 105.4167 },
  
  // Lịch sử và văn hóa
  { name: 'Chùa Bà Đanh', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Mẫu Âu Cơ', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Lạc Long Quân', category: 'historical', lat: 21.3667, lng: 105.2167 },
  { name: 'Đền Giếng', category: 'historical', lat: 21.3667, lng: 105.2167 },
  
  // Làng nghề
  { name: 'Làng gốm Phù Lãng', category: 'countryside', lat: 21.3500, lng: 105.3000 },
  { name: 'Làng nghề Phú Thọ', category: 'countryside', lat: 21.3167, lng: 105.4167 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Phu Tho Hotel', category: 'hotel' },
  { name: 'Phu Tho Hotel', category: 'hotel' },
  { name: 'Viet Tri Hotel', category: 'hotel' },
  { name: 'Hung Vuong Hotel', category: 'hotel' },
  { name: 'Xuan Son National Park Guesthouse', category: 'hotel' },
  { name: 'Phu Tho Riverside Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Phú Thọ', category: 'restaurant' },
  { name: 'Quán Cơm Việt Trì', category: 'restaurant' },
  { name: 'Nhà hàng Hùng Vương', category: 'restaurant' },
  { name: 'Quán Bánh Đúc Phú Thọ', category: 'restaurant' },
  { name: 'Nhà hàng Đền Hùng', category: 'restaurant' },
  { name: 'Quán Ăn Xuân Sơn', category: 'restaurant' }
];

async function fetchPhuTho() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏛️  ${PROVINCE.toUpperCase()} - ĐẤT TỔ HÙNG VƯƠNG`);
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
          
          // Validate Phú Thọ coordinates (21.0 - 21.7 N, 104.8 - 105.5 E)
          if (lat < 21.0 || lat > 21.7 || lng < 104.8 || lng > 105.5) {
            console.log(`   ❌ Tọa độ ngoài Phú Thọ: ${lat}, ${lng}`);
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
          rating: 4.6
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

fetchPhuTho();
