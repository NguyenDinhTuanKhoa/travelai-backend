require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const PROVINCE = 'Hà Giang';
const CITY_CENTER = 'Hà Giang';

const destinations = [
  // Cao nguyên đá Đồng Văn - UNESCO
  { name: 'Cao nguyên đá Đồng Văn', category: 'attraction', lat: 23.2833, lng: 105.3667 },
  { name: 'Cột cờ Lũng Cú', category: 'historical', lat: 23.3667, lng: 105.3167 },
  { name: 'Dinh thự nhà Vương', category: 'historical', lat: 23.2833, lng: 105.3667 },
  { name: 'Phố cổ Đồng Văn', category: 'city', lat: 23.2833, lng: 105.3667 },
  
  // Đèo và thung lũng
  { name: 'Đèo Mã Pì Lèng', category: 'attraction', lat: 23.2167, lng: 105.2833 },
  { name: 'Sông Nho Quế', category: 'attraction', lat: 23.2167, lng: 105.2833 },
  { name: 'Thung lũng Sủng Là', category: 'countryside', lat: 23.2500, lng: 105.3000 },
  
  // Chợ vùng cao
  { name: 'Chợ Đồng Văn', category: 'city', lat: 23.2833, lng: 105.3667 },
  { name: 'Chợ Mèo Vạc', category: 'city', lat: 23.1667, lng: 105.4167 },
  { name: 'Chợ Phiên Khâu Vai', category: 'city', lat: 23.3000, lng: 105.4000 },
  
  // Khách sạn
  { name: 'Ha Giang Ecolodge', category: 'hotel' },
  { name: 'Panhou Village', category: 'hotel' },
  { name: 'Ha Giang Backpackers Hostel', category: 'hotel' },
  { name: 'Hmong House', category: 'hotel' },
  { name: 'Ha Giang Riverside Hotel', category: 'hotel' },
  
  // Nhà hàng
  { name: 'Nhà hàng Cơm Niêu Hà Giang', category: 'restaurant' },
  { name: 'Quán Thắng Cố', category: 'restaurant' },
  { name: 'Nhà hàng Hương Quê', category: 'restaurant' }
];

async function fetchHaGiang() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log(`🏔️  ${PROVINCE.toUpperCase()} - CAO NGUYÊN ĐÁ`);
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
        let lat, lng;
        
        if (dest.lat && dest.lng) {
          lat = dest.lat;
          lng = dest.lng;
        } else {
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

          lat = place.latitude;
          lng = place.longitude;
          
          // Validate Hà Giang coordinates
          if (lat < 22.5 || lat > 23.5 || lng < 104.5 || lng > 105.5) {
            failed++;
            continue;
          }
        }

        const images = await serperManager.searchImages(`${dest.name} ${PROVINCE}`, 5);
        const validImages = images.slice(0, 3);

        const newDestination = new Destination({
          name: dest.name,
          description: `${dest.name} tại ${PROVINCE} - Đông Bắc`,
          location: {
            city: PROVINCE,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages,
          category: dest.category,
          rating: 4.8
        });

        await newDestination.save();
        saved++;
        console.log(`   ✅`);

      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 600));
    }

    const total = await Destination.countDocuments({ 'location.city': PROVINCE });
    console.log(`\n🎯 TỔNG ${PROVINCE}: ${total} địa điểm\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchHaGiang();
