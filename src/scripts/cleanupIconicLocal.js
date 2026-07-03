/**
 * Dọn iconic LOCAL (không gọi Serper) — chạy nhanh, miễn phí.
 *  1. Hạ iconic mọi địa điểm có tên chứa từ khóa thương mại/dịch vụ (CTY, TNHH, CLB,
 *     thuê xe, shop, vườn trái cây, siêu thị, homestay...) — đây không phải điểm du lịch.
 *  2. Nâng iconic lại các địa danh nằm trong whitelist quốc dân (Chùa Thiên Mụ, Yên Tử...)
 *     bất kể review, miễn không phải rác thương mại.
 *
 * Chạy: node src/scripts/cleanupIconicLocal.js [--dry]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const WHITELIST = require('./iconicWhitelist');

const DRY_RUN = process.argv.includes('--dry');

const TOUR_CATS = ['attraction', 'historical', 'landmark', 'temple', 'beach', 'mountain', 'culture', 'amusement', 'countryside', 'city'];

// Từ khóa thương mại/dịch vụ → KHÔNG phải điểm du lịch nổi tiếng
const JUNK_REGEX = new RegExp([
  'cty', 'công ty', 'tnhh', 'mtv', 'clb', 'câu lạc bộ', 'dịch vụ', 'thuê xe', 'cho thuê',
  'rửa xe', 'vá vỏ', 'sửa xe', 'shop', 'store', 'cửa hàng', 'trái cây', 'vườn nho', 'vườn dâu',
  'vườn táo', 'thủy canh', 'nông nghiệp', 'rau sạch', 'nhân sâm', 'hủ tiếu', 'coopmart',
  'winmart', 'bách hóa', 'homestay', 'villa', 'motel', 'nhà nghỉ', 'spa', 'massage',
  'karaoke', 'cà phê', 'quán', 'nhà hàng', 'farm', 'bến tàu', 'bến xe', 'bến cano', 'đại lý',
  'tour', 'travel', 'tourist', 'booking', 'vé ', 'ticket', 'cáp treo', 'cap treo', 'cable car',
  'hotel', 'khách sạn', 'apec', 'mandala', 'wyndham', 'melia', 'meliá', 'superior', 'deluxe',
  'bungalow', ' room', 'apartment', 'official', 'langfarm', 'kdl', 'bảo tồn',
  'starbucks', 'vinpearl', 'pineapple', 'panorama', 'vinwonders', 'sunworld', 'safari',
].join('|'), 'i');

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Khớp whitelist CHẶT: tên phải chứa địa danh VÀ không dài hơn địa danh quá 2 từ
// (tránh "Apec Mandala Wyndham Phan Thiet - Mui Ne" khớp "mui ne")
function isWhitelisted(name) {
  const n = normalize(name);
  const nameWords = n.split(' ').length;
  return WHITELIST.some(w => {
    if (!n.includes(w)) return false;
    const termWords = w.split(' ').length;
    return nameWords <= termWords + 2;
  });
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected' + (DRY_RUN ? ' (DRY RUN)\n' : '\n'));

  // ── Bước 1: hạ rác thương mại đang là iconic ──
  const iconicDocs = await Destination.find({ isIconic: true, category: { $in: TOUR_CATS } }).select('name').lean();
  const toDemote = iconicDocs.filter(d => JUNK_REGEX.test(d.name) && !isWhitelisted(d.name));
  console.log(`🗑️  Hạ rác thương mại: ${toDemote.length}`);
  toDemote.slice(0, 25).forEach(d => console.log(`   ⬇️  ${d.name}`));
  if (!DRY_RUN && toDemote.length) {
    await Destination.updateMany({ _id: { $in: toDemote.map(d => d._id) } }, { $set: { isIconic: false } });
  }

  // ── Bước 2: nâng lại địa danh whitelist (nếu đang không iconic và không phải rác) ──
  const nonIconic = await Destination.find({ isIconic: { $ne: true }, category: { $in: TOUR_CATS } }).select('name reviewCount').lean();
  const toPromote = nonIconic.filter(d => isWhitelisted(d.name) && !JUNK_REGEX.test(d.name));
  console.log(`\n⭐ Nâng lại địa danh quốc dân: ${toPromote.length}`);
  toPromote.slice(0, 40).forEach(d => console.log(`   ✅ ${d.name} (rv=${d.reviewCount})`));
  if (!DRY_RUN && toPromote.length) {
    await Destination.updateMany({ _id: { $in: toPromote.map(d => d._id) } }, { $set: { isIconic: true } });
  }

  const finalCount = await Destination.countDocuments({ isIconic: true, category: { $in: TOUR_CATS } });
  console.log(`\n${'═'.repeat(50)}\n🎯 Iconic du lịch sau dọn: ${finalCount}\n${'═'.repeat(50)}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
