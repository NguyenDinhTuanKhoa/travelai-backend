require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Hải Phòng';
const CITY_CENTER = 'Hải Phòng';

const destinations = [
  // Đảo Cát Bà - UNESCO
  { name: 'Vườn quốc gia Cát Bà', category: 'attraction', lat: 20.7833, lng: 107.0000 },
  { name: 'Đảo Cát Bà', category: 'attraction', lat: 20.7833, lng: 107.0000 },
  { name: 'Bãi biển Cát Cò 1', category: 'beach', lat: 20.7667, lng: 107.0500 },
  { name: 'Bãi biển Cát Cò 2', category: 'beach', lat: 20.7667, lng: 107.0500 },
  { name: 'Bãi biển Cát Cò 3', category: 'beach', lat: 20.7667, lng: 107.0500 },
  { name: 'Hang Trống Cát Bà', category: 'attraction', lat: 20.7833, lng: 107.0000 },
  { name: 'Pháo đài Cannon Fort', category: 'historical', lat: 20.7833, lng: 107.0000 },
  
  // Đảo Đồ Sơn
  { name: 'Bãi biển Đồ Sơn', category: 'beach', lat: 20.7000, lng: 106.7833 },
  { name: 'Núi Đồ Sơn', category: 'attraction', lat: 20.7000, lng: 106.7833 },
  { name: 'Casino Đồ Sơn', category: 'attraction', lat: 20.7000, lng: 106.7833 },
  
  // Thành phố Hải Phòng
  { name: 'Nhà hát lớn Hải Phòng', category: 'city', lat: 20.8647, lng: 106.6838 },
  { name: 'Chợ Sắt Hải Phòng', category: 'city', lat: 20.8647, lng: 106.6838 },
  { name: 'Công viên Tam Bạc', category: 'city', lat: 20.8647, lng: 106.6838 },
  { name: 'Phố đi bộ Hải Phòng', category: 'city', lat: 20.8647, lng: 106.6838 },
  { name: 'Bảo tàng Hải Phòng', category: 'historical', lat: 20.8647, lng: 106.6838 },
  
  // Lịch sử
  { name: 'Đền Ngọc Sơn Hải Phòng', category: 'historical', lat: 20.8647, lng: 106.6838 },
  { name: 'Chùa Hang Hải Phòng', category: 'historical', lat: 20.8647, lng: 106.6838 },
  { name: 'Đình Hàng Kênh', category: 'historical', lat: 20.8647, lng: 106.6838 },
  
  // Bãi biển khác
  { name: 'Bãi biển Minh Châu', category: 'beach', lat: 20.6500, lng: 107.0833 },
  { name: 'Bãi biển Tuần Châu Hải Phòng', category: 'beach', lat: 20.9167, lng: 107.0667 },
  
  // Đảo và cảng
  { name: 'Cảng Hải Phòng', category: 'city', lat: 20.8647, lng: 106.6838 },
  { name: 'Cầu Bính', category: 'city', lat: 20.8647, lng: 106.6838 },
  
  // Khách sạn
  { name: 'Catba Island Resort', category: 'hotel' },
  { name: 'Hai Phong Hotel', category: 'hotel' },
  { name: 'Avani Hai Phong Harbour View', category: 'hotel' },
  { name: 'Cat Ba Sunrise Resort', category: 'hotel' },
  { name: 'Do Son Beach Hotel', category: 'hotel' },
  { name: 'Catba Central Hotel', category: 'hotel' },
  { name: 'Hai Phong Harbour View Hotel', category: 'hotel' },
  { name: 'Nam Cuong Hotel Hai Phong', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Cát Bà', category: 'restaurant' },
  { name: 'Quán Cơm Hải Phòng', category: 'restaurant' },
  { name: 'Nhà hàng Đồ Sơn', category: 'restaurant' },
  { name: 'Quán Bánh Đa Cua Hải Phòng', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển', category: 'restaurant' },
  { name: 'Quán Hải Sản Đồ Sơn', category: 'restaurant' }
];

async function fetchHaiPhong() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏖️  ${PROVINCE.toUpperCase()} - THÀNH PHỐ CẢNG & ĐẢO CÁT BÀ`);
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
          
          // Validate Hải Phòng coordinates (20.5 - 21.0 N, 106.5 - 107.2 E)
          if (lat < 20.5 || lat > 21.0 || lng < 106.5 || lng > 107.2) {
            console.log(`   ❌ Tọa độ ngoài Hải Phòng: ${lat}, ${lng}`);
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

fetchHaiPhong();
