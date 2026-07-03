require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Nghệ An';
const CITY_CENTER = 'Vinh';

const destinations = [
  // Biển
  { name: 'Bãi biển Cửa Lò', category: 'beach' },
  { name: 'Bãi biển Quỳnh', category: 'beach' },
  { name: 'Bãi biển Diễn Thành', category: 'beach' },
  
  // Lịch sử - Quê Bác
  { name: 'Khu di tích Kim Liên', category: 'historical' },
  { name: 'Nhà thờ Đức Mẹ Cửa Lò', category: 'historical' },
  { name: 'Quảng trường Hồ Chí Minh Vinh', category: 'historical' },
  { name: 'Bảo tàng Nghệ An', category: 'historical' },
  
  // Núi và thác
  { name: 'Vườn Quốc gia Pù Mát', category: 'attraction' },
  { name: 'Thác Khe Kèm', category: 'attraction' },
  { name: 'Núi Hồng Lĩnh', category: 'attraction' },
  
  // Khách sạn
  { name: 'Muong Thanh Cua Lo Hotel', category: 'hotel' },
  { name: 'Sai Gon Kim Lien Hotel', category: 'hotel' },
  { name: 'Vinh Hotel', category: 'hotel' },
  { name: 'Cua Lo Beach Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hải Sản Cửa Lò', category: 'restaurant' },
  { name: 'Quán Cơm Niêu Nghệ An', category: 'restaurant' },
  { name: 'Nhà hàng Biển Xanh', category: 'restaurant' },
  
  // Chợ
  { name: 'Chợ Vinh', category: 'city' },
  { name: 'Chợ Cửa Lò', category: 'city' }
];

async function fetchNgheAn() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏛️  ${PROVINCE.toUpperCase()}`);
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

fetchNgheAn();
