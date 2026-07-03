require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Thanh Hóa';
const CITY_CENTER = 'Thanh Hóa';

const destinations = [
  // Biển
  { name: 'Bãi biển Sầm Sơn', category: 'beach' },
  { name: 'Bãi biển Hải Tiến', category: 'beach' },
  { name: 'Bãi biển Hải Hòa', category: 'beach' },
  
  // Núi và thác
  { name: 'Khu du lịch Pù Luông', category: 'attraction' },
  { name: 'Vườn Quốc gia Bến En', category: 'attraction' },
  { name: 'Thác Hiêu', category: 'attraction' },
  { name: 'Hang Múa', category: 'attraction' },
  
  // Lịch sử
  { name: 'Thành nhà Hồ', category: 'historical' },
  { name: 'Đền Trần', category: 'historical' },
  { name: 'Bảo tàng Thanh Hóa', category: 'historical' },
  
  // Khách sạn
  { name: 'FLC Sầm Sơn', category: 'hotel' },
  { name: 'Muong Thanh Sam Son Hotel', category: 'hotel' },
  { name: 'Thanh Hoa Hotel', category: 'hotel' },
  { name: 'Pu Luong Retreat', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Sầm Sơn', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Thanh Hóa', category: 'restaurant' },
  { name: 'Nhà hàng Biển Xanh Sầm Sơn', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Thanh Hóa', category: 'city' },
  { name: 'Chợ Sầm Sơn', category: 'city' }
];

async function fetchThanhHoa() {
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
        console.log(`   ✅ Lưu`);

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

fetchThanhHoa();
