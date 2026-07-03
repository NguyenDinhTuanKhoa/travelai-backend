require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

const AMUSEMENT_KEYWORDS = [
  'khu vui chơi', 'khu du lịch', 'vinwonders', 'sun world', 'công viên nước',
  'thủy cung', 'sở thú', 'cáp treo', 'giải trí', 'farmstay', 'nông trại',
  'khu sinh thái', 'vườn thú', 'safari', 'cắm trại', 'picnic'
];

const CULTURE_KEYWORDS = [
  'chợ nổi', 'làng gốm', 'làng nghề', 'vườn trái cây', 'làng hoa', 'cù lao',
  'vườn dâu', 'làng chài', 'thổ cẩm', 'vườn mận', 'làng cổ'
];

const LANDMARK_KEYWORDS = [
  'cổng chào', 'quảng trường', 'cầu đi bộ', 'công viên', 'tháp', 'cột cờ',
  'tượng đài', 'cầu', 'hồ', 'bến tàu', 'phố đi bộ', 'nhà hát'
];

async function migrateAttractions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const attractions = await Destination.find({ category: 'attraction' });
    console.log(`📊 Tổng số attraction hiện tại: ${attractions.length}\n`);

    let updatedAmusement = 0;
    let updatedCulture = 0;
    let updatedLandmark = 0;

    for (const dest of attractions) {
      const nameLower = dest.name.toLowerCase();
      const descLower = (dest.description || '').toLowerCase();

      // Helper function to check keywords
      const hasMatch = (keywords) => keywords.some(kw => nameLower.includes(kw) || descLower.includes(kw));

      let newCategory = null;

      if (hasMatch(AMUSEMENT_KEYWORDS)) {
        newCategory = 'amusement';
      } else if (hasMatch(CULTURE_KEYWORDS)) {
        newCategory = 'culture';
      } else if (hasMatch(LANDMARK_KEYWORDS)) {
        newCategory = 'landmark';
      }

      if (newCategory) {
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { category: newCategory } }
        );
        if (newCategory === 'amusement') updatedAmusement++;
        if (newCategory === 'culture') updatedCulture++;
        if (newCategory === 'landmark') updatedLandmark++;
      }
    }

    console.log(`🎡 Đã chuyển ${updatedAmusement} địa điểm sang "amusement" (Khu vui chơi)`);
    console.log(`🏮 Đã chuyển ${updatedCulture} địa điểm sang "culture" (Văn hóa)`);
    console.log(`📸 Đã chuyển ${updatedLandmark} địa điểm sang "landmark" (Địa danh)`);
    
    const remaining = await Destination.countDocuments({ category: 'attraction' });
    console.log(`\n🎯 Số lượng "attraction" còn lại chưa phân loại: ${remaining}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateAttractions();
