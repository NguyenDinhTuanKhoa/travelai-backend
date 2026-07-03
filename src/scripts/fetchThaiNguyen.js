require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Thái Nguyên';
const CITY_CENTER = 'Thái Nguyên';

const destinations = [
  // Hồ Núi Cốc - Iconic
  { name: 'Hồ Núi Cốc', category: 'attraction', lat: 21.8833, lng: 105.8333 },
  { name: 'Đảo Hồ Núi Cốc', category: 'attraction', lat: 21.8833, lng: 105.8333 },
  { name: 'Khu du lịch Núi Cốc', category: 'attraction', lat: 21.8833, lng: 105.8333 },
  
  // Đồi chè
  { name: 'Đồi chè Tân Cương', category: 'attraction', lat: 21.6167, lng: 105.8500 },
  { name: 'Đồi chè Thái Nguyên', category: 'attraction', lat: 21.5667, lng: 105.8333 },
  { name: 'Làng chè Tân Cương', category: 'countryside', lat: 21.6167, lng: 105.8500 },
  
  // Vườn quốc gia
  { name: 'Vườn quốc gia Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
  { name: 'Thác Bạc Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
  { name: 'Thác Vạc Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
  { name: 'Đỉnh Thiên Thạch', category: 'attraction', lat: 21.4667, lng: 105.6333 },
  
  // Thành phố Thái Nguyên
  { name: 'Bảo tàng Thái Nguyên', category: 'historical', lat: 21.5667, lng: 105.8333 },
  { name: 'Chợ Thái Nguyên', category: 'city', lat: 21.5667, lng: 105.8333 },
  { name: 'Công viên Thái Nguyên', category: 'city', lat: 21.5667, lng: 105.8333 },
  { name: 'Đại học Thái Nguyên', category: 'city', lat: 21.5667, lng: 105.8333 },
  
  // Lịch sử
  { name: 'Khu di tích ATK Định Hóa', category: 'historical', lat: 21.7000, lng: 105.6000 },
  { name: 'Nhà tù Thái Nguyên', category: 'historical', lat: 21.5667, lng: 105.8333 },
  { name: 'Đền Đuổm', category: 'historical', lat: 21.5667, lng: 105.8333 },
  
  // Suối và thác
  { name: 'Suối Mỡ Thái Nguyên', category: 'attraction', lat: 21.6000, lng: 105.7500 },
  { name: 'Thác Mơ Thái Nguyên', category: 'attraction', lat: 21.6500, lng: 105.7000 },
  
  // Làng nghề
  { name: 'Làng nghề Phổ Yên', category: 'countryside', lat: 21.4167, lng: 105.7667 },
  { name: 'Làng trà Tân Cương', category: 'countryside', lat: 21.6167, lng: 105.8500 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Thai Nguyen Hotel', category: 'hotel' },
  { name: 'Thai Nguyen Hotel', category: 'hotel' },
  { name: 'Nui Coc Lake Resort', category: 'hotel' },
  { name: 'Tam Dao Belvedere Resort', category: 'hotel' },
  { name: 'Thai Nguyen Plaza Hotel', category: 'hotel' },
  { name: 'Tan Cuong Tea Resort', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Thái Nguyên', category: 'restaurant' },
  { name: 'Quán Cơm Núi Cốc', category: 'restaurant' },
  { name: 'Nhà hàng Trà Tân Cương', category: 'restaurant' },
  { name: 'Quán Ăn Tam Đảo', category: 'restaurant' },
  { name: 'Nhà hàng Hồ Núi Cốc', category: 'restaurant' },
  { name: 'Quán Cá Hồ Núi Cốc', category: 'restaurant' }
];

async function fetchThaiNguyen() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🍵 ${PROVINCE.toUpperCase()} - TRÀ & HỒ NÚI CỐC`);
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
          
          // Validate Thái Nguyên coordinates (21.3 - 22.0 N, 105.5 - 106.2 E)
          if (lat < 21.3 || lat > 22.0 || lng < 105.5 || lng > 106.2) {
            console.log(`   ❌ Tọa độ ngoài Thái Nguyên: ${lat}, ${lng}`);
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

fetchThaiNguyen();
