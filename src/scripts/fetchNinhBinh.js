require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Ninh Bình';
const CITY_CENTER = 'Ninh Bình';

const destinations = [
  // Di sản UNESCO
  { name: 'Quần thể danh thắng Tràng An', category: 'attraction' },
  { name: 'Tam Cốc - Bích Động', category: 'attraction' },
  { name: 'Chùa Bái Đính', category: 'historical' },
  { name: 'Hang Múa', category: 'attraction' },
  { name: 'Vườn Quốc gia Cúc Phương', category: 'attraction' },
  
  // Lịch sử
  { name: 'Cố đô Hoa Lư', category: 'historical' },
  { name: 'Đền Đinh Tiên Hoàng', category: 'historical' },
  { name: 'Đền Lê Đại Hành', category: 'historical' },
  { name: 'Chùa Thái Vi', category: 'historical' },
  { name: 'Chùa Bích Động', category: 'historical' },
  
  // Thiên nhiên
  { name: 'Vân Long', category: 'attraction' },
  { name: 'Thung Nham', category: 'attraction' },
  { name: 'Đầm Vân Long', category: 'attraction' },
  { name: 'Hang Động Thiên Hà', category: 'attraction' },
  
  // Khách sạn resort
  { name: 'Emeralda Ninh Binh Resort', category: 'hotel' },
  { name: 'Tam Coc Garden Resort', category: 'hotel' },
  { name: 'Ninh Binh Hidden Charm Hotel', category: 'hotel' },
  { name: 'Tam Coc Bungalow', category: 'hotel' },
  { name: 'Trang An Retreat', category: 'hotel' },
  { name: 'Ninh Binh Legend Hotel', category: 'hotel' },
  { name: 'Tam Coc Rice Fields Resort', category: 'hotel' },
  { name: 'Chez Loan Homestay', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Thúy Anh', category: 'restaurant' },
  { name: 'Nhà hàng Chookie', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Ninh Bình', category: 'restaurant' },
  { name: 'Nhà hàng Trần', category: 'restaurant' },
  { name: 'Nhà hàng Dê Núi', category: 'restaurant' },
  
  // Cafe
  { name: 'Tam Coc Coffee', category: 'restaurant' },
  { name: 'Cafe Tràng An', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Ninh Bình', category: 'city' },
  { name: 'Chợ Tam Điệp', category: 'city' }
];

async function fetchNinhBinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏞️  ${PROVINCE.toUpperCase()} - TRÀNG AN`);
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
        const query = `${dest.name} ${CITY_CENTER} Vietnam`;
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
        console.log(`   ✅`);

      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`\n🎯 TỔNG ${PROVINCE}: ${total} địa điểm\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchNinhBinh();
