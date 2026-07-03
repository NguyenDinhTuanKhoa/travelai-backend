const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

/**
 * Script để xóa tất cả địa điểm NGOẠI TRỪ Trà Vinh và Bến Tre
 */

const keepOnlyTraVinhBenTre = async () => {
  console.log('🗑️  BẮT ĐẦU XÓA DỮ LIỆU CÁC TỈNH KHÁC\n');
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Bước 1: Đếm tổng số địa điểm
    const totalCount = await Destination.countDocuments();
    console.log(`📊 Tổng số địa điểm hiện tại: ${totalCount}\n`);

    // Bước 2: Đếm số địa điểm Trà Vinh và Bến Tre
    const traVinhCount = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    const benTreCount = await Destination.countDocuments({ 'location.city': 'Bến Tre' });
    
    console.log(`✅ Trà Vinh: ${traVinhCount} địa điểm (sẽ GIỮ LẠI)`);
    console.log(`✅ Bến Tre: ${benTreCount} địa điểm (sẽ GIỮ LẠI)`);
    console.log(`❌ Các tỉnh khác: ${totalCount - traVinhCount - benTreCount} địa điểm (sẽ XÓA)\n`);

    // Bước 3: Lấy danh sách các tỉnh khác
    const otherCities = await Destination.distinct('location.city', {
      'location.city': { $nin: ['Trà Vinh', 'Bến Tre'] }
    });

    if (otherCities.length > 0) {
      console.log('📋 Các tỉnh sẽ bị xóa:');
      console.log('='.repeat(70));
      otherCities.forEach((city, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${city}`);
      });
      console.log('');
    }

    // Bước 4: Xóa tất cả địa điểm NGOẠI TRỪ Trà Vinh và Bến Tre
    console.log('🗑️  Đang xóa dữ liệu các tỉnh khác...');
    const deleteResult = await Destination.deleteMany({
      'location.city': { $nin: ['Trà Vinh', 'Bến Tre'] }
    });

    console.log(`✅ Đã xóa ${deleteResult.deletedCount} địa điểm\n`);

    // Bước 5: Kiểm tra lại
    const remainingCount = await Destination.countDocuments();
    const remainingTraVinh = await Destination.countDocuments({ 'location.city': 'Trà Vinh' });
    const remainingBenTre = await Destination.countDocuments({ 'location.city': 'Bến Tre' });

    console.log('='.repeat(70));
    console.log('🎉 HOÀN THÀNH!');
    console.log('='.repeat(70));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Đã xóa: ${deleteResult.deletedCount} địa điểm`);
    console.log(`   - Còn lại: ${remainingCount} địa điểm`);
    console.log(`     + Trà Vinh: ${remainingTraVinh} địa điểm`);
    console.log(`     + Bến Tre: ${remainingBenTre} địa điểm`);
    console.log('='.repeat(70));

    if (otherCities.length > 0) {
      console.log(`\n✅ Đã xóa dữ liệu của ${otherCities.length} tỉnh khác`);
      console.log('✅ Chỉ còn lại dữ liệu Trà Vinh và Bến Tre');
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
keepOnlyTraVinhBenTre();
