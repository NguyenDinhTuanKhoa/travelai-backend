require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const provinces = [
  {
    name: 'Hải Dương',
    center: 'Hải Dương',
    bounds: { latMin: 20.8, latMax: 21.2, lngMin: 106.2, lngMax: 106.6 },
    destinations: [
      { name: 'Chùa Côn Sơn', category: 'historical', lat: 20.9333, lng: 106.3167 },
      { name: 'Đền Kiếp Bạc', category: 'historical', lat: 21.0333, lng: 106.3833 },
      { name: 'Chợ Hải Dương', category: 'city', lat: 20.9333, lng: 106.3167 },
      { name: 'Hai Duong Hotel', category: 'hotel' },
      { name: 'Nhà hàng Hải Dương', category: 'restaurant' }
    ]
  },
  {
    name: 'Hưng Yên',
    center: 'Hưng Yên',
    bounds: { latMin: 20.6, latMax: 21.0, lngMin: 105.9, lngMax: 106.2 },
    destinations: [
      { name: 'Chùa Phổ Minh Hưng Yên', category: 'historical', lat: 20.6500, lng: 106.0500 },
      { name: 'Đền Gióng', category: 'historical', lat: 20.6667, lng: 106.0667 },
      { name: 'Chợ Hưng Yên', category: 'city', lat: 20.6500, lng: 106.0500 },
      { name: 'Hung Yen Hotel', category: 'hotel' },
      { name: 'Nhà hàng Hưng Yên', category: 'restaurant' }
    ]
  },
  {
    name: 'Hà Nam',
    center: 'Phủ Lý',
    bounds: { latMin: 20.3, latMax: 20.7, lngMin: 105.8, lngMax: 106.1 },
    destinations: [
      { name: 'Chùa Tam Chúc', category: 'historical', lat: 20.5167, lng: 105.9167 },
      { name: 'Chùa Bà Đanh Hà Nam', category: 'historical', lat: 20.5333, lng: 105.9333 },
      { name: 'Chợ Phủ Lý', category: 'city', lat: 20.5333, lng: 105.9167 },
      { name: 'Ha Nam Hotel', category: 'hotel' },
      { name: 'Nhà hàng Hà Nam', category: 'restaurant' }
    ]
  },
  {
    name: 'Vĩnh Phúc',
    center: 'Vĩnh Yên',
    bounds: { latMin: 21.2, latMax: 21.6, lngMin: 105.4, lngMax: 105.8 },
    destinations: [
      { name: 'Tam Đảo Vĩnh Phúc', category: 'attraction', lat: 21.4667, lng: 105.6333 },
      { name: 'Đại Lải', category: 'attraction', lat: 21.3500, lng: 105.5500 },
      { name: 'Chợ Vĩnh Yên', category: 'city', lat: 21.3083, lng: 105.5967 },
      { name: 'Vinh Phuc Hotel', category: 'hotel' },
      { name: 'Nhà hàng Vĩnh Phúc', category: 'restaurant' }
    ]
  },
  {
    name: 'Bắc Giang',
    center: 'Bắc Giang',
    bounds: { latMin: 21.2, latMax: 21.8, lngMin: 106.0, lngMax: 106.8 },
    destinations: [
      { name: 'Chùa Vĩnh Nghiêm', category: 'historical', lat: 21.2833, lng: 106.1833 },
      { name: 'Suối Mỡ Bắc Giang', category: 'attraction', lat: 21.3500, lng: 106.2500 },
      { name: 'Chợ Bắc Giang', category: 'city', lat: 21.2833, lng: 106.1833 },
      { name: 'Bac Giang Hotel', category: 'hotel' },
      { name: 'Nhà hàng Bắc Giang', category: 'restaurant' }
    ]
  },
  {
    name: 'Bắc Kạn',
    center: 'Bắc Kạn',
    bounds: { latMin: 21.8, latMax: 22.5, lngMin: 105.5, lngMax: 106.2 },
    destinations: [
      { name: 'Hồ Ba Bể Bắc Kạn', category: 'attraction', lat: 22.2500, lng: 105.6167 },
      { name: 'Thác Đầu Đẳng Bắc Kạn', category: 'attraction', lat: 22.2333, lng: 105.6000 },
      { name: 'Chợ Bắc Kạn', category: 'city', lat: 22.1500, lng: 105.8333 },
      { name: 'Bac Kan Hotel', category: 'hotel' },
      { name: 'Nhà hàng Bắc Kạn', category: 'restaurant' }
    ]
  },
  {
    name: 'Tuyên Quang',
    center: 'Tuyên Quang',
    bounds: { latMin: 21.7, latMax: 22.3, lngMin: 104.9, lngMax: 105.5 },
    destinations: [
      { name: 'Hồ Na Hang', category: 'attraction', lat: 22.3167, lng: 105.3667 },
      { name: 'ATK Tân Trào', category: 'historical', lat: 21.9833, lng: 105.2167 },
      { name: 'Chợ Tuyên Quang', category: 'city', lat: 21.8167, lng: 105.2167 },
      { name: 'Tuyen Quang Hotel', category: 'hotel' },
      { name: 'Nhà hàng Tuyên Quang', category: 'restaurant' }
    ]
  },
  {
    name: 'Lai Châu',
    center: 'Lai Châu',
    bounds: { latMin: 21.8, latMax: 22.5, lngMin: 102.8, lngMax: 103.8 },
    destinations: [
      { name: 'Đèo Ô Quy Hồ', category: 'attraction', lat: 22.2500, lng: 103.7500 },
      { name: 'Thác Tát Mộc', category: 'attraction', lat: 22.3000, lng: 103.4500 },
      { name: 'Chợ Lai Châu', category: 'city', lat: 22.3833, lng: 103.4667 },
      { name: 'Lai Chau Hotel', category: 'hotel' },
      { name: 'Nhà hàng Lai Châu', category: 'restaurant' }
    ]
  }
];

async function fetchAllProvinces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║        THU THẬP 8 TỈNH CÒN LẠI - PHÍA BẮC                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    let totalSaved = 0;

    for (const province of provinces) {
      console.log('═'.repeat(60));
      console.log(`📍 ${province.name.toUpperCase()}`);
      console.log('═'.repeat(60));

      let saved = 0, skipped = 0, failed = 0;

      for (let i = 0; i < province.destinations.length; i++) {
        const dest = province.destinations[i];
        console.log(`[${i + 1}/${province.destinations.length}] ${dest.name}...`);

        const existing = await Destination.findOne({
          name: dest.name,
          'location.city': province.name
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
            const query = `${dest.name} ${province.center} ${province.name}`;
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
            
            const { latMin, latMax, lngMin, lngMax } = province.bounds;
            if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
              failed++;
              continue;
            }
          }

          const images = await serperManager.searchImages(`${dest.name} ${province.name}`, 5);
          const validImages = images.slice(0, 3);

          if (validImages.length === 0) {
            failed++;
            continue;
          }

          const newDestination = new Destination({
            name: dest.name,
            description: `${dest.name} tại ${province.name}`,
            location: {
              city: province.name,
              country: 'Vietnam',
              coordinates: { lat, lng }
            },
            images: validImages,
            category: dest.category,
            rating: 4.4
          });

          await newDestination.save();
          saved++;

        } catch (error) {
          failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 600));
      }

      const total = await Destination.countDocuments({ 'location.city': province.name });
      console.log(`✅ ${saved} | ⏭️  ${skipped} | ❌ ${failed} → Tổng: ${total}\n`);
      totalSaved += saved;
    }

    console.log('═'.repeat(60));
    console.log(`🎉 HOÀN THÀNH: Đã thêm ${totalSaved} destinations mới!`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchAllProvinces();
