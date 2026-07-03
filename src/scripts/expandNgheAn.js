require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Nghệ An';
const CITY_CENTER = 'Vinh';

const destinations = [
  // Biển
  { name: 'Bãi biển Cửa Lò', category: 'beach', lat: 18.8000, lng: 105.7167 },
  { name: 'Bãi biển Quỳnh', category: 'beach', lat: 19.0000, lng: 105.7500 },
  { name: 'Đảo Nghi Sơn', category: 'beach', lat: 18.8167, lng: 105.7333 },
  
  // Lịch sử
  { name: 'Khu di tích Kim Liên', category: 'historical', lat: 19.0500, lng: 105.3500 },
  { name: 'Nhà thờ Đức Bà Cửa Lò', category: 'historical', lat: 18.8000, lng: 105.7167 },
  { name: 'Đền Cuông', category: 'historical', lat: 19.0333, lng: 105.3833 },
  { name: 'Chùa Đức', category: 'historical', lat: 18.6667, lng: 105.6833 },
  
  // Núi và rừng
  { name: 'Vườn quốc gia Pù Mát', category: 'attraction', lat: 19.2500, lng: 104.7500 },
  { name: 'Núi Hồng Lĩnh', category: 'attraction', lat: 18.5000, lng: 105.5000 },
  { name: 'Thác Khe Kèm', category: 'attraction', lat: 19.2000, lng: 104.8000 },
  
  // Thành phố Vinh
  { name: 'Quảng trường Hồ Chí Minh Vinh', category: 'city', lat: 18.6667, lng: 105.6833 },
  { name: 'Chợ Vinh', category: 'city', lat: 18.6667, lng: 105.6833 },
  { name: 'Công viên Vinh', category: 'city', lat: 18.6667, lng: 105.6833 },
  { name: 'Bảo tàng Nghệ An', category: 'historical', lat: 18.6667, lng: 105.6833 },
  
  // Khách sạn
  { name: 'Muong Thanh Grand Cua Lo Hotel', category: 'hotel' },
  { name: 'Vinh Hotel', category: 'hotel' },
  { name: 'Cua Lo Beach Hotel', category: 'hotel' },
  { name: 'Saigon Kim Lien Hotel', category: 'hotel' },
  { name: 'Nghe An Hotel', category: 'hotel' },
  { name: 'Vinh Plaza Hotel', category: 'hotel' },
  { name: 'Cua Lo Riverside Hotel', category: 'hotel' },
  { name: 'Nghe An Riverside Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Cửa Lò', category: 'restaurant' },
  { name: 'Quán Hải Sản Cửa Lò', category: 'restaurant' },
  { name: 'Nhà hàng Vinh', category: 'restaurant' },
  { name: 'Quán Cơm Nghệ An', category: 'restaurant' },
  { name: 'Nhà hàng Kim Liên', category: 'restaurant' },
  { name: 'Quán Phở Vinh', category: 'restaurant' },
  { name: 'Nhà hàng Pù Mát', category: 'restaurant' },
  { name: 'Quán Ăn Nghệ An', category: 'restaurant' },
  { name: 'Nhà hàng Hồng Lĩnh', category: 'restaurant' },
  { name: 'Quán Bún Nghệ An', category: 'restaurant' }
];

async function expandNgheAn() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏖️  ${PROVINCE.toUpperCase()} - CỬA LÒ & KIM LIÊN`);
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
          
          // Validate Nghệ An coordinates (18.3 - 19.8 N, 104.5 - 105.8 E)
          if (lat < 18.3 || lat > 19.8 || lng < 104.5 || lng > 105.8) {
            console.log(`   ❌ Tọa độ ngoài Nghệ An: ${lat}, ${lng}`);
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
          description: `${dest.name} tại ${PROVINCE} - Bắc Trung Bộ`,
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

expandNgheAn();
