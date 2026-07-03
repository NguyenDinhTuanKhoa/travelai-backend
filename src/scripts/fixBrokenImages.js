require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

// Check if a URL returns a valid image (fast HEAD request with timeout)
function checkImageUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve(ok);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function auditImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const allDests = await Destination.find({}).lean();
    console.log(`📊 Tổng: ${allDests.length} địa điểm\n`);

    const broken = []; // { dest, badIndexes }
    const noImages = [];
    let checked = 0;

    // Phase 1: Audit
    console.log('🔍 PHASE 1: Kiểm tra ảnh...\n');

    for (const dest of allDests) {
      checked++;
      if (checked % 200 === 0) {
        console.log(`   Đã kiểm tra ${checked}/${allDests.length}...`);
      }

      // No images at all
      if (!dest.images || dest.images.length === 0) {
        noImages.push(dest);
        continue;
      }

      // Check for obviously bad URLs
      const badIndexes = [];
      for (let i = 0; i < dest.images.length; i++) {
        const url = dest.images[i];
        if (!url || 
            url.includes('placehold.co') || 
            url.includes('placeholder') ||
            url.length < 10 ||
            (!url.startsWith('http://') && !url.startsWith('https://'))) {
          badIndexes.push(i);
          continue;
        }

        // HEAD check only the first image (primary display image)
        if (i === 0) {
          const ok = await checkImageUrl(url, 4000);
          if (!ok) {
            badIndexes.push(i);
          }
        }
      }

      if (badIndexes.length > 0) {
        broken.push({ dest, badIndexes });
      }
    }

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`📊 KẾT QUẢ AUDIT:`);
    console.log(`   ✅ Ảnh OK: ${allDests.length - broken.length - noImages.length}`);
    console.log(`   ❌ Ảnh lỗi: ${broken.length}`);
    console.log(`   🚫 Không có ảnh: ${noImages.length}`);
    console.log(`${'═'.repeat(55)}\n`);

    const toFix = [...broken.map(b => b.dest), ...noImages];

    if (toFix.length === 0) {
      console.log('🎉 Tất cả ảnh đều OK!');
      process.exit(0);
      return;
    }

    // Show sample of broken ones
    console.log('Mẫu địa điểm cần sửa:');
    toFix.slice(0, 15).forEach(d => {
      console.log(`  - ${d.name} (${d.location?.city}) [${d.images?.length || 0} ảnh]`);
    });
    if (toFix.length > 15) console.log(`  ... và ${toFix.length - 15} địa điểm khác`);

    // Phase 2: Fix
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question(`\n🔄 Sửa ${toFix.length} địa điểm bằng Serper Images? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Đã hủy.');
      process.exit(0);
      return;
    }

    console.log('\n🔄 PHASE 2: Fetch ảnh mới...\n');

    let fixed = 0, failed = 0;

    for (let i = 0; i < toFix.length; i++) {
      const dest = toFix[i];
      const progress = `[${i + 1}/${toFix.length}]`;
      
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
          console.log(`${progress} ${dest.name} ✅ ${validImages.length} ảnh`);
        }
      } catch (err) {
        console.log(`${progress} ${dest.name} ❌ ${err.message}`);
        failed++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`🎯 KẾT QUẢ: Đã sửa ${fixed} | Thất bại ${failed}`);
    console.log(`${'═'.repeat(55)}`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

auditImages();
