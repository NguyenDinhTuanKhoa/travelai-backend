require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Các biển nổi tiếng bị thiếu tọa độ từ Serper - dùng tọa độ cố định
const manualBeaches = [
  // Thanh Hóa
  { name: 'Bãi biển Sầm Sơn', province: 'Thanh Hóa', lat: 19.7441, lng: 105.9030, desc: 'Bãi biển Sầm Sơn - Bãi biển nổi tiếng nhất Thanh Hóa, thu hút hàng triệu du khách mỗi năm' },
  { name: 'Bãi biển Hải Tiến', province: 'Thanh Hóa', lat: 19.8253, lng: 105.9407, desc: 'Bãi biển Hải Tiến - Bãi biển hoang sơ đẹp tại Hoằng Hóa, Thanh Hóa' },
  { name: 'Bãi biển Hải Hòa', province: 'Thanh Hóa', lat: 19.4472, lng: 105.8142, desc: 'Bãi biển Hải Hòa - Bãi biển đẹp tại Tĩnh Gia, Thanh Hóa' },
  
  // Thừa Thiên Huế  
  { name: 'Bãi biển Lăng Cô', province: 'Thừa Thiên Huế', lat: 16.2522, lng: 108.0660, desc: 'Bãi biển Lăng Cô - Một trong những vịnh đẹp nhất thế giới, nước biển trong xanh' },
  { name: 'Bãi biển Thuận An', province: 'Thừa Thiên Huế', lat: 16.5533, lng: 107.6434, desc: 'Bãi biển Thuận An - Bãi biển gần thành phố Huế nhất, yên bình và thơ mộng' },
  { name: 'Bãi biển Canh Dương', province: 'Thừa Thiên Huế', lat: 16.3825, lng: 107.9144, desc: 'Bãi biển Canh Dương - Bãi biển hoang sơ giữa đèo Phú Gia và Phước Tượng' },
  { name: 'Bãi biển Vinh Thanh', province: 'Thừa Thiên Huế', lat: 16.4933, lng: 107.7230, desc: 'Bãi biển Vinh Thanh - Bãi biển đẹp phía nam đầm Cầu Hai' },
  
  // Đà Nẵng
  { name: 'Bãi biển Mỹ Khê', province: 'Đà Nẵng', lat: 16.0544, lng: 108.2479, desc: 'Bãi biển Mỹ Khê - Một trong 6 bãi biển đẹp nhất hành tinh theo Forbes' },
  
  // Quảng Ngãi
  { name: 'Bãi biển Sa Huỳnh', province: 'Quảng Ngãi', lat: 14.7778, lng: 109.0476, desc: 'Bãi biển Sa Huỳnh - Bãi biển đẹp phía nam Quảng Ngãi, gần cánh đồng muối' },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log('🏖️  BỔ SUNG BIỂN NỔI TIẾNG VỚI TỌA ĐỘ THỦ CÔNG');
    console.log('═'.repeat(60));

    let saved = 0, skipped = 0, failed = 0;

    for (let i = 0; i < manualBeaches.length; i++) {
      const beach = manualBeaches[i];
      console.log(`\n[${i + 1}/${manualBeaches.length}] ${beach.name} (${beach.province})...`);

      const existing = await Destination.findOne({
        name: beach.name,
        'location.city': beach.province
      });

      if (existing) {
        console.log('   ⏭️  Đã tồn tại');
        skipped++;
        continue;
      }

      try {
        // Search for images
        const images = await serperManager.searchImages(`${beach.name} ${beach.province}`, 5);
        let validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          const images2 = await serperManager.searchImages(`${beach.name} Vietnam beach`, 5);
          validImages = images2.slice(0, 3);
        }

        if (validImages.length === 0) {
          console.log('   ❌ Không có hình ảnh');
          failed++;
          continue;
        }

        const newDest = new Destination({
          name: beach.name,
          description: beach.desc,
          location: {
            city: beach.province,
            country: 'Vietnam',
            coordinates: { lat: beach.lat, lng: beach.lng }
          },
          images: validImages,
          category: 'beach',
          rating: 4.5
        });

        await newDest.save();
        saved++;
        console.log(`   ✅ Đã lưu (${beach.lat}, ${beach.lng}) - ${validImages.length} ảnh`);

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 KẾT QUẢ:');
    console.log(`   ✅ Đã lưu: ${saved}`);
    console.log(`   ⏭️  Bỏ qua: ${skipped}`);
    console.log(`   ❌ Thất bại: ${failed}`);

    const totalBeaches = await Destination.countDocuments({ category: 'beach' });
    console.log(`\n🏖️  TỔNG SỐ BIỂN SAU CẬP NHẬT: ${totalBeaches}`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
