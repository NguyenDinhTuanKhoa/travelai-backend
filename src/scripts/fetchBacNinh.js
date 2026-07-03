require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Bắc Ninh';
const CITY_CENTER = 'Bắc Ninh';

const destinations = [
  // Quan họ - UNESCO
  { name: 'Làng Quan họ Diềm', category: 'historical', lat: 21.1833, lng: 106.0500 },
  { name: 'Làng Quan họ Lim', category: 'historical', lat: 21.1833, lng: 106.0500 },
  { name: 'Hội Lim', category: 'historical', lat: 21.1833, lng: 106.0500 },
  { name: 'Đền Lim', category: 'historical', lat: 21.1833, lng: 106.0500 },
  
  // Chùa và đền
  { name: 'Chùa Dâu', category: 'historical', lat: 21.1667, lng: 106.0667 },
  { name: 'Chùa Phật Tích', category: 'historical', lat: 21.2167, lng: 106.1167 },
  { name: 'Đền Đô', category: 'historical', lat: 21.1833, lng: 106.0833 },
  { name: 'Đền Bà Chúa Kho', category: 'historical', lat: 21.1667, lng: 106.0833 },
  
  // Lịch sử
  { name: 'Thành Cổ Loa', category: 'historical', lat: 21.1333, lng: 105.9167 },
  { name: 'Đền An Dương Vương', category: 'historical', lat: 21.1333, lng: 105.9167 },
  { name: 'Đền Mỵ Châu', category: 'historical', lat: 21.1333, lng: 105.9167 },
  { name: 'Bảo tàng Bắc Ninh', category: 'historical', lat: 21.1833, lng: 106.0500 },
  
  // Thành phố Bắc Ninh
  { name: 'Chợ Bắc Ninh', category: 'city', lat: 21.1833, lng: 106.0500 },
  { name: 'Công viên Kinh Bắc', category: 'city', lat: 21.1833, lng: 106.0500 },
  { name: 'Phố đi bộ Bắc Ninh', category: 'city', lat: 21.1833, lng: 106.0500 },
  
  // Làng nghề
  { name: 'Làng gốm Phù Lãng', category: 'countryside', lat: 21.2000, lng: 106.1000 },
  { name: 'Làng tranh Đông Hồ', category: 'countryside', lat: 21.1500, lng: 106.1500 },
  { name: 'Làng đúc đồng Đại Bái', category: 'countryside', lat: 21.2000, lng: 106.0833 },
  
  // Hồ và công viên
  { name: 'Hồ Văn Miếu Bắc Ninh', category: 'city', lat: 21.1833, lng: 106.0500 },
  { name: 'Công viên Hồ Bạch Đằng', category: 'city', lat: 21.1833, lng: 106.0500 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Bac Ninh Hotel', category: 'hotel' },
  { name: 'Bac Ninh Hotel', category: 'hotel' },
  { name: 'Kinh Bac Hotel', category: 'hotel' },
  { name: 'Bac Ninh Plaza Hotel', category: 'hotel' },
  { name: 'Quan Ho Hotel', category: 'hotel' },
  { name: 'Bac Ninh Riverside Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Bắc Ninh', category: 'restaurant' },
  { name: 'Quán Cơm Quan Họ', category: 'restaurant' },
  { name: 'Nhà hàng Kinh Bắc', category: 'restaurant' },
  { name: 'Quán Phở Bắc Ninh', category: 'restaurant' },
  { name: 'Nhà hàng Chùa Dâu', category: 'restaurant' },
  { name: 'Quán Ăn Lim', category: 'restaurant' }
];

async function fetchBacNinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🎵 ${PROVINCE.toUpperCase()} - QUAN HỌ UNESCO`);
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
          
          // Validate Bắc Ninh coordinates (21.0 - 21.3 N, 105.9 - 106.2 E)
          if (lat < 21.0 || lat > 21.3 || lng < 105.9 || lng > 106.2) {
            console.log(`   ❌ Tọa độ ngoài Bắc Ninh: ${lat}, ${lng}`);
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

fetchBacNinh();
