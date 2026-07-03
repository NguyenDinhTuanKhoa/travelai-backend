require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Quảng Ninh';
const CITY_CENTER = 'Hạ Long';

const destinations = [
  // Thêm nhiều địa điểm Hạ Long
  { name: 'Sun World Halong Complex', category: 'attraction' },
  { name: 'Cáp treo Nữ Hoàng Hạ Long', category: 'attraction' },
  { name: 'Công viên Sun World Halong Park', category: 'attraction' },
  { name: 'Bảo tàng Quảng Ninh', category: 'historical' },
  { name: 'Nhà hát Hạ Long', category: 'city' },
  { name: 'Quảng trường 30/4 Hạ Long', category: 'city' },
  
  // Thêm các hang động
  { name: 'Hang Luồn', category: 'attraction' },
  { name: 'Hang Trống', category: 'attraction' },
  { name: 'Hang Trinh Nữ', category: 'attraction' },
  { name: 'Hang Mê Cung', category: 'attraction' },
  { name: 'Hang Bồ Nâu', category: 'attraction' },
  
  // Thêm các đảo
  { name: 'Đảo Soi Sim', category: 'attraction' },
  { name: 'Đảo Ba Trái Đào', category: 'attraction' },
  { name: 'Đảo Cát Bà', category: 'attraction' },
  { name: 'Vườn Quốc gia Cát Bà', category: 'attraction' },
  { name: 'Bãi biển Cát Cò', category: 'beach' },
  { name: 'Bãi biển Cát Dứa', category: 'beach' },
  
  // Thêm khách sạn
  { name: 'Vinpearl Resort & Golf Nam Hội An', category: 'hotel' },
  { name: 'Halong Plaza Hotel', category: 'hotel' },
  { name: 'Muong Thanh Luxury Halong Hotel', category: 'hotel' },
  { name: 'Grand Ha Long Hotel', category: 'hotel' },
  { name: 'Halong Pearl Hotel', category: 'hotel' },
  { name: 'Halong Dream Hotel', category: 'hotel' },
  { name: 'Halong Silversea Cruise', category: 'hotel' },
  { name: 'Paradise Elegance Cruise', category: 'hotel' },
  { name: 'Bhaya Cruise', category: 'hotel' },
  { name: 'Indochina Junk', category: 'hotel' },
  
  // Thêm nhà hàng
  { name: 'Nhà hàng Hải Sản Bãi Cháy', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển Hạ Long', category: 'restaurant' },
  { name: 'Quán Ốc Hạ Long', category: 'restaurant' },
  { name: 'Nhà hàng Lẩu Hải Sản Hạ Long', category: 'restaurant' },
  { name: 'Quán Bánh Đa Cua Hải Phòng', category: 'restaurant' },
  { name: 'Nhà hàng Cua Vàng', category: 'restaurant' },
  { name: 'Quán Chả Mực Hạ Long', category: 'restaurant' },
  { name: 'Nhà hàng Sao Biển', category: 'restaurant' },
  
  // Cafe
  { name: 'Cafe Bãi Cháy', category: 'restaurant' },
  { name: 'Highlands Coffee Hạ Long', category: 'restaurant' },
  { name: 'The Coffee House Hạ Long', category: 'restaurant' },
  
  // Chợ và mua sắm
  { name: 'Chợ Bãi Cháy', category: 'city' },
  { name: 'Vincom Plaza Hạ Long', category: 'city' },
  { name: 'Chợ đêm Hạ Long', category: 'city' },
  
  // Thêm địa điểm Móng Cái
  { name: 'Cửa khẩu Móng Cái', category: 'city' },
  { name: 'Bãi biển Móng Cái', category: 'beach' },
  { name: 'Chợ Móng Cái', category: 'city' }
];

async function fetchQuangNinhExtra() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏝️  BỔ SUNG ${PROVINCE.toUpperCase()}`);
    console.log('═'.repeat(60));

    let saved = 0, skipped = 0, failed = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      console.log(`\n[${i + 1}/${destinations.length}] ${dest.name}...`);

      const existing = await Destination.findOne({
        name: dest.name,
        'location.city': PROVINCE
      });

      if (existing) {
        console.log(`   ⏭️  Đã có`);
        skipped++;
        continue;
      }

      try {
        const query = `${dest.name} ${CITY_CENTER} ${PROVINCE}`;
        const placeResult = await serperManager.searchPlaces(query);

        if (!placeResult.places || placeResult.places.length === 0) {
          failed++;
          continue;
        }

        const place = placeResult.places[0];
        if (!place.latitude || !place.longitude) {
          failed++;
          continue;
        }

        const lat = place.latitude;
        const lng = place.longitude;

        if (!isWithinProvince(lat, lng, PROVINCE)) {
          failed++;
          continue;
        }

        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${PROVINCE} - Đồng Bằng Sông Hồng`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: place.rating || 4.7
        });

        await newDestination.save();
        saved++;
        console.log(`   ✅ Lưu`);

      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Đã lưu: ${saved}`);
    console.log(`⏭️  Đã có: ${skipped}`);
    console.log(`❌ Thất bại: ${failed}`);
    console.log('═'.repeat(60));
    
    // Tổng kết
    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`\n🎯 TỔNG ${PROVINCE}: ${total} địa điểm\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchQuangNinhExtra();
