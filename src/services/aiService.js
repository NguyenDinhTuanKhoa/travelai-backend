const OpenAI = require('openai');
const User = require('../models/User');
const Itinerary = require('../models/Itinerary');
const Destination = require('../models/Destination');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
const routingService = require('./routingService');
const searchService = require('./searchService');
const serperManager = require('../utils/serperManager');
const serpApiManager = require('../utils/serpApiManager');
const geocodingService = require('./geocodingService');
const { MERGER_CONTEXT_BLOCK, RESTRUCTURED_NAMES, MERGER_KEYWORDS } = require('../data/provinceMergers');

const opencodeClient = new OpenAI({
  baseURL: 'https://opencode.ai/zen/v1',
  apiKey: process.env.OPENCODE_API_KEY,
  timeout: 45 * 1000,
  maxRetries: 0,
});
const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  timeout: 60 * 1000,
  maxRetries: 2,
});
// GPT-5.5 qua highwayapi.ai (jiekou.ai) — HỖ TRỢ NHIỀU KEY, tự xoay vòng khi 1 key hết
// quota/bị rate-limit (giống serpApiManager). Gộp HIGHWAY_API_KEYS (số nhiều, phân cách phẩy)
// + HIGHWAY_API_KEY (số ít, tương thích cũ), khử trùng giữ thứ tự. Mỗi key → 1 client riêng.
const HIGHWAY_KEYS = [...new Set(
  [...(process.env.HIGHWAY_API_KEYS || '').split(','), process.env.HIGHWAY_API_KEY || '']
    .map(k => k.trim()).filter(Boolean)
)];
const gpt55Clients = HIGHWAY_KEYS.map(apiKey => new OpenAI({
  baseURL: 'https://api.highwayapi.ai/openai/v1',
  apiKey,
  timeout: 45 * 1000,
  maxRetries: 0,
}));
if (gpt55Clients.length) console.log(`✅ Đã load ${gpt55Clients.length} highway (GPT-5.5) key`);
const OPENCODE_MODEL = 'mimo-v2.5-free';
const NVIDIA_MODEL_PRIMARY = 'stepfun-ai/step-3.7-flash';
const NVIDIA_MODEL_FALLBACK = 'minimaxai/minimax-m2.7';
const GPT55_MODEL = 'gpt-5.5';

// Token tối đa mỗi phản hồi. step-3.7-flash là model reasoning → cần dư token cho cả
// phần <think> lẫn câu trả lời; nếu thấp (4096) câu trả lời bị cắt giữa chừng hoặc rỗng.
const MAX_TOKENS = 8192;

// Tạo tour là one-shot sinh JSON dày (nhiều trạm + review) → cần dư token hơn chat
// để tránh JSON bị cắt giữa chừng (parse lỗi). Cao hơn MAX_TOKENS vì không streaming.
const MAX_TOKENS_TOUR = 16384;

// Model reasoning trên NVIDIA: nếu không giới hạn reasoning_effort, phần <think> ngốn hết
// max_tokens → câu trả lời rỗng/cụt. 'low' giảm mạnh reasoning, dồn token cho đáp án.
// (Đã kiểm chứng: chat_template_kwargs.thinking/enable_thinking và /no_think đều bị NVIDIA bỏ qua.)
const REASONING_MODELS = new Set([NVIDIA_MODEL_PRIMARY, NVIDIA_MODEL_FALLBACK]);

// ── Sliding window: chỉ gửi N message CUỐI lên model để tránh token phình ─────
// buildSystemPrompt đã giữ context quan trọng (vùng, sở thích, điểm đến) trong system
// prompt → cắt message không mất ngữ cảnh. Mỗi cặp user+assistant = 2 messages.
const MAX_CHAT_WINDOW = 12;  // ~6 lượt hội thoại gần nhất

// Gắn model + reasoning_effort phù hợp vào params trước khi gọi API
function withModel(baseParams, model) {
  const params = { ...baseParams, model };
  if (REASONING_MODELS.has(model)) params.reasoning_effort = 'low';
  return params;
}

// Lỗi thuộc về RIÊNG 1 key (hết quota / sai key / bị rate-limit) → nên đổi key khác.
// Phân biệt với lỗi hạ tầng (network/timeout/500): loại đó đổi key vô ích + tốn thêm 45s
// timeout mỗi key → ném thẳng để fallback nhanh sang NVIDIA.
function isHighwayKeyError(err) {
  const status = err?.status || err?.response?.status;
  if ([401, 402, 403, 429].includes(status)) return true;
  const msg = (err?.message || '').toLowerCase();
  return /quota|insufficient|exceeded|rate.?limit|too many|balance|credit|余额|额度/.test(msg);
}

// Con trỏ key đang dùng — nhớ qua các request để KHÔNG thử lại key đã cạn mỗi lần gọi
// (giống serpApiManager). Khi 1 key hết quota, con trỏ dính luôn sang key sống kế tiếp.
let gpt55Cursor = 0;

// Gọi GPT-5.5 (highway) với xoay vòng key: bắt đầu từ key đang dùng, gặp lỗi HẾT QUOTA/CHẶN
// thì sang key kế (vòng tròn); hết sạch key (hoặc gặp lỗi hạ tầng) → ném để caller fallback
// sang NVIDIA. Dùng chung cho cả stream (trả về stream object) lẫn non-stream (trả về response).
async function gpt55Create(params) {
  const n = gpt55Clients.length;
  if (!n) throw new Error('Chưa cấu hình HIGHWAY_API_KEY(S)');
  let lastErr;
  for (let attempt = 0; attempt < n; attempt++) {
    const idx = (gpt55Cursor + attempt) % n;
    try {
      const res = await gpt55Clients[idx].chat.completions.create(params);
      gpt55Cursor = idx; // key này chạy được → các request sau bắt đầu thẳng từ đây
      return res;
    } catch (err) {
      lastErr = err;
      if (isHighwayKeyError(err) && attempt < n - 1) {
        console.warn(`🔄 Highway key ${idx + 1}/${n} hết quota/bị chặn (${err.message}) → đổi key khác`);
        continue;
      }
      throw err; // lỗi hạ tầng, hoặc đã thử hết key → để provider-fallback lo tiếp
    }
  }
  throw lastErr;
}

const SYSTEM_PROMPT = `Bạn là TravelAI - trợ lý du lịch thông minh của Việt Nam.

**QUY TẮC QUAN TRỌNG - BẮT BUỘC TUÂN THỦ:**
1. CHỈ đưa ra thông tin CHÍNH XÁC, dựa trên dữ liệu có sẵn trong hệ thống
2. KHÔNG bịa đặt tên địa điểm, khách sạn, nhà hàng, món ăn, đặc sản không có thật
3. Nếu KHÔNG chắc chắn về thông tin → HÃY NÓI "Tôi không có thông tin chính xác" thay vì đoán
4. Khi được cung cấp danh sách điểm đến từ hệ thống → CHỈ gợi ý từ danh sách đó
5. Khi được cung cấp danh sách đặc sản từ hệ thống → CHỈ gợi ý từ danh sách đó
6. KHÔNG nhầm lẫn địa điểm giữa các tỉnh/thành phố
7. KHÔNG nhầm lẫn đặc sản giữa các tỉnh/thành phố

**NHIỆM VỤ:**
- Tư vấn du lịch Việt Nam với thông tin CHÍNH XÁC
- Đề xuất lịch trình chi tiết theo ngày
- Tư vấn món ăn và đặc sản của từng tỉnh/thành phố
- Ước tính ngân sách bằng VNĐ
- Trả lời bằng tiếng Việt, thân thiện và hữu ích

**ƯU TIÊN:** Sử dụng thông tin từ [DANH SÁCH ĐIỂM ĐẾN] và [ĐẶC SẢN ĐỊA PHƯƠNG] bên dưới nếu có.`;

// Instruction bổ sung khi user hỏi về lịch trình — yêu cầu AI trả về JSON block ẩn
const ITINERARY_JSON_INSTRUCTION = `

**KHI NGƯỜI DÙNG MUỐN LỊCH TRÌNH:** Nếu người dùng đã cho biết khu vực / số ngày / sở thích → HÃY TẠO NGAY lịch trình chi tiết theo từng ngày từ các điểm đến trong context bên trên. Bạn LUÔN có thể tự dựng lịch trình từ danh sách điểm đến đã cung cấp — KHÔNG được trả lời "chưa có tour" hay từ chối, và KHÔNG lặp lại câu trả lời ở lượt trước.

**QUAN TRỌNG - KHI TẠO LỊCH TRÌNH:** Sau phần lịch trình markdown, hãy thêm một block JSON ẩn theo định dạng CHÍNH XÁC này (trên một dòng riêng, không thêm text gì):
\`\`\`json_itinerary
{"destinations":["Tên địa điểm 1","Tên địa điểm 2"],"days":N,"budget":"X triệu VNĐ","summary":"Mô tả ngắn 1 câu"}
\`\`\`
Chỉ liệt kê tên địa điểm thực sự (địa danh, không phải hoạt động). Đây là dữ liệu để hệ thống tự động lưu lịch trình.`;

// ── Định nghĩa field cho form làm rõ yêu cầu (clarification) ────────────────
// Form do backend dựng tất định (không gọi model). buildClarificationBlock()
// chọn các field còn THIẾU từ đây. location + interests luôn hiện; days/budget
// chỉ hiện khi user chưa nhắc tới.
const CLARIFY_FIELDS = {
  location: {
    key: 'location',
    label: 'Bạn muốn đi đâu?',
    type: 'region',
    required: true,
    allowCustom: true,
    placeholder: 'Nhập tỉnh/thành phố (vd: Đà Nẵng, Phú Quốc...)',
    options: [
      { value: 'Miền Bắc', label: 'Miền Bắc', icon: '⛰️' },
      { value: 'Miền Trung', label: 'Miền Trung', icon: '🏖️' },
      { value: 'Tây Nguyên', label: 'Tây Nguyên', icon: '🌄' },
      { value: 'Miền Nam', label: 'Miền Nam', icon: '🌴' },
      { value: 'Đà Nẵng', label: 'Đà Nẵng', icon: '🌉' },
      { value: 'Đà Lạt', label: 'Đà Lạt', icon: '🌲' },
      { value: 'Phú Quốc', label: 'Phú Quốc', icon: '🏝️' },
      { value: 'Sa Pa', label: 'Sa Pa', icon: '🏔️' },
      { value: 'Hội An', label: 'Hội An', icon: '🏮' },
      { value: 'Nha Trang', label: 'Nha Trang', icon: '🐚' },
    ],
  },
  days: {
    key: 'days',
    label: 'Đi mấy ngày?',
    type: 'select',
    required: false,
    allowCustom: true,
    options: [
      { value: '2', label: '2 ngày' },
      { value: '3', label: '3 ngày' },
      { value: '4', label: '4 ngày' },
      { value: '5', label: '5 ngày' },
      { value: '7', label: '1 tuần' },
    ],
  },
  budget: {
    key: 'budget',
    label: 'Ngân sách dự kiến?',
    type: 'select',
    required: false,
    allowCustom: true,
    options: [
      { value: '3 triệu', label: '~3 triệu' },
      { value: '5 triệu', label: '~5 triệu' },
      { value: '10 triệu', label: '~10 triệu' },
      { value: '15 triệu', label: 'trên 15 triệu' },
    ],
  },
  people: {
    key: 'people',
    label: 'Đi mấy người?',
    type: 'select',
    required: false,
    allowCustom: true,
    placeholder: 'Số người cụ thể (vd: 4 người)',
    options: [
      { value: 'một mình', label: 'Một mình', icon: '🧍' },
      { value: '2 người', label: 'Cặp đôi', icon: '💑' },
      { value: 'gia đình', label: 'Gia đình', icon: '👨‍👩‍👧' },
      { value: 'nhóm bạn', label: 'Nhóm bạn', icon: '👥' },
    ],
  },
  interests: {
    key: 'interests',
    label: 'Bạn thích gì? (chọn nhiều)',
    type: 'multiselect',
    required: false,
    options: [
      { value: 'biển', label: 'Biển', icon: '🏖️' },
      { value: 'núi', label: 'Núi', icon: '⛰️' },
      { value: 'ẩm thực', label: 'Ẩm thực', icon: '🍜' },
      { value: 'văn hóa', label: 'Văn hóa', icon: '🏛️' },
      { value: 'nghỉ dưỡng', label: 'Nghỉ dưỡng', icon: '🧘' },
      { value: 'khám phá', label: 'Khám phá', icon: '🧭' },
      { value: 'vui chơi', label: 'Vui chơi', icon: '🎡' },
      { value: 'chụp ảnh', label: 'Chụp ảnh', icon: '📸' },
      { value: 'lãng mạn', label: 'Lãng mạn', icon: '💕' },
      { value: 'cắm trại', label: 'Dã ngoại', icon: '🏕️' },
    ],
  },
};

// ── Loại hình chuyến đi (cho form làm rõ THÍCH ỨNG) ─────────────────────────
// Khi user nêu LOẠI HÌNH nhưng chưa có địa điểm ("đi biển", "tuần trăng mật",
// "dã ngoại"...), detectTripType() khớp keyword (đã bỏ dấu) để cá nhân hóa form:
// lời mở đầu riêng + tự tích sẵn `interests` + `defaults` (vd trăng mật → cặp đôi).
// Việc nhận diện này còn vá 2 lỗ hổng: (1) câu kiểu "đi dã ngoại" không qua được
// hasTravelIntent; (2) cụm "tuần trăng mật"/"leo núi" bị tưởng là TÊN ĐỊA DANH.
// THỨ TỰ QUAN TRỌNG: loại đặc thù đứng TRƯỚC, 'beach' để CUỐI vì keyword 'bien' rộng nhất.
const TRIP_TYPES = [
  { type: 'honeymoon', keywords: ['tuan trang mat', 'trang mat', 'honeymoon'],
    intro: '💕 Tuần trăng mật lãng mạn! Cho mình hỏi vài ý để gợi ý nơi phù hợp nhất nhé 👇',
    interests: ['nghỉ dưỡng', 'lãng mạn'], defaults: { people: '2 người' } },
  { type: 'mountain', keywords: ['leo nui', 'len nui', 'trekking', 'trek', 'san may', 'chinh phuc'],
    intro: '⛰️ Mê núi rừng hả! Chọn giúp mình vài thông tin để gợi ý cung đường hợp ý nhé 👇',
    interests: ['núi'] },
  { type: 'camping', keywords: ['cam trai', 'camping', 'glamping'],
    intro: '🏕️ Đi cắm trại thì tuyệt! Cho mình vài thông tin để gợi ý điểm cắm trại phù hợp nhé 👇',
    interests: ['cắm trại'] },
  { type: 'picnic', keywords: ['da ngoai', 'picnic'],
    intro: '🧺 Một chuyến dã ngoại thư giãn! Chọn giúp mình vài ý để gợi ý nơi phù hợp nhé 👇',
    interests: ['cắm trại'] },
  { type: 'phuot', keywords: ['phuot', 'xuyen viet', 'road trip'],
    intro: '🏍️ Tâm hồn phượt thủ! Cho mình vài thông tin để gợi ý cung đường khám phá nhé 👇',
    interests: ['khám phá'] },
  { type: 'foodie', keywords: ['tour am thuc', 'food tour'],
    intro: '🍜 Đi ăn sập đường luôn! Chọn giúp mình vài ý để gợi ý thiên đường ẩm thực nhé 👇',
    interests: ['ẩm thực'] },
  { type: 'resort', keywords: ['nghi duong', 'resort', 'an duong', 'thu gian'],
    intro: '🧘 Cần nghỉ dưỡng thư giãn! Cho mình vài thông tin để gợi ý nơi chill hợp ý nhé 👇',
    interests: ['nghỉ dưỡng'] },
  { type: 'beach', keywords: ['di bien', 'tam bien', 'ra bien', 'bai bien', 'lan bien', 'san ho', 'bien'],
    intro: '🏖️ Bạn muốn đi biển! Chọn giúp mình vài thông tin để gợi ý bãi biển hợp ý nhé 👇',
    interests: ['biển'] },
];

// ── "Gần tôi": loại địa điểm cho tìm-kiếm-theo-vị-trí ────────────────────────
// detectNearbyQuery() yêu cầu CÓ token khoảng cách ("gần tôi"...) LẪN 1 loại địa điểm dưới đây.
// `category` khớp enum Destination.category; `label`/`query` dùng cho intro & truy vấn Serper/SerpApi.
// THỨ TỰ: loại cụ thể trước; keyword đã bỏ dấu, khớp theo ranh giới từ (containsWord).
// Gồm biến thể đại từ ngôi 1 thân mật/miền Nam: tôi / tui / mình / tớ (đã bỏ dấu).
const NEARBY_PROXIMITY = ['gan toi', 'gan tui', 'gan minh', 'gan to', 'gan day', 'gan nhat',
  'quanh day', 'quanh toi', 'quanh tui', 'quanh minh', 'xung quanh',
  'cho toi', 'cho tui', 'cho minh', 'gan cho toi', 'gan cho tui', 'gan cho minh',
  'gan khu vuc', 'gan vi tri', 'lan can', 'o gan', 'khu vuc nay'];
const NEARBY_TYPES = [
  { category: 'cafe', label: 'quán cà phê', query: 'quán cà phê',
    keywords: ['ca phe', 'cafe', 'coffee', 'quan nuoc'] },
  { category: 'hotel', label: 'chỗ nghỉ', query: 'khách sạn nhà nghỉ',
    keywords: ['nha nghi', 'khach san', 'homestay', 'resort', 'cho nghi', 'cho ngu', 'nha tro'] },
  { category: 'restaurant', label: 'quán ăn', query: 'quán ăn nhà hàng',
    keywords: ['quan an', 'nha hang', 'an uong', 'quan nhau', 'do an', 'quan com', 'quan pho', 'quan bun'] },
];

// ── Mapping tỉnh/vùng miền để lọc context ──────────────────────────────────
const REGION_KEYWORDS = {
  'Miền Bắc': ['hà nội', 'hà giang', 'cao bằng', 'bắc kạn', 'tuyên quang', 'lào cai', 'yên bái', 'thái nguyên',
    'lạng sơn', 'quảng ninh', 'bắc giang', 'phú thọ', 'vĩnh phúc', 'bắc ninh', 'hải dương', 'hải phòng',
    'hưng yên', 'thái bình', 'hà nam', 'nam định', 'ninh bình', 'hòa bình', 'sơn la', 'điện biên',
    'lai châu', 'sapa', 'sa pa', 'hạ long', 'vịnh hạ long', 'bản giốc', 'mộc châu', 'mai châu', 'tam cốc', 'tràng an'],
  'Miền Trung': ['thanh hóa', 'nghệ an', 'hà tĩnh', 'quảng bình', 'quảng trị', 'thừa thiên huế', 'huế',
    'đà nẵng', 'quảng nam', 'hội an', 'quảng ngãi', 'bình định', 'quy nhơn', 'phú yên', 'khánh hòa',
    'nha trang', 'ninh thuận', 'bình thuận', 'phan thiết', 'mũi né', 'phong nha'],
  'Tây Nguyên': ['kon tum', 'gia lai', 'pleiku', 'đắk lắk', 'buôn ma thuột', 'đắk nông', 'lâm đồng', 'đà lạt'],
  'Miền Nam': ['hồ chí minh', 'sài gòn', 'bình dương', 'bình phước', 'tây ninh', 'đồng nai', 'bà rịa', 'vũng tàu', 'long an',
    'tiền giang', 'bến tre', 'trà vinh', 'vĩnh long', 'đồng tháp', 'an giang', 'châu đốc', 'kiên giang',
    'phú quốc', 'cần thơ', 'hậu giang', 'sóc trăng', 'bạc liêu', 'cà mau', 'cần thơ', 'côn đảo',
    'hà tiên', 'châu đốc', 'cù lao', 'miền tây'],
};

// Cụm chỉ VÙNG MIỀN (không phải tỉnh cụ thể) — có thể lọt vào REGION_KEYWORDS như "miền tây",
// hoặc là bản ghi rác trong ProvinceSpecialty. Khi detect ra "tỉnh" trùng các cụm này → xử như
// VÙNG (Bước 2: chọn tỉnh trong vùng) chứ KHÔNG khoá thành điểm đến cụ thể ở Bước 3.
const REGION_ALIAS_WORDS = new Set([
  'miền tây', 'miền bắc', 'miền trung', 'miền nam', 'tây nguyên', 'bắc bộ', 'trung bộ', 'nam bộ',
  'đồng bằng sông cửu long', 'tây bắc', 'đông bắc', 'đông nam bộ',
]);

// Viết tắt / biệt danh tỉnh phổ biến mà REGION_KEYWORDS KHÔNG có (vd "HCM", "TPHCM", "BR-VT").
// Chuẩn hoá về TÊN ĐẦY ĐỦ để detectRegionFromQuery nhận ra → bật form đúng thay vì rơi null.
// pats đã bỏ dấu/thường hoá (khớp trên noTonesQuery). CHỈ thêm cụm ÍT MƠ HỒ — tránh biệt danh
// dễ đụng ("cố đô", "phố núi", "đảo ngọc", "tây đô"≈"tây đó") gây khoá sai tỉnh.
const PROVINCE_ALIASES = [
  { pats: ['thanh pho ho chi minh', 'tphcm', 'tp hcm', 'tp.hcm', 'hcm', 'sai gon', 'saigon'], name: 'Hồ Chí Minh', region: 'Miền Nam' },
  { pats: ['ba ria vung tau', 'ba ria - vung tau', 'br-vt', 'brvt', 'br vt'], name: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam' },
  { pats: ['xu nghe'], name: 'Nghệ An', region: 'Miền Trung' },
];

// Detect vùng/tỉnh từ query người dùng
// Dịch chuyển detectRegionFromQuery vào trong class AIService để gọi hàm async

// Detect xem user đang TÌM tour có sẵn (không phải tạo mới)
function detectTourSearchQuery(messages) {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') return false;
  const text = lastMsg.content.toLowerCase();
  const searchPhrases = [
    'có tour nào', 'tìm tour', 'tour nào', 'có chuyến nào', 'có lịch trình nào',
    'tour có sẵn', 'xem tour', 'danh sách tour', 'tour nào phù hợp', 'gợi ý tour',
    'có tour', 'tour đi', 'tour biển', 'tour núi',
  ];
  return searchPhrases.some(p => text.includes(p));
}

// Detect xem user có hỏi về lịch trình không (tạo mới). Phân tầng tín hiệu thay vì
// "1 keyword bất kỳ là đủ" (cũ) — tránh nhồi ITINERARY_JSON_INSTRUCTION vào MỌI lượt
// chỉ vì câu chứa "du lịch"/"gợi ý"/"ngày".
function detectItineraryQuery(messages) {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') return false;
  // Nếu chỉ đang TÌM tour có sẵn → không bật chế độ tạo lịch trình mới
  if (detectTourSearchQuery(messages)) return false;
  const text = lastMsg.content.toLowerCase();

  // Tín hiệu MẠNH: user nói thẳng muốn lịch trình/kế hoạch → 1 cái là đủ
  const strong = ['lịch trình', 'itinerary', 'kế hoạch', 'lên lịch', 'hành trình', 'plan'];
  if (strong.some(k => text.includes(k))) return true;

  // Tín hiệu THỜI LƯỢNG: "N ngày/đêm" hoặc "cuối tuần" — trong chatbot du lịch gần như
  // luôn nghĩa là muốn dựng lịch trình. Loại trừ câu hỏi tra cứu thời gian (thời tiết...).
  const hasDuration = /\d+\s*(ngày|đêm)\b/.test(text) || text.includes('cuối tuần');
  if (hasDuration) {
    const factualTiming = /thời tiết|nhiệt độ|dự báo|mấy giờ|ngày tới|sắp tới|hôm nay|ngày mai|tuần tới/.test(text);
    if (!factualTiming) return true;
  }

  return false;
}

class AIService {
  // Cache toàn bộ danh sách destinations (dùng khi không detect được vùng)
  destinationsCache = null;
  cacheTime = null;
  CACHE_DURATION = 5 * 60 * 1000; // 5 phút

  // Cache specialties
  specialtiesCache = null;
  specialtiesCacheTime = null;

  // Cache danh sách tên địa danh (cho frontend)
  namesCache = null;
  namesCacheTime = null;

  // Cache danh sách tên tỉnh/thành (cho clarification form bước 2)
  provinceNamesCache = null;
  provinceNamesCacheTime = null;

  // Cache lite docs (đủ data render card + matching) cho trích "điểm đến được nhắc đến"
  destLiteCache = null;
  destLiteCacheTime = null;

  // ── Lấy destinations đã lọc theo vùng/tỉnh ─────────────────────────────────
  // Trả về { iconic, supporting }: iconic = điểm tham quan biểu tượng (đã cluster theo địa lý); supporting = ăn/ở bổ sung
  async getFilteredDestinations(regionInfo = null) {
    try {
      const baseQuery = {};

      if (regionInfo?.province) {
        const escapedProvince = regionInfo.province.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        baseQuery['location.city'] = { $regex: escapedProvince, $options: 'i' };
      } else if (regionInfo?.region) {
        const provinces = REGION_KEYWORDS[regionInfo.region] || [];
        if (provinces.length > 0) {
          baseQuery['location.city'] = { $regex: provinces.slice(0, 10).join('|'), $options: 'i' };
        }
      }

      const ATTRACTION_CATS = ['attraction', 'historical', 'landmark', 'temple', 'beach', 'mountain', 'culture', 'amusement', 'countryside'];
      const SUPPORT_CATS = ['restaurant', 'cafe', 'hotel'];

      // Bước 1: Lấy iconic/attraction trước (ưu tiên isIconic + iconicRank, rồi rating)
      const attractionLimit = regionInfo ? 18 : 12;
      const attractions = await Destination.find({
        ...baseQuery,
        category: { $in: ATTRACTION_CATS }
      })
        .select('name location category priceRange rating isIconic iconicRank')
        .sort({ isIconic: -1, iconicRank: 1, rating: -1 })
        .limit(attractionLimit);

      // Bước 2: Lấy thêm vài địa điểm ăn/ở để bổ sung (không phải điểm tham quan chính)
      const supportLimit = regionInfo ? 8 : 5;
      const supporting = await Destination.find({
        ...baseQuery,
        category: { $in: SUPPORT_CATS }
      })
        .select('name location category priceRange rating')
        .sort({ rating: -1 })
        .limit(supportLimit);

      // Fallback: nếu không có gì cho vùng này, dùng top-rated toàn quốc
      if (attractions.length === 0 && supporting.length === 0 && regionInfo) {
        return this.getFilteredDestinations(null);
      }

      const categoryMap = {
        beach: 'Biển', mountain: 'Núi', city: 'Thành phố', countryside: 'Nông thôn',
        historical: 'Di tích', attraction: 'Tham quan', landmark: 'Biểu tượng',
        temple: 'Đền/Chùa', culture: 'Văn hóa', amusement: 'Giải trí',
        restaurant: 'Nhà hàng', cafe: 'Cafe', hotel: 'Khách sạn'
      };
      const priceMap = { budget: 'Tiết kiệm', 'mid-range': 'Trung bình', luxury: 'Cao cấp' };

      const formatLine = (d, opts = {}) => {
        const star = opts.iconic ? '⭐ICONIC' : `⭐${d.rating}`;
        return `- ${d.name} (${d.location?.city || ''}) [${categoryMap[d.category] || d.category}, ${priceMap[d.priceRange] || d.priceRange || '-'}, ${star}]`;
      };

      // ── Cluster attractions theo địa lý (Haversine, bán kính 15km) ────────
      const clusters = this.clusterByGeography(attractions, 15);
      const iconicBlock = clusters
        .map((cluster, idx) => {
          const header = `▸ CỤM ${idx + 1} (gần nhau ~${cluster.spread}km - NÊN gom vào CÙNG 1 NGÀY):`;
          const lines = cluster.points.map(d => formatLine(d, { iconic: d.isIconic })).join('\n');
          return `${header}\n${lines}`;
        })
        .join('\n\n');

      const supportingBlock = supporting.map(d => formatLine(d)).join('\n');

      return { iconic: iconicBlock, supporting: supportingBlock, clusterCount: clusters.length };

    } catch (error) {
      console.error('Error getting filtered destinations:', error);
      return { iconic: '', supporting: '', clusterCount: 0 };
    }
  }

  // ── Haversine distance (km) giữa 2 điểm ──────────────────────────────────
  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // ── Greedy clustering theo proximity ─────────────────────────────────────
  // Sort theo iconicRank, mỗi điểm chưa có cụm → seed cụm mới + gom các điểm trong radiusKm
  clusterByGeography(points, radiusKm = 15) {
    const valid = points.filter(p => p.location?.coordinates?.lat && p.location?.coordinates?.lng);
    const noCoord = points.filter(p => !(p.location?.coordinates?.lat && p.location?.coordinates?.lng));
    const used = new Set();
    const clusters = [];

    for (let i = 0; i < valid.length; i++) {
      if (used.has(i)) continue;
      used.add(i);
      const seed = valid[i];
      const members = [seed];
      let maxDist = 0;

      for (let j = i + 1; j < valid.length; j++) {
        if (used.has(j)) continue;
        const other = valid[j];
        const dist = this.haversineKm(
          seed.location.coordinates.lat, seed.location.coordinates.lng,
          other.location.coordinates.lat, other.location.coordinates.lng
        );
        if (dist <= radiusKm) {
          used.add(j);
          members.push(other);
          if (dist > maxDist) maxDist = dist;
        }
      }

      clusters.push({ points: members, spread: Math.round(maxDist) });
    }

    // Các điểm không có toạ độ → 1 cụm "chưa rõ vị trí" cuối
    if (noCoord.length > 0) {
      clusters.push({ points: noCoord, spread: 0, unknownLocation: true });
    }

    return clusters;
  }

  // Helper loại bỏ dấu tiếng Việt
  removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  // Rút "cụm địa điểm" trong câu bằng cách bỏ các từ đệm (tôi/muốn/đi/du lịch...).
  // Vd: "tôi muốn đi suối tiên" → "suối tiên"; "tôi muốn đi du lịch" → "".
  extractPlaceCandidate(text) {
    if (!text) return '';
    let t = text.toLowerCase();
    const fillerPhrases = [
      'khu du lịch sinh thái', 'khu du lịch', 'đi du lịch', 'du lịch', 'tôi muốn', 'muốn đi',
      'đi chơi', 'tham quan', 'khám phá', 'chuyến đi', 'một chuyến', 'lên kế hoạch', 'kế hoạch',
      'gợi ý', 'đề xuất', 'lịch trình', 'cho tôi', 'giúp tôi', 'giúp mình',
    ];
    for (const p of fillerPhrases) t = t.split(p).join(' ');
    const fillerWords = new Set([
      'tôi', 'mình', 'muốn', 'đi', 'đến', 'tới', 'về', 'chơi', 'ghé', 'thăm', 'chuyến', 'cho',
      'giúp', 'nên', 'vào', 'ở', 'tại', 'một', 'các', 'và', 'với', 'nha', 'ạ', 'là', 'đâu', 'đó',
      'chỗ', 'nơi', 'gì', 'nào', 'này', 'kia', 'hãy', 'cần', 'xem', 'ăn',
      // Từ chào hỏi / xã giao — KHÔNG phải địa danh. Nếu không loại, lời chào "xin chào"
      // bị khớp nhầm với tên địa điểm (vd "Nhà Hàng Xin Chào Phú Quốc" → ra Kiên Giang).
      'xin', 'chào', 'hello', 'hi', 'hey', 'alo', 'bạn', 'ơi', 'cảm', 'ơn', 'ok', 'oke',
    ]);
    const tokens = t.split(/\s+/).filter(w => w && !fillerWords.has(w));
    return tokens.join(' ').trim();
  }

  // Cụm chỉ là từ CHUNG CHUNG (biển/núi/...) → không coi là tên địa điểm cụ thể
  isGenericPlaceWord(coreNoTones) {
    const GENERIC = new Set([
      'bien', 'nui', 'dao', 'thac', 'ho', 'chua', 'rung', 'song', 'suoi', 'hang', 'dong',
      'vinh', 'thanh pho', 'que', 'nong thon', 'mien tay', 'tam bien', 'nghi duong',
    ]);
    return GENERIC.has(coreNoTones);
  }

  // ── Nhận diện vùng miền từ câu query ──────────────────────────────────────
  async detectRegionFromQuery(query) {
    if (!query) return null;
    const lowerQuery = query.toLowerCase();
    const noTonesQuery = this.removeVietnameseTones(query);
    
    // Viết tắt / biệt danh tỉnh (không nằm trong REGION_KEYWORDS) → chuẩn hoá về tên đầy đủ.
    // Đặt TRƯỚC khớp thường để "hcm"/"tphcm" không rơi vào nhánh null.
    for (const a of PROVINCE_ALIASES) {
      if (a.pats.some(p => noTonesQuery.includes(p))) return { region: a.region, province: a.name };
    }

    // Tìm tỉnh cụ thể trước
    const allProvinces = Object.values(REGION_KEYWORDS).flat();
    let matchedProvince = allProvinces.find(p => lowerQuery.includes(p) || noTonesQuery.includes(this.removeVietnameseTones(p)));
    
    const destNames = await this.getDestinationNames();
    const provinceOfCity = (city) => allProvinces.find(p => city.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(city.toLowerCase()));
    const regionOf = (prov) => {
      for (const [region, provinces] of Object.entries(REGION_KEYWORDS)) {
        if (provinces.includes(prov)) return region;
      }
      return null;
    };

    // 1) Có tỉnh cụ thể (province keyword) → return luôn
    if (matchedProvince) {
      const region = regionOf(matchedProvince);
      if (region) return { region, province: matchedProvince };
    }

    // 2) Vùng miền chung — XÉT TRƯỚC khi khớp tên địa danh (để "miền nam" ra VÙNG)
    if (lowerQuery.includes('miền bắc') || lowerQuery.includes('bắc bộ')) return { region: 'Miền Bắc', province: null };
    if (lowerQuery.includes('miền trung') || lowerQuery.includes('trung bộ')) return { region: 'Miền Trung', province: null };
    if (lowerQuery.includes('miền nam') || lowerQuery.includes('nam bộ') || lowerQuery.includes('miền tây') || lowerQuery.includes('đồng bằng sông cửu long')) return { region: 'Miền Nam', province: null };
    if (lowerQuery.includes('tây nguyên')) return { region: 'Tây Nguyên', province: null };
    // Tiểu vùng phía Bắc (chưa phải tỉnh cụ thể) → coi là Miền Bắc để đi Bước 2 chọn tỉnh.
    if (lowerQuery.includes('tây bắc') || lowerQuery.includes('đông bắc')) return { region: 'Miền Bắc', province: null };

    // 3) Khớp tên địa danh trong DB — ĐẦY ĐỦ (tên nằm trong câu) HOẶC MỘT PHẦN (tên chứa cụm
    //    địa điểm, vd "suối tiên" → "Khu Du Lịch Suối Tiên"). CHỈ nhận khi KHÔNG mơ hồ: mọi địa
    //    danh khớp thuộc CÙNG 1 tỉnh. Nếu nhiều tỉnh (vd Suối Tiên ở Khánh Hòa/HCM/Kiên Giang)
    //    → null để web search liệt kê các lựa chọn cho người dùng.
    const coreNoTones = this.removeVietnameseTones(this.extractPlaceCandidate(query));
    const useCore = coreNoTones.length >= 4 && !this.isGenericPlaceWord(coreNoTones);
    const matches = destNames.filter(d => {
      if (!d.name || !d.city) return false;
      const dn = this.removeVietnameseTones(d.name);
      if (dn.length < 4) return false;
      return noTonesQuery.includes(dn) || (useCore && dn.includes(coreNoTones));
    });
    if (matches.length) {
      const provinces = new Set(matches.map(d => provinceOfCity(d.city)).filter(Boolean));
      if (provinces.size === 1) {
        const prov = [...provinces][0];
        const region = regionOf(prov);
        if (region) return { region, province: prov };
      }
    }

    return null; // Không xác định được vùng (hoặc địa danh mơ hồ) → để web search xử lý
  }

  // ── Clarification form: phát hiện yêu cầu mơ hồ & dựng form ────────────────
  // Có ý định du lịch trong câu hỏi không? (broad — bộ lọc thật là "thiếu địa điểm")
  hasTravelIntent(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    const intentKeywords = [
      'đi du lịch', 'du lịch', 'đi chơi', 'lên lịch', 'lịch trình', 'kế hoạch đi',
      'muốn đi', 'gợi ý điểm đến', 'nên đi đâu', 'đi đâu', 'trip', 'chuyến đi',
    ];
    return intentKeywords.some(k => t.includes(k));
  }

  // Nhận diện LOẠI HÌNH chuyến đi từ câu (biển/trăng mật/dã ngoại/...). Trả về object
  // trong TRIP_TYPES (type, intro, interests, defaults) hoặc null. Khớp theo RANH GIỚI TỪ
  // (containsWord) trên chuỗi đã bỏ dấu để 'bien' không dính nhầm trong "bienhoa"...
  detectTripType(text) {
    if (!text) return null;
    const noTones = this.removeVietnameseTones(text);
    for (const t of TRIP_TYPES) {
      if (t.keywords.some(kw => this.containsWord(noTones, kw))) return t;
    }
    return null;
  }

  // ── "Gần tôi": nhận diện ý định tìm địa điểm THEO VỊ TRÍ ──────────────────
  // Trả { category, label, query } hoặc null. YÊU CẦU cả token khoảng cách ("gần tôi"...)
  // LẪN 1 loại địa điểm (quán ăn/cafe/nhà nghỉ) → không cướp câu du lịch thường như
  // "quán ăn ngon ở Đà Nẵng" (không có "gần"). Khớp bỏ dấu theo ranh giới từ.
  detectNearbyQuery(text) {
    if (!text) return null;
    const noTones = this.removeVietnameseTones(text);
    if (!NEARBY_PROXIMITY.some(p => this.containsWord(noTones, p))) return null;
    for (const t of NEARBY_TYPES) {
      if (t.keywords.some(kw => this.containsWord(noTones, kw))) {
        return { category: t.category, label: t.label, query: t.query };
      }
    }
    return null;
  }

  // Khoảng cách Haversine giữa 2 toạ độ {lat,lng} → km. Model lưu {lat,lng} thường (không
  // GeoJSON 2dsphere) nên tính tay bằng JS thay vì $near.
  haversineKm(a, b) {
    if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371; // bán kính Trái Đất (km)
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Tìm địa điểm trong DB theo category, gần toạ độ user, sort theo khoảng cách tăng dần.
  // Lọc bằng bounding-box thô trước (giảm số doc phải tính Haversine), rồi tính chính xác.
  async findNearbyDestinations(category, lat, lng, radiusKm, limit) {
    const latDelta = radiusKm / 111; // ~111km / 1 độ vĩ
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
    const docs = await Destination.find({
      category,
      'location.coordinates.lat': { $ne: null, $gte: lat - latDelta, $lte: lat + latDelta },
      'location.coordinates.lng': { $ne: null, $gte: lng - lngDelta, $lte: lng + lngDelta },
    }).select('name images location category rating priceRange description').lean();

    const user = { lat, lng };
    return docs
      .map(d => ({ d, distanceKm: this.haversineKm(user, d.location?.coordinates) }))
      .filter(x => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
      .map(({ d, distanceKm }) => ({
        _id: String(d._id), name: d.name, images: d.images || [], location: d.location,
        category: d.category, rating: d.rating, priceRange: d.priceRange, description: d.description,
        distanceKm: Math.round(distanceKm * 10) / 10,
      }));
  }

  // ── "Gần tôi": dựng block ```json_nearby``` (tất định, KHÔNG gọi model) ──────
  //  - Không phải câu "gần tôi"        → null (để luồng thường xử lý).
  //  - Là "gần tôi" nhưng thiếu GPS    → block { needLocation:true } (frontend nhắc bật vị trí).
  //  - Có GPS: DB TRƯỚC; thiếu N → bù Serper (chính) → SerpApi (dự phòng). Kết quả live KHÔNG lưu DB.
  async buildNearbyBlock(messages, location) {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return null;
    const intent = this.detectNearbyQuery(lastUserMsg.content);
    if (!intent) return null;

    const lat = Number(location?.lat), lng = Number(location?.lng);
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
    if (!hasLoc) {
      const block = JSON.stringify({ type: 'nearby', category: intent.category, needLocation: true, items: [] });
      return `Để tìm ${intent.label} gần bạn, mình cần biết vị trí của bạn 📍 Hãy bật quyền vị trí trong trình duyệt rồi hỏi lại giúp mình nhé!\n\n\`\`\`json_nearby\n${block}\n\`\`\``;
    }

    const N = 6;
    let radiusKm = 8;
    let items = await this.findNearbyDestinations(intent.category, lat, lng, radiusKm, N);
    if (items.length < 3) { // quá ít trong 8km → nới bán kính trước khi gọi API ngoài
      radiusKm = 15;
      items = await this.findNearbyDestinations(intent.category, lat, lng, radiusKm, N);
    }

    // Thiếu N → bù bằng API ngoài (Serper chính, SerpApi dự phòng). Dedupe theo tên (bỏ dấu)
    // hoặc toạ độ gần (<150m) so với item đã có.
    if (items.length < N) {
      const seenNames = new Set(items.map(i => this.removeVietnameseTones(i.name)));
      const isDup = (name, c) => seenNames.has(this.removeVietnameseTones(name)) ||
        items.some(i => i.location?.coordinates && this.haversineKm(i.location.coordinates, c) < 0.15);

      // QUAN TRỌNG: Serper/SerpApi KHÔNG lọc theo toạ độ (tham số ll bị phớt lờ → trả kết quả
      // mặc định ở Hà Nội). Phải REVERSE GEOCODE toạ độ → tên khu vực rồi nhét vào query `q`
      // (vd "quán cà phê Phường Hòa Thuận, Vĩnh Long"). Haversine sau đó vẫn lọc chính xác theo
      // GPS thật nên kể cả query hơi rộng cũng chỉ giữ đúng quán trong bán kính.
      const geo = await geocodingService.reverseGeocode(lat, lng).catch(() => null);
      const searchQuery = geo?.label ? `${intent.query} ${geo.label}` : intent.query;

      let live = [];
      try {
        live = await this._serperNearby(searchQuery, lat, lng, radiusKm);
      } catch (e) {
        console.warn('[Nearby] Serper lỗi, thử SerpApi:', e.message);
      }
      if (!live.length) {
        try {
          live = await this._serpApiNearby(searchQuery, lat, lng, radiusKm);
        } catch (e) {
          console.warn('[Nearby] SerpApi lỗi:', e.message);
        }
      }
      for (const item of live) {
        if (items.length >= N) break;
        if (isDup(item.name, item.location.coordinates)) continue;
        seenNames.add(this.removeVietnameseTones(item.name));
        items.push(item);
      }
    }

    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    items = items.slice(0, N);

    const intro = items.length
      ? `Đây là ${items.length} ${intent.label} gần bạn nhất mình tìm được 📍 (sắp theo khoảng cách):`
      : `Mình chưa tìm thấy ${intent.label} nào gần vị trí của bạn 😔 Bạn thử mở rộng khu vực hoặc kiểm tra lại vị trí nhé.`;
    const block = JSON.stringify({ type: 'nearby', category: intent.category, items });
    return `${intro}\n\n\`\`\`json_nearby\n${block}\n\`\`\``;
  }

  // Map 1 kết quả live (Serper/SerpApi) → card shape + distanceKm + external.mapsUrl.
  _mapLivePlace(name, plat, plng, rating, address, image, user, radiusKm) {
    if (plat == null || plng == null) return null;
    const distanceKm = this.haversineKm(user, { lat: plat, lng: plng });
    if (distanceKm > radiusKm) return null;
    return {
      _id: null,
      name,
      images: image ? [image] : [],
      location: { city: address || '', country: 'Việt Nam', coordinates: { lat: plat, lng: plng } },
      category: 'attraction',
      rating: rating || 0,
      description: address || '',
      distanceKm: Math.round(distanceKm * 10) / 10,
      external: { mapsUrl: `https://www.google.com/maps/search/?api=1&query=${plat},${plng}` },
    };
  }

  // Serper /places KHÔNG lọc theo toạ độ → `query` PHẢI đã kèm địa danh (reverse geocode).
  // Haversine lọc lại theo GPS thật nên chỉ giữ đúng quán trong bán kính.
  async _serperNearby(query, lat, lng, radiusKm) {
    const data = await serperManager.searchPlaces(query);
    const places = data?.places || [];
    const user = { lat, lng };
    return places
      .map(p => this._mapLivePlace(p.title, p.latitude, p.longitude, p.rating, p.address, p.thumbnailUrl || p.imageUrl, user, radiusKm))
      .filter(Boolean);
  }

  // SerpApi google_maps CÓ hỗ trợ `ll` (@lat,lng,zoom) thật → tự dựng từ toạ độ; query cũng
  // kèm địa danh cho chắc. Haversine lọc lại theo GPS thật.
  async _serpApiNearby(query, lat, lng, radiusKm) {
    const data = await serpApiManager.fetchWithRotation({
      engine: 'google_maps', type: 'search', q: query, ll: `@${lat},${lng},15z`, hl: 'vi', gl: 'vn',
    });
    const results = data?.local_results || [];
    const user = { lat, lng };
    return results
      .map(r => this._mapLivePlace(r.title, r.gps_coordinates?.latitude, r.gps_coordinates?.longitude, r.rating, r.address, r.thumbnail, user, radiusKm))
      .filter(Boolean);
  }

  // User đã nhắc tới số ngày chưa?
  extractDaysFromText(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    return /(\d+)\s*(ngày|ngay|đêm|dem|tuần|tuan)/i.test(t) || t.includes('cuối tuần');
  }

  // User đã nhắc tới ngân sách chưa?
  extractBudgetFromText(text) {
    if (!text) return false;
    return /(triệu|trieu|nghìn|nghin|ngàn|ngan|\btr\b|vnđ|vnd|ngân sách|ngan sach|tiết kiệm|tiet kiem|cao cấp|cao cap|\d{6,})/i.test(text);
  }

  // User đã nhắc tới số người đi chưa?
  extractPeopleFromText(text) {
    if (!text) return false;
    return /(\d+)\s*(người|nguoi|khách|khach)|gia đình|gia dinh|nhóm|nhom|cặp đôi|cap doi|một mình|mot minh|\bsolo\b|vợ chồng|vo chong|bạn bè|ban be/i.test(text);
  }

  // Lấy danh sách tên tỉnh/thành (từ ProvinceSpecialty), có cache
  async getAllProvinceNames() {
    if (this.provinceNamesCache && this.provinceNamesCacheTime && (Date.now() - this.provinceNamesCacheTime < this.CACHE_DURATION)) {
      return this.provinceNamesCache;
    }
    try {
      const names = await ProvinceSpecialty.distinct('province');
      this.provinceNamesCache = names.filter(Boolean);
      this.provinceNamesCacheTime = Date.now();
      return this.provinceNamesCache;
    } catch (e) {
      console.error('Error getting province names:', e);
      return [];
    }
  }

  // Phát hiện tỉnh/thành cụ thể trong text (bao phủ cả tỉnh không có trong REGION_KEYWORDS).
  // Đây là chốt chặn chống vòng lặp bước 2: tỉnh user vừa chọn LUÔN được nhận diện.
  async detectProvinceFromText(text) {
    if (!text) return null;
    const noTones = this.removeVietnameseTones(text);
    const provinces = await this.getAllProvinceNames();
    // Ưu tiên tên dài trước (vd "Bà Rịa - Vũng Tàu" trước "Vũng Tàu")
    const sorted = [...provinces].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (noTones.includes(this.removeVietnameseTones(p))) return p;
    }
    return null;
  }

  // Liệt kê các tỉnh trong 1 vùng CÓ điểm đến, sắp theo độ phong phú (nhiều điểm trước).
  async getProvincesInRegion(region) {
    try {
      const provinces = await ProvinceSpecialty.find({ region }).distinct('province');
      if (!provinces.length) return [];
      // Đếm số điểm đến mỗi tỉnh (tên tỉnh trùng với location.city)
      const counts = await Destination.aggregate([
        { $match: { 'location.city': { $in: provinces } } },
        { $group: { _id: '$location.city', count: { $sum: 1 } } },
      ]);
      const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));
      return provinces
        .filter(p => (countMap[p] || 0) > 0)
        .sort((a, b) => (countMap[b] || 0) - (countMap[a] || 0))
        .slice(0, 12);
    } catch (e) {
      console.error('Error getting provinces in region:', e);
      return [];
    }
  }

  // Dựng block ```json_form``` làm rõ yêu cầu. Trả về string (intro + fenced block) hoặc null.
  //  - Chưa có địa điểm      → BƯỚC 1: hỏi vùng + ngày/ngân sách/người/sở thích.
  //  - Có vùng, chưa có tỉnh → BƯỚC 2: liệt kê các tỉnh trong vùng để chọn cụ thể.
  //  - Đã có tỉnh cụ thể     → null (đủ thông tin → tạo lịch trình).
  async buildClarificationBlock(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return null;

    // 1. Xét ý định trên tin nhắn user cuối. LOẠI HÌNH chuyến đi ("đi biển", "tuần
    //    trăng mật", "dã ngoại"...) cũng tính là có ý định — kể cả khi hasTravelIntent
    //    không bắt được (vd "đi dã ngoại", "đi phượt").
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return null;
    const tripType = this.detectTripType(lastUserMsg.content);
    if (!this.hasTravelIntent(lastUserMsg.content) && !tripType) return null;

    // 2. Xác định địa điểm tốt nhất trong ~4 tin user gần nhất (đa lượt)
    const recentUserMsgs = messages.filter(m => m.role === 'user').slice(-4);
    let knownProvince = null;
    let knownRegion = null;
    for (const m of recentUserMsgs) {
      const r = await this.detectRegionFromQuery(m.content);
      // "province" trả về có thể thực chất là ALIAS VÙNG (vd "miền tây" nằm trong REGION_KEYWORDS)
      // → xử như VÙNG (Bước 2), đừng khoá thành điểm đến cụ thể ở Bước 3.
      const provinceIsAlias = r?.province && REGION_ALIAS_WORDS.has(r.province.toLowerCase());
      if (r?.province && !provinceIsAlias) { knownProvince = knownProvince || r.province; continue; } // tỉnh thật
      if (r?.region) { knownRegion = r.region; continue; }  // vùng thuần HOẶC province-là-alias-vùng
      if (!knownProvince) {
        const p = await this.detectProvinceFromText(m.content); // tỉnh cụ thể (kể cả ngoài REGION_KEYWORDS)
        if (p && !REGION_ALIAS_WORDS.has(p.toLowerCase())) knownProvince = p; // né bản ghi rác "miền tây"
      }
    }

    // 2b. BƯỚC 3 — đã biết TỈNH cụ thể. Trước đây coi là "đủ thông tin" → tạo lịch trình luôn
    //     (model tự đoán 3N2Đ rồi hỏi thêm bằng lời). Giờ nếu CHƯA nêu số ngày → hỏi nốt chi
    //     tiết rồi mới dựng. Tỉnh được KHOÁ qua defaults.location (compose() tự chèn "đi du lịch
    //     <tỉnh>") nên KHÔNG render lại field địa điểm. Đã nêu ngày (vd "3 ngày 2 đêm") → vẫn
    //     tạo luôn để khỏi hỏi thừa — cũng là chốt chặn chống lặp: câu compose trả về LUÔN kèm
    //     số ngày (field bắt buộc) nên lần sau rơi vào nhánh này và return null.
    if (knownProvince) {
      // Ngày/ngân sách/người có thể đã nêu ở LƯỢT TRƯỚC (vd chọn vùng "Miền Nam, 3 ngày, 10
      // triệu, 2 người, thích biển" rồi mới chốt tỉnh ở lượt sau) → QUÉT các tin user gần đây,
      // KHÔNG chỉ nhìn tin cuối, kẻo hỏi lại thông tin đã có → vòng lặp form. Đã nêu số ngày ở
      // bất kỳ lượt gần đây → đủ cốt lõi, để model tự dựng lịch trình từ toàn bộ hội thoại.
      if (recentUserMsgs.some(m => this.extractDaysFromText(m.content))) return null;
      const budgetMentioned = recentUserMsgs.some(m => this.extractBudgetFromText(m.content));
      const peopleMentioned = recentUserMsgs.some(m => this.extractPeopleFromText(m.content));
      const fields = [{ ...CLARIFY_FIELDS.days, required: true }]; // số ngày là thông tin cốt lõi → bắt buộc
      if (!budgetMentioned) fields.push(CLARIFY_FIELDS.budget);
      if (!peopleMentioned) fields.push(CLARIFY_FIELDS.people);
      fields.push(CLARIFY_FIELDS.interests);

      // Tên tỉnh có thể lấy từ REGION_KEYWORDS (viết thường) → title-case cho hiển thị & câu compose.
      const displayProvince = knownProvince.split(/\s+/).map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
      // Khoá tỉnh + gộp default theo loại hình (trăng mật → cặp đôi...) nếu có, chỉ giữ key ứng
      // với field đang hiển thị (default cho field ẩn sẽ rò vào câu compose).
      const defaults = { location: displayProvince };
      if (tripType) {
        const fieldKeys = new Set(fields.map(f => f.key));
        const merged = { ...(tripType.defaults || {}), interests: tripType.interests };
        for (const [k, v] of Object.entries(merged)) {
          if (fieldKeys.has(k)) defaults[k] = v;
        }
      }
      const intro = tripType
        ? tripType.intro
        : `Đi ${displayProvince} hay đấy! 🎒 Cho mình xin vài thông tin để lên lịch trình chuẩn hơn nhé 👇`;
      const block = JSON.stringify({
        type: 'clarification',
        step: 'details',
        tripType: tripType?.type || null,
        title: `Lên lịch trình ${displayProvince} — mình cần thêm chút thông tin nhé!`,
        fields,
        ...(Object.keys(defaults).length ? { defaults } : {}),
      });
      return `${intro}\n\n\`\`\`json_form\n${block}\n\`\`\``;
    }

    // 3. BƯỚC 2 — đã có vùng nhưng chưa có tỉnh → hỏi chọn tỉnh trong vùng
    if (knownRegion) {
      const provinces = await this.getProvincesInRegion(knownRegion);
      if (!provinces.length) return null; // không liệt kê được → để model tự xử lý
      const intro = `${knownRegion} có nhiều điểm đến hấp dẫn! Bạn muốn đi cụ thể tỉnh/thành nào để mình lên lịch trình chi tiết nhé 👇`;
      const block = JSON.stringify({
        type: 'clarification',
        step: 'province',
        title: `Chọn tỉnh/thành ở ${knownRegion}`,
        fields: [{
          key: 'location',
          label: `Bạn muốn đi tỉnh/thành nào ở ${knownRegion}?`,
          type: 'select',
          required: true,
          allowCustom: true,
          placeholder: 'Hoặc nhập tỉnh/thành khác...',
          options: provinces.map(p => ({ value: p, label: p })),
        }],
      });
      return `${intro}\n\n\`\`\`json_form\n${block}\n\`\`\``;
    }

    // 3b. Nếu user ĐÃ nêu một địa điểm cụ thể (dù chưa khớp DB/region) → KHÔNG hỏi form
    //     chung chung; để buildSystemPrompt tự web-search trả lời (vd "tôi muốn đi suối tiên",
    //     "đi đảo Robinson"...). NGOẠI LỆ: nếu cụm chỉ là LOẠI HÌNH chuyến đi (tripType) thì
    //     KHÔNG coi là địa danh (vd "tuần trăng mật", "leo núi") → vẫn hiện form làm rõ.
    const candidate = this.removeVietnameseTones(this.extractPlaceCandidate(lastUserMsg.content));
    if (candidate.length >= 3 && !this.isGenericPlaceWord(candidate) && !tripType) {
      return null;
    }

    // 4. BƯỚC 1 — chưa có địa điểm gì → hỏi vùng + các field còn thiếu
    const daysMentioned = this.extractDaysFromText(lastUserMsg.content);
    const budgetMentioned = this.extractBudgetFromText(lastUserMsg.content);
    const peopleMentioned = this.extractPeopleFromText(lastUserMsg.content);

    const fields = [CLARIFY_FIELDS.location];
    if (!daysMentioned) fields.push(CLARIFY_FIELDS.days);
    if (!budgetMentioned) fields.push(CLARIFY_FIELDS.budget);
    if (!peopleMentioned) fields.push(CLARIFY_FIELDS.people);
    fields.push(CLARIFY_FIELDS.interests);

    // Cá nhân hóa theo loại hình nếu nhận diện được: lời mở đầu riêng + tích sẵn sở thích
    // + mặc định (vd trăng mật → cặp đôi). defaults CHỈ giữ key ứng với field ĐANG hiển thị —
    // vì frontend compose() đọc theo answers, default cho field bị ẩn sẽ rò vào câu gửi đi.
    const fieldKeys = new Set(fields.map(f => f.key));
    const defaults = {};
    if (tripType) {
      const merged = { ...(tripType.defaults || {}), interests: tripType.interests };
      for (const [k, v] of Object.entries(merged)) {
        if (fieldKeys.has(k)) defaults[k] = v;
      }
    }

    const intro = tripType
      ? tripType.intro
      : 'Bạn muốn đi du lịch nhưng mình chưa rõ điểm đến. Bạn chọn giúp mình vài thông tin bên dưới để mình gợi ý lịch trình chính xác nhé! 👇';
    const block = JSON.stringify({
      type: 'clarification',
      step: 'overview',
      tripType: tripType?.type || null,
      title: 'Mình cần thêm vài thông tin để gợi ý chính xác hơn nhé!',
      fields,
      ...(Object.keys(defaults).length ? { defaults } : {}),
    });
    return `${intro}\n\n\`\`\`json_form\n${block}\n\`\`\``;
  }

  // ── Lấy specialties đã lọc theo tỉnh/vùng hoặc tên món ──────────────────────
  async getFilteredSpecialties(regionInfo = null, userQuery = '') {
    try {
      let query = {};
      
      if (regionInfo?.province) {
        const escapedProvince = regionInfo.province.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.province = { $regex: escapedProvince, $options: 'i' };
      } else if (regionInfo?.region) {
        query.region = regionInfo.region;
      }

      let specialties = await ProvinceSpecialty.find(query)
        .select('province region localDishes souvenirs')
        .sort({ stt: 1 })
        .limit(regionInfo ? 10 : 5);

      // Nếu không tìm được theo vùng VÀ user hỏi về một món cụ thể,
      // tìm thêm bằng text search trên tên món ăn
      if (!regionInfo && userQuery) {
        const lowerQuery = userQuery.toLowerCase();
        const byDishName = await ProvinceSpecialty.find({
          $or: [
            { localDishesText: { $regex: lowerQuery, $options: 'i' } },
            { souvenirsText: { $regex: lowerQuery, $options: 'i' } },
            { 'localDishes.name': { $regex: lowerQuery, $options: 'i' } },
            { 'souvenirs.name': { $regex: lowerQuery, $options: 'i' } },
          ]
        }).select('province region localDishes souvenirs').limit(5);
        
        // Gộp vào kết quả, tránh trùng tỉnh
        const existingProvinces = new Set(specialties.map(s => s.province));
        for (const s of byDishName) {
          if (!existingProvinces.has(s.province)) {
            specialties.push(s);
            existingProvinces.add(s.province);
          }
        }
      }

      if (specialties.length === 0) return '';

      return specialties.map(s => {
        const dishes = s.localDishes?.slice(0, 4).map(d => `${d.name}${d.estimatedPrice ? ` (Giá: ${d.estimatedPrice})` : ''}${d.imageUrl ? ` (Ảnh: ${d.imageUrl})` : ''}`).join(', ') || '';
        const souvenirs = s.souvenirs?.slice(0, 3).map(d => `${d.name}${d.estimatedPrice ? ` (Giá: ${d.estimatedPrice})` : ''}${d.imageUrl ? ` (Ảnh: ${d.imageUrl})` : ''}`).join(', ') || '';
        return `- ${s.province} (${s.region}): Món ăn [${dishes}] | Đặc sản [${souvenirs}]`;
      }).join('\n');

    } catch (error) {
      console.error('Error getting filtered specialties:', error);
      return '';
    }
  }

  // ── Lấy danh sách tên địa danh (cho frontend matching) ───────────────────
  async getDestinationNames() {
    if (this.namesCache && this.namesCacheTime && (Date.now() - this.namesCacheTime < this.CACHE_DURATION)) {
      return this.namesCache;
    }
    try {
      const destinations = await Destination.find({}).select('name location.city').lean();
      const names = destinations.map(d => ({ name: d.name, city: d.location?.city || '' }));
      this.namesCache = names;
      this.namesCacheTime = Date.now();
      return names;
    } catch (error) {
      console.error('Error getting destination names:', error);
      return [];
    }
  }

  // ── Lite docs (đủ data render card) + tên/thành phố đã chuẩn hoá (cache) ─────
  async getDestinationsLite() {
    if (this.destLiteCache && this.destLiteCacheTime && (Date.now() - this.destLiteCacheTime < this.CACHE_DURATION)) {
      return this.destLiteCache;
    }
    try {
      const docs = await Destination.find({})
        .select('name location images category rating priceRange description')
        .lean();
      for (const d of docs) {
        d._nn = this.removeVietnameseTones(d.name || '');          // tên không dấu, thường
        d._nc = this.removeVietnameseTones(d.location?.city || ''); // city không dấu, thường
        d._core = this.coreDestName(d._nn);                          // lõi tên (bỏ tiền tố loại hình)
        // Bản GIỮ DẤU (đã thường hoá) cho khớp có xác thực dấu — chặn kiểu "hàng trong"
        // (nhà hàng trong resort) khớp nhầm "Hang Trống" vì cùng ra "hang trong" khi bỏ dấu.
        // _nn (bỏ dấu) và _nnT (giữ dấu) căn chỉnh 1:1 vì ký tự tiếng Việt tiền tổ hợp đều
        // 1 code unit → lõi có dấu = cắt _nnT tại ĐÚNG offset mà coreDestName cắt khỏi _nn.
        d._nnT = String(d.name || '').normalize('NFC').toLowerCase();
        d._coreT = d._nnT.slice(d._nn.length - d._core.length);
      }
      this.destLiteCache = docs;
      this.destLiteCacheTime = Date.now();
      return docs;
    } catch (e) {
      console.error('Error getting destinations lite:', e);
      return [];
    }
  }

  // Bỏ tiền tố loại hình ("Khu Du Lịch", "Công Viên"...) để lấy lõi tên địa danh
  coreDestName(noTonesName) {
    const prefixes = [
      'khu du lich sinh thai', 'khu du lich van hoa', 'khu du lich cong dong', 'khu du lich',
      'khu di tich lich su', 'khu di tich', 'khu tuong niem', 'khu bao ton',
      'cong vien', 'vuon quoc gia', 'bao tang', 'nha tho', 'thanh duong', 'khu nghi duong',
    ];
    for (const p of prefixes) {
      if (noTonesName.startsWith(p + ' ')) return noTonesName.slice(p.length).trim();
    }
    return noTonesName;
  }

  // Khớp `needle` trong `haystack` theo RANH GIỚI TỪ (chuỗi đã bỏ dấu, thường hoá).
  // Khác .includes(): "thanh" KHÔNG khớp trong "thanh pho" (vì "pho" dính liền sau),
  // nhưng "thanh pho" khớp đúng. Ranh giới = đầu/cuối chuỗi hoặc ký tự không phải [a-z0-9].
  containsWord(haystack, needle) {
    if (!haystack || !needle) return false;
    let from = 0;
    while (true) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) return false;
      const before = idx === 0 ? '' : haystack[idx - 1];
      const after = idx + needle.length >= haystack.length ? '' : haystack[idx + needle.length];
      const boundaryBefore = !before || !/[a-z0-9]/.test(before);
      const boundaryAfter = !after || !/[a-z0-9]/.test(after);
      if (boundaryBefore && boundaryAfter) return true;
      from = idx + 1;
    }
  }

  // Tách chuỗi thành cặp song song CÙNG ĐỘ DÀI (UTF-16): `toned` = NFC thường hoá GIỮ DẤU,
  // `base` = bỏ dấu. Mỗi ký tự map 1:1 → index tìm được trên `base` dùng thẳng trên `toned`
  // để đối chiếu dấu tại đúng vị trí khớp.
  toneAlignedLower(str) {
    const chars = Array.from(String(str || '').normalize('NFC').toLowerCase());
    const base = chars.map(ch => {
      const s = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
      return s.length === ch.length ? s : ch; // ký tự lạ không map 1:1 → giữ nguyên cho thẳng hàng
    });
    return { toned: chars.join(''), base: base.join('') };
  }

  // containsWord + XÁC THỰC DẤU: tìm theo ranh giới từ trên bản bỏ dấu, nhưng đoạn text tại
  // vị trí khớp phải ĐÚNG DẤU với tên (hoặc chính đoạn đó viết trần không dấu — người gõ tắt).
  // Chặn false-positive ghép chéo từ kiểu "nhà HÀNG TRONG resort" ≈ "Hang Trống" — hai cụm
  // này chỉ trùng nhau SAU KHI bỏ dấu ("hang trong"), so bản giữ dấu là phân biệt được ngay.
  containsWordToneAware(pair, needleBase, needleToned) {
    if (!pair?.base || !needleBase) return false;
    let from = 0;
    while (true) {
      const idx = pair.base.indexOf(needleBase, from);
      if (idx === -1) return false;
      const before = idx === 0 ? '' : pair.base[idx - 1];
      const after = idx + needleBase.length >= pair.base.length ? '' : pair.base[idx + needleBase.length];
      const boundaryBefore = !before || !/[a-z0-9]/.test(before);
      const boundaryAfter = !after || !/[a-z0-9]/.test(after);
      if (boundaryBefore && boundaryAfter) {
        const slice = pair.toned.slice(idx, idx + needleBase.length);
        if (slice === needleToned || slice === needleBase) return true;
      }
      from = idx + 1;
    }
  }

  // Tên 1 TỪ trùng từ thông dụng tiếng Việt → cực dễ false-positive (vd "Thành",
  // "Một", "Mộc", "Gió"). Chỉ nên trích khi có tỉnh ngữ cảnh khớp đúng.
  isAmbiguousShortName(noTonesName) {
    if (!noTonesName || noTonesName.includes(' ')) return false; // chỉ xét tên 1 từ
    const COMMON = new Set([
      'thanh', 'mot', 'moc', 'gio', 'sam', 'pi', 'temple', 'breathe', 'rua', 'co', 'mai',
      'nha', 'cho', 'bien', 'nui', 'pho', 'que', 'song', 'ho', 'rung', 'cau', 'cua', 'dao',
    ]);
    return COMMON.has(noTonesName);
  }

  // Tên NHIỀU TỪ nhưng TOÀN danh từ chung/loại hình (không có lõi tên riêng), vd
  // "Khu vui chơi", "Bãi biển", "Chợ đêm", "Nhà hàng". Đây thường là record placeholder
  // và cực dễ false-positive: lịch trình AI luôn có cụm văn xuôi kiểu "chọn khu vui chơi",
  // "đi dạo bãi biển" → khớp nhầm đúng cái tên chung đó dù khác tỉnh. Chỉ nên trích khi có
  // tỉnh ngữ cảnh khớp đúng (giống chính sách của isAmbiguousShortName). Tên còn 1 token
  // RIÊNG (vd "Bãi biển Titop", "Công viên Yên Sở") sẽ KHÔNG bị coi là chung → vẫn hiện.
  isGenericPlaceName(noTonesName) {
    if (!noTonesName || !noTonesName.includes(' ')) return false; // tên 1 từ đã có guard riêng
    const GENERIC = new Set([
      'khu', 'vui', 'choi', 'giai', 'tri',        // khu vui chơi, giải trí
      'bai', 'bien',                              // bãi biển
      'cong', 'vien',                             // công viên
      'trung', 'tam',                             // trung tâm
      'thuong', 'mai',                            // thương mại
      'sieu', 'thi',                              // siêu thị
      'cho', 'dem',                               // chợ, chợ đêm
      'nha', 'hang',                              // nhà hàng
      'quan', 'an', 'uong', 'ca', 'phe',          // quán ăn, cà phê
      'du', 'lich', 'diem', 'thang', 'canh',      // du lịch, điểm, thắng cảnh
      'khach', 'san',                             // khách sạn
      'resort', 'homestay', 'hostel', 'hotel',
    ]);
    return noTonesName.split(/\s+/).every(tok => GENERIC.has(tok));
  }

  // ── Trích "điểm đến được nhắc đến" trong 1 đoạn text (cho card AI chat) ──────
  // Khớp KHÔNG phân biệt hoa/dấu, cả tên đầy đủ lẫn lõi tên; lọc theo TỈNH NGỮ CẢNH
  // (có alias TP.HCM/Sài Gòn...) để KHÔNG hiện card sai tỉnh. Trả về dạng card frontend.
  async extractMentionedDestinations(text, limit = 10, question = '') {
    if (!text) return [];
    // Câu hỏi NGOÀI LỀ (kiến thức chung / hành chính, vd "Việt Nam có bao nhiêu tỉnh",
    // "Trà Vinh còn không") → AI chỉ liệt kê tên tỉnh/thành chứ không gợi ý điểm đến.
    // Bỏ qua trích card để tránh hiện "Điểm đến được nhắc đến" sai ngữ cảnh.
    if (question && this.isGeneralKnowledgeQuery(question)) return [];
    // AI HỎI NGƯỢC để chọn địa phương ("...ở tỉnh/thành nào?", "khu vực nào?") → đây mới là
    // bước LÀM RÕ bằng văn xuôi, chưa gợi ý điểm đến cụ thể (chỉ liệt kê tỉnh cho user chọn).
    // Nếu trích sẽ vớ phải record cấp tỉnh (vd placeholder "Vĩnh Long" rating 0) tình cờ trùng
    // 1 tỉnh trong danh sách → hiện 1 card lẻ, sai ngữ cảnh. Bỏ qua tới khi user chốt tỉnh.
    if (this.isLocationChoicePrompt(text)) return [];
    const docs = await this.getDestinationsLite();
    const noTonesText = this.removeVietnameseTones(text);
    // Cặp song song (bỏ dấu ‖ giữ dấu) để khớp tên địa danh CÓ XÁC THỰC DẤU — chặn kiểu
    // "nhà hàng trong resort" (→ "hang trong") khớp nhầm "Hang Trống" (Quảng Ninh).
    const textPair = this.toneAlignedLower(text);

    // Bỏ tiền tố hành chính ("TP.", "Tỉnh", "Thành phố") — DB lưu "TP. Hồ Chí Minh" nhưng
    // người dùng gõ tên trần "Hồ Chí Minh"/lõi tên địa danh cũng ra "ho chi minh" KHÔNG
    // tiền tố. Dùng CHUNG cho cả bước nhận ngữ cảnh tỉnh (dưới) lẫn cityNormSet (dưới nữa)
    // để tránh lệch chuẩn hoá ở bất kỳ chỗ nào so sánh với city gốc.
    const stripAdminPrefix = (s) => s.replace(/^(tp\.?\s+|thanh pho\s+|tinh\s+)/, '');

    // 1) Tỉnh ngữ cảnh: city xuất hiện trực tiếp trong text (khớp theo TỪ, không substring).
    //    So cả bản city gốc lẫn bản đã bỏ tiền tố — text thường gõ tên trần ("Hồ Chí Minh")
    //    chứ không kèm "TP." nên nếu chỉ so bản gốc sẽ KHÔNG nhận ra ngữ cảnh, khiến câu hỏi
    //    du lịch HCM hợp lệ rơi vào nhánh "không ngữ cảnh" (list lẫn địa danh tỉnh khác).
    const ctxCities = new Set();
    for (const d of docs) {
      if (!d._nc || d._nc.length < 4) continue;
      const ncStripped = stripAdminPrefix(d._nc);
      if (this.containsWord(noTonesText, d._nc) ||
          (ncStripped.length >= 4 && this.containsWord(noTonesText, ncStripped))) {
        ctxCities.add(d.location.city);
      }
    }
    // 1b) Alias tỉnh (text viết tắt khác với tên DB)
    const aliasGroups = [
      { pats: ['hcm', 'tphcm', 'tp.hcm', 'sai gon'], frag: 'ho chi minh' },
      { pats: ['vung tau'], frag: 'vung tau' },
    ];
    const hitFrags = aliasGroups.filter(g => g.pats.some(p => noTonesText.includes(p))).map(g => g.frag);
    if (hitFrags.length) {
      for (const d of docs) {
        if (d._nc && hitFrags.some(f => d._nc.includes(f))) ctxCities.add(d.location.city);
      }
    }

    // Tập tên tỉnh/thành (chuẩn hoá, đã bỏ tiền tố) — để loại "lõi tên" trùng tên tỉnh
    // (vd "da nang"), tránh khớp/mở rộng tràn lan ra mọi địa danh trong tỉnh khi text
    // nhắc tới NGƯỜI "Hồ Chí Minh" (trùng tên tỉnh) dù không liên quan du lịch.
    const cityNormSet = new Set(docs.map(d => stripAdminPrefix(d._nc || '')).filter(Boolean));

    // 2) Khớp TRỰC TIẾP theo RANH GIỚI TỪ (không substring thô): tên đầy đủ trong text,
    //    HOẶC lõi tên (≥5 ký tự, KHÔNG phải tên tỉnh). Tên 1 TỪ trùng từ thông dụng tiếng
    //    Việt (Thành/Một/Mộc/Gió...) bị loại trừ trừ khi có tỉnh ngữ cảnh khớp đúng — vì
    //    chúng cực dễ false-positive (vd "thành phố" → khớp nhầm địa điểm tên "Thành").
    const fullNameMatchIds = new Set();
    const directMatches = docs.filter(d => {
      if (!d._nn || d._nn.length < 4) return false;
      if ((this.isAmbiguousShortName(d._nn) || this.isGenericPlaceName(d._nn)) && !ctxCities.has(d.location?.city)) return false;
      // Khớp TÊN ĐẦY ĐỦ (proper name xuất hiện y nguyên) → chính xác cao, đánh dấu để bước 3
      // KHÔNG loại nhầm dù tỉnh khác ngữ cảnh (vd lịch trình Hạ Long có câu "đi từ Hà Nội" →
      // "Hà Nội" thành ngữ cảnh, nhưng "Vịnh Hạ Long" vẫn phải hiện vì được nhắc đích danh).
      if (this.containsWordToneAware(textPair, d._nn, d._nnT)) { fullNameMatchIds.add(String(d._id)); return true; }
      // Khớp theo LÕI tên (bỏ tiền tố loại hình) — lỏng hơn, dễ trùng tên chéo tỉnh → vẫn siết
      // theo tỉnh ngữ cảnh ở bước 3.
      return d._core.length >= 5 && !cityNormSet.has(d._core) &&
        this.containsWordToneAware(textPair, d._core, d._coreT);
    });

    // 2b) Cụm địa danh "chắc chắn có trong text" (bỏ cụm trùng tên tỉnh) → để mở rộng sang
    //     địa danh CÙNG TÊN trong tỉnh ngữ cảnh mà tên DB dài hơn (vd "Suối Tiên" + HCM →
    //     "Công viên văn hóa Suối Tiên").
    const phrases = [...new Set(directMatches.map(d => d._core)
      .filter(p => p.length >= 5 && !cityNormSet.has(p)))];

    // 3) Chọn kết quả:
    //  - Có tỉnh ngữ cảnh → giữ khớp TÊN ĐẦY ĐỦ (dù tỉnh khác, vì được nhắc đích danh) + khớp
    //    theo lõi/mở rộng ĐÚNG tỉnh ngữ cảnh. (Tránh việc 1 city nhắc thoáng qua — vd điểm xuất
    //    phát "từ Hà Nội" — nuốt mất điểm đến chính có tên riêng rõ ràng.)
    //  - Không có ngữ cảnh → giữ các khớp trực tiếp (best-effort, có thể gồm nhiều tỉnh).
    let result;
    if (ctxCities.size > 0) {
      // Mở rộng theo cụm — CHỈ với cụm ĐỦ ĐẶC TRƯNG (khớp ≤3 địa danh trong tỉnh ngữ cảnh).
      // Cụm chung chung như "bãi biển" khớp quá nhiều → bỏ qua để không "nổ" card.
      const expanded = [];
      for (const p of phrases) {
        const hits = docs.filter(d => d._nn && ctxCities.has(d.location?.city) && this.containsWord(d._nn, p));
        if (hits.length <= 3) expanded.push(...hits);
      }
      const kept = directMatches.filter(d =>
        fullNameMatchIds.has(String(d._id)) || ctxCities.has(d.location?.city));
      result = [...kept, ...expanded];
    } else {
      result = directMatches;
    }

    // 4) Ưu tiên rating cao, khử trùng theo _id, giới hạn
    const ranked = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const seen = new Set();
    const out = [];
    for (const d of ranked) {
      const id = String(d._id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        _id: id, name: d.name, images: d.images || [], location: d.location,
        category: d.category, rating: d.rating, priceRange: d.priceRange, description: d.description,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  // ── Lấy context người dùng ─────────────────────────────────────────────────
  async getUserContext(userId) {
    try {
      const user = await User.findById(userId)
        .populate('savedDestinations', 'name location category priceRange');
      
      const itineraries = await Itinerary.find({ user: userId })
        .populate('destinations.destination', 'name location category')
        .sort({ createdAt: -1 })
        .limit(3);

      let context = '';

      if (user?.preferences) {
        const { travelStyle, budget, interests } = user.preferences;
        if (travelStyle?.length) context += `\n- Phong cách du lịch yêu thích: ${travelStyle.join(', ')}`;
        if (budget) context += `\n- Ngân sách: ${budget === 'low' ? 'Tiết kiệm' : budget === 'medium' ? 'Trung bình' : 'Cao cấp'}`;
        if (interests?.length) context += `\n- Sở thích: ${interests.join(', ')}`;
      }

      if (user?.savedDestinations?.length) {
        const savedNames = user.savedDestinations.map(d =>
          `${d.name} (${d.location?.city || ''}, ${d.category})`
        ).join(', ');
        context += `\n- Địa điểm đã lưu: ${savedNames}`;
      }

      if (itineraries.length) {
        const itinInfo = itineraries.map(it => {
          const dests = it.destinations.map(d => d.destination?.name).filter(Boolean).join(', ');
          return `"${it.title}" (${dests})`;
        }).join('; ');
        context += `\n- Lịch trình đã tạo: ${itinInfo}`;
      }

      return context;
    } catch (error) {
      console.error('Error getting user context:', error);
      return '';
    }
  }

  // ── Lấy public itineraries phù hợp với query của user ─────────────────────
  async getPublicItineraries(queryText) {
    try {
      // Map từ khoá → category destination
      const categoryMap = {
        biển: 'beach', núi: 'mountain', thành: 'city', lịch: 'historical',
        văn: 'culture', chùa: 'temple', vui: 'amusement', đảo: 'beach',
      };
      let destFilter = {};
      const lowerQ = queryText.toLowerCase();
      for (const [kw, cat] of Object.entries(categoryMap)) {
        if (lowerQ.includes(kw)) { destFilter.category = cat; break; }
      }

      // Lấy destination IDs phù hợp nếu có filter
      let destIds = null;
      if (destFilter.category) {
        const matchDests = await Destination.find(destFilter).select('_id').limit(50);
        destIds = matchDests.map(d => d._id);
      }

      const filter = { isPublic: true };
      if (destIds?.length) filter['destinations.destination'] = { $in: destIds };

      const itineraries = await Itinerary.find(filter)
        .populate('destinations.destination', 'name location category')
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      if (!itineraries.length) return null;

      return itineraries.map(it => {
        const dests = it.destinations.map(d => d.destination?.name).filter(Boolean).join(', ');
        const days = it.startDate && it.endDate
          ? Math.max(1, Math.ceil((new Date(it.endDate) - new Date(it.startDate)) / 86400000))
          : '?';
        const budget = it.budget?.estimated
          ? ` | Ngân sách: ${it.budget.estimated.toLocaleString('vi-VN')}đ`
          : '';
        return `• "${it.title}" (${days} ngày) — ${dests}${budget}`;
      }).join('\n');
    } catch (err) {
      console.error('Error getting public itineraries:', err);
      return null;
    }
  }

  // Câu hỏi tra cứu SỰ KIỆN/THÔNG TIN cụ thể (giá vé, giờ mở cửa, khoảng cách, "là gì"...)
  // → nên tra web để trả lời chính xác, kể cả khi địa điểm có trong DB.
  isFactualQuery(text) {
    if (!text) return false;
    const t = text.toLowerCase();
    const noTones = this.removeVietnameseTones(text);
    const patterns = [
      'giá vé', 'gia ve', 'vé vào', 've vao', 'phí vào', 'phi vao', 'giá phòng', 'gia phong',
      'bao nhiêu tiền', 'bao nhieu tien', 'mấy giờ', 'may gio', 'mở cửa', 'mo cua', 'đóng cửa', 'dong cua',
      'giờ mở', 'gio mo', 'bao xa', 'khoảng cách', 'khoang cach', 'cách bao', 'cach bao',
      'thời tiết', 'thoi tiet', 'nhiệt độ', 'nhiet do', 'là gì', 'la gi', 'là ai', 'la ai', 'ai là', 'ai la',
      'khi nào', 'khi nao', 'năm nào', 'nam nao', 'lịch sử', 'lich su', 'sự kiện', 'su kien', 'tin tức', 'tin tuc',
      'số điện thoại', 'so dien thoai', 'địa chỉ', 'dia chi', 'website', 'hotline', 'dân số', 'dan so',
      'diện tích', 'dien tich', 'cao bao nhiêu', 'cao bao nhieu', 'rộng bao nhiêu', 'rong bao nhieu',
      // chi phí / miễn phí / thực tế
      'free', 'miễn phí', 'mien phi', 'mất phí', 'mat phi', 'tốn tiền', 'ton tien', 'có phí', 'co phi',
      'tính phí', 'tinh phi', 'có mất', 'co mat', 'mất tiền', 'mat tien', 'có tốn', 'co ton',
      'an toàn', 'an toan', 'có nên', 'co nen', 'đặt vé', 'dat ve', 'đặt phòng', 'dat phong',
      'gửi xe', 'gui xe', 'đỗ xe', 'do xe', 'di chuyển', 'di chuyen', 'phương tiện', 'phuong tien',
      'review', 'đánh giá', 'danh gia', 'mùa nào', 'mua nao', 'tháng nào', 'thang nao',
    ];
    return patterns.some(p => t.includes(p) || noTones.includes(p));
  }

  // Câu hỏi về MÓN ĂN / đặc sản (gồm cả hỏi thêm "còn món nào", "món khác")
  isFoodQuestion(text) {
    if (!text) return false;
    const noTones = this.removeVietnameseTones(text);
    return /an gi|an cai gi|cai gi an|an thu gi|mon gi|mon nao|mon an|mon khac|con mon|them mon|mon ngon|dac san|an mon|an them|quan an|an o dau|am thuc|do an|an vat|an uong|nau gi|co mon/.test(noTones);
  }

  // Câu hỏi tìm ĐỊA ĐIỂM ăn/ở/uống CỤ THỂ (quán ăn, nhà hàng, khách sạn, cafe, quán nhậu...)
  // → cần tra Google Local để lấy TÊN + ⭐đánh giá + địa chỉ thật (DB không lưu loại cơ sở này).
  // Khác isFoodQuestion (hỏi MÓN ăn/đặc sản): đây là hỏi CHỖ. LƯU Ý bỏ dấu: "quan" trùng
  // "quan tâm/cơ quan/quan trọng" → KHÔNG dùng 'quan' trần, chỉ dùng cụm đặc trưng.
  isVenueQuery(text) {
    if (!text) return false;
    const nq = this.removeVietnameseTones(text);
    // Loại hình cơ sở (danh từ chỉ quán/chỗ) — cụm đủ đặc trưng để không false-positive
    const venueTypes = [
      'quan an', 'nha hang', 'khach san', 'quan cafe', 'quan ca phe', 'ca phe', 'cafe', 'coffee',
      'quan nhau', 'quan bar', 'rooftop', 'resort', 'homestay', 'nha nghi', 'quan oc', 'quan lau',
      'quan nuong', 'quan hai san', 'hai san', 'buffet', 'tra sua', 'quan che', 'quan bun',
      'quan pho', 'quan com', 'quan chay', 'quan an vat', 'diem an uong', 'do uong',
      // "quán" + tính từ/nghi vấn (đã bỏ dấu) — người dùng hay hỏi kiểu này
      'quan nao', 'quan re', 'quan ngon', 'quan mac', 'quan gan', 'quan dep', 'quan sang',
      'quan binh dan', 'quan view', 'quan ven bien',
    ];
    if (venueTypes.some(t => nq.includes(t))) return true;
    // "chỗ/nơi/địa điểm ăn/ở/uống" hoặc "ăn/ngủ/nghỉ ở đâu"
    return /(cho|noi|dia diem) (an|o|uong|nghi|luu tru|check.?in)/.test(nq)
      || /(an|o|ngu|nghi|uong) o dau/.test(nq);
  }

  // Câu hỏi KIẾN THỨC CHUNG / hành chính / địa lý (KHÔNG phải hỏi đi chơi) → không hiện
  // card "điểm đến được nhắc đến". Vd: "Việt Nam có bao nhiêu tỉnh", "Trà Vinh còn không",
  // "Hồ Chí Minh là ai". Nếu câu hỏi có Ý ĐỊNH DU LỊCH rõ ràng (đi đâu, chơi gì, ăn gì,
  // lịch trình, gợi ý điểm đến...) thì BỎ QUA gate này để vẫn hiện card bình thường.
  isGeneralKnowledgeQuery(text) {
    if (!text) return false;
    const noTones = this.removeVietnameseTones(text);

    // 1) Ý định du lịch rõ ràng → luôn cho hiện card (ưu tiên cao nhất)
    const travelIntent = [
      'di dau', 'choi gi', 'choi o', 'co gi choi', 'co gi an', 'tham quan', 'dia diem',
      'diem den', 'du lich', 'lich trinh', 'an gi', 'mon gi', 'mon nao', 'dac san',
      'an o dau', 'quan an', 'am thuc', 'goi y', 'de xuat', 'nghi duong', 'khach san',
      'homestay', 'resort', 'check in', 'song ao', 'canh dep', 'view dep', 'bai bien',
      'bien dep', 'co bien', 'nen di', 'ghe tham', 'kham pha', 'phuot', 'vui choi',
      'giai tri', 'cho nao dep', 'noi nao dep',
    ];
    if (travelIntent.some(k => noTones.includes(k))) return false;

    // 2) Dấu hiệu kiến thức chung / hành chính / địa lý
    const generalKnowledge = [
      'bao nhieu tinh', 'bao nhieu thanh pho', 'bao nhieu don vi', 'bao nhieu huyen',
      'don vi hanh chinh', 'cap tinh', 'sap nhap', 'con khong', 'con ton tai', 'doi ten',
      'truc thuoc', 'thuoc tinh nao', 'thuoc mien nao', 'nam o dau', 'o mien nao',
      'giap voi', 'tiep giap', 'la gi', 'la ai', 'ai la', 'dan so', 'dien tich',
      'thu do', 'lich su', 'thanh lap', 'nam nao', 'the ky', 'ma vung', 'bien so',
      'quoc khanh', 'dan toc', 'ngon ngu', 'tien te', 'gdp', 'co tu khi nao', 'tu nam',
    ];
    return generalKnowledge.some(k => noTones.includes(k));
  }

  // ── AI hỏi ngược chọn địa phương? (disambiguation bằng văn xuôi) ─────────────
  // Vd "Bạn muốn tìm bánh xèo ở tỉnh/thành nào?" — model liệt kê nhiều tỉnh cho user chọn
  // thay vì gợi ý 1 điểm đến. Đây KHÔNG phải câu trả lời có điểm đến → không trích card
  // (kẻo dính record cấp tỉnh trùng tên 1 tỉnh trong danh sách). Bỏ dấu để né vướng \w với
  // ký tự tiếng Việt; đòi dấu "?" NGAY SAU cụm (cùng câu, không vượt . ! ? \n) để chắc là
  // câu hỏi chọn nơi, không phải câu kể vô tình chứa "tỉnh ... nào".
  isLocationChoicePrompt(text) {
    if (!text || !text.includes('?')) return false;
    const noTones = this.removeVietnameseTones(text);
    return /\b(?:tinh|thanh pho|thanh|khu vuc|vung|mien|dia phuong)\s*\/?\s*(?:tinh|thanh pho|thanh)?\s*nao\b[^.?!\n]{0,15}\?/.test(noTones);
  }

  // ── Build system prompt thông minh ─────────────────────────────────────────
  async buildSystemPrompt(messages, userId = null) {
    let systemPrompt = SYSTEM_PROMPT;

    // Detect vùng/tỉnh từ tin nhắn cuối; nếu follow-up KHÔNG nêu địa điểm → kế thừa vùng từ
    // NGỮ CẢNH các tin user gần nhất (vd hỏi "nên ăn món gì" sau khi đã nói Vũng Tàu).
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let regionInfo = lastUserMsg ? await this.detectRegionFromQuery(lastUserMsg.content) : null;
    if (!regionInfo && lastUserMsg) {
      const recentUsers = messages.filter(m => m.role === 'user').slice(-5).reverse();
      for (const m of recentUsers) {
        const r = await this.detectRegionFromQuery(m.content);
        if (r) { regionInfo = r; console.log(`[AI] Region kế thừa ngữ cảnh: ${r.region}${r.province ? ' / ' + r.province : ''}`); break; }
      }
    }
    
    if (regionInfo) {
      console.log(`[AI] Detected region: ${regionInfo.region}${regionInfo.province ? ` / ${regionInfo.province}` : ''}`);
    } else {
      console.log(`[AI] No region detected, using top-rated fallback`);
    }

    // Cập nhật hành chính 2025: nếu câu hỏi liên quan tỉnh/thành → cấp bảng đối chiếu cũ↔mới
    // để AI hiểu cả tên cũ lẫn mới (DB vẫn dùng tên cũ, không đổi dữ liệu).
    if (lastUserMsg) {
      const noTonesQ = this.removeVietnameseTones(lastUserMsg.content);
      const adminRelevant = !!regionInfo
        || MERGER_KEYWORDS.some(k => noTonesQ.includes(this.removeVietnameseTones(k)))
        || RESTRUCTURED_NAMES.some(n => noTonesQ.includes(this.removeVietnameseTones(n)));
      if (adminRelevant) {
        systemPrompt += `\n\n${MERGER_CONTEXT_BLOCK}`;
      }
    }

    // ── Phase 2: Song song TẤT CẢ query DB độc lập ─────────────────────────
    // Trước đây chạy tuần tự 5-6 await (mỗi cái 100-300ms) → cộng dồn 1-2s.
    // Giờ gom vào Promise.all để chỉ tốn thời gian của query CHẬM NHẤT.
    const needTours = detectTourSearchQuery(messages) && !!lastUserMsg;
    const tPhase2 = Date.now();

    const [
      { iconic, supporting, clusterCount },
      specialtiesList,
      userContext,
      routeInfo,
      publicTours,
    ] = await Promise.all([
      this.getFilteredDestinations(regionInfo),
      this.getFilteredSpecialties(regionInfo, lastUserMsg?.content || ''),
      userId ? this.getUserContext(userId).catch(() => '') : Promise.resolve(''),
      lastUserMsg ? routingService.processUserQuery(lastUserMsg.content).catch(() => null) : Promise.resolve(null),
      needTours ? this.getPublicItineraries(lastUserMsg.content).catch(() => null) : Promise.resolve(null),
    ]);

    console.log(`[AI-PERF] Phase 2 (parallel queries): ${Date.now() - tPhase2}ms`);

    const label = regionInfo?.province
      ? regionInfo.province
      : regionInfo?.region
      ? `vùng ${regionInfo.region}`
      : 'phổ biến nhất';

    if (iconic) {
      systemPrompt += `\n\n[ĐIỂM ĐẾN BIỂU TƯỢNG - ${label.toUpperCase()} - ĐÃ NHÓM THEO CỤM ĐỊA LÝ - ƯU TIÊN CAO]\n${iconic}`;
    }
    if (supporting) {
      systemPrompt += `\n\n[CHỖ Ở & ẨM THỰC - ${label.toUpperCase()} - Chỉ dùng để bổ sung sau khi đã gợi ý điểm tham quan biểu tượng]\n${supporting}`;
    }
    if (iconic || supporting) {
      systemPrompt += `\n\n[QUY TẮC GỢI Ý ĐIỂM ĐẾN]
- LUÔN ưu tiên các địa điểm có nhãn ⭐ICONIC trước khi gợi ý các địa điểm khác.
- KHÔNG BAO GIỜ đưa nhà hàng/quán cafe/khách sạn làm điểm tham quan chính; chỉ dùng chúng để bổ sung sau khi đã đề xuất ít nhất 2-3 điểm tham quan biểu tượng.
- Nếu user hỏi "nên đi đâu ở [tỉnh]" → liệt kê các ICONIC trước, kèm 1 dòng mô tả ngắn cho mỗi điểm.

[QUY TẮC PHÂN BỔ THEO NGÀY - QUAN TRỌNG khi tạo lịch trình nhiều ngày]
- Các điểm trong CÙNG MỘT CỤM (vd "CỤM 1") nằm gần nhau về địa lý → BẮT BUỘC gom vào CÙNG MỘT NGÀY để tiết kiệm thời gian di chuyển.
- KHÔNG ĐƯỢC tách 2 điểm trong cùng cụm ra 2 ngày khác nhau (vd KHÔNG được để Ao Bà Om ngày 1 và Chùa Âng ngày 2 nếu chúng cùng CỤM 1).
- Nếu 1 cụm có quá nhiều điểm cho 1 ngày, có thể chia thành "sáng/chiều" trong cùng ngày, hoặc chia ra 2 ngày liên tiếp.
- Số cụm hiện có: ${clusterCount || 0}. Nếu user yêu cầu N ngày mà chỉ có M cụm (M < N), hãy phân bổ mỗi cụm cho 1 ngày + thêm hoạt động bổ sung (ẩm thực, nghỉ ngơi) cho các ngày còn lại.
- Khi user yêu cầu N ngày mà M > N cụm, ưu tiên các CỤM đầu (CỤM 1, 2, ...) vì chúng chứa các điểm rank cao nhất.`;
    }

    if (specialtiesList) {
      systemPrompt += `\n\n[ĐẶC SẢN ĐỊA PHƯƠNG - Sử dụng khi hỏi về món ăn/đặc sản]\n${specialtiesList}

**CÁCH TRÌNH BÀY MÓN ĂN / ĐẶC SẢN (BẮT BUỘC tuân thủ):**
- TUYỆT ĐỐI KHÔNG dùng bảng Markdown để liệt kê món ăn (nhồi ảnh vào ô bảng sẽ vỡ giao diện).
- Mở đầu bằng 1 câu dẫn dắt ngắn (đoạn riêng). Sau đó liệt kê các món trong CÙNG MỘT đoạn văn liền mạch, KHÔNG để dòng trống giữa các món — hệ thống sẽ tự gom thành lưới thẻ đẹp.
- Mỗi món gồm 3 dòng liên tiếp (xuống dòng đơn, KHÔNG bỏ dòng trống giữa các dòng), ảnh LUÔN ở dòng đầu:
![Tên món](URL_Ảnh)
**Tên món** (Tỉnh) — Giá đúng theo danh sách
Mô tả thật ngắn (≤8 từ).
- Chỉ chèn ảnh khi danh sách có URL thật. Báo giá BẮT BUỘC ĐÚNG theo danh sách, không bịa; nếu thiếu giá ghi "đang cập nhật".
- Nếu muốn so sánh giá nhiều tỉnh, viết thành câu văn xuôi, KHÔNG dùng bảng.`;
    }

    if (userContext) {
      systemPrompt += `\n\n[THÔNG TIN NGƯỜI DÙNG - Cá nhân hóa gợi ý]${userContext}`;
    }

    if (routeInfo?.detected) {
      console.log(`[AI] Route detected: ${routeInfo.from} → ${routeInfo.to}`);
      systemPrompt += routeInfo.injectionText;
    }

    if (publicTours) {
      systemPrompt += `\n\n[TOUR / LỊCH TRÌNH CÔNG KHAI TRONG HỆ THỐNG]\n${publicTours}\n\n**HƯỚNG DẪN:** Giới thiệu các tour trên cho người dùng. Nếu người dùng muốn tour khác, đề nghị tạo lịch trình riêng.`;
    } else if (needTours) {
      systemPrompt += `\n\n[THÔNG TIN TOUR — CHƯA CÓ TOUR DỰNG SẴN]
Hệ thống chưa có tour công khai dựng sẵn phù hợp. KHÔNG bịa tour. Phản hồi theo đúng cấu trúc sau:
- Câu 1: Thông báo ngắn chưa có tour dựng sẵn, đề nghị tạo lịch trình riêng.
- Sau đó ghi đúng 5 câu hỏi RIÊNG BIỆT (đánh số 1-5), KHÔNG gộp lại:
  1. Bạn muốn đi biển ở khu vực nào (miền Bắc, miền Trung, miền Nam) hay có tỉnh/thành phố cụ thể muốn đến không?
  2. Thời gian du lịch dự kiến là bao lâu?
  3. Ngân sách dự kiến cho chuyến đi là bao nhiêu?
  4. Bạn thích hoạt động gì ở biển (tắm biển, lặn ngắm san hô, thưởng thức hải sản, tham quan các điểm đến biển nổi tiếng, v.v.)?
  5. Số người đi cùng và có yêu cầu đặc biệt nào không (ví dụ đi cùng trẻ nhỏ, người già, thích chỗ ở yên tĩnh hay sầm uất)?
TUYỆT ĐỐI không lặp lại câu trả lời ở lượt trước.`;
    }

    // Nếu user hỏi về lịch trình → thêm instruction JSON
    if (detectItineraryQuery(messages)) {
      systemPrompt += ITINERARY_JSON_INSTRUCTION;
    }

    // ── Tra Google: ĐỊA ĐIỂM ăn/ở (Google Local) HOẶC web fallback — KHÔNG bịa ──────
    if (lastUserMsg) {
      const q = lastUserMsg.content;
      const nq = this.removeVietnameseTones(q);
      const loc = regionInfo?.province || regionInfo?.region || '';
      const isTourSearch = detectTourSearchQuery(messages);

      // ── ƯU TIÊN: hỏi QUÁN ĂN / NHÀ HÀNG / KHÁCH SẠN / CAFE cụ thể → Google Local ──
      // DB chỉ có điểm tham quan (không có quán ăn/khách sạn) nên trước đây model đành trả
      // "không có trong hệ thống" rồi tư vấn chung chung. Giờ tra Google Local để đưa TÊN
      // + ⭐đánh giá + địa chỉ thật của cơ sở, model chỉ trình bày lại (không bịa).
      // GATE: bỏ qua nhánh venue nếu đang TÌM tour hoặc DỰNG LỊCH TRÌNH — nếu không, câu
      // "lịch trình 3 ngày Nha Trang có hải sản" bị isVenueQuery ('hai san') cướp sang tìm quán.
      let venueHandled = false;
      if (!isTourSearch && !detectItineraryQuery(messages) && this.isVenueQuery(q)) {
        // Giữ NGUYÊN câu người dùng (chứa tiêu chí rẻ/ngon/gần/mắc/cao cấp...) + kèm địa danh
        // ngữ cảnh nếu câu CHƯA nhắc (vd follow-up "chọn quán rẻ" sau khi đã nói Nha Trang).
        const venueQuery = loc && !nq.includes(this.removeVietnameseTones(loc)) ? `${q} ${loc}` : q;
        console.log(`[AI] Venue search for: "${venueQuery.slice(0, 70)}"`);
        let venues = null;
        try {
          venues = await searchService.searchVenues(venueQuery);
        } catch (e) {
          console.warn('[AI] Venue search error:', e.message);
        }
        venueHandled = true; // đã nhận ý định "tìm quán" → không rơi xuống nhánh web-search món ăn
        if (venues) {
          systemPrompt += `\n\n[ĐỊA ĐIỂM THỰC TỪ GOOGLE - quán ăn/nhà hàng/khách sạn/cafe... trả lời câu hỏi "quán nào"]\n${venues}\n\nHƯỚNG DẪN: Người dùng đang hỏi địa điểm ăn uống/lưu trú CỤ THỂ. Hãy giới thiệu các cơ sở ở trên (thông tin thật từ Google Maps): nêu tên, ⭐đánh giá, mức giá, địa chỉ; sắp xếp/ưu tiên theo tiêu chí người dùng nêu (rẻ/ngon/gần/cao cấp/2 người ~1 triệu...). Có thể kèm link. TUYỆT ĐỐI KHÔNG bịa tên quán ngoài danh sách; nếu chưa khớp tiêu chí thì nói rõ và tư vấn cách chọn. Nhắc ngắn rằng giá/đánh giá có thể thay đổi, nên xác nhận trước khi đến.`;
        } else {
          systemPrompt += `\n\n[LƯU Ý] Người dùng hỏi địa điểm ăn uống/lưu trú nhưng tìm kiếm Google không có kết quả. Hãy tư vấn TIÊU CHÍ chọn quán (khu vực, tầm giá, loại món, hỏi giá trước khi gọi) — TUYỆT ĐỐI KHÔNG bịa tên quán cụ thể.`;
        }
      }

      // ── Web search fallback: câu hỏi NGOÀI dữ liệu hệ thống → tra Google, KHÔNG bịa ──
      // Kích hoạt khi: (a) hỏi sự kiện/giá/giờ... cụ thể, HOẶC (b) DB không có gì để trả lời.
      if (!venueHandled) {
        const isFactual = this.isFactualQuery(q);
        // User nêu một địa điểm cụ thể NHƯNG không resolve được vùng/tỉnh → tra web để liệt kê.
        const placeRaw = this.extractPlaceCandidate(q);
        const candidate = this.removeVietnameseTones(placeRaw);
        const placeUnresolved = !regionInfo && candidate.length >= 4 && !this.isGenericPlaceWord(candidate);
        // Hỏi món ăn: tra web khi DB KHÔNG có đặc sản, HOẶC user muốn THÊM (còn/khác/nữa) ngoài
        // danh sách DB (vd "còn món nào nữa không").
        const isFood = this.isFoodQuestion(q);
        const wantsMore = /\b(con|them|khac|nua|ngoai ra)\b/.test(nq);
        const foodNeedsWeb = isFood && (!specialtiesList || wantsMore);
        // Catch-all: câu hỏi YES/NO / chi tiết trong ngữ cảnh 1 tỉnh, KHÔNG phải hỏi điểm đến/
        // lịch trình/món ăn → DB không lưu loại chi tiết này (free, an toàn, đi lại...) → tra web.
        const isQuestion = /\?|không|hông|\bko\b|chưa|nhỉ|hả/.test(q) || /\bkhong\b|\bhong\b/.test(nq);
        const isDestOrItin = detectItineraryQuery(messages) || /co gi|gi choi|di dau|diem den|nen di|choi gi|tham quan|ngam canh/.test(nq);
        const detailFollowup = !!regionInfo && isQuestion && !isDestOrItin && !isFood;
        const shouldSearch = !isTourSearch && (isFactual || placeUnresolved || foodNeedsWeb || detailFollowup);

        if (shouldSearch) {
          // Tinh chỉnh truy vấn theo loại câu hỏi để lấy đúng thông tin thực tế.
          let searchQuery;
          if (foodNeedsWeb) {
            searchQuery = loc ? `đặc sản ${loc} ăn món gì ngon nổi tiếng` : lastUserMsg.content;
          } else if (placeUnresolved && !isFactual) {
            searchQuery = `${placeRaw} du lịch giá vé giờ mở cửa địa chỉ`;
          } else if (loc) {
            // Câu hỏi chi tiết trong ngữ cảnh 1 tỉnh → kèm tên tỉnh để Google ra đúng nơi
            // (vd "biển ở đây tắm free hông" → "biển ở đây tắm free hông vũng tàu").
            searchQuery = `${lastUserMsg.content} ${loc}`;
          } else {
            searchQuery = lastUserMsg.content;
          }
          console.log(`[AI] Web search triggered (factual=${isFactual}, placeUnresolved=${placeUnresolved}) for: "${searchQuery.slice(0, 70)}"`);
          let webResults = null;
          try {
            webResults = await searchService.webSearch(searchQuery);
          } catch (e) {
            console.warn('[AI] Web search error:', e.message);
          }
          if (webResults) {
            systemPrompt += `\n\n[KẾT QUẢ TÌM KIẾM WEB - dùng để trả lời CHÍNH XÁC câu hỏi nằm ngoài dữ liệu hệ thống]\n${webResults}\n\nHƯỚNG DẪN: Trả lời dựa trên các kết quả tìm kiếm web ở trên (thông tin thực tế từ Google), trích nguồn (link) khi phù hợp. Nếu kết quả vẫn chưa đủ chắc chắn, hãy nói rõ "Mình chưa tìm thấy thông tin chắc chắn về vấn đề này" — TUYỆT ĐỐI KHÔNG bịa.`;
          } else {
            systemPrompt += `\n\n[LƯU Ý] Câu hỏi này nằm ngoài dữ liệu hệ thống và tìm kiếm web không trả về kết quả. Nếu không chắc chắn, hãy nói rõ bạn chưa có thông tin chính xác và đề nghị người dùng kiểm tra nguồn chính thống — TUYỆT ĐỐI KHÔNG bịa.`;
          }
        }
      }
    }

    return systemPrompt;
  }

  // ── Chat streaming ──────────────────────────────────────────────────────────
  async chat(messages, onChunk, userId = null) {
    const t0 = Date.now();
    const systemPrompt = await this.buildSystemPrompt(messages, userId);
    console.log(`[AI-PERF] buildSystemPrompt: ${Date.now() - t0}ms`);

    // Sliding window: chỉ gửi MAX_CHAT_WINDOW message cuối lên model.
    // buildSystemPrompt đã inject context quan trọng (vùng, điểm đến, sở thích...)
    const trimmed = messages.length > MAX_CHAT_WINDOW ? messages.slice(-MAX_CHAT_WINDOW) : messages;
    if (messages.length > MAX_CHAT_WINDOW) {
      console.log(`[AI-PERF] Trimmed ${messages.length} → ${trimmed.length} messages (window=${MAX_CHAT_WINDOW})`);
    }
    const allMessages = [{ role: 'system', content: systemPrompt }, ...trimmed];
    const params = { messages: allMessages, stream: true, max_tokens: MAX_TOKENS, temperature: 0.4, top_p: 0.9 };

    const preferredProvider = process.env.AI_PROVIDER || 'nvidia';
    let client, model, provider;

    if (preferredProvider === 'gpt55') {
      // Primary: GPT-5.5 (highwayapi.ai) → fallback: nvidia step3.7 → nvidia minimax
      try {
        model = GPT55_MODEL; provider = 'gpt55';
        const stream = await gpt55Create(withModel(params, model));
        console.log(`[AI-PERF] ${provider} (${model}) stream open: ${Date.now() - t0}ms`);
        return await this._consumeStream(stream, onChunk, t0);
      } catch (err) {
        console.warn(`[AI] ${model} failed (${err.message}), falling back to nvidia step3.7`);
        try {
          client = nvidiaClient; model = NVIDIA_MODEL_PRIMARY; provider = 'nvidia-step3.7';
          const stream = await client.chat.completions.create(withModel(params, model));
          console.log(`[AI-PERF] ${provider} (${model}) stream open: ${Date.now() - t0}ms`);
          return await this._consumeStream(stream, onChunk, t0);
        } catch (err2) {
          console.warn(`[AI] ${model} failed (${err2.message}), falling back to nvidia minimax`);
          client = nvidiaClient; model = NVIDIA_MODEL_FALLBACK; provider = 'nvidia-minimax';
          const stream = await client.chat.completions.create(withModel(params, model));
          console.log(`[AI-PERF] ${provider} (${model}) stream open: ${Date.now() - t0}ms`);
          return await this._consumeStream(stream, onChunk, t0);
        }
      }
    } else if (preferredProvider === 'nvidia') {
      // Try step-3.7-flash first
      try {
        client = nvidiaClient; model = NVIDIA_MODEL_PRIMARY; provider = 'nvidia-step3.7';
        const stream = await client.chat.completions.create(withModel(params, model));
        console.log(`[AI-PERF] ${provider} (${model}) stream open: ${Date.now() - t0}ms`);
        return await this._consumeStream(stream, onChunk, t0);
      } catch (err) {
        console.warn(`[AI] ${model} failed (${err.message}), falling back to minimax`);
        // Try minimax fallback
        try {
          client = nvidiaClient; model = NVIDIA_MODEL_FALLBACK; provider = 'nvidia-minimax';
          const stream = await client.chat.completions.create(withModel(params, model));
          console.log(`[AI-PERF] ${provider} (${model}) stream open: ${Date.now() - t0}ms`);
          return await this._consumeStream(stream, onChunk, t0);
        } catch (err2) {
          console.warn(`[AI] ${model} failed (${err2.message}), falling back to opencode`);
          client = opencodeClient; model = OPENCODE_MODEL; provider = 'opencode';
          const stream = await client.chat.completions.create(withModel(params, model));
          console.log(`[AI-PERF] ${provider} stream open: ${Date.now() - t0}ms`);
          return await this._consumeStream(stream, onChunk, t0);
        }
      }
    } else {
      try {
        client = opencodeClient; model = OPENCODE_MODEL; provider = 'opencode';
        const stream = await client.chat.completions.create(withModel(params, model));
        console.log(`[AI-PERF] ${provider} stream open: ${Date.now() - t0}ms`);
        return await this._consumeStream(stream, onChunk, t0);
      } catch (err) {
        console.warn(`[AI] ${provider} failed (${err.message}), falling back to NVIDIA`);
        client = nvidiaClient; model = NVIDIA_MODEL_PRIMARY; provider = 'nvidia-step3.7';
        const stream = await client.chat.completions.create(withModel(params, model));
        console.log(`[AI-PERF] ${provider} stream open: ${Date.now() - t0}ms`);
        return await this._consumeStream(stream, onChunk, t0);
      }
    }
  }

  async _consumeStream(stream, onChunk, t0) {
    let fullResponse = '', isReasoning = false, firstChunk = false, chunks = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (!firstChunk) { firstChunk = true; console.log(`[AI-PERF] TTFT: ${Date.now() - t0}ms`); }
      chunks++;

      // Handle reasoning_content (for models like step-3.7-flash)
      const reasoning = delta.reasoning_content;
      if (reasoning) {
        if (!isReasoning) { if (onChunk) onChunk('<think>\n'); fullResponse += '<think>\n'; isReasoning = true; }
        if (onChunk) onChunk(reasoning); fullResponse += reasoning;
      }

      // Handle regular content
      const content = delta.content || '';
      if (content) {
        if (isReasoning) { if (onChunk) onChunk('\n</think>\n'); fullResponse += '\n</think>\n'; isReasoning = false; }
        if (onChunk) onChunk(content); fullResponse += content;
      }
    }
    if (isReasoning) { if (onChunk) onChunk('\n</think>\n'); fullResponse += '\n</think>\n'; }
    console.log(`[AI-PERF] Total: ${Date.now() - t0}ms | chunks: ${chunks} | len: ${fullResponse.length}`);
    return fullResponse;
  }

  // ── Chat non-streaming ──────────────────────────────────────────────────────
  async chatComplete(messages, userId = null) {
    const systemPrompt = await this.buildSystemPrompt(messages, userId);
    // Sliding window: chỉ gửi MAX_CHAT_WINDOW message cuối lên model
    const trimmed = messages.length > MAX_CHAT_WINDOW ? messages.slice(-MAX_CHAT_WINDOW) : messages;
    if (messages.length > MAX_CHAT_WINDOW) {
      console.log(`[AI-PERF] Trimmed ${messages.length} → ${trimmed.length} messages (window=${MAX_CHAT_WINDOW})`);
    }
    const allMessages = [{ role: 'system', content: systemPrompt }, ...trimmed];
    const params = { messages: allMessages, stream: false, max_tokens: MAX_TOKENS, temperature: 0.4, top_p: 0.9 };
    const preferredProvider = process.env.AI_PROVIDER || 'nvidia';

    if (preferredProvider === 'gpt55') {
      // Primary: GPT-5.5 → fallback: nvidia step3.7 → nvidia minimax
      try {
        const res = await gpt55Create(withModel(params, GPT55_MODEL));
        return res.choices[0]?.message?.content || 'Không có phản hồi';
      } catch (err) {
        console.warn(`[AI] ${GPT55_MODEL} failed (${err.message}), falling back to nvidia step3.7`);
        try {
          const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_PRIMARY));
          const content = res.choices[0]?.message?.content;
          const reasoning = res.choices[0]?.message?.reasoning_content;
          return content || reasoning || 'Không có phản hồi';
        } catch (err2) {
          console.warn(`[AI] ${NVIDIA_MODEL_PRIMARY} failed (${err2.message}), falling back to nvidia minimax`);
          const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_FALLBACK));
          return res.choices[0]?.message?.content || 'Không có phản hồi';
        }
      }
    } else if (preferredProvider === 'nvidia') {
      // Try step-3.7-flash first
      try {
        const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_PRIMARY));
        const content = res.choices[0]?.message?.content;
        const reasoning = res.choices[0]?.message?.reasoning_content;
        // step-3.7 trả cả reasoning_content (<think>) lẫn content; với reasoning_effort='low'
        // content là câu trả lời thật → ưu tiên content, chỉ fallback reasoning nếu content rỗng.
        return content || reasoning || 'Không có phản hồi';
      } catch (err) {
        console.warn(`[AI] ${NVIDIA_MODEL_PRIMARY} failed (${err.message}), falling back to minimax`);
        // Try minimax fallback
        try {
          const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_FALLBACK));
          return res.choices[0]?.message?.content || 'Không có phản hồi';
        } catch (err2) {
          console.warn(`[AI] ${NVIDIA_MODEL_FALLBACK} failed (${err2.message}), falling back to opencode`);
          const res = await opencodeClient.chat.completions.create(withModel(params, OPENCODE_MODEL));
          return res.choices[0]?.message?.content || 'Không có phản hồi';
        }
      }
    } else {
      try {
        const res = await opencodeClient.chat.completions.create(withModel(params, OPENCODE_MODEL));
        return res.choices[0]?.message?.content || 'Không có phản hồi';
      } catch (err) {
        console.warn(`[AI] opencode failed (${err.message}), falling back to NVIDIA`);
        const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_PRIMARY));
        const content = res.choices[0]?.message?.content;
        const reasoning = res.choices[0]?.message?.reasoning_content;
        return content || reasoning || 'Không có phản hồi';
      }
    }
  }

  // ── Gợi ý lịch trình ───────────────────────────────────────────────────────
  async suggestItinerary(destination, days, budget, interests) {
    const prompt = `Hãy tạo lịch trình du lịch ${destination} trong ${days} ngày với ngân sách ${budget}. 
Sở thích: ${interests.join(', ')}.
Hãy đưa ra lịch trình chi tiết theo từng ngày, bao gồm:
- Địa điểm tham quan
- Nhà hàng/quán ăn gợi ý
- Khách sạn phù hợp ngân sách
- Chi phí ước tính cho mỗi hoạt động`;
    return this.chatComplete([{ role: 'user', content: prompt }]);
  }

  // ── Gợi ý điểm đến ────────────────────────────────────────────────────────
  async suggestDestinations(preferences) {
    const { travelStyle, budget, interests, duration } = preferences;
    const prompt = `Dựa trên sở thích sau, hãy gợi ý 5 điểm đến du lịch phù hợp tại Việt Nam:
- Loại hình: ${travelStyle?.join(', ') || 'đa dạng'}
- Ngân sách: ${budget || 'trung bình'}
- Sở thích: ${interests?.join(', ') || 'khám phá'}
- Thời gian: ${duration || '3-5 ngày'}`;
    return this.chatComplete([{ role: 'user', content: prompt }]);
  }

  // ── Hỏi về điểm đến cụ thể ───────────────────────────────────────────────
  async askAboutDestination(destination, question) {
    return this.chatComplete([{ role: 'user', content: `Về điểm đến ${destination}: ${question}` }]);
  }

  // ── Tạo tour cộng đồng bằng AI (cho admin) ───────────────────────────────
  // Trả về object tour DRAFT (chưa có ảnh, chưa lưu DB). Route admin sẽ fill ảnh
  // qua Serper rồi cho admin review trước khi lưu.
  async generateTour(answers = {}) {
    const sys = `Bạn là chuyên gia thiết kế tour du lịch Việt Nam. Dựa trên yêu cầu của admin, hãy tạo MỘT tour hoàn chỉnh.

QUY TẮC BẮT BUỘC:
- ƯU TIÊN TUYỆT ĐỐI chọn trạm từ "DANH SÁCH ĐIỂM ĐẾN CÓ THẬT" cung cấp bên dưới, và PHẢI dùng ĐÚNG toạ độ [lat,lng] kèm theo mỗi điểm.
- BẮT BUỘC đưa vào tour những điểm NỔI TIẾNG / BIỂU TƯỢNG nhất của khu vực nếu chúng có trong danh sách (vd các địa danh đứng đầu danh sách).
- TUYỆT ĐỐI KHÔNG bịa toạ độ. Nếu một điểm KHÔNG có trong danh sách và bạn không chắc chắn toạ độ thật, ĐỪNG thêm điểm đó.
- MỌI trạm phải nằm ĐÚNG khu vực/tỉnh được yêu cầu — KHÔNG đưa điểm ở tỉnh khác.
- Số trạm hợp lý theo số ngày (khoảng 2-4 trạm/ngày).
- Mọi nội dung văn bản bằng tiếng Việt.
- Trả về DUY NHẤT một object JSON hợp lệ. KHÔNG kèm giải thích, KHÔNG markdown, KHÔNG dấu \`\`\`.

ĐỊNH DẠNG JSON (đúng tên field, KHÔNG thêm field ảnh — hệ thống tự lấy ảnh):
{
  "title": "tiêu đề hấp dẫn",
  "description": "mô tả 2-3 câu",
  "duration": "vd '3 ngày 2 đêm'",
  "days": number,
  "category": "một trong: Biển, Núi, Di sản, Thành phố, Sinh thái, Đảo, Văn hóa",
  "categoryIcon": "1 emoji",
  "region": "vd 'Miền Trung', 'Tây Nam Bộ'",
  "priceRange": "budget | mid-range | luxury",
  "priceLabel": "vd '5.500.000 ₫'",
  "rating": number (4.0-5.0),
  "reviewCount": number (50-600),
  "tags": ["4 thẻ ngắn"],
  "highlights": ["4 điểm nhấn"],
  "badge": "nhãn ngắn kèm emoji, vd '🔥 Phổ biến'",
  "badgeColor": "class tailwind, vd 'bg-red-500'",
  "author": "tên người tạo",
  "authorAvatar": "2 chữ cái viết tắt",
  "completedDate": "vd '04/2026'",
  "stops": [
    { "name": "...", "city": "...", "category": "beach|mountain|nature|heritage|city|island|countryside", "rating": number, "description": "mô tả ngắn", "coordinates": { "lat": number, "lng": number } }
  ],
  "reviews": [
    { "name": "...", "avatar": "2 chữ", "date": "vd '03/2026'", "rating": number, "text": "review chân thực", "helpful": number }
  ]
}
Tạo 2-3 review mẫu chân thực.`;

    // ── Neo dữ liệu: nạp điểm đến CÓ THẬT từ DB (đồ án tập trung Trà Vinh + Bến Tre) ──
    const Destination = require('../models/Destination');
    const optimizeService = require('./optimizeService');

    const norm = (s) => String(s || '').toLowerCase().trim();
    // Model lưu toạ độ ở location.coordinates; fallback top-level coordinates nếu có.
    const getCoords = (d) => {
      const c = (d?.location?.coordinates && typeof d.location.coordinates.lat === 'number')
        ? d.location.coordinates : d?.coordinates;
      return (c && typeof c.lat === 'number' && typeof c.lng === 'number') ? { lat: c.lat, lng: c.lng } : null;
    };

    let allDests = [];
    try {
      allDests = await Destination.find({}, 'name location coordinates category rating description isIconic iconicRank').lean();
    } catch (e) {
      console.warn('[generateTour] load destinations lỗi:', e.message);
    }

    // Ứng viên theo khu vực (khớp city hoặc tên); rỗng → lấy điểm biểu tượng toàn bộ.
    const area = norm(answers.destination);
    const byRank = (a, b) =>
      ((b.isIconic ? 1 : 0) - (a.isIconic ? 1 : 0)) ||
      ((a.iconicRank || 999) - (b.iconicRank || 999)) ||
      ((b.rating || 0) - (a.rating || 0));
    let candidates = allDests;
    let areaMatched = false;
    if (area) {
      const matched = allDests.filter((d) => {
        const city = norm(d.location?.city);
        return (city && (city.includes(area) || area.includes(city))) || norm(d.name).includes(area);
      });
      if (matched.length > 0) { candidates = matched; areaMatched = true; }
    }

    // Chỉ NEO danh sách điểm-có-thật khi: admin để AI tự chọn vùng (area rỗng) HOẶC
    // khu vực yêu cầu KHỚP dữ liệu DB. Nếu admin nhập một vùng mà DB chưa có điểm nào
    // (vd 'Đà Nẵng' khi DB tập trung Trà Vinh/Bến Tre) → KHÔNG gửi danh sách trái vùng
    // (tránh nhiễm điểm tỉnh khác); để AI tự dựng từ kiến thức đúng khu vực — toạ độ
    // thiếu sẽ được TourMap geocode runtime qua Nominatim.
    const useCandidates = !area || areaMatched;
    let candidateBlock = '';
    if (useCandidates) {
      candidates = [...candidates].sort(byRank).slice(0, 40);
      candidateBlock = candidates.map((d) => {
        const c = getCoords(d);
        return `- ${d.name}${d.location?.city ? ` (${d.location.city})` : ''}${c ? ` [${c.lat},${c.lng}]` : ''}`;
      }).join('\n');
    }

    const lines = [
      `- Điểm đến / khu vực: ${answers.destination || 'gợi ý điểm phù hợp ở Việt Nam'}`,
      `- Số ngày: ${answers.days || 3}`,
      `- Ngân sách: ${answers.budget || 'trung bình'}`,
      `- Sở thích / chủ đề: ${answers.interests || 'khám phá tổng hợp'}`,
      `- Đối tượng đi: ${answers.audience || 'mọi đối tượng'}`,
      `- Nhịp độ: ${answers.pace || 'cân bằng'}`,
    ];
    // Các tùy chọn mở rộng — chỉ thêm khi có ý nghĩa (bỏ qua "bất kỳ"/"tự do").
    if (answers.season && answers.season !== 'bất kỳ') lines.push(`- Mùa/thời điểm đi: ${answers.season} (chọn điểm đến & hoạt động hợp mùa, tránh thời tiết xấu)`);
    if (answers.transport && answers.transport !== 'tự do') lines.push(`- Phương tiện di chuyển: ${answers.transport} (sắp xếp lộ trình & khoảng cách phù hợp)`);
    if (answers.accommodation && answers.accommodation !== 'tự do') lines.push(`- Loại lưu trú ưu tiên: ${answers.accommodation}`);
    if (answers.fitness) lines.push(`- Mức thể lực: ${answers.fitness}`);
    if (answers.density) lines.push(`- Mật độ điểm mỗi ngày: ${answers.density}`);
    if (answers.notes && String(answers.notes).trim()) lines.push(`- Yêu cầu riêng (BẮT BUỘC tôn trọng): ${String(answers.notes).trim()}`);

    let userMsg = `Yêu cầu tour:\n${lines.join('\n')}`;
    if (candidateBlock) {
      userMsg += `\n\nDANH SÁCH ĐIỂM ĐẾN CÓ THẬT (ưu tiên chọn, dùng ĐÚNG toạ độ [lat,lng]; BẮT BUỘC gồm các điểm nổi tiếng nhất đứng đầu danh sách):\n${candidateBlock}`;
    }

    const messages = [{ role: 'system', content: sys }, { role: 'user', content: userMsg }];
    const params = { messages, stream: false, max_tokens: MAX_TOKENS_TOUR, temperature: 0.6, top_p: 0.9 };

    // Gọi model: gpt55 primary → nvidia step3.7 → nvidia minimax → opencode.
    const callRaw = async () => {
      const preferredProvider = process.env.AI_PROVIDER || 'nvidia';
      if (preferredProvider === 'gpt55') {
        try {
          const res = await gpt55Create(withModel(params, GPT55_MODEL));
          return res.choices[0]?.message?.content;
        } catch (err) {
          console.warn(`[generateTour] ${GPT55_MODEL} failed (${err.message}), thử nvidia step3.7`);
        }
      }
      try {
        const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_PRIMARY));
        return res.choices[0]?.message?.content || res.choices[0]?.message?.reasoning_content;
      } catch (err) {
        console.warn(`[generateTour] ${NVIDIA_MODEL_PRIMARY} failed (${err.message}), thử minimax`);
        try {
          const res = await nvidiaClient.chat.completions.create(withModel(params, NVIDIA_MODEL_FALLBACK));
          return res.choices[0]?.message?.content;
        } catch (err2) {
          console.warn(`[generateTour] minimax failed (${err2.message}), thử opencode`);
          const res = await opencodeClient.chat.completions.create(withModel(params, OPENCODE_MODEL));
          return res.choices[0]?.message?.content;
        }
      }
    };

    // Model reasoning thỉnh thoảng trả JSON cụt (hết token) hoặc kèm text → parse lỗi.
    // Thử tối đa 2 lần trước khi báo lỗi để admin không mất trắng lần gọi.
    let draft, lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let raw;
      try {
        raw = await callRaw();
      } catch (err) {
        lastErr = err;
        console.warn(`[generateTour] gọi model lỗi (lần ${attempt}): ${err.message}`);
        continue;
      }
      if (!raw) { lastErr = new Error('AI không trả về nội dung'); continue; }
      try {
        draft = this._parseTourJson(raw);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[generateTour] parse JSON lỗi (lần ${attempt}): ${err.message}`);
      }
    }
    if (!draft) throw lastErr || new Error('Không tạo được tour');

    // ── Neo toạ độ từng trạm theo DB: đè toạ độ AI nếu trạm khớp tên một điểm thật ──
    const matchDest = (stopName) => {
      const n = norm(stopName);
      if (!n) return null;
      let best = allDests.find((d) => norm(d.name) === n);
      if (best) return best;
      best = allDests.find((d) => { const dn = norm(d.name); return dn.length >= 4 && (n.includes(dn) || dn.includes(n)); });
      return best || null;
    };
    let groundedCount = 0;
    for (const s of draft.stops) {
      const m = matchDest(s.name);
      if (!m) continue;
      const c = getCoords(m);
      if (c) { s.coordinates = c; groundedCount++; }
      if (!s.city && m.location?.city) s.city = m.location.city;
    }

    // ── Ép đưa các điểm BIỂU TƯỢNG của khu vực vào tour (vd Ao Bà Om, Ba Động) ──
    // AI hay bỏ sót điểm nổi tiếng → bổ sung tất định từ DB (isIconic) nếu còn thiếu.
    if (areaMatched) {
      const mapCat = (c) => {
        if (['beach', 'mountain', 'city', 'countryside'].includes(c)) return c;
        if (['historical', 'temple', 'culture', 'landmark'].includes(c)) return 'heritage';
        return 'nature';
      };
      const hasStop = (name) => draft.stops.some((s) => {
        const a = norm(s.name), b = norm(name);
        return a === b || (b.length >= 4 && (a.includes(b) || b.includes(a)));
      });
      const mustHave = candidates
        .filter((d) => d.isIconic && getCoords(d))
        .sort((a, b) => (a.iconicRank || 999) - (b.iconicRank || 999))
        .slice(0, 5);
      for (const d of mustHave) {
        if (hasStop(d.name)) continue;
        draft.stops.push({
          name: d.name,
          city: d.location?.city || '',
          category: mapCat(d.category),
          rating: d.rating || 4.6,
          description: d.description || `Địa danh nổi tiếng tại ${d.location?.city || 'khu vực'}.`,
          coordinates: getCoords(d),
        });
        groundedCount++;
      }
    }

    // Nếu AI không tạo được trạm nào (kể cả sau khi bổ sung điểm biểu tượng) → báo lỗi rõ
    // để admin thử lại, thay vì trả về tour rỗng phải tự thêm tay.
    if (!draft.stops.length) {
      throw new Error('AI chưa tạo được trạm dừng nào — vui lòng thử lại hoặc nêu rõ khu vực hơn.');
    }

    // ── Tối ưu thứ tự trạm: "gần nhất kế tiếp" (Nearest Neighbor) như trang chat AI ──
    try {
      const hasCoords = (s) => s.coordinates && typeof s.coordinates.lat === 'number';
      const withCoords = draft.stops.filter(hasCoords);
      if (withCoords.length >= 2) {
        const locations = withCoords.map((s) => ({ lat: s.coordinates.lat, lng: s.coordinates.lng, _stop: s }));
        const result = await optimizeService.optimizeRoute(locations, { lat: locations[0].lat, lng: locations[0].lng }, 'auto');
        const ordered = result.optimizedLocations.map((l) => l._stop);
        draft.stops = [...ordered, ...draft.stops.filter((s) => !hasCoords(s))];
        console.log(`[generateTour] ✓ neo ${groundedCount}/${draft.stops.length} trạm theo DB | tối ưu ${result.stats.locationCount} trạm (${result.method}, tiết kiệm ${result.stats.improvementPercent}%)`);
      }
    } catch (optErr) {
      console.warn('[generateTour] optimize lỗi:', optErr.message);
    }

    return draft;
  }

  // Bóc + parse JSON tour từ phản hồi model (strip <think>, bỏ fence, lấy {...}).
  _parseTourJson(text) {
    let s = String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1) s = s.slice(first, last + 1);

    let obj;
    try {
      obj = JSON.parse(s);
    } catch (e) {
      throw new Error('AI trả về JSON không hợp lệ: ' + e.message);
    }

    // Normalize — đảm bảo kiểu dữ liệu để khớp model Tour.
    const num = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : (parseFloat(v) || d));
    const arr = (v) => (Array.isArray(v) ? v : []);
    return {
      title: obj.title || 'Tour mới',
      description: obj.description || '',
      duration: obj.duration || `${num(obj.days, 1)} ngày`,
      days: num(obj.days, 1),
      category: obj.category || 'Khám phá',
      categoryIcon: obj.categoryIcon || '📍',
      region: obj.region || '',
      priceRange: ['budget', 'mid-range', 'luxury'].includes(obj.priceRange) ? obj.priceRange : 'mid-range',
      priceLabel: obj.priceLabel || 'Liên hệ',
      rating: num(obj.rating, 4.5),
      reviewCount: num(obj.reviewCount, 0),
      tags: arr(obj.tags).map(String),
      highlights: arr(obj.highlights).map(String),
      badge: obj.badge || '✨ Mới',
      badgeColor: obj.badgeColor || 'bg-sky-500',
      author: obj.author || 'TravelAI',
      authorAvatar: obj.authorAvatar || 'AI',
      completedDate: obj.completedDate || '',
      stops: arr(obj.stops).map((s) => ({
        name: s.name || '',
        city: s.city || '',
        category: s.category || 'nature',
        rating: num(s.rating, 4.5),
        description: s.description || '',
        coordinates: (s.coordinates && typeof s.coordinates.lat === 'number')
          ? { lat: num(s.coordinates.lat), lng: num(s.coordinates.lng) }
          : undefined,
      })),
      reviews: arr(obj.reviews).map((r) => ({
        name: r.name || 'Khách',
        avatar: r.avatar || (r.name ? r.name.slice(0, 2).toUpperCase() : 'KH'),
        date: r.date || '',
        rating: num(r.rating, 5),
        text: r.text || '',
        helpful: num(r.helpful, 0),
      })),
    };
  }
}

module.exports = new AIService();
