require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

// Các keyword nhận diện quán cafe
const CAFE_KEYWORDS = [
  'cafe', 'cà phê', 'ca phe', 'coffee', 'trà sữa', 'tra sua',
  'milk tea', 'boba', 'pha máy', 'latte', 'cappuccino', 'espresso',
  'teahouse', 'tea house', 'trà đá', 'sinh tố', 'smoothie',
  'quán nước', 'nước ép', 'juice'
];

async function migrateCafes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Tìm tất cả restaurant mà tên chứa keyword cafe
    const restaurants = await Destination.find({ category: 'restaurant' });
    console.log(`📊 Tổng số restaurant hiện tại: ${restaurants.length}\n`);

    let updated = 0;
    const updatedNames = [];

    for (const dest of restaurants) {
      const nameLower = dest.name.toLowerCase();
      const descLower = (dest.description || '').toLowerCase();

      const isCafe = CAFE_KEYWORDS.some(keyword => 
        nameLower.includes(keyword) || descLower.includes(keyword)
      );

      // Thêm điều kiện: Nếu tên KHÔNG chứa keyword nhà hàng/quán ăn
      const isRestaurant = ['nhà hàng', 'quán ăn', 'restaurant', 'ẩm thực', 'hải sản',
        'phở', 'bún', 'cơm', 'lẩu', 'nướng', 'buffet', 'bbq', 'sushi', 'pizza',
        'chicken', 'gà', 'vịt', 'bò', 'heo', 'bánh canh', 'bánh xèo', 'hủ tiếu',
        'mì', 'cháo', 'bít tết', 'steak', 'food', 'ăn vặt', 'bánh mì'
      ].some(kw => nameLower.includes(kw));

      if (isCafe && !isRestaurant) {
        await Destination.updateOne(
          { _id: dest._id },
          { $set: { category: 'cafe' } }
        );
        updated++;
        updatedNames.push(dest.name);
      }
    }

    console.log(`☕ Đã chuyển ${updated} địa điểm từ "restaurant" → "cafe":\n`);
    updatedNames.forEach(name => console.log(`   - ${name}`));

    // Thống kê cuối
    const totalRestaurants = await Destination.countDocuments({ category: 'restaurant' });
    const totalCafes = await Destination.countDocuments({ category: 'cafe' });
    console.log(`\n📊 Kết quả cuối:`);
    console.log(`   🍜 Nhà hàng: ${totalRestaurants}`);
    console.log(`   ☕ Quán Cafe: ${totalCafes}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateCafes();
