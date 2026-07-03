/**
 * Enrich review/rating thật cho các địa điểm iconic đang thiếu (reviewCount = 0)
 * bằng Serper Places (Google Maps). Sau khi có review thật, đánh dấu lại isIconic
 * để loại các "địa điểm" rác (resort/địa chỉ/cơ sở tôn giáo) không thực sự nổi tiếng.
 *
 * Cách chạy:
 *   node src/scripts/enrichIconicReviews.js            # chạy thật
 *   node src/scripts/enrichIconicReviews.js --dry      # chỉ xem, không ghi DB
 *   node src/scripts/enrichIconicReviews.js --limit=50 # giới hạn số địa điểm
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const TOUR_CATS = ['attraction', 'historical', 'landmark', 'temple', 'beach', 'mountain', 'culture', 'amusement', 'countryside', 'city'];

// Ngưỡng review tối thiểu để được coi là "nổi tiếng" (giữ isIconic = true)
const MIN_REVIEWS_ICONIC = 30;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 0;
const modeArg = args.find(a => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'default';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Bỏ dấu tiếng Việt để so khớp tên mềm
function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Chọn place khớp tên tốt nhất VÀ có nhiều review nhất (tránh lấy địa điểm nhỏ trùng tên)
function pickBestPlace(places, destName) {
  if (!places || places.length === 0) return null;
  const nName = normalize(destName);
  const nameTokens = nName.split(' ').filter(t => t.length > 2);

  // Cho điểm: ưu tiên place mà tên chứa các token chính của địa danh, rồi tới review count
  const scored = places.map(p => {
    const nPlace = normalize(p.title || p.name || '');
    const matched = nameTokens.filter(t => nPlace.includes(t)).length;
    const matchRatio = nameTokens.length ? matched / nameTokens.length : 0;
    return { p, matchRatio, reviews: p.ratingCount || 0 };
  });

  // Chỉ giữ các place khớp tên đủ tốt (>=50% token), nếu không có thì xét tất cả
  const matched = scored.filter(s => s.matchRatio >= 0.5);
  const pool = matched.length > 0 ? matched : scored;
  pool.sort((a, b) => b.reviews - a.reviews);
  return pool[0].p;
}

// Thử nhiều biến thể query, trả về place tốt nhất tìm được
async function findPlace(destName, city) {
  const queries = [destName, `${destName} ${city}`.trim(), `${destName} Việt Nam`];
  let best = null, bestReviews = -1;
  for (const q of queries) {
    try {
      const result = await serperManager.searchPlaces(q);
      const picked = pickBestPlace(result?.places, destName);
      if (picked && (picked.ratingCount || 0) > bestReviews) {
        best = picked;
        bestReviews = picked.ratingCount || 0;
      }
      // Nếu đã tìm được place có review khá cao thì dừng sớm, tiết kiệm credit
      if (bestReviews >= MIN_REVIEWS_ICONIC) break;
    } catch (e) { /* thử query kế tiếp */ }
    await sleep(400);
  }
  return best;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(DRY_RUN ? '🔍 DRY RUN — không ghi DB\n' : '✍️  Ghi trực tiếp vào DB\n');

  // mode=recover: xử lý lại các địa điểm bị run trước hạ nhầm (review thấp 1-29) hoặc
  // không tìm thấy (review 0 nhưng vẫn iconic). Dùng logic findPlace mới (match tên + review cao nhất).
  const RECOVER = MODE === 'recover';
  const query = RECOVER
    ? {
        category: { $in: TOUR_CATS },
        $or: [
          { isIconic: false, reviewCount: { $gte: 1, $lt: MIN_REVIEWS_ICONIC } },
          { isIconic: true, reviewCount: 0 },
        ],
      }
    : {
        isIconic: true,
        category: { $in: TOUR_CATS },
        $or: [{ reviewCount: 0 }, { reviewCount: null }, { reviewCount: { $exists: false } }],
      };

  let docs = await Destination.find(query).select('name location category rating reviewCount isIconic');
  if (LIMIT > 0) docs = docs.slice(0, LIMIT);

  console.log(`📍 Cần enrich: ${docs.length} địa điểm\n`);

  let enriched = 0, demoted = 0, notFound = 0, failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const city = d.location?.city || '';
    const tag = `[${i + 1}/${docs.length}]`;

    try {
      const place = await findPlace(d.name, city);

      if (!place) {
        // KHÔNG hạ iconic khi không tìm thấy — giữ nguyên để không phá địa danh nổi tiếng
        console.log(`${tag} ⚠️  Không thấy trên Maps (giữ nguyên): ${d.name}`);
        notFound++;
        continue;
      }

      const rating = place.rating || d.rating || 0;
      const reviewCount = place.ratingCount || 0;
      const stillIconic = reviewCount >= MIN_REVIEWS_ICONIC;

      if (!stillIconic) demoted++; else enriched++;

      console.log(`${tag} ${stillIconic ? '✅' : '⬇️ '} ${d.name} → ${rating}⭐ ${reviewCount} review${stillIconic ? '' : ' (hạ iconic)'}`);

      if (!DRY_RUN) {
        await Destination.updateOne(
          { _id: d._id },
          { $set: { rating, reviewCount, isIconic: stillIconic } }
        );
      }
    } catch (err) {
      console.log(`${tag} ❌ Lỗi: ${d.name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎯 Giữ iconic (review ≥ ${MIN_REVIEWS_ICONIC}): ${enriched}`);
  console.log(`⬇️  Hạ iconic (review thấp/rác)        : ${demoted}`);
  console.log(`⚠️  Không thấy trên Maps               : ${notFound}`);
  console.log(`❌ Lỗi                                 : ${failed}`);
  console.log(`${'═'.repeat(60)}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
