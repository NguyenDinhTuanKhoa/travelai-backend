const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// 🔧 Sửa tọa độ Bãi Sao
// Bãi Sao thực tế ở Phú Quốc, Kiên Giang
// KHÔNG PHẢI ở Vũng Tàu (10.3330389, 107.0899537)

const fixBaiSao = async () => {
  console.log('🔧 Đang sửa tọa độ Bãi Sao...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found ✅' : 'NOT FOUND ❌');

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Tìm địa điểm Bãi Sao
    const baiSao = await Destination.findOne({ name: 'Bãi Sao' });

    if (!baiSao) {
      console.log('❌ Không tìm thấy địa điểm "Bãi Sao" trong database');
      process.exit(1);
    }

    console.log('📍 Thông tin hiện tại:');
    console.log(`   Tên: ${baiSao.name}`);
    console.log(`   Địa điểm: ${baiSao.location.city}, ${baiSao.location.country}`);
    console.log(`   Tọa độ CŨ: lat=${baiSao.location.coordinates.lat}, lng=${baiSao.location.coordinates.lng}`);

    // Tọa độ ĐÚNG của Bãi Sao, Phú Quốc
    // Nguồn: Google Maps "Bãi Sao Phú Quốc"
    const correctCoordinates = {
      lat: 10.1599,  // Bãi Sao, phía Nam đảo Phú Quốc
      lng: 103.9959  // Kiên Giang, Việt Nam
    };

    console.log('\n📍 Tọa độ ĐÚNG (Bãi Sao, Phú Quốc):');
    console.log(`   lat: ${correctCoordinates.lat}`);
    console.log(`   lng: ${correctCoordinates.lng}`);

    // Update
    const result = await Destination.updateOne(
      { name: 'Bãi Sao' },
      {
        $set: {
          'location.city': 'Phú Quốc',
          'location.coordinates.lat': correctCoordinates.lat,
          'location.coordinates.lng': correctCoordinates.lng,
          images: [
            'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200', // Tropical beach
            'https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=1200', // White sand beach
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200'  // Beautiful coastline
          ]
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Đã cập nhật thành công!');
      console.log('📍 Bãi Sao giờ đã có tọa độ đúng ở Phú Quốc');
      console.log('🖼️  Đã cập nhật 3 ảnh chất lượng cao');
      console.log('\n💡 Kiểm tra trên OpenStreetMap:');
      console.log(`   https://www.openstreetmap.org/?mlat=${correctCoordinates.lat}&mlon=${correctCoordinates.lng}#map=15/${correctCoordinates.lat}/${correctCoordinates.lng}`);
    } else {
      console.log('\n⚠️  Không có thay đổi (có thể tọa độ đã đúng rồi)');
    }

    // Verify
    const updated = await Destination.findOne({ name: 'Bãi Sao' });
    console.log('\n✅ Xác nhận sau khi update:');
    console.log(`   Địa điểm: ${updated.location.city}`);
    console.log(`   Tọa độ: lat=${updated.location.coordinates.lat}, lng=${updated.location.coordinates.lng}`);

    console.log('\n🎉 Hoàn thành!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    console.error('Chi tiết:', error);
    process.exit(1);
  }
};

// Run
fixBaiSao();
