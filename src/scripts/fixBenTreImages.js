const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để fix hình ảnh cho các địa điểm Bến Tre bị mất ảnh
 * Sử dụng SerpAPI Google Images để tìm ảnh chất lượng cao
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchImagesForDestination = async (destinationName, city) => {
  try {
    console.log(`  🔍 Đang tìm ảnh cho: ${destinationName}...`);
    
    // Tìm ảnh trên Google Images với query cụ thể
    const params = {
      engine: 'google_images',
      q: `${destinationName} ${city} Vietnam`,
      num: 5, // Lấy 5 ảnh đầu tiên
      ijn: 0  // Page 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      console.log(`  ⚠️  Không tìm thấy ảnh cho: ${destinationName}`);
      return [];
    }

    // Lấy URL ảnh gốc (original) hoặc thumbnail
    const imageUrls = data.images_results
      .slice(0, 3) // Chỉ lấy 3 ảnh đầu
      .map(img => img.original || img.thumbnail)
      .filter(url => url); // Loại bỏ URL null/undefined

    console.log(`  ✅ Tìm thấy ${imageUrls.length} ảnh`);
    return imageUrls;

  } catch (error) {
    console.error(`  ❌ Lỗi khi tìm ảnh cho ${destinationName}:`, error.message);
    return [];
  }
};

const fixBenTreImages = async () => {
  console.log('🖼️  Bắt đầu fix hình ảnh cho địa điểm Bến Tre...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Tìm tất cả địa điểm Bến Tre không có ảnh hoặc mảng ảnh rỗng
    const destinationsWithoutImages = await Destination.find({
      'location.city': 'Bến Tre',
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: null }
      ]
    }).select('name category location images');

    console.log(`📊 Tìm thấy ${destinationsWithoutImages.length} địa điểm cần cập nhật ảnh\n`);

    if (destinationsWithoutImages.length === 0) {
      console.log('🎉 Tất cả địa điểm Bến Tre đã có ảnh!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < destinationsWithoutImages.length; i++) {
      const dest = destinationsWithoutImages[i];
      console.log(`\n[${i + 1}/${destinationsWithoutImages.length}] ${dest.name}`);

      // Fetch ảnh từ SerpAPI
      const imageUrls = await fetchImagesForDestination(dest.name, dest.location.city);

      if (imageUrls.length > 0) {
        // Cập nhật vào database
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: imageUrls } }
        );
        console.log(`  💾 Đã cập nhật ${imageUrls.length} ảnh vào database`);
        updated++;
      } else {
        console.log(`  ⚠️  Không thể lấy ảnh, giữ nguyên`);
        failed++;
      }

      // Delay 1 giây giữa các request để tránh rate limit
      if (i < destinationsWithoutImages.length - 1) {
        await delay(1000);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 KẾT QUẢ:');
    console.log(`✅ Đã cập nhật: ${updated} địa điểm`);
    console.log(`❌ Thất bại: ${failed} địa điểm`);
    console.log(`📝 Tổng cộng: ${destinationsWithoutImages.length} địa điểm`);
    console.log('='.repeat(50));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
fixBenTreImages();
