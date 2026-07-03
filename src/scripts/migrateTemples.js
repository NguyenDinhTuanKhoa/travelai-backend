require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

const TEMPLE_KEYWORDS = [
  'chùa', 'đền', 'đình', 'miếu', 'pagoda', 'temple',
  'nhà thờ', 'thánh đường', 'thiền viện', 'tu viện',
  'phủ', 'am', 'tịnh xá', 'niệm phật'
];

async function migrateTemples() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const historicals = await Destination.find({ category: 'historical' });
    console.log(`📊 Tổng số historical hiện tại: ${historicals.length}\n`);

    let updated = 0;

    for (const dest of historicals) {
      const nameLower = dest.name.toLowerCase();

      const isTemple = TEMPLE_KEYWORDS.some(kw => nameLower.includes(kw));

      // Loại trừ nếu rõ ràng là di tích lịch sử
      const isHistorical = ['bảo tàng', 'thành cổ', 'nhà tù', 'di tích', 'tưởng niệm',
        'lăng', 'mộ', 'bia', 'chiến thắng', 'cách mạng', 'kháng chiến'
      ].some(kw => nameLower.includes(kw));

      if (isTemple && !isHistorical) {
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { category: 'temple' } }
        );
        updated++;
      }
    }

    const totalHistorical = await Destination.countDocuments({ category: 'historical' });
    const totalTemple = await Destination.countDocuments({ category: 'temple' });

    console.log(`⛩️ Đã chuyển ${updated} địa điểm từ "historical" → "temple"`);
    console.log(`\n📊 Kết quả cuối:`);
    console.log(`   🏛️ Di tích lịch sử: ${totalHistorical}`);
    console.log(`   ⛩️ Chùa & Đền: ${totalTemple}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateTemples();
