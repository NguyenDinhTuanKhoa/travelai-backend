require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Hà Nội';
const CITY_CENTER = 'Hà Nội';

const destinations = [
  // Di sản văn hóa
  { name: 'Hoàng Thành Thăng Long', category: 'historical' },
  { name: 'Văn Miếu Quốc Tử Giám', category: 'historical' },
  { name: 'Lăng Chủ tịch Hồ Chí Minh', category: 'historical' },
  { name: 'Chùa Một Cột', category: 'historical' },
  { name: 'Nhà thờ Lớn Hà Nội', category: 'historical' },
  { name: 'Đền Ngọc Sơn', category: 'historical' },
  { name: 'Hồ Hoàn Kiếm', category: 'attraction' },
  { name: 'Phố cổ Hà Nội', category: 'city' },
  { name: 'Cầu Thê Húc', category: 'attraction' },
  
  // Bảo tàng
  { name: 'Bảo tàng Hồ Chí Minh', category: 'historical' },
  { name: 'Bảo tàng Lịch sử Quốc gia', category: 'historical' },
  { name: 'Bảo tàng Dân tộc học', category: 'historical' },
  { name: 'Bảo tàng Phụ nữ Việt Nam', category: 'historical' },
  { name: 'Bảo tàng Mỹ thuật Việt Nam', category: 'historical' },
  
  // Hồ và công viên
  { name: 'Hồ Tây', category: 'attraction' },
  { name: 'Chùa Trấn Quốc', category: 'historical' },
  { name: 'Hồ Gươm', category: 'attraction' },
  { name: 'Công viên Thống Nhất', category: 'attraction' },
  { name: 'Công viên Thủ Lệ', category: 'attraction' },
  
  // Nhà hát và văn hóa
  { name: 'Nhà hát Lớn Hà Nội', category: 'city' },
  { name: 'Nhà hát Múa rối Thăng Long', category: 'attraction' },
  { name: 'Cầu Long Biên', category: 'attraction' },
  
  // Chợ
  { name: 'Chợ Đồng Xuân', category: 'city' },
  { name: 'Chợ Hôm', category: 'city' },
  { name: 'Chợ đêm Hà Nội', category: 'city' },
  
  // Khách sạn
  { name: 'Sofitel Legend Metropole Hanoi', category: 'hotel' },
  { name: 'JW Marriott Hotel Hanoi', category: 'hotel' },
  { name: 'Hilton Hanoi Opera', category: 'hotel' },
  { name: 'InterContinental Hanoi Westlake', category: 'hotel' },
  { name: 'Lotte Hotel Hanoi', category: 'hotel' },
  { name: 'Pan Pacific Hanoi', category: 'hotel' },
  { name: 'Hanoi Hotel', category: 'hotel' },
  { name: 'Melia Hanoi', category: 'hotel' },
  
  // Nhà hàng đặc sản
  { name: 'Nhà hàng Ngon', category: 'restaurant' },
  { name: 'Quán Bún Chả Hàng Mành', category: 'restaurant' },
  { name: 'Phở Thìn Bờ Hồ', category: 'restaurant' },
  { name: 'Bún Bò Nam Bộ', category: 'restaurant' },
  { name: 'Chả Cá Lã Vọng', category: 'restaurant' },
  { name: 'Bánh Cuốn Bà Hoành', category: 'restaurant' },
  { name: 'Xôi Yến Phố Ngọc Lâm', category: 'restaurant' },
  { name: 'Bánh Mì 25', category: 'restaurant' },
  { name: 'Bún Đậu Mắm Tôm Hàng Khay', category: 'restaurant' },
  { name: 'Phở Gia Truyền Bát Đàn', category: 'restaurant' },
  
  // Cafe
  { name: 'Cafe Giảng', category: 'restaurant' },
  { name: 'Cafe Phố Cổ', category: 'restaurant' },
  { name: 'Highlands Coffee Hà Nội', category: 'restaurant' },
  { name: 'The Coffee House Hà Nội', category: 'restaurant' },
  { name: 'Cộng Cà Phê', category: 'restaurant' },
  
  // Làng nghề
  { name: 'Làng gốm Bát Tràng', category: 'countryside' },
  { name: 'Làng lụa Vạn Phúc', category: 'countryside' },
  { name: 'Làng tranh Đông Hồ', category: 'countryside' },
  
  // Thêm địa điểm
  { name: 'Nhà tù Hỏa Lò', category: 'historical' },
  { name: 'Phố đi bộ Hồ Gươm', category: 'city' },
  { name: 'Phố Tây Tạ Hiện', category: 'city' },
  { name: 'Vincom Mega Mall Royal City', category: 'city' },
  { name: 'Aeon Mall Long Biên', category: 'city' }
];

async function fetchHaNoi() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏛️  ${PROVINCE.toUpperCase()} - THỦ ĐÔ`);
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
        skipped++;
        continue;
      }

      try {
        const query = `${dest.name} ${CITY_CENTER} Vietnam`;
        const placeResult = await serperManager.searchPlaces(query);

        if (!placeResult.places || placeResult.places.length === 0) {
          failed++;
          continue;
        }

        const place = placeResult.places[0];
        if (!place.latitude || !place.longitude) {
          failed++;
          continue;
        }

        const lat = place.latitude;
        const lng = place.longitude;

        if (!isWithinProvince(lat, lng, PROVINCE)) {
          failed++;
          continue;
        }

        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

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
          rating: place.rating || 4.6
        });

        await newDestination.save();
        saved++;
        console.log(`   ✅`);

      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`\n🎯 TỔNG ${PROVINCE}: ${total} địa điểm\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchHaNoi();
