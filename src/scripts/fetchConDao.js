require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Bà Rịa - Vũng Tàu';
const CITY_CENTER = 'Côn Đảo';

const destinations = [
  // Côn Đảo - Iconic island
  { name: 'Quần đảo Côn Đảo', category: 'attraction', lat: 8.6833, lng: 106.6000 },
  { name: 'Nhà tù Côn Đảo', category: 'historical', lat: 8.6833, lng: 106.6000 },
  { name: 'Nghĩa trang Hàng Dương', category: 'historical', lat: 8.6833, lng: 106.6000 },
  
  // Bãi biển Côn Đảo
  { name: 'Bãi Đầm Trấu', category: 'beach', lat: 8.6833, lng: 106.6000 },
  { name: 'Bãi Nhát', category: 'beach', lat: 8.6833, lng: 106.6000 },
  { name: 'Bãi Ông Đụng', category: 'beach', lat: 8.6833, lng: 106.6000 },
  { name: 'Bãi Vòng', category: 'beach', lat: 8.6833, lng: 106.6000 },
  { name: 'Bãi Đất Dốc', category: 'beach', lat: 8.6833, lng: 106.6000 },
  
  // Núi và rừng
  { name: 'Núi Chúa Côn Đảo', category: 'attraction', lat: 8.6833, lng: 106.6000 },
  { name: 'Vườn quốc gia Côn Đảo', category: 'attraction', lat: 8.6833, lng: 106.6000 },
  
  // Đảo nhỏ
  { name: 'Đảo Bảy Cạnh', category: 'attraction', lat: 8.6833, lng: 106.6000 },
  { name: 'Đảo Trứng', category: 'attraction', lat: 8.6833, lng: 106.6000 },
  
  // Lịch sử
  { name: 'Cầu tàu 914', category: 'historical', lat: 8.6833, lng: 106.6000 },
  { name: 'Dinh Chúa Đảo', category: 'historical', lat: 8.6833, lng: 106.6000 },
  { name: 'Bảo tàng Côn Đảo', category: 'historical', lat: 8.6833, lng: 106.6000 },
  
  // Chợ và thành phố
  { name: 'Chợ Côn Đảo', category: 'city', lat: 8.6833, lng: 106.6000 },
  { name: 'Bến Đầm Côn Đảo', category: 'city', lat: 8.6833, lng: 106.6000 },
  
  // Khách sạn
  { name: 'Six Senses Con Dao', category: 'hotel' },
  { name: 'Poulo Condor Boutique Resort', category: 'hotel' },
  { name: 'Con Dao Resort', category: 'hotel' },
  { name: 'Saigon Con Dao Resort', category: 'hotel' },
  { name: 'Con Dao Camping', category: 'hotel' },
  { name: 'ATC Con Dao Hotel', category: 'hotel' },
  { name: 'Con Son Blue Sea Hotel', category: 'hotel' },
  { name: 'Con Dao Sea Travel Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Côn Đảo', category: 'restaurant' },
  { name: 'Quán Hải Sản Côn Đảo', category: 'restaurant' },
  { name: 'Nhà hàng Thu Ba', category: 'restaurant' },
  { name: 'Quán Ăn Bến Đầm', category: 'restaurant' },
  { name: 'Nhà hàng Infiniti', category: 'restaurant' },
  { name: 'Quán Cơm Côn Đảo', category: 'restaurant' }
];

async function fetchConDao() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏝️  CÔN ĐẢO - ${PROVINCE.toUpperCase()}`);
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
          
          // Validate Côn Đảo coordinates (8.5 - 8.8 N, 106.5 - 106.7 E)
          if (lat < 8.5 || lat > 8.8 || lng < 106.5 || lng > 106.7) {
            console.log(`   ❌ Tọa độ ngoài Côn Đảo: ${lat}, ${lng}`);
            failed++;
            continue;
          }
        }

        const images = await serperManager.searchImages(`${dest.name} Côn Đảo`, 5);
        const validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          console.log(`   ❌ Không có hình ảnh`);
          failed++;
          continue;
        }

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại Côn Đảo, ${PROVINCE} - Đông Nam Bộ`,
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

fetchConDao();
