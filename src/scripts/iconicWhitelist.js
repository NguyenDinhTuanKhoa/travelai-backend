/**
 * Whitelist các địa danh biểu tượng quốc gia — LUÔN giữ isIconic = true bất kể
 * Serper có match được review hay không. Đây là các điểm đến nổi tiếng bậc nhất
 * Việt Nam mà ai cũng biết, không cần xác minh qua số review Google Maps.
 *
 * Match theo tên (đã bỏ dấu, lowercase, so khớp chứa chuỗi con).
 */
module.exports = [
  // Miền Bắc
  'ho hoan kiem', 'ho guom', 'pho co ha noi', 'van mieu', 'lang bac', 'lang chu tich',
  'chua mot cot', 'hoang thanh thang long', 'nha tho lon ha noi', 'ho tay',
  'vinh ha long', 'vinh lan ha', 'dao co to', 'dao cat ba', 'bai chay', 'yen tu',
  'sa pa', 'sapa', 'ban cat cat', 'fansipan', 'phan xi pang', 'ruong bac thang',
  'mu cang chai', 'thac ban gioc', 'ho ba be', 'dong nguom ngao', 'cao nguyen da dong van',
  'ha giang', 'cot co lung cu', 'deo ma pi leng', 'moc chau', 'mai chau', 'tam coc',
  'trang an', 'chua bai dinh', 'tam dao', 'dong van',
  // Miền Trung
  'kinh thanh hue', 'dai noi hue', 'chua thien mu', 'lang khai dinh', 'lang tu duc',
  'lang minh mang', 'song huong', 'cau trang tien', 'pho co hoi an', 'chua cau',
  'thanh dia my son', 'ba na hills', 'cau vang', 'ngu hanh son', 'ban dao son tra',
  'bai bien my khe', 'deo hai van', 'phong nha', 'dong thien duong', 'dong phong nha',
  'thanh nha trang', 'thap ba ponagar', 'vinpearl', 'mui ne', 'bau trang',
  // Tây Nguyên
  'ho xuan huong', 'thung lung tinh yeu', 'dinh langbiang', 'langbiang', 'ho tuyen lam',
  'thac datanla', 'thac pongour', 'bien ho', 'ho lak', 'nha tho con ga',
  // Miền Nam
  'dinh doc lap', 'nha tho duc ba', 'buu dien thanh pho', 'cho ben thanh', 'pho di bo nguyen hue',
  'dia dao cu chi', 'nui ba den', 'mui ca mau', 'rung tram tra su', 'mieu ba chua xu',
  'nui sam', 'nui cam', 'cho noi cai rang', 'dao phu quoc', 'hon thom', 'cap treo phu quoc',
  'con dao', 'lang hoa sa dec', 'cho noi cai be',
];
