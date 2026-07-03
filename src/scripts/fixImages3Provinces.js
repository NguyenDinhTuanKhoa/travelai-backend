require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

const TARGET_CITIES = ['Bến Tre', 'Trà Vinh', 'Vĩnh Long'];

function checkImageUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function isObviouslyBad(url) {
  if (!url || url.length < 10) return true;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true;
  const lower = url.toLowerCase();
  return lower.includes('placehold.co') ||
         lower.includes('placeholder') ||
         lower.includes('lookaside.fbsbx.com');
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(`🎯 Quét 3 tỉnh: ${TARGET_CITIES.join(', ')}\n`);

  const cityRegex = new RegExp(TARGET_CITIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const dests = await Destination.find({ 'location.city': { $regex: cityRegex } }).lean();
  console.log(`📊 Tổng: ${dests.length} địa điểm thuộc 3 tỉnh\n`);

  const toFix = [];
  let checked = 0;

  console.log('🔍 PHASE 1: Audit ảnh...\n');
  for (const dest of dests) {
    checked++;
    if (checked % 50 === 0) console.log(`   Đã kiểm tra ${checked}/${dests.length}...`);

    if (!dest.images || dest.images.length === 0) {
      toFix.push({ dest, reason: 'no-images' });
      continue;
    }

    const firstUrl = dest.images[0];
    if (isObviouslyBad(firstUrl)) {
      toFix.push({ dest, reason: 'bad-url' });
      continue;
    }

    const ok = await checkImageUrl(firstUrl, 4000);
    if (!ok) toFix.push({ dest, reason: 'broken-primary' });
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`📊 KẾT QUẢ AUDIT:`);
  console.log(`   ✅ Ảnh OK: ${dests.length - toFix.length}`);
  console.log(`   ❌ Cần fix: ${toFix.length}`);
  console.log(`${'═'.repeat(55)}\n`);

  if (toFix.length === 0) {
    console.log('🎉 Không có gì để fix!');
    process.exit(0);
  }

  const byReason = toFix.reduce((acc, x) => { acc[x.reason] = (acc[x.reason] || 0) + 1; return acc; }, {});
  console.log('Phân loại:', byReason, '\n');

  console.log('Mẫu 10 địa điểm đầu cần sửa:');
  toFix.slice(0, 10).forEach(({ dest, reason }) => {
    console.log(`  - [${reason}] ${dest.name} (${dest.location?.city})`);
  });
  if (toFix.length > 10) console.log(`  ... và ${toFix.length - 10} địa điểm khác\n`);

  console.log('\n🔄 PHASE 2: Fetch ảnh từ Serper...\n');

  let fixed = 0, failed = 0;
  for (let i = 0; i < toFix.length; i++) {
    const { dest } = toFix[i];
    const progress = `[${i + 1}/${toFix.length}]`;
    try {
      const query = `${dest.name} ${dest.location?.city || ''} Vietnam`;
      const images = await serperManager.searchImages(query, 5);
      const validImages = images.slice(0, 3);

      if (validImages.length === 0) {
        console.log(`${progress} ❌ ${dest.name} — không tìm thấy ảnh`);
        failed++;
      } else {
        await Destination.updateOne({ _id: dest._id }, { $set: { images: validImages } });
        console.log(`${progress} ✅ ${dest.name} — ${validImages.length} ảnh mới`);
        fixed++;
      }
    } catch (err) {
      console.log(`${progress} ❌ ${dest.name} — ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🎯 HOÀN TẤT: Fixed ${fixed} | Failed ${failed}`);
  console.log(`${'═'.repeat(55)}`);
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
