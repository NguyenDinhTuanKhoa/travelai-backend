require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Cao Bằng';
const CITY_CENTER = 'Cao Bằng';

const destinations = [
  // Iconic landmarks - MUST HAVE
  { name: 'Thác Bản Giốc', category: 'attraction', lat: 22.8500, lng: 106.7167 },
  { name: 'Hồ Ba Bể', category: 'attraction', lat: 22.2500, lng: 105.6167 },
  
  // Thác Bản Giốc area
  { name: 'Động Ngườm Ngao', category: 'attraction', lat: 22.8333, lng: 106.7000 },
  { name: 'Chùa Phật Tích Trúc Lâm Bản Giốc', category: 'historical', lat: 22.8500, lng: 106.7167 },
  { name: 'Cột cờ Lũng Pô', category: 'historical', lat: 22.8667, lng: 106.7333 },
  
  // Hồ Ba Bể area
  { name: 'Động Puông', category: 'attraction', lat: 22.2500, lng: 105.6167 },
  { name: 'Đảo An Mã', category: 'attraction', lat: 22.2500, lng: 105.6167 },
  { name: 'Thác Đầu Đẳng', category: 'attraction', lat: 22.2333, lng: 105.6000 },
  { name: 'Làng Pác Ngòi', category: 'countryside', lat: 22.2500, lng: 105.6167 },
  
  // Núi và hang động
  { name: 'Núi Phia Oắc - Phia Đén', category: 'attraction', lat: 22.5000, lng: 105.8333 },
  { name: 'Động Khuổi Ky', category: 'attraction', lat: 22.6667, lng: 106.2500 },
  { name: 'Thác Leng Phinh', category: 'attraction', lat: 22.8000, lng: 106.6500 },
  
  // Lịch sử
  { name: 'Hang Pác Bó', category: 'historical', lat: 22.7000, lng: 106.3667 },
  { name: 'Suối Lê Nin', category: 'historical', lat: 22.7000, lng: 106.3667 },
  { name: 'Núi Các Mác', category: 'historical', lat: 22.7000, lng: 106.3667 },
  
  // Thành phố và chợ
  { name: 'Chợ Cao Bằng', category: 'city', lat: 22.6667, lng: 106.2500 },
  { name: 'Phố đi bộ Cao Bằng', category: 'city', lat: 22.6667, lng: 106.2500 },
  { name: 'Chợ Trùng Khánh', category: 'city', lat: 22.8167, lng: 106.5833 },
  
  // Đèo và cảnh quan
  { name: 'Đèo Mã Phục', category: 'attraction', lat: 22.7500, lng: 106.4000 },
  { name: 'Thung lũng Quảng Uyên', category: 'countryside', lat: 22.7000, lng: 106.5000 },
  
  // Khách sạn
  { name: 'Cao Bang Hotel', category: 'hotel' },
  { name: 'Bang Giang Hotel', category: 'hotel' },
  { name: 'Ba Be Lake Hotel', category: 'hotel' },
  { name: 'Homestay Ba Bể', category: 'hotel' },
  { name: 'Cao Bang Riverside Hotel', category: 'hotel' },
  { name: 'Trung Khanh Hotel', category: 'hotel' },
  { name: 'Ban Gioc Waterfall Resort', category: 'hotel' },
  { name: 'Ba Be National Park Guesthouse', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hương Quê Cao Bằng', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Ba Bể', category: 'restaurant' },
  { name: 'Nhà hàng Bản Giốc', category: 'restaurant' },
  { name: 'Quán Ăn Trùng Khánh', category: 'restaurant' },
  { name: 'Nhà hàng Sông Bằng', category: 'restaurant' },
  { name: 'Quán Cá Hồ Ba Bể', category: 'restaurant' }
];

async function fetchCaoBang() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏔️  ${PROVINCE.toUpperCase()} - THÁC BẢN GIỐC & HỒ BA BỂ`);
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
          
          // Validate Cao Bằng coordinates (22.0 - 23.2 N, 105.5 - 106.8 E)
          if (lat < 22.0 || lat > 23.2 || lng < 105.5 || lng > 106.8) {
            console.log(`   ❌ Tọa độ ngoài Cao Bằng: ${lat}, ${lng}`);
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

fetchCaoBang();
