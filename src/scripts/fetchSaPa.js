require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const { isWithinProvince } = require('../utils/gpsValidator');

const PROVINCE = 'Lào Cai';
const CITY_CENTER = 'Sa Pa';

const destinations = [
  // Núi và đỉnh
  { name: 'Fansipan', category: 'attraction' },
  { name: 'Đỉnh Fansipan', category: 'attraction' },
  { name: 'Cáp treo Fansipan', category: 'attraction' },
  { name: 'Núi Hàm Rồng', category: 'attraction' },
  
  // Ruộng bậc thang
  { name: 'Ruộng bậc thang Sa Pa', category: 'countryside' },
  { name: 'Ruộng bậc thang Mường Hoa', category: 'countryside' },
  { name: 'Ruộng bậc thang Y Tý', category: 'countryside' },
  { name: 'Thung lũng Mường Hoa', category: 'countryside' },
  
  // Làng bản
  { name: 'Bản Cát Cát', category: 'countryside' },
  { name: 'Làng Tả Van', category: 'countryside' },
  { name: 'Làng Tả Phìn', category: 'countryside' },
  { name: 'Làng Lao Chải', category: 'countryside' },
  { name: 'Làng Sin Chai', category: 'countryside' },
  
  // Thác và suối
  { name: 'Thác Bạc', category: 'attraction' },
  { name: 'Thác Tình Yêu', category: 'attraction' },
  { name: 'Cầu Mây Rồng', category: 'attraction' },
  
  // Chợ
  { name: 'Chợ Sa Pa', category: 'city' },
  { name: 'Chợ Tình Sa Pa', category: 'city' },
  { name: 'Chợ Bắc Hà', category: 'city' },
  
  // Khách sạn resort
  { name: 'Hotel de la Coupole Sa Pa', category: 'hotel' },
  { name: 'Topas Ecolodge', category: 'hotel' },
  { name: 'Victoria Sapa Resort', category: 'hotel' },
  { name: 'Sapa Jade Hill Resort', category: 'hotel' },
  { name: 'Amazing Hotel Sapa', category: 'hotel' },
  { name: 'Sapa Panorama Hotel', category: 'hotel' },
  { name: 'Sapa Elegance Hotel', category: 'hotel' },
  { name: 'Sapa Charm Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Hill Station', category: 'restaurant' },
  { name: 'Nhà hàng Nature View', category: 'restaurant' },
  { name: 'Quán Lẩu Cá Tầm Sa Pa', category: 'restaurant' },
  { name: 'Nhà hàng Gerbera', category: 'restaurant' },
  { name: 'Nhà hàng Delta', category: 'restaurant' },
  
  // Cafe
  { name: 'Cafe In The Clouds', category: 'restaurant' },
  { name: 'Sapa O\'Chau Cafe', category: 'restaurant' },
  { name: 'Cafe Fansipan', category: 'restaurant' }
];

async function fetchSaPa() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`⛰️  SA PA - FANSIPAN`);
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

        // Sa Pa có tọa độ đặc biệt, cần check riêng
        if (lat < 22.0 || lat > 23.0 || lng < 103.5 || lng > 104.5) {
          failed++;
          continue;
        }

        const images = await serperManager.searchImages(query, 5);
        const validImages = images.slice(0, 3);

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${CITY_CENTER}, ${PROVINCE} - Tây Bắc`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: place.rating || 4.8
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
    console.log(`\n🎯 TỔNG ${PROVINCE} (Sa Pa): ${total} địa điểm\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchSaPa();
