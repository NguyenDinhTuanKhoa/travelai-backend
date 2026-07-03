require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const https = require('https');
const http = require('http');

const TARGET_CITIES = ['Bến Tre', 'Trà Vinh', 'Vĩnh Long'];
const SERPER_KEY = process.env.SERPER_API_KEY;

const SEARCH_QUERIES = (city) => [
  { q: `Điểm du lịch ${city}`, category: 'attraction' },
  { q: `Chùa ${city}`, category: 'historical' },
  { q: `Nhà hàng ${city}`, category: 'restaurant' },
  { q: `Quán cà phê ${city}`, category: 'restaurant' },
  { q: `Khách sạn ${city}`, category: 'hotel' },
  { q: `Homestay ${city}`, category: 'hotel' },
];

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

async function serperPlaces(query) {
  try {
    const res = await axios.post('https://google.serper.dev/places',
      { q: query, gl: 'vn', hl: 'vi' },
      { headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return res.data?.places || [];
  } catch (err) {
    console.log(`   ⚠️ Serper Places err: ${err.message}`);
    return [];
  }
}

async function serperImages(query, num = 5) {
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
        return !lower.includes('facebook.com') && !lower.includes('lookaside.fbsbx.com');
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

function detectCity(address, fallback) {
  if (!address) return fallback;
  for (const city of TARGET_CITIES) {
    if (address.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return fallback;
}

async function phase1Delete() {
  console.log('═══ PHASE 1: Audit + Xóa destinations không có ảnh ═══\n');

  const cityRegex = new RegExp(TARGET_CITIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const dests = await Destination.find({ 'location.city': { $regex: cityRegex } }).lean();
  console.log(`📊 Tổng 3 tỉnh: ${dests.length} destinations\n`);

  const toDelete = [];
  let checked = 0;
  for (const dest of dests) {
    checked++;
    if (checked % 100 === 0) console.log(`   Đã kiểm tra ${checked}/${dests.length}...`);

    if (!dest.images || dest.images.length === 0) { toDelete.push(dest); continue; }
    const firstUrl = dest.images[0];
    if (isObviouslyBad(firstUrl)) { toDelete.push(dest); continue; }
    const ok = await checkImageUrl(firstUrl, 4000);
    if (!ok) toDelete.push(dest);
  }

  console.log(`\n❌ Cần xóa: ${toDelete.length} destinations\n`);
  if (toDelete.length === 0) return [];

  // Backup
  const backupPath = path.join(__dirname, `backup_deleted_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
  console.log(`💾 Backup: ${backupPath}\n`);

  toDelete.slice(0, 10).forEach(d => console.log(`   - ${d.name} (${d.location?.city})`));
  if (toDelete.length > 10) console.log(`   ... và ${toDelete.length - 10} điểm khác\n`);

  const ids = toDelete.map(d => d._id);
  const result = await Destination.deleteMany({ _id: { $in: ids } });
  console.log(`✅ Đã xóa ${result.deletedCount} destinations\n`);

  return toDelete;
}

async function phase2Fetch() {
  console.log('═══ PHASE 2: Fetch destinations mới từ Serper ═══\n');

  let totalAdded = 0;
  let skippedExisting = 0;
  let skippedNoImage = 0;

  for (const city of TARGET_CITIES) {
    console.log(`\n📍 Đang xử lý: ${city}`);
    const queries = SEARCH_QUERIES(city);

    for (const { q, category } of queries) {
      console.log(`\n  🔍 Query: "${q}"`);
      const places = await serperPlaces(q);
      console.log(`     Tìm thấy ${places.length} places`);

      for (const place of places) {
        const detectedCity = detectCity(place.address, city);

        // Skip exists
        const existing = await Destination.findOne({
          name: place.title,
          'location.city': detectedCity
        });
        if (existing) { skippedExisting++; continue; }

        // Get images (thumbnailUrl từ Places + Images search)
        let images = [];
        if (place.thumbnailUrl && /^https?:\/\//.test(place.thumbnailUrl)) {
          images.push(place.thumbnailUrl);
        }
        const extraImages = await serperImages(`${place.title} ${detectedCity}`, 4);
        for (const url of extraImages) {
          if (!images.includes(url)) images.push(url);
          if (images.length >= 3) break;
        }

        if (images.length === 0) {
          skippedNoImage++;
          console.log(`     ⏭️  Skip (no image): ${place.title}`);
          continue;
        }

        let priceRange = 'budget';
        if (category === 'hotel' && place.rating >= 4.0) priceRange = 'mid-range';
        if (category === 'restaurant' && place.rating >= 4.5) priceRange = 'mid-range';

        const doc = {
          name: place.title,
          description: `${place.title} tại ${detectedCity} - ${place.type || 'Điểm đến du lịch'}`,
          location: {
            coordinates: { lat: place.latitude || 0, lng: place.longitude || 0 },
            city: detectedCity,
            country: 'Việt Nam'
          },
          images,
          category,
          priceRange,
          rating: place.rating || 0,
          reviewCount: place.reviewsCount || 0,
          amenities: [],
          bestTimeToVisit: ['Cả năm'],
          activities: [],
          cuisine: category === 'restaurant'
            ? { name: place.type || `Ẩm thực ${detectedCity}`, description: 'Đặc sản và món ăn địa phương' }
            : undefined,
        };

        try {
          await Destination.create(doc);
          totalAdded++;
          console.log(`     ✅ Added: ${place.title} (${images.length} ảnh)`);
        } catch (err) {
          console.log(`     ❌ Insert err: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, 300));
      }
      await new Promise(r => setTimeout(r, 800));
    }
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🎯 PHASE 2 KẾT QUẢ:`);
  console.log(`   ✅ Added: ${totalAdded}`);
  console.log(`   ⏭️  Skip (exists): ${skippedExisting}`);
  console.log(`   ⏭️  Skip (no image): ${skippedNoImage}`);
  console.log(`${'═'.repeat(55)}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const deleted = await phase1Delete();
  await phase2Fetch();

  // Final stats
  console.log('\n📊 THỐNG KÊ CUỐI CÙNG:');
  for (const city of TARGET_CITIES) {
    const c = await Destination.countDocuments({ 'location.city': city });
    console.log(`   ${city}: ${c} destinations`);
  }
  const total = await Destination.countDocuments();
  console.log(`   Tổng toàn DB: ${total} destinations`);

  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
