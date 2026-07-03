const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Destination = require('../models/Destination');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const checkDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const count = await Destination.countDocuments({ 'location.city': 'Bến Tre' });
    console.log(`\n📊 TỔNG QUAN DATABASE: Có ${count} địa điểm ở Bến Tre (Cào từ SerpApi).`);
    
    if (count > 0) {
      console.log('\n--- 🏨 MỘT SỐ KHÁCH SẠN MẪU ---');
      const hotels = await Destination.find({ 'location.city': 'Bến Tre', category: 'hotel' }).limit(2);
      hotels.forEach(h => console.log(`- ${h.name} (${h.rating}⭐, ${h.reviewCount} đánh giá) | ${h.description}`));

      console.log('\n--- 🍜 MỘT SỐ NHÀ HÀNG MẪU ---');
      const restaurants = await Destination.find({ 'location.city': 'Bến Tre', category: 'restaurant' }).limit(2);
      restaurants.forEach(r => console.log(`- ${r.name} (${r.rating}⭐, ${r.reviewCount} đánh giá) | ${r.description}`));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDb();
