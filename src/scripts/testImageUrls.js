const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

/**
 * Script để test xem URL ảnh nào bị lỗi (không load được)
 */

const testImageUrl = async (url, timeout = 5000) => {
  try {
    const response = await axios.head(url, {
      timeout,
      validateStatus: (status) => status < 500, // Chấp nhận cả 404, 403
    });
    
    if (response.status === 200) {
      return { status: 'OK', code: 200 };
    } else if (response.status === 403) {
      return { status: 'FORBIDDEN', code: 403 };
    } else if (response.status === 404) {
      return { status: 'NOT_FOUND', code: 404 };
    } else {
      return { status: 'ERROR', code: response.status };
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return { status: 'TIMEOUT', code: 0 };
    }
    return { status: 'FAILED', code: 0, error: error.message };
  }
};

const testBenTreImages = async () => {
  console.log('🔍 Đang test URL ảnh của địa điểm Bến Tre...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    const destinations = await Destination.find({ 'location.city': 'Bến Tre' })
      .select('name category images')
      .limit(50); // Test 50 địa điểm đầu tiên

    console.log(`📊 Đang test ${destinations.length} địa điểm...\n`);

    let totalImages = 0;
    let okImages = 0;
    let forbiddenImages = 0;
    let notFoundImages = 0;
    let timeoutImages = 0;
    let failedImages = 0;
    let emptyImages = 0;

    const problemDestinations = [];

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      
      if (!dest.images || dest.images.length === 0) {
        console.log(`❌ [${i + 1}] ${dest.name} - KHÔNG CÓ ẢNH`);
        emptyImages++;
        problemDestinations.push({ name: dest.name, issue: 'NO_IMAGES' });
        continue;
      }

      console.log(`[${i + 1}/${destinations.length}] ${dest.name}`);
      
      let hasWorkingImage = false;
      for (let j = 0; j < dest.images.length; j++) {
        const imgUrl = dest.images[j];
        const result = await testImageUrl(imgUrl);
        
        totalImages++;
        
        if (result.status === 'OK') {
          okImages++;
          hasWorkingImage = true;
          console.log(`  ✅ Ảnh ${j + 1}: OK`);
        } else if (result.status === 'FORBIDDEN') {
          forbiddenImages++;
          console.log(`  🚫 Ảnh ${j + 1}: FORBIDDEN (403)`);
        } else if (result.status === 'NOT_FOUND') {
          notFoundImages++;
          console.log(`  ❌ Ảnh ${j + 1}: NOT FOUND (404)`);
        } else if (result.status === 'TIMEOUT') {
          timeoutImages++;
          console.log(`  ⏱️  Ảnh ${j + 1}: TIMEOUT`);
        } else {
          failedImages++;
          console.log(`  ❌ Ảnh ${j + 1}: FAILED (${result.error || result.code})`);
        }
      }

      if (!hasWorkingImage) {
        problemDestinations.push({ 
          name: dest.name, 
          issue: 'ALL_IMAGES_BROKEN',
          imageCount: dest.images.length 
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 KẾT QUẢ TEST:');
    console.log('='.repeat(60));
    console.log(`Tổng số ảnh test: ${totalImages}`);
    console.log(`✅ OK (200): ${okImages} (${((okImages/totalImages)*100).toFixed(1)}%)`);
    console.log(`🚫 Forbidden (403): ${forbiddenImages} (${((forbiddenImages/totalImages)*100).toFixed(1)}%)`);
    console.log(`❌ Not Found (404): ${notFoundImages} (${((notFoundImages/totalImages)*100).toFixed(1)}%)`);
    console.log(`⏱️  Timeout: ${timeoutImages} (${((timeoutImages/totalImages)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedImages} (${((failedImages/totalImages)*100).toFixed(1)}%)`);
    console.log(`📭 Địa điểm không có ảnh: ${emptyImages}`);

    if (problemDestinations.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  ĐỊA ĐIỂM CÓ VẤN ĐỀ:');
      console.log('='.repeat(60));
      problemDestinations.forEach((dest, index) => {
        console.log(`${index + 1}. ${dest.name} - ${dest.issue}`);
      });
    }

    console.log('\n💡 Lưu ý: Một số ảnh có thể bị chặn CORS nhưng vẫn hiển thị được trên browser');
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Chạy script
testBenTreImages();
