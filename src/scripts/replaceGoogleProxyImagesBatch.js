const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để thay thế ảnh Google proxy theo batch
 * Chạy nhiều lần để xử lý hết tất cả
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchPublicImagesForDestination = async (destinationName, city) => {
  try {
    const params = {
      engine: 'google_images',
      q: `${destinationName} ${city} Vietnam`,
      num: 5,
      ijn: 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      return null;
    }

    const imageUrls = data.images_results
      .slice(0, 3)
      .map(img => img.original || img.thumbnail)
      .filter(url => url && !url.includes('googleusercontent.com/gps'));

    return imageUrls.length > 0 ? imageUrls : null;

  } catch (error) {
    console.error(`  ❌ Lỗi:`, error.message);
    return null;
  }
};

const replaceGoogleProxyImagesBatch = async () => {
  const BATCH_SIZE = 50; // Xử lý 50 địa điểm mỗi lần
  
  console.log('🔄 Bắt đầu thay thế ảnh Google proxy (Batch mode)...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Tìm địa điểm còn có ảnh Google proxy
    const destinations = await Destination.find({
      'location.city': 'Bến Tre',
      images: { 
        $elemMatch: { 
          $regex: 'googleusercontent.com/gps' 
        } 
      }
    })
    .select('name category location images')
    .limit(BATCH_SIZE);

    console.log(`📊 Tìm thấy ${destinations.length} địa điểm cần xử lý trong batch này\n`);

    if (destinations.length === 0) {
      console.log('🎉 Đã hoàn thành! Không còn địa điểm nào cần thay thế!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      console.log(`[${i + 1}/${destinations.length}] ${dest.name}`);

      const publicImages = await fetchPublicImagesForDestination(dest.name, dest.location.city);

      if (publicImages && publicImages.length > 0) {
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: publicImages } }
        );
        console.log(`  ✅ Đã thay thế bằng ${publicImages.length} ảnh`);
        updated++;
      } else {
        console.log(`  ⚠️  Không thể lấy ảnh`);
        failed++;
      }

      // Delay để tránh rate limit
      if (i < destinations.length - 1) {
        await delay(1500);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 KẾT QUẢ BATCH NÀY:');
    console.log(`✅ Đã thay thế: ${updated}`);
    console.log(`❌ Thất bại: ${failed}`);
    console.log('='.repeat(50));
    
    // Kiểm tra xem còn địa điểm nào cần xử lý không
    const remaining = await Destination.countDocuments({
      'location.city': 'Bến Tre',
      images: { 
        $elemMatch: { 
          $regex: 'googleusercontent.com/gps' 
        } 
      }
    });

    if (remaining > 0) {
      console.log(`\n⚠️  Còn ${remaining} địa điểm cần xử lý`);
      console.log('💡 Chạy lại script này để tiếp tục:');
      console.log('   node src/scripts/replaceGoogleProxyImagesBatch.js\n');
    } else {
      console.log('\n🎉 ĐÃ HOÀN THÀNH TẤT CẢ!\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
replaceGoogleProxyImagesBatch();
