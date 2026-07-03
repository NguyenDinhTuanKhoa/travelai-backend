const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// 🏖️ BÃI SAU VŨNG TÀU - Địa điểm du lịch nổi tiếng
const baiSauVungTau = {
  name: 'Bãi Sau',
  description: 'Bãi biển dài và đẹp nhất Vũng Tàu, nổi tiếng với làn nước trong xanh, bờ cát trắng mịn và hàng dừa rợp bóng mát. Đây là điểm đến lý tưởng để tắm biển, ngắm hoàng hôn và thưởng thức hải sản tươi ngon.',

  location: {
    city: 'Vũng Tàu',
    country: 'Việt Nam',
    coordinates: {
      lat: 10.3330389,   // Tọa độ chính xác từ Google Maps
      lng: 107.0899537
    }
  },

  images: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200',
    'https://images.unsplash.com/photo-1540202404-a2f29016b523?w=1200'
  ],

  category: 'beach',
  priceRange: 'budget',
  rating: 4.4,
  reviewCount: 1850,

  amenities: [
    'Nhà hàng hải sản',
    'Bãi đỗ xe miễn phí',
    'Ghế tắm nắng',
    'Dù che nắng',
    'Khu vui chơi trẻ em',
    'Nhà vệ sinh công cộng'
  ],

  bestTimeToVisit: [
    'Tháng 3', 'Tháng 4', 'Tháng 5',
    'Tháng 6', 'Tháng 7', 'Tháng 8'
  ],

  activities: [
    'Tắm biển',
    'Lướt ván',
    'Chụp ảnh hoàng hôn',
    'Ăn hải sản',
    'Đi dạo bờ biển',
    'Thể thao bãi biển'
  ],

  cuisine: [
    {
      name: 'Hải sản tươi sống',
      description: 'Các quán hải sản dọc bãi biển phục vụ hải sản tươi ngon giá cả phải chăng'
    },
    {
      name: 'Bánh khọt Vũng Tàu',
      description: 'Đặc sản nổi tiếng của Vũng Tàu với bánh giòn rụm, nhân tôm tươi'
    }
  ]
};

const addBaiSau = async () => {
  console.log('🏖️  Thêm Bãi Sau Vũng Tàu...');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const existing = await Destination.findOne({ name: 'Bãi Sau' });

    if (existing) {
      console.log('⚠️  Đã tồn tại, đang cập nhật...');
      await Destination.updateOne({ name: 'Bãi Sau' }, { $set: baiSauVungTau });
      console.log('✅ Đã cập nhật');
    } else {
      await Destination.create(baiSauVungTau);
      console.log('✅ Đã thêm mới');
    }

    console.log('\n📍 Bãi Sau, Vũng Tàu');
    console.log('   Tọa độ: 10.3330389, 107.0899537');
    console.log('\n🗺️  OpenStreetMap:');
    console.log('   https://www.openstreetmap.org/?mlat=10.3330389&mlon=107.0899537#map=15/10.3330389/107.0899537');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

addBaiSau();
