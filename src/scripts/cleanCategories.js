require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

const KEYWORDS = {
  hotel: ['nhà khách', 'nhà nghỉ', 'homestay', 'hotel', 'resort', 'hostel', 'motel', 'villa', 'phòng trọ', 'khách sạn'],
  restaurant: ['quán', 'tiệm', 'lẩu', 'nướng', 'bánh xèo', 'bún', 'phở', 'cơm', 'hải sản', 'ẩm thực', 'nhà hàng', 'ăn vặt', 'bê thui', 'chè', 'đặc sản'],
  cafe: ['cafe', 'cà phê', 'coffee', 'trà sữa', 'tiệm bánh'],
  historical: ['hầm chỉ huy', 'bảo tàng', 'lăng', 'mộ', 'di tích', 'tưởng niệm', 'địa đạo', 'thành cổ', 'căn cứ', 'chiến thắng'],
  city: ['chợ', 'siêu thị', 'vincom', 'tạp hóa', 'plaza', 'cửa hàng', 'lotte', 'coopmart', 'big c', 'go!', 'aeon'],
  temple: ['chùa', 'đền', 'đình', 'miếu', 'thiền viện', 'nhà thờ', 'tu viện', 'thánh thất'],
  mountain: ['thác', 'đèo', 'núi', 'đỉnh'],
  beach: ['bãi biển', 'biển']
};

async function cleanCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const allDestinations = await Destination.find({});
    let updatedCount = 0;
    const updates = {};

    for (const dest of allDestinations) {
      const nameLower = dest.name.toLowerCase();
      let newCategory = null;

      // Kiểm tra lần lượt ưu tiên cao đến thấp
      if (KEYWORDS.hotel.some(kw => nameLower.includes(kw))) {
        newCategory = 'hotel';
      } else if (KEYWORDS.restaurant.some(kw => nameLower.includes(kw)) && !nameLower.includes('chợ')) {
        newCategory = 'restaurant';
      } else if (KEYWORDS.cafe.some(kw => nameLower.includes(kw))) {
        newCategory = 'cafe';
      } else if (KEYWORDS.historical.some(kw => nameLower.includes(kw))) {
        newCategory = 'historical';
      } else if (KEYWORDS.temple.some(kw => nameLower.includes(kw))) {
        newCategory = 'temple';
      } else if (KEYWORDS.city.some(kw => nameLower.includes(kw)) && !nameLower.includes('chợ nổi')) {
        newCategory = 'city'; // Markets and shopping (exclude Chợ nổi as it's culture)
      } else if (KEYWORDS.mountain.some(kw => nameLower.includes(kw))) {
        newCategory = 'mountain';
      } else if (KEYWORDS.beach.some(kw => nameLower.includes(kw))) {
        newCategory = 'beach';
      }

      // Nếu hiện tại đang là city nhưng không có keyword nào của city => đưa về Khác (attraction)
      if (dest.category === 'city' && !newCategory) {
        newCategory = 'attraction';
      }

      // Chỉ cập nhật nếu danh mục có thay đổi
      if (newCategory && newCategory !== dest.category) {
        await Destination.updateOne({ _id: dest._id }, { $set: { category: newCategory } });
        updates[newCategory] = (updates[newCategory] || 0) + 1;
        updatedCount++;
      }
    }

    console.log(`✨ Đã dọn dẹp và cập nhật lại ${updatedCount} địa điểm!`);
    console.log('Chi tiết chuyển đổi:');
    for (const [cat, count] of Object.entries(updates)) {
      if (count > 0) console.log(`  - ➡️ Chuyển sang [${cat}]: ${count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanCategories();
