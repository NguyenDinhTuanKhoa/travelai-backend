require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Điện Biên';
const CITY_CENTER = 'Điện Biên Phủ';

const destinations = [
  // Điện Biên Phủ - Iconic historical site
  { name: 'Đồi A1 Điện Biên Phủ', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Hầm tướng De Castries', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Nghĩa trang Điện Biên Phủ', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Bảo tàng Điện Biên Phủ', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Đài tưởng niệm Điện Biên Phủ', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Đồi Him Lam', category: 'historical', lat: 21.3833, lng: 103.0167 },
  { name: 'Đồi C1 Điện Biên', category: 'historical', lat: 21.3833, lng: 103.0167 },
  
  // Thung lũng Mường Thanh
  { name: 'Thung lũng Mường Thanh', category: 'countryside', lat: 21.3833, lng: 103.0167 },
  { name: 'Cánh đồng Mường Thanh', category: 'countryside', lat: 21.3833, lng: 103.0167 },
  
  // Hồ và suối
  { name: 'Hồ Pá Khoang', category: 'attraction', lat: 21.5000, lng: 103.1000 },
  { name: 'Suối nước nóng Hua Pé', category: 'attraction', lat: 21.4000, lng: 103.0500 },
  { name: 'Hồ Noong U', category: 'attraction', lat: 21.4500, lng: 103.0833 },
  
  // Núi và đèo
  { name: 'Đèo Pha Đin', category: 'attraction', lat: 21.5500, lng: 103.3000 },
  { name: 'Núi Pú Luông Điện Biên', category: 'attraction', lat: 21.4000, lng: 103.1000 },
  
  // Thành phố Điện Biên Phủ
  { name: 'Chợ Điện Biên Phủ', category: 'city', lat: 21.3833, lng: 103.0167 },
  { name: 'Công viên Điện Biên Phủ', category: 'city', lat: 21.3833, lng: 103.0167 },
  { name: 'Cầu Mường Thanh', category: 'city', lat: 21.3833, lng: 103.0167 },
  
  // Làng bản
  { name: 'Bản Phủ Điện Biên', category: 'countryside', lat: 21.3833, lng: 103.0167 },
  { name: 'Bản Tà Lèng', category: 'countryside', lat: 21.4000, lng: 103.0500 },
  
  // Văn hóa dân tộc
  { name: 'Làng văn hóa các dân tộc Điện Biên', category: 'attraction', lat: 21.3833, lng: 103.0167 },
  { name: 'Chợ phiên Điện Biên', category: 'city', lat: 21.3833, lng: 103.0167 },
  
  // Khách sạn
  { name: 'Muong Thanh Dien Bien Phu Hotel', category: 'hotel' },
  { name: 'Dien Bien Phu Hotel', category: 'hotel' },
  { name: 'Him Lam Resort Dien Bien', category: 'hotel' },
  { name: 'Ruby Hotel Dien Bien', category: 'hotel' },
  { name: 'Dien Bien Lodge', category: 'hotel' },
  { name: 'Pa Khoang Lake Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Điện Biên Phủ', category: 'restaurant' },
  { name: 'Quán Cơm Mường Thanh', category: 'restaurant' },
  { name: 'Nhà hàng Lẩu Dê Điện Biên', category: 'restaurant' },
  { name: 'Quán Ăn Đồi A1', category: 'restaurant' },
  { name: 'Nhà hàng Hồ Pá Khoang', category: 'restaurant' },
  { name: 'Quán Cá Hồ Điện Biên', category: 'restaurant' }
];

async function fetchDienBien() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏛️  ${PROVINCE.toUpperCase()} - ĐIỆN BIÊN PHỦ LỊCH SỬ`);
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
          
          // Validate Điện Biên coordinates (21.0 - 22.0 N, 102.5 - 103.5 E)
          if (lat < 21.0 || lat > 22.0 || lng < 102.5 || lng > 103.5) {
            console.log(`   ❌ Tọa độ ngoài Điện Biên: ${lat}, ${lng}`);
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
          description: `${dest.name} tại ${PROVINCE} - Tây Bắc`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: 4.7
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

fetchDienBien();
