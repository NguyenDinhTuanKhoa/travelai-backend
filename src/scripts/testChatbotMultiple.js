/**
 * Script test chatbot với nhiều tỉnh thành khác nhau
 * Chạy: node backend/src/scripts/testChatbotMultiple.js
 */

require('dotenv').config();
const aiService = require('../services/aiService');

async function testChatbotMultiple() {
  console.log('='.repeat(70));
  console.log('TEST CHATBOT VỚI NHIỀU TỈNH THÀNH VIỆT NAM');
  console.log('='.repeat(70));
  console.log();

  const testQueries = [
    'Du lịch từ Hà Nội đến Sapa mất bao lâu?',
    'Từ Đà Nẵng đến Hội An xa không?',
    'Gợi ý du lịch từ TP.HCM đến Đà Lạt 3 ngày',
    'Nha Trang đến Quy Nhơn bao nhiêu km?',
  ];

  for (const query of testQueries) {
    console.log('━'.repeat(70));
    console.log(`💬 User: "${query}"`);
    console.log('━'.repeat(70));

    try {
      const messages = [{ role: 'user', content: query }];
      const response = await aiService.chatComplete(messages);

      // Chỉ hiển thị 500 ký tự đầu để dễ đọc
      const preview = response.length > 500
        ? response.substring(0, 500) + '...'
        : response;

      console.log('🤖 AI Response:');
      console.log(preview);
      console.log();

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('='.repeat(70));
  console.log('✅ TEST HOÀN THÀNH!');
  console.log('='.repeat(70));
}

testChatbotMultiple().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
