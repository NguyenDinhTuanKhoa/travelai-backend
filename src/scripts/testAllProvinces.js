/**
 * Script test routing với nhiều tỉnh thành VN
 * Chạy: node backend/src/scripts/testAllProvinces.js
 */

const routingService = require('../services/routingService');

async function testMultipleRoutes() {
  console.log('='.repeat(70));
  console.log('TEST ROUTING - TẤT CẢ CÁC TỈNH VIỆT NAM');
  console.log('='.repeat(70));
  console.log();

  const testCases = [
    // Miền Tây
    { from: 'Bến Tre', to: 'Trà Vinh' },
    { from: 'Cần Thơ', to: 'Sóc Trăng' },
    { from: 'An Giang', to: 'Kiên Giang' },

    // Đông Nam Bộ
    { from: 'TP.HCM', to: 'Vũng Tàu' },
    { from: 'Đồng Nai', to: 'Bình Dương' },

    // Miền Trung
    { from: 'Đà Nẵng', to: 'Hội An' },
    { from: 'Huế', to: 'Quảng Bình' },
    { from: 'Nha Trang', to: 'Đà Lạt' },

    // Miền Bắc
    { from: 'Hà Nội', to: 'Hải Phòng' },
    { from: 'Hà Nội', to: 'Sapa' },
    { from: 'Thái Nguyên', to: 'Bắc Kạn' },

    // Xa nhất
    { from: 'Hà Nội', to: 'Cà Mau' },
    { from: 'Hà Giang', to: 'Cà Mau' },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    try {
      const route = await routingService.getRoute(testCase.from, testCase.to);

      if (route) {
        console.log(`✅ ${route.from} → ${route.to}`);
        console.log(`   📏 ${route.distanceText} | ⏱️  ${route.durationRange}`);
        successCount++;
      } else {
        console.log(`❌ ${testCase.from} → ${testCase.to}: Không tính được route`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ${testCase.from} → ${testCase.to}: ${error.message}`);
      failCount++;
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log(`📊 KẾT QUẢ: ${successCount}/${testCases.length} thành công, ${failCount} thất bại`);
  console.log('='.repeat(70));
}

testMultipleRoutes().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
