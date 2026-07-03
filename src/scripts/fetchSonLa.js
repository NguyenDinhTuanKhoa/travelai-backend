require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Sơn La';
const CITY_CENTER = 'Sơn La';

const destinations = [
  // Mộc Châu - Iconic plateau
  { name: 'Cao nguyên Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  { name: 'Đồi chè Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  { name: 'Thung lũng Mộc Châu', category: 'countryside', lat: 20.8333, lng: 104.6833 },
  
  // Thác và suối
  { name: 'Thác Dải Yếm', category: 'attraction', lat: 20.8500, lng: 104.7000 },
  { name: 'Thác Nàng', category: 'attraction', lat: 20.8167, lng: 104.6667 },
  { name: 'Suối Tiên Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  
  // Đồi và cánh đồng
  { name: 'Đồi Tà Xùa', category: 'attraction', lat: 21.1667, lng: 104.3333 },
  { name: 'Đồi Lồng Luông', category: 'attraction', lat: 20.8500, lng: 104.7000 },
  { name: 'Cánh đồng hoa Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  { name: 'Đồng cừu Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  
  // Hang động
  { name: 'Hang Dơi Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  { name: 'Động Tiên Mộc Châu', category: 'attraction', lat: 20.8333, lng: 104.6833 },
  
  // Làng bản
  { name: 'Bản Áng', category: 'countryside', lat: 20.8167, lng: 104.6667 },
  { name: 'Làng Dân tộc Mộc Châu', category: 'countryside', lat: 20.8333, lng: 104.6833 },
  { name: 'Bản Phiêng Luông', category: 'countryside', lat: 20.8500, lng: 104.7000 },
  
  // Thành phố Sơn La
  { name: 'Nhà tù Sơn La', category: 'historical', lat: 21.3167, lng: 103.9167 },
  { name: 'Chợ Sơn La', category: 'city', lat: 21.3167, lng: 103.9167 },
  { name: 'Công viên Sơn La', category: 'city', lat: 21.3167, lng: 103.9167 },
  
  // Hồ và đập
  { name: 'Hồ Sông Đà', category: 'attraction', lat: 21.2000, lng: 104.0000 },
  { name: 'Đập thủy điện Sơn La', category: 'attraction', lat: 21.2000, lng: 104.0000 },
  
  // Khách sạn
  { name: 'Moc Chau Arena Village', category: 'hotel' },
  { name: 'Moc Chau Ecolodge', category: 'hotel' },
  { name: 'Moc Chau Highland Resort', category: 'hotel' },
  { name: 'Homestay Mộc Châu', category: 'hotel' },
  { name: 'Son La Hotel', category: 'hotel' },
  { name: 'Moc Chau Nature Village', category: 'hotel' },
  { name: 'Happy Hill Station Moc Chau', category: 'hotel' },
  { name: 'Moc Chau Retreat', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Mộc Châu', category: 'restaurant' },
  { name: 'Quán Cơm Cao Nguyên', category: 'restaurant' },
  { name: 'Nhà hàng Đồi Chè', category: 'restaurant' },
  { name: 'Quán Ăn Thác Dải Yếm', category: 'restaurant' },
  { name: 'Nhà hàng Sơn La', category: 'restaurant' },
  { name: 'Quán Sữa Mộc Châu', category: 'restaurant' }
];

async function fetchSonLa() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏔️  ${PROVINCE.toUpperCase()} - CAO NGUYÊN MỘC CHÂU`);
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
          
          // Validate Sơn La coordinates (20.5 - 21.8 N, 103.5 - 104.8 E)
          if (lat < 20.5 || lat > 21.8 || lng < 103.5 || lng > 104.8) {
            console.log(`   ❌ Tọa độ ngoài Sơn La: ${lat}, ${lng}`);
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

fetchSonLa();
