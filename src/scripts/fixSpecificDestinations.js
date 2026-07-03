const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để fix các địa điểm cụ thể từ file destinations_need_fix.json
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchImagesForDestination = async (destinationName, city) => {
  try {
    console.log(`  🔍 Đang tìm ảnh cho: ${destinationName}...`);
    
    const params = {
      engine: 'google_images',
      q: `${destinationName} ${city} Vietnam`,
      num: 10,
      ijn: 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      console.log(`  ⚠️  Không tìm thấy ảnh`);
      return null;
    }

    // Lấy ảnh chất lượng cao, loại bỏ Google proxy
    const imageUrls = data.images_results
      .slice(0, 5)
      .map(img => img.original || img.thumbnail)
      .filter(url => 
        url && 
        !url.includes('googleusercontent.com/gps') &&
        !url.includes('tiktok.com') // TikTok thường bị 403
      )
      .slice(0, 3); // Chỉ lấy 3 ảnh tốt nhất

    if (imageUrls.length === 0) {
      console.log(`  ⚠️  Không tìm thấy ảnh phù hợp`);
      return null;
    }

    console.log(`  ✅ Tìm thấy ${imageUrls.length} ảnh`);
    return imageUrls;

  } catch (error) {
    console.error(`  ❌ Lỗi:`, error.message);
    return null;
  }
};

const fixSpecificDestinations = async () => {
  console.log('🔧 Bắt đầu fix các địa điểm cụ thể...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Đọc danh sách cần fix
    const fixListPath = path.join(__dirname, 'destinations_need_fix.json');
    
    if (!fs.existsSync(fixListPath)) {
      console.log('❌ Không tìm thấy file destinations_need_fix.json');
      console.log('💡 Chạy script fullImageAudit.js trước để tạo danh sách');
      process.exit(1);
    }

    const destinationNames = JSON.parse(fs.readFileSync(fixListPath, 'utf8'));
    console.log(`📋 Cần fix: ${destinationNames.length} địa điểm\n`);

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < destinationNames.length; i++) {
      const name = destinationNames[i];
      console.log(`\n[${i + 1}/${destinationNames.length}] ${name}`);

      // Tìm địa điểm trong DB
      const dest = await Destination.findOne({ 
        name, 
        'location.city': 'Bến Tre' 
      });

      if (!dest) {
        console.log(`  ⚠️  Không tìm thấy trong DB`);
        failed++;
        continue;
      }

      // Fetch ảnh mới
      const imageUrls = await fetchImagesForDestination(name, 'Bến Tre');

      if (imageUrls && imageUrls.length > 0) {
        // Cập nhật vào DB
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: imageUrls } }
        );
        console.log(`  💾 Đã cập nhật ${imageUrls.length} ảnh`);
        updated++;
      } else {
        console.log(`  ❌ Không thể lấy ảnh`);
        failed++;
      }

      // Delay để tránh rate limit
      if (i < destinationNames.length - 1) {
        await delay(2000); // 2 giây
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 KẾT QUẢ:');
    console.log('='.repeat(60));
    console.log(`✅ Đã fix: ${updated} địa điểm`);
    console.log(`❌ Thất bại: ${failed} địa điểm`);
    console.log(`📝 Tổng cộng: ${destinationNames.length} địa điểm`);
    console.log('='.repeat(60));

    if (updated > 0) {
      console.log('\n🎉 Đã cập nhật thành công!');
      console.log('💡 Reload trang web để xem kết quả');
    }

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} địa điểm không thể tự động fix`);
      console.log('💡 Có thể thêm ảnh thủ công qua Admin panel');
    }

    console.log('');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
fixSpecificDestinations();
