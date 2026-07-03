require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Yên Bái';
const CITY_CENTER = 'Yên Bái';

const destinations = [
  // Mù Cang Chải - Iconic terraced rice fields
  { name: 'Ruộng bậc thang Mù Cang Chải', category: 'attraction', lat: 21.8333, lng: 104.0667 },
  { name: 'Ruộng bậc thang Lim Mông', category: 'attraction', lat: 21.8167, lng: 104.0500 },
  { name: 'Ruộng bậc thang Chế Cu Nha', category: 'attraction', lat: 21.8500, lng: 104.0833 },
  { name: 'Ruộng bậc thang La Pán Tẩn', category: 'attraction', lat: 21.8000, lng: 104.0333 },
  
  // Đèo và cảnh quan
  { name: 'Đèo Khau Phạ', category: 'attraction', lat: 21.7833, lng: 104.1000 },
  { name: 'Đèo Lũng Lô', category: 'attraction', lat: 21.8667, lng: 104.0167 },
  { name: 'Thung lũng Tú Lệ', category: 'countryside', lat: 21.9167, lng: 104.1667 },
  
  // Suối nước nóng
  { name: 'Suối nước nóng Mù Cang Chải', category: 'attraction', lat: 21.8333, lng: 104.0667 },
  { name: 'Suối nước nóng Tú Lệ', category: 'attraction', lat: 21.9167, lng: 104.1667 },
  
  // Làng bản
  { name: 'Bản Lao Chải', category: 'countryside', lat: 21.8333, lng: 104.0500 },
  { name: 'Bản Dế Xu Phình', category: 'countryside', lat: 21.8500, lng: 104.0667 },
  { name: 'Bản Mồ Dề', category: 'countryside', lat: 21.8167, lng: 104.0833 },
  
  // Thành phố Yên Bái
  { name: 'Hồ Thác Bà', category: 'attraction', lat: 21.6167, lng: 104.6333 },
  { name: 'Đảo Ngọc Yên Bái', category: 'attraction', lat: 21.6167, lng: 104.6333 },
  { name: 'Chợ Yên Bái', category: 'city', lat: 21.7167, lng: 104.8667 },
  { name: 'Công viên Hồ Văn', category: 'city', lat: 21.7167, lng: 104.8667 },
  
  // Núi và rừng
  { name: 'Núi Khau Sơn', category: 'attraction', lat: 21.8000, lng: 104.1000 },
  { name: 'Rừng thông Tú Lệ', category: 'attraction', lat: 21.9167, lng: 104.1667 },
  
  // Chợ vùng cao
  { name: 'Chợ Mù Cang Chải', category: 'city', lat: 21.8333, lng: 104.0667 },
  { name: 'Chợ Tú Lệ', category: 'city', lat: 21.9167, lng: 104.1667 },
  
  // Khách sạn
  { name: 'Mu Cang Chai Ecolodge', category: 'hotel' },
  { name: 'Tu Le Ecolodge', category: 'hotel' },
  { name: 'Mu Cang Chai Terraces Hotel', category: 'hotel' },
  { name: 'Homestay Mù Cang Chải', category: 'hotel' },
  { name: 'Yen Bai Hotel', category: 'hotel' },
  { name: 'Thac Ba Lake Hotel', category: 'hotel' },
  { name: 'Tu Le Hot Spring Resort', category: 'hotel' },
  { name: 'Lim Mong Homestay', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Mù Cang Chải', category: 'restaurant' },
  { name: 'Quán Cơm Tú Lệ', category: 'restaurant' },
  { name: 'Nhà hàng Ruộng Bậc Thang', category: 'restaurant' },
  { name: 'Quán Ăn Khau Phạ', category: 'restaurant' },
  { name: 'Nhà hàng Yên Bái', category: 'restaurant' },
  { name: 'Quán Cá Hồ Thác Bà', category: 'restaurant' }
];

async function fetchYenBai() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🌾 ${PROVINCE.toUpperCase()} - RUỘNG BẬC THANG MÙ CANG CHẢI`);
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
          
          // Validate Yên Bái coordinates (21.3 - 22.3 N, 104.0 - 105.2 E)
          if (lat < 21.3 || lat > 22.3 || lng < 104.0 || lng > 105.2) {
            console.log(`   ❌ Tọa độ ngoài Yên Bái: ${lat}, ${lng}`);
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
          rating: 4.8
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

fetchYenBai();
