require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Hòa Bình';
const CITY_CENTER = 'Hòa Bình';

const destinations = [
  // Mai Châu - Iconic valley
  { name: 'Thung lũng Mai Châu', category: 'countryside', lat: 20.6667, lng: 105.0667 },
  { name: 'Bản Lác Mai Châu', category: 'countryside', lat: 20.6667, lng: 105.0667 },
  { name: 'Bản Pom Coong', category: 'countryside', lat: 20.6667, lng: 105.0667 },
  { name: 'Bản Buộc', category: 'countryside', lat: 20.6500, lng: 105.0500 },
  
  // Hang động
  { name: 'Hang Chiều', category: 'attraction', lat: 20.6667, lng: 105.0667 },
  { name: 'Hang Mỏ Luông', category: 'attraction', lat: 20.6833, lng: 105.0833 },
  { name: 'Động Thung Khe', category: 'attraction', lat: 20.7000, lng: 105.1000 },
  
  // Đèo và núi
  { name: 'Đèo Thung Khe', category: 'attraction', lat: 20.7000, lng: 105.1000 },
  { name: 'Đèo Cun', category: 'attraction', lat: 20.6500, lng: 105.0500 },
  { name: 'Núi Cốc', category: 'attraction', lat: 20.6667, lng: 105.0667 },
  
  // Hồ và suối
  { name: 'Hồ Hòa Bình', category: 'attraction', lat: 20.8167, lng: 105.3333 },
  { name: 'Hồ Đá Bàn', category: 'attraction', lat: 20.8000, lng: 105.3000 },
  { name: 'Suối Cá', category: 'attraction', lat: 20.6667, lng: 105.0667 },
  { name: 'Suối Mơ', category: 'attraction', lat: 20.6833, lng: 105.0833 },
  
  // Thác
  { name: 'Thác Gò Lào', category: 'attraction', lat: 20.7500, lng: 105.2000 },
  { name: 'Thác Đỗ Quyên', category: 'attraction', lat: 20.7333, lng: 105.1833 },
  
  // Thành phố Hòa Bình
  { name: 'Chợ Hòa Bình', category: 'city', lat: 20.8167, lng: 105.3333 },
  { name: 'Công viên Hòa Bình', category: 'city', lat: 20.8167, lng: 105.3333 },
  { name: 'Bảo tàng Hòa Bình', category: 'historical', lat: 20.8167, lng: 105.3333 },
  
  // Khu du lịch
  { name: 'Khu du lịch Mai Châu Ecolodge', category: 'attraction', lat: 20.6667, lng: 105.0667 },
  { name: 'Khu du lịch Thung Nai', category: 'attraction', lat: 20.8000, lng: 105.3000 },
  
  // Khách sạn
  { name: 'Mai Chau Lodge', category: 'hotel' },
  { name: 'Mai Chau Ecolodge', category: 'hotel' },
  { name: 'Mai Chau Valley View Hotel', category: 'hotel' },
  { name: 'Homestay Mai Châu', category: 'hotel' },
  { name: 'Hoa Binh Hotel', category: 'hotel' },
  { name: 'Mai Chau Hideaway Resort', category: 'hotel' },
  { name: 'Sol Bungalows Mai Chau', category: 'hotel' },
  { name: 'Mai Chau Nature Place', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Mai Châu', category: 'restaurant' },
  { name: 'Quán Cơm Bản Lác', category: 'restaurant' },
  { name: 'Nhà hàng Thung Lũng', category: 'restaurant' },
  { name: 'Quán Ăn Dân Tộc', category: 'restaurant' },
  { name: 'Nhà hàng Hòa Bình', category: 'restaurant' },
  { name: 'Quán Cá Hồ Hòa Bình', category: 'restaurant' }
];

async function fetchHoaBinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏞️  ${PROVINCE.toUpperCase()} - THUNG LŨNG MAI CHÂU`);
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
          
          // Validate Hòa Bình coordinates (20.3 - 21.2 N, 104.8 - 105.8 E)
          if (lat < 20.3 || lat > 21.2 || lng < 104.8 || lng > 105.8) {
            console.log(`   ❌ Tọa độ ngoài Hòa Bình: ${lat}, ${lng}`);
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

fetchHoaBinh();
