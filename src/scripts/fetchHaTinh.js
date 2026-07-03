require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Hà Tĩnh';
const CITY_CENTER = 'Hà Tĩnh';

const destinations = [
  // Biển
  { name: 'Bãi biển Thiên Cầm', category: 'beach' },
  { name: 'Bãi biển Kẻ Gỗ', category: 'beach' },
  { name: 'Bãi biển Xuân Thành', category: 'beach' },
  { name: 'Bãi biển Thạch Hải', category: 'beach' },
  
  // Lịch sử
  { name: 'Nhà thờ Đức Mẹ Hà Tĩnh', category: 'historical' },
  { name: 'Khu di tích Lam Kinh', category: 'historical' },
  { name: 'Đền thờ Nguyễn Du', category: 'historical' },
  { name: 'Bảo tàng Hà Tĩnh', category: 'historical' },
  
  // Núi và thác
  { name: 'Vườn Quốc gia Vũ Quang', category: 'attraction' },
  { name: 'Thác Khe Rỗ', category: 'attraction' },
  { name: 'Hồ Kẻ Gỗ', category: 'attraction' },
  
  // Khách sạn
  { name: 'Thiên Cầm Beach Resort', category: 'hotel' },
  { name: 'Vinpearl Hotel Hà Tĩnh', category: 'hotel' },
  { name: 'Hà Tĩnh Hotel', category: 'hotel' },
  { name: 'Saigon Hà Tĩnh Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Thiên Cầm', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Hà Tĩnh', category: 'restaurant' },
  { name: 'Nhà hàng Hương Biển', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Hà Tĩnh', category: 'city' },
  { name: 'Chợ Kỳ Anh', category: 'city' }
];

async function fetchHaTinh() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏖️  ${PROVINCE.toUpperCase()}`);
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
          failed++;
          continue;
        }

        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${PROVINCE} - Bắc Trung Bộ`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: place.rating || 4.5
        });

        await newDestination.save();
        saved++;
        console.log(`   ✅ Lưu thành công`);

      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 700));
    }

    console.log(`\n✅ ${PROVINCE}: ${saved} địa điểm`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchHaTinh();
