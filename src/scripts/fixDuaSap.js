require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
const serperManager = require('../utils/serperManager');

async function fixDuaSap() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const province = await ProvinceSpecialty.findOne({ province: 'Trà Vinh' });
    if (!province) return console.log('Không tìm thấy Trà Vinh');

    const itemIndex = province.souvenirs.findIndex(s => s.name === 'Dừa sáp' || s.name.toLowerCase().includes('dừa sáp'));
    
    if (itemIndex !== -1) {
      console.log('Đang tìm ảnh mới cho Dừa Sáp...');
      const images = await serperManager.searchImages('Dừa sáp Trà Vinh đặc sản', 1);
      if (images.length > 0) {
        province.souvenirs[itemIndex].imageUrl = images[0];
        await province.save();
        console.log('✅ Đã cập nhật ảnh Dừa sáp thành công:', images[0]);
      } else {
        console.log('❌ Không tìm thấy ảnh');
      }
    } else {
      console.log('Không tìm thấy món Dừa sáp trong souvenirs, thử trong localDishes...');
      const dishIndex = province.localDishes.findIndex(s => s.name === 'Dừa sáp' || s.name.toLowerCase().includes('dừa sáp'));
      if (dishIndex !== -1) {
        const images = await serperManager.searchImages('Dừa sáp Trà Vinh đặc sản', 1);
        if (images.length > 0) {
          province.localDishes[dishIndex].imageUrl = images[0];
          await province.save();
          console.log('✅ Đã cập nhật ảnh Dừa sáp thành công:', images[0]);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Lỗi:', error);
    process.exit(1);
  }
}

fixDuaSap();
