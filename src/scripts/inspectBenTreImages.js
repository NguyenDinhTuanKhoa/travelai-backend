const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

/**
 * Script để xem chi tiết URL ảnh của các địa điểm Bến Tre
 */

const inspectBenTreImages = async () => {
  console.log('🔍 Đang kiểm tra chi tiết URL ảnh...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // Lấy 20 địa điểm đầu tiên
    const destinations = await Destination.find({ 'location.city': 'Bến Tre' })
      .select('name category images')
      .limit(20);

    console.log('📋 20 địa điểm đầu tiên:\n');
    console.log('='.repeat(80));

    destinations.forEach((dest, index) => {
      console.log(`\n${index + 1}. ${dest.name}`);
      console.log(`   Category: ${dest.category}`);
      console.log(`   Số lượng ảnh: ${dest.images?.length || 0}`);
      
      if (dest.images && dest.images.length > 0) {
        dest.images.forEach((img, imgIndex) => {
          // Kiểm tra URL có hợp lệ không
          const isValid = img && (img.startsWith('http://') || img.startsWith('https://'));
          const status = isValid ? '✅' : '❌';
          console.log(`   ${status} Ảnh ${imgIndex + 1}: ${img?.substring(0, 80)}...`);
        });
      } else {
        console.log('   ❌ KHÔNG CÓ ẢNH');
      }
    });

    console.log('\n' + '='.repeat(80));

    // Thống kê loại URL
    const allDestinations = await Destination.find({ 'location.city': 'Bến Tre' })
      .select('images');

    let totalImages = 0;
    let validUrls = 0;
    let invalidUrls = 0;
    let emptyImages = 0;

    allDestinations.forEach(dest => {
      if (!dest.images || dest.images.length === 0) {
        emptyImages++;
      } else {
        dest.images.forEach(img => {
          totalImages++;
          if (img && (img.startsWith('http://') || img.startsWith('https://'))) {
            validUrls++;
          } else {
            invalidUrls++;
          }
        });
      }
    });

    console.log('\n📊 THỐNG KÊ URL ẢNH:');
    console.log('='.repeat(80));
    console.log(`Tổng số địa điểm: ${allDestinations.length}`);
    console.log(`Địa điểm không có ảnh: ${emptyImages}`);
    console.log(`Tổng số URL ảnh: ${totalImages}`);
    console.log(`✅ URL hợp lệ (http/https): ${validUrls}`);
    console.log(`❌ URL không hợp lệ: ${invalidUrls}`);
    console.log('='.repeat(80) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
inspectBenTreImages();
