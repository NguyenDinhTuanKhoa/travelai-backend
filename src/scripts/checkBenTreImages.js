const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

/**
 * Script để kiểm tra tình trạng hình ảnh của các địa điểm Bến Tre
 */

const checkBenTreImages = async () => {
  console.log('🔍 Đang kiểm tra hình ảnh địa điểm Bến Tre...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Tổng số địa điểm Bến Tre
    const totalBenTre = await Destination.countDocuments({ 'location.city': 'Bến Tre' });

    // Địa điểm có ảnh
    const withImages = await Destination.countDocuments({
      'location.city': 'Bến Tre',
      images: { $exists: true, $ne: [], $not: { $size: 0 } }
    });

    // Địa điểm không có ảnh
    const withoutImages = await Destination.countDocuments({
      'location.city': 'Bến Tre',
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: null }
      ]
    });

    // Thống kê theo category
    const byCategory = await Destination.aggregate([
      { $match: { 'location.city': 'Bến Tre' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          withImages: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$images', null] },
                    { $ne: ['$images', []] },
                    { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Lấy danh sách 10 địa điểm không có ảnh (để xem ví dụ)
    const examplesWithoutImages = await Destination.find({
      'location.city': 'Bến Tre',
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: null }
      ]
    })
      .select('name category')
      .limit(10);

    // In kết quả
    console.log('=' .repeat(60));
    console.log('📊 TỔNG QUAN');
    console.log('='.repeat(60));
    console.log(`📍 Tổng số địa điểm Bến Tre: ${totalBenTre}`);
    console.log(`✅ Có hình ảnh: ${withImages} (${((withImages / totalBenTre) * 100).toFixed(1)}%)`);
    console.log(`❌ Không có hình ảnh: ${withoutImages} (${((withoutImages / totalBenTre) * 100).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(60));
    console.log('📊 THỐNG KÊ THEO LOẠI');
    console.log('='.repeat(60));
    byCategory.forEach(cat => {
      const percentage = ((cat.withImages / cat.total) * 100).toFixed(1);
      const categoryName = {
        hotel: 'Khách sạn',
        restaurant: 'Nhà hàng',
        attraction: 'Địa điểm du lịch'
      }[cat._id] || cat._id;

      console.log(`${categoryName.padEnd(20)} | Tổng: ${cat.total.toString().padStart(3)} | Có ảnh: ${cat.withImages.toString().padStart(3)} (${percentage}%)`);
    });

    if (examplesWithoutImages.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('📋 VÍ DỤ CÁC ĐỊA ĐIỂM KHÔNG CÓ ẢNH (10 đầu tiên)');
      console.log('='.repeat(60));
      examplesWithoutImages.forEach((dest, index) => {
        const categoryName = {
          hotel: 'Khách sạn',
          restaurant: 'Nhà hàng',
          attraction: 'Địa điểm'
        }[dest.category] || dest.category;
        console.log(`${(index + 1).toString().padStart(2)}. [${categoryName}] ${dest.name}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 HƯỚNG DẪN');
    console.log('='.repeat(60));
    console.log('Để fix hình ảnh, chạy lệnh:');
    console.log('  node src/scripts/fixBenTreImages.js');
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
checkBenTreImages();
