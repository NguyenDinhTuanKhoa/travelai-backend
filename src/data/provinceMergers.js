// ─────────────────────────────────────────────────────────────────────────────
// Cập nhật hành chính Việt Nam 2025: 63 → 34 đơn vị hành chính cấp tỉnh
// (28 tỉnh + 6 thành phố trực thuộc TW), hiệu lực 01/07/2025.
//
// QUAN TRỌNG: File này CHỈ để AI HIỂU & trả lời cho hợp lý. Dữ liệu điểm đến trong
// MongoDB VẪN lưu theo tên tỉnh CŨ (location.city) — KHÔNG đổi gì ở DB.
// ─────────────────────────────────────────────────────────────────────────────

// 23 đơn vị mới hình thành từ sáp nhập: { newName, old: [các tỉnh cũ gộp vào] }
const MERGERS = [
  { newName: 'Tuyên Quang', old: ['Tuyên Quang', 'Hà Giang'] },
  { newName: 'Lào Cai', old: ['Lào Cai', 'Yên Bái'] },
  { newName: 'Thái Nguyên', old: ['Bắc Kạn', 'Thái Nguyên'] },
  { newName: 'Phú Thọ', old: ['Vĩnh Phúc', 'Phú Thọ', 'Hòa Bình'] },
  { newName: 'Bắc Ninh', old: ['Bắc Ninh', 'Bắc Giang'] },
  { newName: 'Hưng Yên', old: ['Hưng Yên', 'Thái Bình'] },
  { newName: 'Hải Phòng', old: ['Hải Dương', 'Hải Phòng'] },
  { newName: 'Ninh Bình', old: ['Hà Nam', 'Ninh Bình', 'Nam Định'] },
  { newName: 'Quảng Trị', old: ['Quảng Bình', 'Quảng Trị'] },
  { newName: 'Đà Nẵng', old: ['Quảng Nam', 'Đà Nẵng'] },
  { newName: 'Quảng Ngãi', old: ['Kon Tum', 'Quảng Ngãi'] },
  { newName: 'Gia Lai', old: ['Gia Lai', 'Bình Định'] },
  { newName: 'Đắk Lắk', old: ['Đắk Lắk', 'Phú Yên'] },
  { newName: 'Khánh Hòa', old: ['Ninh Thuận', 'Khánh Hòa'] },
  { newName: 'Lâm Đồng', old: ['Lâm Đồng', 'Đắk Nông', 'Bình Thuận'] },
  { newName: 'Đồng Nai', old: ['Đồng Nai', 'Bình Phước'] },
  { newName: 'Hồ Chí Minh', old: ['Bà Rịa - Vũng Tàu', 'Bình Dương', 'Hồ Chí Minh'] },
  { newName: 'Tây Ninh', old: ['Tây Ninh', 'Long An'] },
  { newName: 'Đồng Tháp', old: ['Tiền Giang', 'Đồng Tháp'] },
  { newName: 'Vĩnh Long', old: ['Bến Tre', 'Vĩnh Long', 'Trà Vinh'] },
  { newName: 'Cần Thơ', old: ['Cần Thơ', 'Sóc Trăng', 'Hậu Giang'] },
  { newName: 'Cà Mau', old: ['Bạc Liêu', 'Cà Mau'] },
  { newName: 'An Giang', old: ['An Giang', 'Kiên Giang'] },
];

// Đổi tên / nâng cấp (không sáp nhập thêm tỉnh khác)
const RENAMES = [
  { newName: 'Huế', old: ['Thừa Thiên Huế'] }, // nâng lên TP trực thuộc TW
];

// 11 đơn vị giữ nguyên (không sáp nhập)
const INDEPENDENT = [
  'Hà Nội', 'Huế', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn',
  'Quảng Ninh', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Cao Bằng',
];

// 6 thành phố trực thuộc Trung ương
const CITIES_TW = ['Hà Nội', 'Huế', 'Hải Phòng', 'Đà Nẵng', 'Hồ Chí Minh', 'Cần Thơ'];

// Dòng đối chiếu "tỉnh cũ, tỉnh cũ → tỉnh mới" (bỏ qua tỉnh trùng tên mới)
const mapLines = [...MERGERS, ...RENAMES]
  .map(m => {
    const olds = m.old.filter(o => o !== m.newName);
    return olds.length ? `- ${olds.join(', ')} → ${m.newName}` : null;
  })
  .filter(Boolean);

// Khối context tiêm vào system prompt khi câu hỏi liên quan tỉnh/thành
const MERGER_CONTEXT_BLOCK = `[CẬP NHẬT HÀNH CHÍNH VIỆT NAM 2025 - QUAN TRỌNG]
Từ 01/07/2025, Việt Nam sắp xếp còn 34 đơn vị hành chính cấp tỉnh (28 tỉnh + 6 thành phố trực thuộc TW: ${CITIES_TW.join(', ')}). KHÔNG còn 63 tỉnh.
Dữ liệu điểm đến trong hệ thống VẪN lưu theo tên tỉnh CŨ — cứ dùng bình thường, không báo lỗi. Khi người dùng nhắc tên CŨ hay MỚI, hãy hiểu là tương đương và trả lời tự nhiên.

Bảng đối chiếu tỉnh CŨ → tỉnh/thành MỚI:
${mapLines.join('\n')}

Hướng dẫn trả lời:
- Hiểu cả tên cũ lẫn mới. Nếu user hỏi "tỉnh X giờ thuộc đâu / còn không" → trả lời theo bảng trên.
- KHÔNG cần chèn thông tin sáp nhập vào MỌI câu trả lời lịch trình; chỉ nhắc khi user hỏi hoặc khi thực sự hữu ích (vd ghi chú ngắn "(nay thuộc <tỉnh mới>)").
- Các tỉnh KHÔNG đổi: ${INDEPENDENT.join(', ')}.
- TUYỆT ĐỐI không bịa thông tin sáp nhập ngoài bảng trên.`;

// Tên các tỉnh CÓ thay đổi (cũ + mới) — để nhận biết câu hỏi có liên quan
const RESTRUCTURED_NAMES = Array.from(new Set([
  ...MERGERS.flatMap(m => [m.newName, ...m.old]),
  ...RENAMES.flatMap(m => [m.newName, ...m.old]),
  'Sài Gòn', 'Vũng Tàu', // alias thường gặp
]));

// Từ khóa cho thấy user đang hỏi về sắp xếp hành chính
const MERGER_KEYWORDS = [
  'sáp nhập', 'sát nhập', 'tỉnh mới', 'đơn vị hành chính', 'bao nhiêu tỉnh',
  'còn bao nhiêu tỉnh', '63 tỉnh', '34 tỉnh', 'thuộc tỉnh nào', 'trực thuộc',
  'sắp xếp tỉnh', 'nhập tỉnh', 'tỉnh thành mới', 'giờ thuộc',
];

module.exports = {
  MERGERS, RENAMES, INDEPENDENT, CITIES_TW,
  MERGER_CONTEXT_BLOCK, RESTRUCTURED_NAMES, MERGER_KEYWORDS,
};
