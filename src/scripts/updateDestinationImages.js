const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// 🖼️ HƯỚNG DẪN SỬ DỤNG:
// 1. Tìm ảnh thực tế cho các địa điểm
// 2. Upload lên Cloudinary/ImgBB/AWS S3
// 3. Copy URL và paste vào object bên dưới
// 4. Run: node src/scripts/updateDestinationImages.js

// 📍 Mapping: Tên địa điểm → Array URL ảnh mới
const imageUpdates = {
  // ===== Trà Vinh - Thiên nhiên & Check-in =====
  'Ao Bà Om': [
    'https://example.com/ao-ba-om-main.jpg',        // Ảnh chính: toàn cảnh hồ
    'https://example.com/ao-ba-om-trees.jpg',       // Cây cổ thụ
    'https://example.com/ao-ba-om-temple.jpg',      // Đình chùa
  ],

  'Biển Ba Động': [
    'https://example.com/ba-dong-beach-sunset.jpg', // Hoàng hôn
    'https://example.com/ba-dong-beach-shore.jpg',  // Bờ biển
    'https://example.com/ba-dong-seafood.jpg',      // Quán hải sản
  ],

  'Rừng ngập mặn Long Khánh': [
    'https://example.com/long-khanh-mangrove.jpg',  // Rừng ngập mặn
    'https://example.com/long-khanh-boat.jpg',      // Thuyền trong rừng
    'https://example.com/long-khanh-birds.jpg',     // Chim trong rừng
  ],

  'Điện gió Duyên Hải': [
    'https://example.com/duyen-hai-wind-turbines.jpg', // Cánh đồng điện gió
    'https://example.com/duyen-hai-sunset.jpg',        // Điện gió lúc hoàng hôn
    'https://example.com/duyen-hai-checkin.jpg',       // Góc chụp ảnh đẹp
  ],

  // ===== Trà Vinh - Du lịch sinh thái =====
  'Cồn Chim': [
    'https://example.com/con-chim-village.jpg',     // Làng quê
    'https://example.com/con-chim-boat.jpg',        // Đi ghe
    'https://example.com/con-chim-garden.jpg',      // Vườn trái cây
  ],

  'Cù lao Tân Quy': [
    'https://example.com/tan-quy-fruit-garden.jpg', // Vườn trái cây
    'https://example.com/tan-quy-cycling.jpg',      // Đạp xe
    'https://example.com/tan-quy-river.jpg',        // Bờ sông
  ],

  'Cù lao Long Trị': [
    'https://example.com/long-tri-landscape.jpg',   // Cảnh quan
    'https://example.com/long-tri-homestay.jpg',    // Homestay
    'https://example.com/long-tri-farm.jpg',        // Vườn trái cây
  ],

  'Khu du lịch Huỳnh Kha': [
    'https://example.com/huynh-kha-gate.jpg',       // Cổng vào
    'https://example.com/huynh-kha-pool.jpg',       // Hồ bơi
    'https://example.com/huynh-kha-restaurant.jpg', // Nhà hàng
  ],

  // ===== Trà Vinh - Tâm linh văn hóa Khmer =====
  'Chùa Âng': [
    'https://example.com/chua-ang-front.jpg',       // Mặt tiền chùa
    'https://example.com/chua-ang-architecture.jpg',// Kiến trúc
    'https://example.com/chua-ang-inside.jpg',      // Bên trong
  ],

  'Chùa Vàm Ray (Ang Pagoda)': [
    'https://example.com/vam-ray-main.jpg',         // Toàn cảnh chùa
    'https://example.com/vam-ray-tower.jpg',        // Tháp chùa
    'https://example.com/vam-ray-gate.jpg',         // Cổng tam quan
  ],

  'Chùa Cò (Nodol Pagoda)': [
    'https://example.com/chua-co-pagoda.jpg',       // Chùa
    'https://example.com/chua-co-storks.jpg',       // Đàn cò
    'https://example.com/chua-co-sunset.jpg',       // Cò bay lúc hoàng hôn
  ],

  'Nhà thờ Mặc Bắc': [
    'https://example.com/mac-bac-church-front.jpg', // Mặt tiền
    'https://example.com/mac-bac-church-inside.jpg',// Bên trong
    'https://example.com/mac-bac-church-night.jpg', // Ban đêm
  ],

  // ===== Trà Vinh - Di tích lịch sử =====
  'Đền thờ Chủ tịch Hồ Chí Minh': [
    'https://example.com/den-ho-chi-minh.jpg',      // Đền thờ
    'https://example.com/den-ho-chi-minh-yard.jpg', // Sân trong
    'https://example.com/den-ho-chi-minh-museum.jpg',// Bảo tàng
  ],

  'Bảo tàng Văn hóa Khmer': [
    'https://example.com/khmer-museum-building.jpg',// Tòa nhà
    'https://example.com/khmer-museum-exhibit.jpg', // Hiện vật
    'https://example.com/khmer-museum-art.jpg',     // Nghệ thuật Khmer
  ],
};

// 🔧 Main function
const updateDestinationImages = async () => {
  console.log('🖼️  Starting image update script...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found ✅' : 'NOT FOUND ❌');

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    console.log('📍 Updating destination images...\n');

    for (const [name, images] of Object.entries(imageUpdates)) {
      // Skip if images contain example.com (placeholder)
      if (images.some(img => img.includes('example.com'))) {
        console.log(`⏭️  Skipped: ${name} (placeholder URLs)`);
        skipped++;
        continue;
      }

      const result = await Destination.updateOne(
        { name },
        { $set: { images } }
      );

      if (result.matchedCount === 0) {
        console.log(`❌ Not found: ${name}`);
        notFound++;
      } else if (result.modifiedCount > 0) {
        console.log(`✅ Updated: ${name} (${images.length} images)`);
        updated++;
      } else {
        console.log(`⚠️  No change: ${name} (images already up-to-date)`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Updated:    ${updated}`);
    console.log(`❌ Not found:  ${notFound}`);
    console.log(`⏭️  Skipped:    ${skipped} (placeholder URLs)`);
    console.log(`📝 Total:      ${Object.keys(imageUpdates).length}`);

    if (skipped > 0) {
      console.log('\n💡 Tip: Replace example.com URLs with real image URLs');
      console.log('   See HUONG_DAN_CAP_NHAT_ANH.md for detailed instructions');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating images:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

// Run script
updateDestinationImages();
