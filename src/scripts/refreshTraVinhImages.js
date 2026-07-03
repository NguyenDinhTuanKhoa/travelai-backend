const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');
const serpApiManager = require('../utils/serpApiManager');

/**
 * Script để:
 * 1. Xóa tất cả ảnh của địa điểm Trà Vinh
 * 2. Lấy ảnh mới từ Google Images qua SerpAPI
 * 3. Cập nhật lại vào database
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchImagesFromGoogleImages = async (placeName, city) => {
  try {
    const params = {
      engine: 'google_images',
      q: `${placeName} ${city} Vietnam`,
      num: 10,
      ijn: 0
    };

    const data = await serpApiManager.fetchWithRotation(params);
    
    if (!data.images_results || data.images_results.length === 0) {
      return [];
    }

    // Lấy ảnh chất lượng cao, loại bỏ các nguồn không ổn định
    const imageUrls = data.images_results
      .slice(0, 10)
      .map(img => img.original || img.thumbnail)
      .filter(url => 
        url && 
        !url.includes('googleusercontent.com/gps') && // Google proxy
        !url.includes('tiktok.com') && // TikTok bị 403
        !url.includes('facebook.com') && // Facebook bị chặn
        !url.includes('instagram.com') && // Instagram bị chặn
        (url.startsWith('http://') || url.startsWith('https://'))
      )
      .slice(0, 3); // Lấy 3 ảnh tốt nhất

    return imageUrls;

  } catch (error) {
    console.error(`    ❌ Lỗi:`, error.message);
    return [];
  }
};

const refreshTraVinhImages = async () => {
  console.log('🔄 BẮT ĐẦU REFRESH ẢNH TRÀ VINH\n');
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Bước 1: Đếm số lượng địa điểm Trà Vinh
    const totalCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    console.log(`📊 Tổng số địa điểm Trà Vinh: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('⚠️  Không tìm thấy địa điểm Trà Vinh nào trong database');
      process.exit(0);
    }

    // Bước 2: Xóa tất cả ảnh (set images = [])
    console.log('🗑️  Đang xóa tất cả ảnh cũ...');
    const updateResult = await Destination.updateMany(
      { 'location.city': 'Trà Vinh' },
      { $set: { images: [] } }
    );
    console.log(`✅ Đã xóa ảnh của ${updateResult.modifiedCount} địa điểm\n`);

    // Bước 3: Lấy danh sách tất cả địa điểm Trà Vinh
    console.log('='.repeat(70));
    console.log('🚀 BẮT ĐẦU LẤY ẢNH MỚI TỪ GOOGLE IMAGES\n');

    const destinations = await Destination.find({ 'location.city': 'Trà Vinh' })
      .select('name category images');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      
      console.log(`[${i + 1}/${destinations.length}] ${dest.name}`);

      // Lấy ảnh từ Google Images
      const images = await fetchImagesFromGoogleImages(dest.name, 'Trà Vinh');

      if (images.length > 0) {
        // Cập nhật vào database
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: images } }
        );
        console.log(`  ✅ Đã cập nhật ${images.length} ảnh`);
        successCount++;
      } else {
        console.log(`  ⚠️  Không tìm thấy ảnh`);
        failCount++;
      }

      // Delay để tránh rate limit
      if (i < destinations.length - 1) {
        await delay(1500); // 1.5 giây
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 HOÀN THÀNH!');
    console.log('='.repeat(70));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Tổng số địa điểm: ${totalCount}`);
    console.log(`   - Đã cập nhật ảnh: ${successCount} địa điểm (${((successCount/totalCount)*100).toFixed(1)}%)`);
    console.log(`   - Không tìm thấy ảnh: ${failCount} địa điểm (${((failCount/totalCount)*100).toFixed(1)}%)`);
    console.log(`   - Trung bình: ~${(successCount * 3 / totalCount).toFixed(1)} ảnh/địa điểm`);
    console.log('='.repeat(70));

    if (failCount > 0) {
      console.log(`\n⚠️  ${failCount} địa điểm không tìm thấy ảnh`);
      console.log('💡 Có thể thêm ảnh thủ công qua Admin panel hoặc chạy lại script');
    }

    console.log('\n🚀 Reload trang web để xem kết quả!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
refreshTraVinhImages();
