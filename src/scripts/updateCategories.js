const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Destination = require('../models/Destination');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const classifyCategory = (name, currentCategory) => {
  const lowerName = name.toLowerCase();
  
  // Ưu tiên phân loại các địa điểm du lịch (attraction)
  if (lowerName.includes('biển') || lowerName.includes('beach') || lowerName.includes('bãi') || lowerName.includes('cồn')) return 'beach';
  if (lowerName.includes('núi') || lowerName.includes('mountain') || lowerName.includes('đồi')) return 'mountain';
  if (lowerName.includes('chùa') || lowerName.includes('đền') || lowerName.includes('di tích') || 
      lowerName.includes('bảo tàng') || lowerName.includes('lăng') || lowerName.includes('thiền viện') ||
      lowerName.includes('miếu') || lowerName.includes('tượng') || lowerName.includes('nhà cổ')) return 'historical';
  if (lowerName.includes('vườn') || lowerName.includes('nông trại') || lowerName.includes('farm') || 
      lowerName.includes('sinh thái') || lowerName.includes('trại') || lowerName.includes('trái cây')) return 'countryside';
      
  // Nếu là attraction nhưng không khớp keyword nào, tạm xếp vào city (thành phố) hoặc giữ nguyên
  if (currentCategory === 'attraction') return 'city';
  
  return currentCategory; // Giữ nguyên hotel, restaurant
};

const updateCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const destinations = await Destination.find({});
    let updatedCount = 0;

    for (const dest of destinations) {
      const newCategory = classifyCategory(dest.name, dest.category);
      
      if (newCategory !== dest.category) {
        console.log(`🔄 Cập nhật: "${dest.name}" | ${dest.category} -> ${newCategory}`);
        dest.category = newCategory;
        await dest.save();
        updatedCount++;
      }
    }

    console.log(`\n🎉 Đã phân loại lại thành công ${updatedCount} địa điểm!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

updateCategories();
