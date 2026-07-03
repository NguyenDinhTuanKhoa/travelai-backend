const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// 🏖️ BÃI SAU - VŨNG TÀU
// Tọa độ chính xác: 10.3330389, 107.0899537
const baiSauVungTau = {
  name: 'Bãi Sau',
  description: 'Bãi biển nổi tiếng ở Vũng Tàu với bờ cát dài, sóng lặng, nước trong xanh. Đây là bãi biển lý tưởng để bơi lội, tắm nắng và thưởng thức hải sản tươi ngon. Gần trung tâm thành phố, rất thuận tiện du lịch.',
  location: {
    city: 'Vũng Tàu',
    country: 'Việt Nam',
    coordinates: {
      lat: 10.3330389,  // Tọa độ chính xác
      lng: 107.0899537
    }
  },
  images: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', // Beach scene
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200', // Coastal view
    'https://images.unsplash.com/photo-1540202404-a2f29016b523?w=1200'  // Sunset beach
  ],
  category: 'beach',
  priceRange: 'budget',
  rating: 4.4,
  reviewCount: 1850,
  amenities: [
    'Bãi đỗ xe',
    'Nhà hàng hải sản',
    'Ghế tắm nắng',
    'Dịch vụ massage',
    'Cho thuê phao bơi',
    'Khu vui chơi trẻ em'
  ],
  bestTimeToVisit: [
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 9',
    'Tháng 10'
  ],
  activities: [
    'Tắm biển',
    'Bơi lội',
    'Tắm nắng',
    'Ăn hải sản',
    'Chụp ảnh',
    'Đi dạo bờ biển',
    'Ngắm hoàng hôn'
  ],
  cuisine: [
    {
      name: 'Hải sản tươi sống',
      description: 'Các loại hải sản tươi ngon: tôm, cua, ghẹ, cá được chế biến ngay tại bãi biển'
    },
    {
      name: 'Bánh khọt Vũng Tàu',
      description: 'Đặc sản nổi tiếng của Vũng Tàu với tôm tươi và bánh giòn tan'
    },
    {
      name: 'Lẩu cá đuối',
      description: 'Món ăn đặc trưng miền biển với cá đuối tươi ngon'
    }
  ]
};

// 🔧 Main function
const addBaiSau = async () => {
  console.log('🏖️  Đang thêm Bãi Sau (Vũng Tàu) vào database...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found ✅' : 'NOT FOUND ❌');

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Kiểm tra xem Bãi Sau đã tồn tại chưa
    const existing = await Destination.findOne({
      name: 'Bãi Sau',
      'location.city': 'Vũng Tàu'
    });

    if (existing) {
      console.log('⚠️  Bãi Sau (Vũng Tàu) đã tồn tại trong database');
      console.log('📍 Thông tin hiện tại:');
      console.log(`   Tên: ${existing.name}`);
      console.log(`   Địa điểm: ${existing.location.city}`);
      console.log(`   Tọa độ: ${existing.location.coordinates.lat}, ${existing.location.coordinates.lng}`);

      console.log('\n🔄 Cập nhật lại thông tin...');
      await Destination.updateOne(
        { _id: existing._id },
        { $set: baiSauVungTau }
      );
      console.log('✅ Đã cập nhật Bãi Sau');
    } else {
      console.log('➕ Thêm địa điểm mới: Bãi Sau');
      const newDestination = await Destination.create(baiSauVungTau);
      console.log('✅ Đã thêm thành công!');
      console.log(`   ID: ${newDestination._id}`);
    }

    console.log('\n📍 Thông tin Bãi Sau:');
    console.log(`   Tên: ${baiSauVungTau.name}`);
    console.log(`   Địa điểm: ${baiSauVungTau.location.city}, ${baiSauVungTau.location.country}`);
    console.log(`   Tọa độ: ${baiSauVungTau.location.coordinates.lat}, ${baiSauVungTau.location.coordinates.lng}`);
    console.log(`   Category: ${baiSauVungTau.category}`);
    console.log(`   Số ảnh: ${baiSauVungTau.images.length}`);

    console.log('\n🗺️  Xem trên OpenStreetMap:');
    console.log(`   https://www.openstreetmap.org/?mlat=${baiSauVungTau.location.coordinates.lat}&mlon=${baiSauVungTau.location.coordinates.lng}#map=15/${baiSauVungTau.location.coordinates.lat}/${baiSauVungTau.location.coordinates.lng}`);

    console.log('\n🎉 Hoàn thành!');
    console.log('💡 Xem trên frontend: http://localhost:3000/destinations?search=Bãi+Sau');

    // Kiểm tra tổng số destinations hiện có
    const total = await Destination.countDocuments();
    console.log(`\n📊 Tổng số địa điểm trong database: ${total}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error('Chi tiết:', error);
    process.exit(1);
  }
};

// Run
addBaiSau();
