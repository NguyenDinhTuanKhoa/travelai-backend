/**
 * Script test chatbot với routing integration
 * Chạy: node backend/src/scripts/testChatbot.js
 */

require('dotenv').config();
const aiService = require('../services/aiService');

async function testChatbot() {
  console.log('='.repeat(70));
  console.log('TEST CHATBOT VỚI ROUTING INTEGRATION');
  console.log('='.repeat(70));
  console.log();

  const testQueries = [
    {
      name: 'Test câu hỏi ban đầu của user',
      message: 'cho tôi gợi ý du lịch từ tp.bến tre đến tp.trà vinh 2 ngày tôi có hai triệu'
    },
    {
      name: 'Test câu hỏi ngắn gọn',
      message: 'từ bến tre đến cần thơ bao xa?'
    }
  ];

  for (const query of testQueries) {
    console.log('━'.repeat(70));
    console.log(`📝 ${query.name}`);
    console.log(`💬 User: "${query.message}"`);
    console.log('━'.repeat(70));
    console.log();

    try {
      const messages = [{ role: 'user', content: query.message }];
      const response = await aiService.chatComplete(messages);

      console.log('🤖 AI Response:');
      console.log(response);
      console.log();

      // Check nếu response có chứa thông tin chính xác
      const hasCorrectDistance = response.match(/\b(4[0-9]|5[0-9]|6[0-9])\s*(km|kilômét)/i);
      const hasCorrectTime = response.match(/(1\s*giờ|0\.[5-9]\s*giờ|[3-9]0\s*phút)/i);

      console.log('📊 Đánh giá:');
      console.log(`   - Có thông tin khoảng cách đúng? ${hasCorrectDistance ? '✅' : '❌'}`);
      console.log(`   - Có thông tin thời gian đúng? ${hasCorrectTime ? '✅' : '❌'}`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log('✅ TEST HOÀN THÀNH!');
  console.log('='.repeat(70));
}

testChatbot().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
