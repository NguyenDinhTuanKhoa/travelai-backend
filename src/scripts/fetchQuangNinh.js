require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Quảng Ninh';
const CITY_CENTER = 'Hạ Long';

const destinations = [
  // Vịnh Hạ Long - Di sản UNESCO
  { name: 'Vịnh Hạ Long', category: 'attraction' },
  { name: 'Đảo Tuần Châu', category: 'attraction' },
  { name: 'Hang Đầu Gỗ', category: 'attraction' },
  { name: 'Hang Sửng Sốt', category: 'attraction' },
  { name: 'Hang Thiên Cung', category: 'attraction' },
  { name: 'Đảo Titop', category: 'attraction' },
  { name: 'Làng chài Cửa Vạn', category: 'countryside' },
  { name: 'Vịnh Bái Tử Long', category: 'attraction' },
  { name: 'Đảo Cô Tô', category: 'attraction' },
  { name: 'Đảo Quan Lạn', category: 'attraction' },
  { name: 'Đảo Ngọc Vừng', category: 'attraction' },
  
  // Biển
  { name: 'Bãi Cháy', category: 'beach' },
  { name: 'Bãi biển Trà Cổ', category: 'beach' },
  { name: 'Bãi biển Vân Đồn', category: 'beach' },
  { name: 'Bãi biển Minh Châu', category: 'beach' },
  
  // Núi và chùa
  { name: 'Núi Bài Thơ', category: 'attraction' },
  { name: 'Chùa Cái Bầu', category: 'historical' },
  { name: 'Yên Tử', category: 'historical' },
  
  // Khách sạn resort
  { name: 'Vinpearl Resort & Spa Ha Long', category: 'hotel' },
  { name: 'FLC Hạ Long', category: 'hotel' },
  { name: 'Novotel Ha Long Bay', category: 'hotel' },
  { name: 'Wyndham Legend Halong', category: 'hotel' },
  { name: 'Royal Lotus Halong Resort', category: 'hotel' },
  { name: 'Halong Bay Hotel', category: 'hotel' },
  { name: 'Tuan Chau Island Holiday Villa', category: 'hotel' },
  { name: 'Paradise Suites Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Hạ Long', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Quảng Ninh', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển', category: 'restaurant' },
  { name: 'Nhà hàng Bến Đoan', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Hạ Long', category: 'city' },
  { name: 'Chợ Cái Rồng', category: 'city' },
  { name: 'Chợ Móng Cái', category: 'city' }
];

async function fetchQuangNinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏝️  ${PROVINCE.toUpperCase()} - VỊNH HẠ LONG`);
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
          console.log(`   ❌ Ngoài ${PROVINCE}`);
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

    console.log(`\n✅ ${PROVINCE}: ${saved} địa điểm`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchQuangNinh();
