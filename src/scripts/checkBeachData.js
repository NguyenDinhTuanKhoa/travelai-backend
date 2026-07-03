require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // All beach destinations
  const beaches = await Destination.find({ category: 'beach' });
  console.log(`\n=== TỔNG SỐ BIỂN: ${beaches.length} ===\n`);
  
  const byCity = {};
  beaches.forEach(d => {
    const c = d.location?.city || 'Unknown';
    if (!byCity[c]) byCity[c] = [];
    byCity[c].push(d.name);
  });
  
  const sorted = Object.entries(byCity).sort((a,b) => b[1].length - a[1].length);
  sorted.forEach(([city, names]) => {
    console.log(`${city}: ${names.length} biển`);
    names.forEach(n => console.log(`  - ${n}`));
  });
  
  // Coastal provinces that SHOULD have beaches
  const coastalProvinces = [
    'Quảng Ninh', 'Hải Phòng', 'Thái Bình', 'Nam Định', 'Ninh Bình',
    'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị',
    'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi',
    'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận',
    'Bà Rịa - Vũng Tàu', 'TP. Hồ Chí Minh', 'Tiền Giang', 'Bến Tre',
    'Trà Vinh', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Kiên Giang'
  ];
  
  console.log('\n=== TỈNH VEN BIỂN THIẾU DỮ LIỆU ===\n');
  const missing = [];
  for (const province of coastalProvinces) {
    const count = byCity[province]?.length || 0;
    if (count < 3) {
      console.log(`❌ ${province}: chỉ có ${count} biển`);
      missing.push({ province, count });
    }
  }
  
  console.log(`\n=> ${missing.length} tỉnh thiếu dữ liệu biển`);
  
  await mongoose.disconnect();
})();
