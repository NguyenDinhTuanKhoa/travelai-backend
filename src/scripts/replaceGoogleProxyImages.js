const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để thay thế các ảnh Google proxy (không load được) 
 * bằng ảnh công khai từ Google Images
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchPublicImagesForDestination = async (destinationName, city) => {
  try {
    console.log(`  🔍 Đang tìm ảnh công khai cho: ${destinationName}...`);
    
    // Tìm ảnh trên Google Images
    const params = {
      engine: 'google_images',
      q: `${destinationName} ${city} Vietnam`,
      num: 5,
      ijn: 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      console.log(`  ⚠️  Không tìm thấy ảnh`);
      return null;
    }

    // Lấy URL ảnh gốc, ưu tiên ảnh có kích thước lớn
    const imageUrls = data.images_results
      .slice(0, 3)
      .map(img => {
        // Ưu tiên original, nếu không có thì dùng thumbnail
        return img.original || img.thumbnail;
      })
      .filter(url => url && !url.includes('googleusercontent.com/gps')); // Loại bỏ Google proxy

    if (imageUrls.length === 0) {
      console.log(`  ⚠️  Không tìm thấy ảnh công khai`);
      return null;
    }

    console.log(`  ✅ Tìm thấy ${imageUrls.length} ảnh công khai`);
    return imageUrls;

  } catch (error) {
    console.error(`  ❌ Lỗi:`, error.message);
    return null;
  }
};

const replaceGoogleProxyImages = async () => {
  console.log('🔄 Bắt đầu thay thế ảnh Google proxy...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Tìm tất cả địa điểm Bến Tre có ảnh từ Google proxy
    const destinations = await Destination.find({
      'location.city': 'Bến Tre',
      images: { 
        $elemMatch: { 
          $regex: 'googleusercontent.com/gps' 
        } 
      }
    }).select('name category location images');

    console.log(`📊 Tìm thấy ${destinations.length} địa điểm có ảnh Google proxy\n`);

    if (destinations.length === 0) {
      console.log('🎉 Không có địa điểm nào cần thay thế!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      console.log(`\n[${i + 1}/${destinations.length}] ${dest.name}`);

      // Kiểm tra xem có ảnh Google proxy không
      const hasGoogleProxy = dest.images.some(img => 
        img && img.includes('googleusercontent.com/gps')
      );

      if (!hasGoogleProxy) {
        console.log(`  ⏭️  Bỏ qua (không có ảnh Google proxy)`);
        skipped++;
        continue;
      }

      // Fetch ảnh công khai từ Google Images
      const publicImages = await fetchPublicImagesForDestination(dest.name, dest.location.city);

      if (publicImages && publicImages.length > 0) {
        // Cập nhật vào database
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: publicImages } }
        );
        console.log(`  💾 Đã thay thế bằng ${publicImages.length} ảnh công khai`);
        updated++;
      } else {
        console.log(`  ⚠️  Không thể lấy ảnh, giữ nguyên`);
        failed++;
      }

      // Delay để tránh rate limit
      if (i < destinations.length - 1) {
        await delay(1500); // 1.5 giây
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 KẾT QUẢ:');
    console.log(`✅ Đã thay thế: ${updated} địa điểm`);
    console.log(`❌ Thất bại: ${failed} địa điểm`);
    console.log(`⏭️  Bỏ qua: ${skipped} địa điểm`);
    console.log(`📝 Tổng cộng: ${destinations.length} địa điểm`);
    console.log('='.repeat(50));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
replaceGoogleProxyImages();
