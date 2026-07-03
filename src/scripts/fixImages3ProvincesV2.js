require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Destination = require('../models/Destination');
const https = require('https');
const http = require('http');

const TARGET_CITIES = ['Bến Tre', 'Trà Vinh', 'Vĩnh Long'];
const SERPER_KEY = process.env.SERPER_API_KEY;

function checkImageUrl(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
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

// Strategy 1: Serper Places (Google Maps) → thumbnailUrl
async function searchViaPlaces(query) {
  try {
    const res = await axios.post('https://google.serper.dev/places',
      { q: query, gl: 'vn', hl: 'vi' },
      { headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (!res.data?.places?.length) return [];
    return res.data.places
      .map(p => p.thumbnailUrl)
      .filter(url => url && /^https?:\/\//.test(url))
      .slice(0, 3);
  } catch (err) {
    return [];
  }
}

// Strategy 2: Serper Images với filter nới (chỉ chặn facebook + lookaside)
async function searchViaImagesLoose(query, num = 5) {
  try {
    const res = await axios.post('https://google.serper.dev/images',
      { q: query, gl: 'vn', hl: 'vi', num },
      { headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (!res.data?.images) return [];
    return res.data.images
      .map(img => img.imageUrl)
      .filter(url => {
        if (!url || !/^https?:\/\//.test(url)) return false;
        const lower = url.toLowerCase();
        return !lower.includes('facebook.com') &&
               !lower.includes('lookaside.fbsbx.com');
      })
      .slice(0, 3);
  } catch (err) {
    return [];
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(`🎯 V2 — Quét lại 3 tỉnh tìm điểm vẫn thiếu ảnh: ${TARGET_CITIES.join(', ')}\n`);

  const cityRegex = new RegExp(TARGET_CITIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const dests = await Destination.find({ 'location.city': { $regex: cityRegex } }).lean();
  console.log(`📊 Tổng: ${dests.length} địa điểm thuộc 3 tỉnh\n`);

  const toFix = [];
  let checked = 0;

  console.log('🔍 PHASE 1: Audit ảnh...\n');
  for (const dest of dests) {
    checked++;
    if (checked % 100 === 0) console.log(`   Đã kiểm tra ${checked}/${dests.length}...`);

    if (!dest.images || dest.images.length === 0) { toFix.push(dest); continue; }
    const firstUrl = dest.images[0];
    if (isObviouslyBad(firstUrl)) { toFix.push(dest); continue; }
    const ok = await checkImageUrl(firstUrl, 4000);
    if (!ok) toFix.push(dest);
  }

  console.log(`\n📊 Cần fix V2: ${toFix.length} địa điểm\n`);
  if (toFix.length === 0) {
    console.log('🎉 Không có gì để fix!');
    process.exit(0);
  }

  console.log('🔄 PHASE 2: Combo Places → Images (filter nới)...\n');

  let fixedByPlaces = 0, fixedByImages = 0, failed = 0;

  for (let i = 0; i < toFix.length; i++) {
    const dest = toFix[i];
    const progress = `[${i + 1}/${toFix.length}]`;
    const query = `${dest.name} ${dest.location?.city || ''}`;

    let images = await searchViaPlaces(query);
    let source = 'places';

    if (images.length === 0) {
      images = await searchViaImagesLoose(query, 5);
      source = 'images';
    }

    if (images.length === 0) {
      console.log(`${progress} ❌ ${dest.name} — fail cả 2 strategy`);
      failed++;
    } else {
      await Destination.updateOne({ _id: dest._id }, { $set: { images } });
      console.log(`${progress} ✅ ${dest.name} — ${images.length} ảnh [${source}]`);
      if (source === 'places') fixedByPlaces++; else fixedByImages++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🎯 V2 HOÀN TẤT:`);
  console.log(`   ✅ Fixed via Places: ${fixedByPlaces}`);
  console.log(`   ✅ Fixed via Images (loose): ${fixedByImages}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`${'═'.repeat(55)}`);
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
