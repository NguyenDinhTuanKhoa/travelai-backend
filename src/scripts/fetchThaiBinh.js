require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Thái Bình';
const CITY_CENTER = 'Thái Bình';

const destinations = [
  // Biển Thái Bình
  { name: 'Bãi biển Đồng Châu', category: 'beach', lat: 20.5500, lng: 106.6500 },
  { name: 'Bãi biển Cồn Vành', category: 'beach', lat: 20.5667, lng: 106.6667 },
  { name: 'Bãi biển Cồn Đen', category: 'beach', lat: 20.5833, lng: 106.6833 },
  
  // Đền chùa
  { name: 'Đền Trần Thái Bình', category: 'historical', lat: 20.4500, lng: 106.3333 },
  { name: 'Chùa Keo', category: 'historical', lat: 20.5333, lng: 106.3167 },
  { name: 'Đền Đông Cuông', category: 'historical', lat: 20.4667, lng: 106.3500 },
  
  // Thành phố
  { name: 'Chợ Thái Bình', category: 'city', lat: 20.4500, lng: 106.3333 },
  { name: 'Công viên Thái Bình', category: 'city', lat: 20.4500, lng: 106.3333 },
  { name: 'Bảo tàng Thái Bình', category: 'historical', lat: 20.4500, lng: 106.3333 },
  
  // Khách sạn
  { name: 'Thai Binh Hotel', category: 'hotel' },
  { name: 'Dong Chau Beach Resort', category: 'hotel' },
  { name: 'Thai Binh Plaza Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Thái Bình', category: 'restaurant' },
  { name: 'Quán Hải Sản Đồng Châu', category: 'restaurant' },
  { name: 'Nhà hàng Chùa Keo', category: 'restaurant' }
];

async function fetchThaiBinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏖️  ${PROVINCE.toUpperCase()}`);
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
          
          if (lat < 20.2 || lat > 20.7 || lng < 106.0 || lng > 106.7) {
            console.log(`   ❌ Tọa độ ngoài ${PROVINCE}: ${lat}, ${lng}`);
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
          rating: 4.4
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
    console.log(`📊 KẾT QUẢ: ✅ ${saved} | ⏭️  ${skipped} | ❌ ${failed}`);
    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`🎯 TỔNG ${PROVINCE}: ${total} địa điểm`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchThaiBinh();
