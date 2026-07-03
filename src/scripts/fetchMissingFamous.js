require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Các địa điểm Serper Places không tìm thấy - dùng search thay places
const MANUAL_PLACES = [
  { name: 'Hồ Hoàn Kiếm', province: 'Hà Nội', category: 'attraction', lat: 21.0288, lng: 105.8525 },
  { name: 'Phố cổ Hà Nội', province: 'Hà Nội', category: 'city', lat: 21.0340, lng: 105.8500 },
  { name: 'Cầu Long Biên', province: 'Hà Nội', category: 'attraction', lat: 21.0430, lng: 105.8553 },
  { name: 'Hồ Tây', province: 'Hà Nội', category: 'attraction', lat: 21.0584, lng: 105.8234 },
  { name: 'Bán đảo Sơn Trà', province: 'Đà Nẵng', category: 'attraction', lat: 16.1153, lng: 108.2744 },
  { name: 'Yên Tử', province: 'Quảng Ninh', category: 'historical', lat: 21.0780, lng: 106.7430 },
  { name: 'Bản Cát Cát', province: 'Lào Cai', category: 'countryside', lat: 22.3270, lng: 103.8310 },
  { name: 'Núi Hàm Rồng', province: 'Lào Cai', category: 'mountain', lat: 22.3410, lng: 103.8420 },
  { name: 'Vinpearl Land Nha Trang', province: 'Khánh Hòa', category: 'attraction', lat: 12.2220, lng: 109.2150 },
  { name: 'Hồ Tuyền Lâm', province: 'Lâm Đồng', category: 'attraction', lat: 11.8900, lng: 108.4300 },
  { name: 'Đỉnh Langbiang', province: 'Lâm Đồng', category: 'mountain', lat: 12.0480, lng: 108.4280 },
  { name: 'Suối cá thần Cẩm Lương', province: 'Thanh Hóa', category: 'attraction', lat: 20.1850, lng: 105.2650 },
  { name: 'Ngã ba Đồng Lộc', province: 'Hà Tĩnh', category: 'historical', lat: 18.5450, lng: 105.7550 },
  { name: 'Vịnh Lan Hạ', province: 'Hải Phòng', category: 'beach', lat: 20.7660, lng: 107.0620 },
  { name: 'Hồ Thang Hen', province: 'Cao Bằng', category: 'attraction', lat: 22.7370, lng: 106.1870 },
  { name: 'Hồ Lắk', province: 'Đắk Lắk', category: 'attraction', lat: 12.4070, lng: 108.1980 },
  { name: 'Di tích Điện Biên Phủ', province: 'Điện Biên', category: 'historical', lat: 21.3830, lng: 103.0170 },
];

async function fetchManual() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let saved = 0, skipped = 0;

    for (let i = 0; i < MANUAL_PLACES.length; i++) {
      const place = MANUAL_PLACES[i];
      console.log(`[${i + 1}/${MANUAL_PLACES.length}] ${place.name} (${place.province})...`);

      // Check if already exists
      const exists = await Destination.findOne({
        name: { $regex: place.name.split(' ').slice(0, 3).join('.*'), $options: 'i' },
        'location.city': place.province
      });

      if (exists) {
        console.log('   ⏭️ Đã có');
        skipped++;
        continue;
      }

      // Fetch images
      const images = await serperManager.searchImages(`${place.name} ${place.province} Vietnam`, 5);
      const validImages = images.slice(0, 3);

      if (validImages.length === 0) {
        console.log('   ⚠️ Không tìm thấy ảnh, dùng placeholder');
      }

      const newDest = new Destination({
        name: place.name,
        description: `${place.name} - Điểm đến nổi tiếng tại ${place.province}, Việt Nam`,
        location: {
          city: place.province,
          country: 'Vietnam',
          coordinates: { lat: place.lat, lng: place.lng }
        },
        images: validImages.length > 0 ? validImages : ['https://placehold.co/600x400?text=' + encodeURIComponent(place.name)],
        category: place.category,
        rating: 4.5,
        reviewCount: 0,
      });

      await newDest.save();
      saved++;
      console.log(`   ✅ Đã lưu`);

      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🎯 KẾT QUẢ: Đã lưu ${saved} | Đã có ${skipped}`);
    
    const total = await Destination.countDocuments();
    console.log(`📊 TỔNG SỐ ĐỊA ĐIỂM: ${total}`);
    console.log(`${'═'.repeat(50)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchManual();
