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
      { name: 'Làng gốm Chu Đậu', category: 'countryside', lat: 20.9500, lng: 106.3500 },
      { name: 'Chùa Bà Đanh Hải Dương', category: 'historical', lat: 20.9333, lng: 106.3167 },
      { name: 'Đền Trần Quốc Tuấn', category: 'historical', lat: 21.0333, lng: 106.3833 },
      { name: 'Công viên Hải Dương', category: 'city', lat: 20.9333, lng: 106.3167 },
      { name: 'Bảo tàng Hải Dương', category: 'historical', lat: 20.9333, lng: 106.3167 },
      { name: 'Chợ Cẩm Giàng', category: 'city', lat: 20.9667, lng: 106.2167 },
      { name: 'Chùa Phật Tích Hải Dương', category: 'historical', lat: 21.0500, lng: 106.3000 },
      { name: 'Làng nghề Hải Dương', category: 'countryside', lat: 20.9333, lng: 106.3167 },
      { name: 'Kinh Bac Hotel Hai Duong', category: 'hotel' },
      { name: 'Hai Duong Plaza Hotel', category: 'hotel' },
      { name: 'Muong Thanh Hai Duong', category: 'hotel' },
      { name: 'Nhà hàng Côn Sơn', category: 'restaurant' },
      { name: 'Quán Cơm Kinh Bắc', category: 'restaurant' },
      { name: 'Nhà hàng Kiếp Bạc', category: 'restaurant' },
      { name: 'Quán Phở Hải Dương', category: 'restaurant' },
      { name: 'Nhà hàng Chu Đậu', category: 'restaurant' },
      { name: 'Quán Ăn Cẩm Giàng', category: 'restaurant' },
      { name: 'Nhà hàng Thanh Hà', category: 'restaurant' },
      { name: 'Quán Bún Riêu Hải Dương', category: 'restaurant' },
      { name: 'Nhà hàng Gia Lộc', category: 'restaurant' },
      { name: 'Quán Cà Phê Hải Dương', category: 'restaurant' }
    ]
  },
  {
    name: 'Hưng Yên',
    center: 'Hưng Yên',
    bounds: { latMin: 20.6, latMax: 21.0, lngMin: 105.9, lngMax: 106.2 },
    destinations: [
      { name: 'Chùa Linh Quang', category: 'historical', lat: 20.6500, lng: 106.0500 },
      { name: 'Đền Mẫu Hưng Yên', category: 'historical', lat: 20.6500, lng: 106.0500 },
      { name: 'Làng nghề Phù Lưu', category: 'countryside', lat: 20.6833, lng: 106.0833 },
      { name: 'Công viên Hưng Yên', category: 'city', lat: 20.6500, lng: 106.0500 },
      { name: 'Bảo tàng Hưng Yên', category: 'historical', lat: 20.6500, lng: 106.0500 },
      { name: 'Chợ Khoái Châu', category: 'city', lat: 20.8333, lng: 106.0333 },
      { name: 'Đền Thánh Gióng', category: 'historical', lat: 20.6667, lng: 106.0667 },
      { name: 'Làng hoa Văn Giang', category: 'countryside', lat: 20.7500, lng: 106.0000 },
      { name: 'Hung Yen Plaza Hotel', category: 'hotel' },
      { name: 'Muong Thanh Hung Yen', category: 'hotel' },
      { name: 'Hung Yen Riverside Hotel', category: 'hotel' },
      { name: 'Nhà hàng Phổ Minh', category: 'restaurant' },
      { name: 'Quán Cơm Hưng Yên', category: 'restaurant' },
      { name: 'Nhà hàng Gióng', category: 'restaurant' },
      { name: 'Quán Phở Hưng Yên', category: 'restaurant' },
      { name: 'Nhà hàng Khoái Châu', category: 'restaurant' },
      { name: 'Quán Ăn Văn Giang', category: 'restaurant' },
      { name: 'Nhà hàng Phù Lưu', category: 'restaurant' },
      { name: 'Quán Bún Hưng Yên', category: 'restaurant' },
      { name: 'Nhà hàng Ân Thi', category: 'restaurant' }
    ]
  },
  {
    name: 'Hà Nam',
    center: 'Phủ Lý',
    bounds: { latMin: 20.3, latMax: 20.7, lngMin: 105.8, lngMax: 106.1 },
    destinations: [
      { name: 'Khu du lịch Tam Chúc', category: 'attraction', lat: 20.5167, lng: 105.9167 },
      { name: 'Chùa Tam Chúc Hà Nam', category: 'historical', lat: 20.5167, lng: 105.9167 },
      { name: 'Núi Tam Chúc', category: 'attraction', lat: 20.5167, lng: 105.9167 },
      { name: 'Đền Trần Hà Nam', category: 'historical', lat: 20.5333, lng: 105.9167 },
      { name: 'Công viên Phủ Lý', category: 'city', lat: 20.5333, lng: 105.9167 },
      { name: 'Bảo tàng Hà Nam', category: 'historical', lat: 20.5333, lng: 105.9167 },
      { name: 'Chợ Duy Tiên', category: 'city', lat: 20.6500, lng: 105.9500 },
      { name: 'Làng nghề Hà Nam', category: 'countryside', lat: 20.5333, lng: 105.9167 },
      { name: 'Ha Nam Hotel', category: 'hotel' },
      { name: 'Phu Ly Plaza Hotel', category: 'hotel' },
      { name: 'Tam Chuc Resort', category: 'hotel' },
      { name: 'Ha Nam Riverside Hotel', category: 'hotel' },
      { name: 'Nhà hàng Tam Chúc', category: 'restaurant' },
      { name: 'Quán Cơm Phủ Lý', category: 'restaurant' },
      { name: 'Nhà hàng Bà Đanh', category: 'restaurant' },
      { name: 'Quán Phở Hà Nam', category: 'restaurant' },
      { name: 'Nhà hàng Duy Tiên', category: 'restaurant' },
      { name: 'Quán Ăn Bình Lục', category: 'restaurant' },
      { name: 'Nhà hàng Lý Nhân', category: 'restaurant' },
      { name: 'Quán Bún Hà Nam', category: 'restaurant' }
    ]
  },
  {
    name: 'Vĩnh Phúc',
    center: 'Vĩnh Yên',
    bounds: { latMin: 21.2, latMax: 21.6, lngMin: 105.4, lngMax: 105.8 },
    destinations: [
      { name: 'Khu du lịch Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
      { name: 'Thác Bạc Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
      { name: 'Thác Vạc Tam Đảo', category: 'attraction', lat: 21.4667, lng: 105.6333 },
      { name: 'Khu du lịch Đại Lải', category: 'attraction', lat: 21.3500, lng: 105.5500 },
      { name: 'Hồ Đại Lải', category: 'attraction', lat: 21.3500, lng: 105.5500 },
      { name: 'Công viên Vĩnh Yên', category: 'city', lat: 21.3083, lng: 105.5967 },
      { name: 'Bảo tàng Vĩnh Phúc', category: 'historical', lat: 21.3083, lng: 105.5967 },
      { name: 'Chùa Tây Thiên', category: 'historical', lat: 21.4500, lng: 105.6000 },
      { name: 'Tam Dao Belvedere Resort', category: 'hotel' },
      { name: 'Vinh Phuc Hotel', category: 'hotel' },
      { name: 'Dai Lai Lake Resort', category: 'hotel' },
      { name: 'Tam Dao Golf Resort', category: 'hotel' },
      { name: 'Vinh Yen Plaza Hotel', category: 'hotel' },
      { name: 'Nhà hàng Tam Đảo', category: 'restaurant' },
      { name: 'Quán Cơm Vĩnh Yên', category: 'restaurant' },
      { name: 'Nhà hàng Đại Lải', category: 'restaurant' },
      { name: 'Quán Phở Vĩnh Phúc', category: 'restaurant' },
      { name: 'Nhà hàng Tây Thiên', category: 'restaurant' },
      { name: 'Quán Ăn Tam Đảo', category: 'restaurant' },
      { name: 'Nhà hàng Bình Xuyên', category: 'restaurant' }
    ]
  }
];

async function expandProvinces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           BỔ SUNG DỮ LIỆU CHO CÁC TỈNH ÍT                     ║');
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
