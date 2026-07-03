require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

const provinces = [
  {
    name: 'Bắc Giang',
    center: 'Bắc Giang',
    bounds: { latMin: 21.2, latMax: 21.8, lngMin: 106.0, lngMax: 106.8 },
    destinations: [
      { name: 'Khu du lịch Suối Mỡ', category: 'attraction', lat: 21.3500, lng: 106.2500 },
      { name: 'Động Bổ Lũng', category: 'attraction', lat: 21.4500, lng: 106.3500 },
      { name: 'Chùa Bổ Đà', category: 'historical', lat: 21.3000, lng: 106.2000 },
      { name: 'Đền Nưa', category: 'historical', lat: 21.3500, lng: 106.2500 },
      { name: 'Công viên Bắc Giang', category: 'city', lat: 21.2833, lng: 106.1833 },
      { name: 'Bảo tàng Bắc Giang', category: 'historical', lat: 21.2833, lng: 106.1833 },
      { name: 'Chợ Lục Ngạn', category: 'city', lat: 21.4167, lng: 106.7500 },
      { name: 'Vườn vải Lục Ngạn', category: 'countryside', lat: 21.4167, lng: 106.7500 },
      { name: 'Bac Giang Plaza Hotel', category: 'hotel' },
      { name: 'Muong Thanh Bac Giang', category: 'hotel' },
      { name: 'Bac Giang Riverside Hotel', category: 'hotel' },
      { name: 'Nhà hàng Vĩnh Nghiêm', category: 'restaurant' },
      { name: 'Quán Cơm Bắc Giang', category: 'restaurant' },
      { name: 'Nhà hàng Suối Mỡ', category: 'restaurant' },
      { name: 'Quán Phở Bắc Giang', category: 'restaurant' },
      { name: 'Nhà hàng Lục Ngạn', category: 'restaurant' },
      { name: 'Quán Ăn Yên Thế', category: 'restaurant' },
      { name: 'Nhà hàng Hiệp Hòa', category: 'restaurant' },
      { name: 'Quán Bún Bắc Giang', category: 'restaurant' }
    ]
  },
  {
    name: 'Bắc Kạn',
    center: 'Bắc Kạn',
    bounds: { latMin: 21.8, latMax: 22.5, lngMin: 105.5, lngMax: 106.2 },
    destinations: [
      { name: 'Khu du lịch Ba Bể', category: 'attraction', lat: 22.2500, lng: 105.6167 },
      { name: 'Động Puông Ba Bể', category: 'attraction', lat: 22.2500, lng: 105.6167 },
      { name: 'Đảo An Mã Ba Bể', category: 'attraction', lat: 22.2500, lng: 105.6167 },
      { name: 'Thác Đầu Đẳng', category: 'attraction', lat: 22.2333, lng: 105.6000 },
      { name: 'Làng Pác Ngòi', category: 'countryside', lat: 22.2500, lng: 105.6167 },
      { name: 'Công viên Bắc Kạn', category: 'city', lat: 22.1500, lng: 105.8333 },
      { name: 'Bảo tàng Bắc Kạn', category: 'historical', lat: 22.1500, lng: 105.8333 },
      { name: 'Hồ Bắc Kạn', category: 'attraction', lat: 22.1500, lng: 105.8333 },
      { name: 'Ba Be Lake Hotel', category: 'hotel' },
      { name: 'Bac Kan Hotel', category: 'hotel' },
      { name: 'Ba Be National Park Guesthouse', category: 'hotel' },
      { name: 'Nhà hàng Ba Bể', category: 'restaurant' },
      { name: 'Quán Cơm Bắc Kạn', category: 'restaurant' },
      { name: 'Nhà hàng Hồ Ba Bể', category: 'restaurant' },
      { name: 'Quán Cá Ba Bể', category: 'restaurant' },
      { name: 'Nhà hàng Pác Ngòi', category: 'restaurant' },
      { name: 'Quán Ăn Bắc Kạn', category: 'restaurant' }
    ]
  },
  {
    name: 'Tuyên Quang',
    center: 'Tuyên Quang',
    bounds: { latMin: 21.7, latMax: 22.3, lngMin: 104.9, lngMax: 105.5 },
    destinations: [
      { name: 'Khu du lịch Na Hang', category: 'attraction', lat: 22.3167, lng: 105.3667 },
      { name: 'Hồ Thác Bà Tuyên Quang', category: 'attraction', lat: 22.3167, lng: 105.3667 },
      { name: 'Khu di tích Tân Trào', category: 'historical', lat: 21.9833, lng: 105.2167 },
      { name: 'Đền Hùng Tuyên Quang', category: 'historical', lat: 21.8167, lng: 105.2167 },
      { name: 'Công viên Tuyên Quang', category: 'city', lat: 21.8167, lng: 105.2167 },
      { name: 'Bảo tàng Tuyên Quang', category: 'historical', lat: 21.8167, lng: 105.2167 },
      { name: 'Chợ Tuyên Quang', category: 'city', lat: 21.8167, lng: 105.2167 },
      { name: 'Làng nghề Tuyên Quang', category: 'countryside', lat: 21.8167, lng: 105.2167 },
      { name: 'Na Hang Lake Resort', category: 'hotel' },
      { name: 'Tuyen Quang Hotel', category: 'hotel' },
      { name: 'Tan Trao Hotel', category: 'hotel' },
      { name: 'Nhà hàng Na Hang', category: 'restaurant' },
      { name: 'Quán Cơm Tuyên Quang', category: 'restaurant' },
      { name: 'Nhà hàng Tân Trào', category: 'restaurant' },
      { name: 'Quán Phở Tuyên Quang', category: 'restaurant' },
      { name: 'Nhà hàng Hồ Na Hang', category: 'restaurant' },
      { name: 'Quán Ăn Tuyên Quang', category: 'restaurant' }
    ]
  },
  {
    name: 'Lai Châu',
    center: 'Lai Châu',
    bounds: { latMin: 21.8, latMax: 22.5, lngMin: 102.8, lngMax: 103.8 },
    destinations: [
      { name: 'Khu du lịch Ô Quy Hồ', category: 'attraction', lat: 22.2500, lng: 103.7500 },
      { name: 'Đỉnh Ô Quy Hồ', category: 'attraction', lat: 22.2500, lng: 103.7500 },
      { name: 'Thác Tát Mộc Lai Châu', category: 'attraction', lat: 22.3000, lng: 103.4500 },
      { name: 'Thung lũng Mường So', category: 'countryside', lat: 22.3500, lng: 103.5000 },
      { name: 'Bản Phùng Lai Châu', category: 'countryside', lat: 22.3833, lng: 103.4667 },
      { name: 'Công viên Lai Châu', category: 'city', lat: 22.3833, lng: 103.4667 },
      { name: 'Bảo tàng Lai Châu', category: 'historical', lat: 22.3833, lng: 103.4667 },
      { name: 'Chợ phiên Lai Châu', category: 'city', lat: 22.3833, lng: 103.4667 },
      { name: 'Lai Chau Hotel', category: 'hotel' },
      { name: 'Muong Lay Hotel', category: 'hotel' },
      { name: 'Lai Chau Riverside Hotel', category: 'hotel' },
      { name: 'Nhà hàng Ô Quy Hồ', category: 'restaurant' },
      { name: 'Quán Cơm Lai Châu', category: 'restaurant' },
      { name: 'Nhà hàng Mường So', category: 'restaurant' },
      { name: 'Quán Ăn Lai Châu', category: 'restaurant' },
      { name: 'Nhà hàng Tát Mộc', category: 'restaurant' },
      { name: 'Quán Lẩu Dê Lai Châu', category: 'restaurant' }
    ]
  }
];

async function expandProvinces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           BỔ SUNG DỮ LIỆU ĐỢT 2 - 4 TỈNH                      ║');
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
            rating: 4.5
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
    console.log(`🎉 HOÀN THÀNH: Đã thêm ${totalSaved} destinations!`);
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

expandProvinces();
