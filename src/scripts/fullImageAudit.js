const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

/**
 * Script để audit toàn bộ ảnh và tìm địa điểm cần fix
 */

const testImageUrl = async (url, timeout = 3000) => {
  try {
    const response = await axios.head(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

const fullImageAudit = async () => {
  console.log('🔍 Đang audit toàn bộ ảnh Bến Tre...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    const destinations = await Destination.find({ 'location.city': 'Bến Tre' })
      .select('name category images');

    console.log(`📊 Tổng số: ${destinations.length} địa điểm\n`);

    const noImages = [];
    const allImagesBroken = [];
    const someImagesWork = [];
    const allImagesWork = [];

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      process.stdout.write(`\r[${i + 1}/${destinations.length}] Đang kiểm tra...`);

      // Không có ảnh
      if (!dest.images || dest.images.length === 0) {
        noImages.push(dest.name);
        continue;
      }

      // Test từng ảnh
      const results = await Promise.all(
        dest.images.map(url => testImageUrl(url))
      );

      const workingCount = results.filter(r => r).length;

      if (workingCount === 0) {
        allImagesBroken.push({ name: dest.name, imageCount: dest.images.length });
      } else if (workingCount === dest.images.length) {
        allImagesWork.push(dest.name);
      } else {
        someImagesWork.push({ name: dest.name, working: workingCount, total: dest.images.length });
      }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('📊 KẾT QUẢ AUDIT');
    console.log('='.repeat(70));
    
    console.log(`\n✅ Tất cả ảnh hoạt động: ${allImagesWork.length} địa điểm (${((allImagesWork.length/destinations.length)*100).toFixed(1)}%)`);
    console.log(`⚠️  Một số ảnh hoạt động: ${someImagesWork.length} địa điểm (${((someImagesWork.length/destinations.length)*100).toFixed(1)}%)`);
    console.log(`❌ Tất cả ảnh bị lỗi: ${allImagesBroken.length} địa điểm (${((allImagesBroken.length/destinations.length)*100).toFixed(1)}%)`);
    console.log(`📭 Không có ảnh: ${noImages.length} địa điểm (${((noImages.length/destinations.length)*100).toFixed(1)}%)`);

    // Hiển thị địa điểm cần fix
    const needFix = [...noImages, ...allImagesBroken.map(d => d.name)];
    
    if (needFix.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log(`⚠️  CẦN FIX: ${needFix.length} ĐỊA ĐIỂM`);
      console.log('='.repeat(70));
      
      // Hiển thị 20 địa điểm đầu tiên
      needFix.slice(0, 20).forEach((name, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${name}`);
      });
      
      if (needFix.length > 20) {
        console.log(`... và ${needFix.length - 20} địa điểm khác`);
      }

      // Lưu danh sách vào file
      const fs = require('fs');
      fs.writeFileSync(
        path.join(__dirname, 'destinations_need_fix.json'),
        JSON.stringify(needFix, null, 2)
      );
      console.log(`\n💾 Đã lưu danh sách vào: destinations_need_fix.json`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 HÀNH ĐỘNG TIẾP THEO');
    console.log('='.repeat(70));
    
    if (needFix.length > 0) {
      console.log('1. Chạy script fix ảnh tự động:');
      console.log('   node src/scripts/fixSpecificDestinations.js');
      console.log('\n2. Hoặc thêm ảnh thủ công qua Admin panel');
    } else {
      console.log('🎉 Tất cả địa điểm đã có ảnh hoạt động!');
    }
    
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    process.exit(1);
  }
};

// Chạy script
fullImageAudit();
