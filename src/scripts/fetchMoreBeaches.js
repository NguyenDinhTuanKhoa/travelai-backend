require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Danh sách biển cần bổ sung - sắp xếp theo tỉnh từ Bắc vào Nam
const beachesToAdd = [
  // === QUẢNG NINH ===
  { name: 'Bãi biển Trà Cổ', province: 'Quảng Ninh', category: 'beach' },
  { name: 'Bãi biển Quan Lạn', province: 'Quảng Ninh', category: 'beach' },
  { name: 'Bãi biển Ngọc Vừng', province: 'Quảng Ninh', category: 'beach' },
  { name: 'Bãi biển Titop', province: 'Quảng Ninh', category: 'beach' },
  { name: 'Bãi biển Sơn Hào', province: 'Quảng Ninh', category: 'beach' },
  
  // === THANH HÓA (thiếu hoàn toàn) ===
  { name: 'Bãi biển Sầm Sơn', province: 'Thanh Hóa', category: 'beach' },
  { name: 'Bãi biển Hải Tiến', province: 'Thanh Hóa', category: 'beach' },
  { name: 'Bãi biển Hải Hòa', province: 'Thanh Hóa', category: 'beach' },
  { name: 'Bãi biển Nghi Sơn', province: 'Thanh Hóa', category: 'beach' },
  { name: 'Bãi biển Tiên Trang', province: 'Thanh Hóa', category: 'beach' },
  { name: 'Khu du lịch biển FLC Sầm Sơn', province: 'Thanh Hóa', category: 'beach' },
  
  // === NGHỆ AN (chỉ có 4) ===
  { name: 'Bãi biển Bãi Lữ', province: 'Nghệ An', category: 'beach' },
  { name: 'Bãi biển Cửa Hiền', province: 'Nghệ An', category: 'beach' },
  { name: 'Bãi biển Nghi Thiết', province: 'Nghệ An', category: 'beach' },
  { name: 'Bãi biển Quỳnh Bảng', province: 'Nghệ An', category: 'beach' },
  
  // === HÀ TĨNH (chỉ có 2) ===
  { name: 'Bãi biển Xuân Thành', province: 'Hà Tĩnh', category: 'beach' },
  { name: 'Bãi biển Kỳ Ninh', province: 'Hà Tĩnh', category: 'beach' },
  { name: 'Bãi biển Đèo Con', province: 'Hà Tĩnh', category: 'beach' },
  { name: 'Bãi biển Cửa Nhượng', province: 'Hà Tĩnh', category: 'beach' },
  
  // === QUẢNG BÌNH (chỉ có 3) ===
  { name: 'Bãi biển Bảo Ninh', province: 'Quảng Bình', category: 'beach' },
  { name: 'Bãi biển Vũng Chùa', province: 'Quảng Bình', category: 'beach' },
  { name: 'Bãi biển Hải Ninh', province: 'Quảng Bình', category: 'beach' },
  
  // === THỪA THIÊN HUẾ (thiếu hoàn toàn) ===
  { name: 'Bãi biển Lăng Cô', province: 'Thừa Thiên Huế', category: 'beach' },
  { name: 'Bãi biển Thuận An', province: 'Thừa Thiên Huế', category: 'beach' },
  { name: 'Bãi biển Canh Dương', province: 'Thừa Thiên Huế', category: 'beach' },
  { name: 'Bãi biển Vinh Thanh', province: 'Thừa Thiên Huế', category: 'beach' },
  { name: 'Bãi biển Phú Thuận', province: 'Thừa Thiên Huế', category: 'beach' },
  
  // === ĐÀ NẴNG (đã có 9, thêm 3) ===
  { name: 'Bãi biển Mỹ Khê', province: 'Đà Nẵng', category: 'beach' },
  { name: 'Bãi biển Nam Ô', province: 'Đà Nẵng', category: 'beach' },
  { name: 'Bãi biển Bắc Mỹ An', province: 'Đà Nẵng', category: 'beach' },
  
  // === QUẢNG NGÃI (thiếu hoàn toàn) ===
  { name: 'Bãi biển Mỹ Khê Quảng Ngãi', province: 'Quảng Ngãi', category: 'beach' },
  { name: 'Bãi biển Sa Huỳnh', province: 'Quảng Ngãi', category: 'beach' },
  { name: 'Đảo Lý Sơn', province: 'Quảng Ngãi', category: 'beach' },
  { name: 'Bãi biển Khe Hai', province: 'Quảng Ngãi', category: 'beach' },
  { name: 'Bãi biển Phổ Thạnh', province: 'Quảng Ngãi', category: 'beach' },
  
  // === PHÚ YÊN (chỉ có 3) ===
  { name: 'Bãi Xép Phú Yên', province: 'Phú Yên', category: 'beach' },
  { name: 'Vịnh Vũng Rô', province: 'Phú Yên', category: 'beach' },
  { name: 'Bãi biển Tuy Hòa', province: 'Phú Yên', category: 'beach' },
  { name: 'Bãi biển Long Thủy', province: 'Phú Yên', category: 'beach' },
  
  // === KHÁNH HÒA (thêm) ===
  { name: 'Bãi Dài Cam Ranh', province: 'Khánh Hòa', category: 'beach' },
  { name: 'Bãi biển Bình Lập', province: 'Khánh Hòa', category: 'beach' },
  { name: 'Đảo Hòn Tằm', province: 'Khánh Hòa', category: 'beach' },
  
  // === TIỀN GIANG (thiếu hoàn toàn) ===
  { name: 'Biển Tân Thành Tiền Giang', province: 'Tiền Giang', category: 'beach' },
  { name: 'Bãi biển Tân Thành', province: 'Tiền Giang', category: 'beach' },
  { name: 'Cồn Ngang Tiền Giang', province: 'Tiền Giang', category: 'beach' },
  
  // === NINH BÌNH (thiếu hoàn toàn - ven biển Kim Sơn) ===
  { name: 'Bãi biển Kim Sơn', province: 'Ninh Bình', category: 'beach' },
  { name: 'Cồn Nổi Kim Sơn', province: 'Ninh Bình', category: 'beach' },
  { name: 'Biển Bình Minh Ninh Bình', province: 'Ninh Bình', category: 'beach' },
];

// Coordinate bounds cho validate
const provinceBounds = {
  'Quảng Ninh':      { latMin: 20.6, latMax: 21.6, lngMin: 106.4, lngMax: 108.1 },
  'Thanh Hóa':       { latMin: 19.2, latMax: 20.5, lngMin: 104.4, lngMax: 106.1 },
  'Nghệ An':         { latMin: 18.3, latMax: 19.8, lngMin: 104.0, lngMax: 105.8 },
  'Hà Tĩnh':        { latMin: 17.9, latMax: 18.7, lngMin: 105.0, lngMax: 106.5 },
  'Quảng Bình':      { latMin: 17.0, latMax: 18.1, lngMin: 105.5, lngMax: 107.0 },
  'Thừa Thiên Huế':  { latMin: 16.0, latMax: 16.8, lngMin: 107.0, lngMax: 108.2 },
  'Đà Nẵng':         { latMin: 15.9, latMax: 16.2, lngMin: 107.9, lngMax: 108.4 },
  'Quảng Ngãi':      { latMin: 14.5, latMax: 15.4, lngMin: 108.2, lngMax: 109.1 },
  'Phú Yên':         { latMin: 12.6, latMax: 13.6, lngMin: 108.6, lngMax: 109.5 },
  'Khánh Hòa':       { latMin: 11.8, latMax: 12.9, lngMin: 108.6, lngMax: 109.5 },
  'Tiền Giang':      { latMin: 10.1, latMax: 10.6, lngMin: 105.8, lngMax: 106.9 },
  'Ninh Bình':       { latMin: 19.8, latMax: 20.5, lngMin: 105.5, lngMax: 106.3 },
};

function isValidCoord(lat, lng, province) {
  const b = provinceBounds[province];
  if (!b) return true; // skip validation if no bounds
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    console.log('═'.repeat(60));
    console.log('🏖️  BỔ SUNG DỮ LIỆU BIỂN CHO CÁC TỈNH VEN BIỂN');
    console.log('═'.repeat(60));

    let saved = 0, skipped = 0, failed = 0;

    for (let i = 0; i < beachesToAdd.length; i++) {
      const beach = beachesToAdd[i];
      console.log(`\n[${i + 1}/${beachesToAdd.length}] ${beach.name} (${beach.province})...`);

      // Check existing
      const existing = await Destination.findOne({
        name: beach.name,
        'location.city': beach.province
      });

      if (existing) {
        console.log('   ⏭️  Đã tồn tại');
        skipped++;
        continue;
      }

      try {
        // Search for place coordinates
        const query = `${beach.name} ${beach.province} Vietnam`;
        const placeResult = await serperManager.searchPlaces(query);

        let lat, lng;

        if (placeResult.places && placeResult.places.length > 0) {
          const place = placeResult.places[0];
          if (place.latitude && place.longitude) {
            lat = place.latitude;
            lng = place.longitude;
          }
        }

        // Fallback: try simpler query
        if (!lat || !lng) {
          const simpleQuery = `${beach.name}`;
          const placeResult2 = await serperManager.searchPlaces(simpleQuery);
          if (placeResult2.places && placeResult2.places.length > 0) {
            const place = placeResult2.places[0];
            if (place.latitude && place.longitude) {
              lat = place.latitude;
              lng = place.longitude;
            }
          }
        }

        if (!lat || !lng) {
          console.log('   ❌ Không tìm thấy tọa độ');
          failed++;
          continue;
        }

        // Validate coordinates
        if (!isValidCoord(lat, lng, beach.province)) {
          console.log(`   ❌ Tọa độ ngoài ${beach.province}: ${lat}, ${lng}`);
          failed++;
          continue;
        }

        // Search for images
        const images = await serperManager.searchImages(`${beach.name} ${beach.province} bãi biển`, 5);
        const validImages = images.slice(0, 3);

        if (validImages.length === 0) {
          // Try simpler image search
          const images2 = await serperManager.searchImages(`${beach.name} Vietnam`, 5);
          const validImages2 = images2.slice(0, 3);
          if (validImages2.length === 0) {
            console.log('   ❌ Không có hình ảnh');
            failed++;
            continue;
          }
          validImages.push(...validImages2);
        }

        const region = getRegion(beach.province);
        const newDest = new Destination({
          name: beach.name,
          description: `${beach.name} - Bãi biển đẹp tại ${beach.province}, ${region}`,
          location: {
            city: beach.province,
            country: 'Vietnam',
            coordinates: { lat, lng }
          },
          images: validImages.slice(0, 3),
          category: 'beach',
          rating: 4.5
        });

        await newDest.save();
        saved++;
        console.log(`   ✅ Đã lưu (${lat.toFixed(4)}, ${lng.toFixed(4)}) - ${validImages.length} ảnh`);

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        failed++;
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 KẾT QUẢ:');
    console.log(`   ✅ Đã lưu: ${saved}`);
    console.log(`   ⏭️  Bỏ qua: ${skipped}`);
    console.log(`   ❌ Thất bại: ${failed}`);

    // Count all beaches now
    const totalBeaches = await Destination.countDocuments({ category: 'beach' });
    console.log(`\n🏖️  TỔNG SỐ BIỂN SAU CẬP NHẬT: ${totalBeaches}`);
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function getRegion(province) {
  const regions = {
    'Quảng Ninh': 'Đông Bắc',
    'Ninh Bình': 'Đồng bằng Bắc Bộ',
    'Thanh Hóa': 'Bắc Trung Bộ',
    'Nghệ An': 'Bắc Trung Bộ',
    'Hà Tĩnh': 'Bắc Trung Bộ',
    'Quảng Bình': 'Bắc Trung Bộ',
    'Thừa Thiên Huế': 'Trung Bộ',
    'Đà Nẵng': 'Nam Trung Bộ',
    'Quảng Ngãi': 'Nam Trung Bộ',
    'Phú Yên': 'Nam Trung Bộ',
    'Khánh Hòa': 'Nam Trung Bộ',
    'Tiền Giang': 'Đồng bằng sông Cửu Long',
  };
  return regions[province] || 'Việt Nam';
}

run();
