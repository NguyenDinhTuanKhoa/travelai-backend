/**
 * Script test routing service
 * Chạy: node backend/src/scripts/testRouting.js
 */

const routingService = require('../services/routingService');

async function test() {
  console.log('='.repeat(60));
  console.log('TEST ROUTING SERVICE - Bến Tre → Trà Vinh');
  console.log('='.repeat(60));
  console.log();

  try {
    // Test 1: Tính route trực tiếp
    console.log('📍 TEST 1: Tính route trực tiếp');
    const route = await routingService.getRoute('Bến Tre', 'Trà Vinh');

    if (route) {
      console.log('✅ Kết quả:');
      console.log(`   - Từ: ${route.from}`);
      console.log(`   - Đến: ${route.to}`);
      console.log(`   - Khoảng cách: ${route.distanceText}`);
      console.log(`   - Thời gian: ${route.durationText}`);
      console.log(`   - Ước tính: ${route.durationRange}`);
    } else {
      console.log('❌ Không tính được route');
    }

    console.log();
    console.log('-'.repeat(60));
    console.log();

    // Test 2: Detect từ câu hỏi user
    console.log('💬 TEST 2: Detect từ câu hỏi user');
    const userMessages = [
      'cho tôi gợi ý du lịch từ tp.bến tre đến tp.trà vinh 2 ngày tôi có hai triệu',
      'Du lịch từ Cần Thơ đến Phú Quốc mất bao lâu?',
      'Bến Tre → Trà Vinh xa không?',
      'Tôi muốn đi Hà Nội',  // Không có route
    ];

    for (const msg of userMessages) {
      console.log(`\n📝 User: "${msg}"`);

      const routeInfo = await routingService.processUserQuery(msg);

      if (routeInfo) {
        console.log('   ✅ Detected route:');
        console.log(`      ${routeInfo.from} → ${routeInfo.to}`);
        console.log(`      ${routeInfo.distance}, ${routeInfo.durationRange}`);
      } else {
        console.log('   ℹ️  Không phát hiện route');
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('✅ TEST HOÀN THÀNH!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error);
  }
}

// Run test
test().then(() => {
  console.log('\nℹ️  Bạn có thể chạy lại test bằng: node backend/src/scripts/testRouting.js');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
