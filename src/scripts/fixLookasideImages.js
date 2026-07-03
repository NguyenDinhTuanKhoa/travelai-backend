require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

async function fixLookasideImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\\n');

    // Tìm tất cả các địa điểm có chứa ảnh từ lookaside.fbsbx.com
    const brokenDests = await Destination.find({
      images: { $regex: /lookaside\.fbsbx\.com/ }
    });

    console.log(`📊 Tìm thấy ${brokenDests.length} địa điểm sử dụng ảnh Facebook (lookaside.fbsbx.com)\\n`);

    if (brokenDests.length === 0) {
      console.log('🎉 Không có địa điểm nào cần sửa!');
      process.exit(0);
      return;
    }

    console.log('Mẫu địa điểm cần sửa:');
    brokenDests.slice(0, 10).forEach(d => {
      console.log(`  - ${d.name} (${d.location?.city})`);
    });

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question(`\\n🔄 Cập nhật ${brokenDests.length} địa điểm bằng Serper Images? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Đã hủy.');
      process.exit(0);
      return;
    }

    console.log('\\n🔄 Đang fetch ảnh mới...\\n');

    let fixed = 0, failed = 0;

    for (let i = 0; i < brokenDests.length; i++) {
      const dest = brokenDests[i];
      const progress = `[${i + 1}/${brokenDests.length}]`;
      
      try {
        const query = `${dest.name} ${dest.location?.city || ''} Vietnam`;
        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          console.log(`${progress} ${dest.name} ⚠️ Không tìm thấy ảnh`);
          failed++;
          continue;
        }

        await Destination.updateOne(
          { _id: dest._id },
          { $set: { images: validImages } }
        );

        fixed++;
        if (fixed % 10 === 0 || i < 5) {
          console.log(`${progress} ${dest.name} ✅ Đã cập nhật ${validImages.length} ảnh`);
        }
      } catch (err) {
        console.log(`${progress} ${dest.name} ❌ Lỗi: ${err.message}`);
        failed++;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`\\n${'═'.repeat(55)}`);
    console.log(`🎯 KẾT QUẢ: Đã sửa ${fixed} | Thất bại ${failed}`);
    console.log(`${'═'.repeat(55)}`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

fixLookasideImages();
