const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  // Điểm đến được trích từ nội dung AI (persist để khỏi re-extract mỗi lần mở chat)
  destinations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Destination' }],
  timestamp: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Cuộc trò chuyện mới' },
  messages: [messageSchema],
  lastMessage: { type: Date, default: Date.now }
}, { timestamps: true });

const DEFAULT_TITLE = 'Cuộc trò chuyện mới';

// Cắt ở ranh giới từ gần nhất để không mất chữ giữa chừng
function truncateAtWord(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Sinh title đẹp từ 1 tin nhắn user. Trả về null nếu tin quá chung chung
// (vd "tôi muốn đi du lịch") → để pre-save defer sang tin cụ thể hơn ở lượt sau.
function generateChatTitle(text) {
  if (!text) return null;
  // Bỏ emoji + ký tự không phải chữ/số ở đầu (quick question: "🏖️ Gợi ý...")
  let t = text.trim().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (t.length < 2) return null;

  // Pattern quiz/clarify-form: "Tôi muốn đi du lịch {phần còn lại}"
  const m = t.match(/^tôi muốn đi du lịch\s+(.+)/i);
  if (m) {
    const rest = m[1];
    const daysMatch = rest.match(/(\d+)\s*ngày/i);
    const days = daysMatch ? ` ${daysMatch[1]} ngày` : '';
    // Địa điểm = segment đầu, đã loại bỏ phần "N ngày" nếu lẫn trong cùng segment
    // (vd "Phú Quốc 4 ngày" → "Phú Quốc", tránh lặp "4 ngày 4 ngày")
    const firstSeg = rest.split(',')[0].replace(/\s*\d+\s*ngày.*$/i, '').trim();
    // firstSeg là ĐỊA ĐIỂM thật khi không phải cụm mô tả (với phong cách.../có.../theo...)
    if (firstSeg && firstSeg.length <= 40 && !/^(với|có|theo|kiểu|khoảng|tầm)\b/i.test(firstSeg)) {
      return capitalize(`Du lịch ${firstSeg}${days}`);
    }
    // Quiz không có địa điểm → lấy sở thích "thích X"
    const interest = rest.match(/thích\s+([^,]+)/i);
    if (interest) return capitalize(truncateAtWord(`Gợi ý du lịch: ${interest[1].trim()}`, 50));
    return null; // chung chung → defer
  }

  // Tin thường: nếu chỉ là ý định chung chung (sau khi bỏ filler còn rỗng) → defer
  const core = t.toLowerCase()
    .replace(/tôi muốn|mình muốn|đi du lịch|du lịch|gợi ý|đề xuất|cho tôi|giúp tôi|đi chơi|một chuyến|lên kế hoạch|kế hoạch/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
  if (core.length < 3) return null;

  return truncateAtWord(t, 50);
}

// Auto-generate title: quét tối đa 3 tin user đầu, lấy title cụ thể đầu tiên
chatHistorySchema.pre('save', function(next) {
  if (this.title === DEFAULT_TITLE && this.messages.length > 0) {
    const userMsgs = this.messages.filter(m => m.role === 'user').slice(0, 3);
    for (const msg of userMsgs) {
      const title = generateChatTitle(msg.content);
      if (title) { this.title = title; break; }
    }
  }
  this.lastMessage = new Date();
  next();
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
module.exports.generateChatTitle = generateChatTitle; // export để test
