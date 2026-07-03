const mongoose = require('mongoose');
require('dotenv').config();

const ProvinceSpecialty = require('../models/ProvinceSpecialty');

// Phân loại vùng miền theo tỉnh
const regionMapping = {
  // Miền Bắc (25 tỉnh)
  'Hà Nội': 'Miền Bắc',
  'Hà Giang': 'Miền Bắc',
  'Cao Bằng': 'Miền Bắc',
  'Bắc Kạn': 'Miền Bắc',
  'Lạng Sơn': 'Miền Bắc',
  'Tuyên Quang': 'Miền Bắc',
  'Thái Nguyên': 'Miền Bắc',
  'Phú Thọ': 'Miền Bắc',
  'Bắc Giang': 'Miền Bắc',
  'Quảng Ninh': 'Miền Bắc',
  'Lào Cai': 'Miền Bắc',
  'Yên Bái': 'Miền Bắc',
  'Điện Biên': 'Miền Bắc',
  'Lai Châu': 'Miền Bắc',
  'Sơn La': 'Miền Bắc',
  'Hòa Bình': 'Miền Bắc',
  'Bắc Ninh': 'Miền Bắc',
  'Hà Nam': 'Miền Bắc',
  'Hải Dương': 'Miền Bắc',
  'Hưng Yên': 'Miền Bắc',
  'Nam Định': 'Miền Bắc',
  'Ninh Bình': 'Miền Bắc',
  'Thái Bình': 'Miền Bắc',
  'Vĩnh Phúc': 'Miền Bắc',
  'Hải Phòng': 'Miền Bắc',

  // Miền Trung (19 tỉnh)
  'Thanh Hóa': 'Miền Trung',
  'Nghệ An': 'Miền Trung',
  'Hà Tĩnh': 'Miền Trung',
  'Quảng Bình': 'Miền Trung',
  'Quảng Trị': 'Miền Trung',
  'Thừa Thiên Huế': 'Miền Trung',
  'Đà Nẵng': 'Miền Trung',
  'Quảng Nam': 'Miền Trung',
  'Quảng Ngãi': 'Miền Trung',
  'Bình Định': 'Miền Trung',
  'Phú Yên': 'Miền Trung',
  'Khánh Hòa': 'Miền Trung',
  'Ninh Thuận': 'Miền Trung',
  'Bình Thuận': 'Miền Trung',

  // Tây Nguyên (5 tỉnh)
  'Kon Tum': 'Tây Nguyên',
  'Gia Lai': 'Tây Nguyên',
  'Đắk Lắk': 'Tây Nguyên',
  'Đắk Nông': 'Tây Nguyên',
  'Lâm Đồng': 'Tây Nguyên',

  // Miền Nam (19 tỉnh)
  'TP. Hồ Chí Minh': 'Miền Nam',
  'Bà Rịa - Vũng Tàu': 'Miền Nam',
  'Bình Dương': 'Miền Nam',
  'Bình Phước': 'Miền Nam',
  'Đồng Nai': 'Miền Nam',
  'Tây Ninh': 'Miền Nam',
  'Long An': 'Miền Nam',
  'Tiền Giang': 'Miền Nam',
  'Bến Tre': 'Miền Nam',
  'Đồng Tháp': 'Miền Nam',
  'Vĩnh Long': 'Miền Nam',
  'Cần Thơ': 'Miền Nam',
  'Hậu Giang': 'Miền Nam',
  'Sóc Trăng': 'Miền Nam',
  'An Giang': 'Miền Nam',
  'Kiên Giang': 'Miền Nam',
  'Bạc Liêu': 'Miền Nam',
  'Cà Mau': 'Miền Nam',
  'Trà Vinh': 'Miền Nam'
};

// Dữ liệu đặc sản 63 tỉnh thành
const specialtiesData = [
  { stt: 1, province: 'Hà Nội', localDishes: 'Phở bò, Bún chả, Bún ốc, Bún thang, Chả cá Lã Vọng, Phở cuốn', souvenirs: 'Cốm làng Vòng, Trà sen Tây Hồ, Ô mai, Bánh chè lam' },
  { stt: 2, province: 'Hà Giang', localDishes: 'Thắng cố, Cháo ấu tẩu, Bánh cuốn trứng, Thắng dền, Phở chua', souvenirs: 'Thịt trâu gác bếp, Mật ong bạc hà, Lạp sườn, Trà Shan tuyết' },
  { stt: 3, province: 'Cao Bằng', localDishes: 'Phở chua, Vịt quay, Bánh cuốn nước xương, Bánh áp chao', souvenirs: 'Hạt dẻ Trùng Khánh, Lạp sườn hun khói, Miến dong đen' },
  { stt: 4, province: 'Bắc Kạn', localDishes: 'Cá nướng hồ Ba Bể, Lợn sữa quay, Khâu nhục', souvenirs: 'Miến dong Na Rì, Tôm chua Ba Bể, Quýt Quang Thuận' },
  { stt: 5, province: 'Lạng Sơn', localDishes: 'Vịt quay lá mắc mật, Khâu nhục, Phở chua, Bánh áp chao', souvenirs: 'Đào Mẫu Sơn, Rượu Mẫu Sơn, Hoa hồi, Na Chi Lăng' },
  { stt: 6, province: 'Tuyên Quang', localDishes: 'Gỏi cá lăng, Bún sườn măng chua, Vịt bầu Minh Hương', souvenirs: 'Cam sành Hàm Yên, Rượu ngô Na Hang, Thịt lợn đen' },
  { stt: 7, province: 'Thái Nguyên', localDishes: 'Bún cuốn, Cơm lam, Đậu phụ Bình Long', souvenirs: 'Trà (Chè) Tân Cương, Bánh chưng Bờ Đậu, Miến Việt Cường' },
  { stt: 8, province: 'Phú Thọ', localDishes: 'Canh cá rau sắn, Cơm nắm lá cọ, Trám om cá', souvenirs: 'Thịt chua Thanh Sơn, Bưởi Đoan Hùng, Bánh tai' },
  { stt: 9, province: 'Bắc Giang', localDishes: 'Xôi trứng kiến, Gà đồi nướng, Bún đa mai', souvenirs: 'Vải thiều Lục Ngạn, Mì Chũ, Bánh đa Kế' },
  { stt: 10, province: 'Quảng Ninh', localDishes: 'Bún bề bề, Cù kỳ hấp, Gà đồi Tiên Yên, Ngán biển', souvenirs: 'Chả mực Hạ Long, Sá sùng khô, Ruốc hàu, Chả rươi' },
  { stt: 11, province: 'Lào Cai', localDishes: 'Cá hồi Sapa, Thắng cố Bắc Hà, Lợn cắp nách', souvenirs: 'Nấm hương rừng, Tương ớt Mường Khương, Trâu gác bếp' },
  { stt: 12, province: 'Yên Bái', localDishes: 'Xôi nếp Tú Lệ, Gà nướng lá mắc mật, Bánh chưng đen', souvenirs: 'Táo mèo, Mắc khén, Lạp xưởng, Trà suối Giàng' },
  { stt: 13, province: 'Điện Biên', localDishes: 'Cá suối nướng (Pa pỉnh tộp), Xôi chim Mường Thanh', souvenirs: 'Gạo nếp nương, Trâu gác bếp, Chè tuyết Tủa Chùa' },
  { stt: 14, province: 'Lai Châu', localDishes: 'Lợn cắp nách, Rêu đá nướng, Canh tết', souvenirs: 'Hạt dổi, Trà Shan tuyết, Rượu ngô Sùng Phài' },
  { stt: 15, province: 'Sơn La', localDishes: 'Bê chao Mộc Châu, Cá nướng Pa pỉnh tộp, Nộm da trâu', souvenirs: 'Thịt trâu gác bếp, Các sản phẩm từ sữa bò Mộc Châu, Tỏi cô đơn' },
  { stt: 16, province: 'Hòa Bình', localDishes: 'Cơm lam, Lợn mán thui luộc, Chả cuốn lá bưởi', souvenirs: 'Cam Cao Phong, Rượu cần, Tỏi tía' },
  { stt: 17, province: 'Bắc Ninh', localDishes: 'Trâu giật Từ Sơn, Chim trời, Cháo cá Bắc Ninh', souvenirs: 'Bánh phu thê Đình Bảng, Bánh tẻ làng Chờ, Nem Bùi' },
  { stt: 18, province: 'Hà Nam', localDishes: 'Bún cá rô đồng, Bánh cuốn chả Phủ Lý', souvenirs: 'Cá kho làng Vũ Đại, Mắm cáy Bình Lục, Rượu Vọc' },
  { stt: 19, province: 'Hải Dương', localDishes: 'Bún cá rô đồng, Rươi Tứ Kỳ (chả rươi)', souvenirs: 'Bánh đậu xanh, Vải thiều Thanh Hà, Bánh gai Ninh Giang' },
  { stt: 20, province: 'Hưng Yên', localDishes: 'Bún thang lươn Phố Hiến, Ếch om Phượng Tường', souvenirs: 'Nhãn lồng, Tương Bần, Gà Đông Tảo' },
  { stt: 21, province: 'Nam Định', localDishes: 'Phở bò, Bún đũa, Xôi xíu, Cá nướng úp chậu', souvenirs: 'Nem nắm Giao Thủy, Bánh xíu páo, Kẹo sìu châu' },
  { stt: 22, province: 'Ninh Bình', localDishes: 'Dê núi nướng/tái chanh, Miến lươn, Gỏi cá nhệch', souvenirs: 'Cơm cháy, Rượu Kim Sơn, Mắm tép Gia Viễn' },
  { stt: 23, province: 'Thái Bình', localDishes: 'Canh cá Quỳnh Côi, Bún bung, Gỏi nhệch', souvenirs: 'Bánh cáy, Nộm sứa Thái Thụy, Ổi Bo' },
  { stt: 24, province: 'Vĩnh Phúc', localDishes: 'Bò tái kiến đốt, Ngọn su su xào, Gà đồi', souvenirs: 'Cá thính Lập Thạch, Dứa Tam Dương, Bánh ngõa' },
  { stt: 25, province: 'Hải Phòng', localDishes: 'Bánh đa cua, Bún cá cay, Nem cua bể, Ốc các loại', souvenirs: 'Bánh mì cay, Sủi dìn, Nước mắm Cát Hải' },
  { stt: 26, province: 'Thanh Hóa', localDishes: 'Chả tôm, Bánh khoái tép, Gỏi nhệch, Bún tôm', souvenirs: 'Nem chua, Bánh gai Tứ Trụ, Nước mắm Ba Làng, Chè lam' },
  { stt: 27, province: 'Nghệ An', localDishes: 'Súp lươn, Miến lươn, Mực nháy nướng, Bánh mướt', souvenirs: 'Giò me (giò bê), Tương Nam Đàn, Nhút Thanh Chương' },
  { stt: 28, province: 'Hà Tĩnh', localDishes: 'Mực nháy Vũng Áng, Bún bò Đức Thọ, Hến sông La', souvenirs: 'Kẹo cu đơ, Bưởi Phúc Trạch, Ram bèo' },
  { stt: 29, province: 'Quảng Bình', localDishes: 'Cháo canh, Bánh xèo Quảng Hòa, Sò huyết Roòn', souvenirs: 'Khoai gieo, Nhút tép đồng, Mực khô' },
  { stt: 30, province: 'Quảng Trị', localDishes: 'Bún hến Mai Xá, Cháo vạt giường, Thịt trâu lá trơng', souvenirs: 'Cà phê Khe Sanh, Tiêu Cồn, Bánh bột lọc Mỹ Chánh' },
  { stt: 31, province: 'Thừa Thiên Huế', localDishes: 'Bún bò, Cơm hến, Bánh canh Nam Phổ, Bánh bèo/nậm/lọc', souvenirs: 'Tré, Mè xửng, Mắm ruốc, Trà cung đình' },
  { stt: 32, province: 'Đà Nẵng', localDishes: 'Mì Quảng, Bún chả cá, Bánh tráng cuốn thịt heo, Gỏi cá', souvenirs: 'Chả bò, Tré, Mực rim me, Rong biển' },
  { stt: 33, province: 'Quảng Nam', localDishes: 'Cao lầu, Mì Quảng, Cơm gà Tam Kỳ, Bê thui Cầu Mống', souvenirs: 'Bánh tráng Đại Lộc, Rượu hồng đào, Bánh tổ' },
  { stt: 34, province: 'Quảng Ngãi', localDishes: 'Don, Bún cá ngừ, Mì Quảng cá bống', souvenirs: 'Cá bống sông Trà, Tỏi Lý Sơn, Kẹo gương, Đường phèn' },
  { stt: 35, province: 'Bình Định', localDishes: 'Bún chả cá, Bánh xèo tôm nhảy, Bánh hỏi cháo lòng', souvenirs: 'Tré, Bánh ít lá gai, Rượu Bầu Đá, Chả ram tôm đất' },
  { stt: 36, province: 'Phú Yên', localDishes: 'Mắt cá ngừ đại dương, Bún sứa, Bánh canh hẹ', souvenirs: 'Bò một nắng, Muối kiến vàng, Nước mắm Gành Đỏ' },
  { stt: 37, province: 'Khánh Hòa', localDishes: 'Bún sứa, Nem nướng Ninh Hòa, Gỏi cá mai, Bún cá', souvenirs: 'Yến sào, Bánh xoài, Chả cá Nha Trang, Nem chua' },
  { stt: 38, province: 'Ninh Thuận', localDishes: 'Bánh căn, Bánh canh chả cá, Dông cát nướng, Cừu nướng', souvenirs: 'Nho, Rượu nho, Táo phong, Tỏi Phan Rang' },
  { stt: 39, province: 'Bình Thuận', localDishes: 'Lẩu thả, Răng mực nướng, Bánh xèo Phan Thiết', souvenirs: 'Bánh rế, Nước mắm Phan Thiết, Thanh long, Mực một nắng' },
  { stt: 40, province: 'Kon Tum', localDishes: 'Gỏi lá, Bún sứa nước lèo, Gà nướng Măng Đen', souvenirs: 'Cà phê, Sâm Ngọc Linh, Rượu ghè' },
  { stt: 41, province: 'Gia Lai', localDishes: 'Phở khô, Bún cua thối, Lẩu lá rừng, Bò né', souvenirs: 'Bò một nắng, Muối kiến vàng, Cà phê Pleiku, Mật ong' },
  { stt: 42, province: 'Đắk Lắk', localDishes: 'Bún đỏ, Gà nướng Bản Đôn, Lẩu cá lăng', souvenirs: 'Cà phê Buôn Ma Thuột, Mật ong hoa cà phê, Bơ sáp' },
  { stt: 43, province: 'Đắk Nông', localDishes: 'Canh thụt, Cá lăng sông Sêrêpốk, Lẩu rau rừng', souvenirs: 'Hạt tiêu, Cà phê, Mắc ca, Rượu cần' },
  { stt: 44, province: 'Lâm Đồng', localDishes: 'Bánh tráng nướng, Lẩu gà lá é, Lẩu bò Ba Toa', souvenirs: 'Dâu tây, Atiso, Trà Bảo Lộc, Hồng treo gió, Rượu vang' },
  { stt: 45, province: 'TP. Hồ Chí Minh', localDishes: 'Cơm tấm, Hủ tiếu Nam Vang, Bánh mì, Phá lấu, Sủi cảo', souvenirs: 'Cơm cháy chà bông, Các loại hạt sấy, Trà và Cà phê' },
  { stt: 46, province: 'Bà Rịa - Vũng Tàu', localDishes: 'Bánh khọt, Lẩu súng Phước Hải, Gỏi cá mai', souvenirs: 'Mứt hạt bàng Côn Đảo, Nước mắm Trí Hải, Cá khô' },
  { stt: 47, province: 'Bình Dương', localDishes: 'Bánh bèo bì, Gỏi măng cụt, Gà quay xôi phồng', souvenirs: 'Nem Lái Thiêu, Hoa quả Lái Thiêu (măng cụt, sầu riêng)' },
  { stt: 48, province: 'Bình Phước', localDishes: 'Đọt măng xào, Heo thả rông nướng, Ve sầu chiên giòn', souvenirs: 'Hạt điều rang muối, Rượu cần, Các sản phẩm từ cao su' },
  { stt: 49, province: 'Đồng Nai', localDishes: 'Gỏi cá Biên Hòa, Lẩu lá khổ qua rừng, Gà hấp bưởi', souvenirs: 'Bưởi Tân Triều, Mít sấy, Trái cây mệt vườn' },
  { stt: 50, province: 'Tây Ninh', localDishes: 'Bò tơ, Thằn lằn núi nướng, Bánh canh Trảng Bàng', souvenirs: 'Bánh tráng phơi sương, Muối tôm, Nho rừng, Bánh tráng trộn' },
  { stt: 51, province: 'Long An', localDishes: 'Canh chua cá chốt, Bún xiêm lo, Lẩu mắm', souvenirs: 'Lạp xưởng Cần Đước, Thanh long Châu Thành, Rượu đế Gò Đen' },
  { stt: 52, province: 'Tiền Giang', localDishes: 'Hủ tiếu Mỹ Tho, Bún gỏi dà, Ốc gạo Tân Phong', souvenirs: 'Vú sữa Lò Rèn, Mắm tôm chà Gò Công, Sầu riêng Ngũ Hiệp' },
  { stt: 53, province: 'Bến Tre', localDishes: 'Chuối đập, Bánh canh bột xắt, Cơm dừa', souvenirs: 'Kẹo dừa, Bánh tráng Mỹ Lồng, Bánh phồng Sơn Đốc' },
  { stt: 54, province: 'Đồng Tháp', localDishes: 'Lẩu cá linh bông điên điển, Chuột đồng nướng', souvenirs: 'Nem Lai Vung, Hạt sen Tháp Mười, Quýt hồng Lai Vung' },
  { stt: 55, province: 'Vĩnh Long', localDishes: 'Cá cháy Trà Ôn, Lẩu gà nòi, Bánh xèo hến', souvenirs: 'Bưởi Năm Roi, Cam sành, Khoai lang Bình Tân' },
  { stt: 56, province: 'Cần Thơ', localDishes: 'Bánh xèo, Lẩu mắm, Vịt nấu chao, Pizza hủ tiếu', souvenirs: 'Bánh tét lá cẩm, Nem nướng Cái Răng, Rượu mận Sáu Tia' },
  { stt: 57, province: 'Hậu Giang', localDishes: 'Bún mắm, Sỏi mầm (thịt heo rừng nướng sỏi), Lẩu mẻ', souvenirs: 'Chả cá thác lác, Khóm Cầu Đúc, Bưởi Phú Hữu' },
  { stt: 58, province: 'Sóc Trăng', localDishes: 'Bún nước lèo, Bún gỏi dà, Bánh cống', souvenirs: 'Bánh pía, Lạp xưởng Vũng Thơm, Bánh in, Hành tím' },
  { stt: 59, province: 'An Giang', localDishes: 'Bún cá Châu Đốc, Gỏi sầu đâu, Bò bảy món Núi Sam', souvenirs: 'Mắm Châu Đốc (mắm thái, mắm cá lóc...), Đường thốt nốt, Cà na' },
  { stt: 60, province: 'Kiên Giang', localDishes: 'Bún kèn, Gỏi cá trích, Lẩu nấm tràm, Ghẹ Hàm Ninh', souvenirs: 'Nước mắm Phú Quốc, Rượu sim, Tiêu Phú Quốc, Hải sản khô' },
  { stt: 61, province: 'Bạc Liêu', localDishes: 'Lẩu bồn bồn, Bánh tằm bì, Bánh xèo A Mật', souvenirs: 'Nhãn da bò, Mắm ba khía, Khô cá lóc' },
  { stt: 62, province: 'Cà Mau', localDishes: 'Lẩu lươn, Cá lóc nướng trui, Vọp nướng mỡ hành', souvenirs: 'Cua Cà Mau, Tôm khô Rạch Gốc, Mật ong rừng U Minh, Ba khía' },
  { stt: 63, province: 'Trà Vinh', localDishes: 'Bún nước lèo, Cháo ám, Bún suông', souvenirs: 'Dừa sáp, Bánh tét Trà Cuôn, Tôm khô Vinh Kim, Củ cải muối' }
];

// Hàm parse món ăn thành mảng objects
function parseDishes(dishString) {
  if (!dishString) return [];
  return dishString.split(',').map(dish => ({
    name: dish.trim(),
    description: ''
  }));
}

async function seedProvinceSpecialties() {
  try {
    // Kết nối MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/travelai';
    await mongoose.connect(mongoUri);
    console.log('✅ Đã kết nối MongoDB');

    // Xóa dữ liệu cũ
    await ProvinceSpecialty.deleteMany({});
    console.log('🗑️  Đã xóa dữ liệu cũ');

    // Chuẩn bị dữ liệu để insert
    const dataToInsert = specialtiesData.map(item => ({
      stt: item.stt,
      province: item.province,
      region: regionMapping[item.province] || 'Miền Bắc',
      localDishes: parseDishes(item.localDishes),
      souvenirs: parseDishes(item.souvenirs),
      localDishesText: item.localDishes,
      souvenirsText: item.souvenirs
    }));

    // Insert vào database
    const result = await ProvinceSpecialty.insertMany(dataToInsert);
    console.log(`✅ Đã thêm ${result.length} tỉnh thành vào database`);

    // Hiển thị thống kê theo vùng miền
    const stats = await ProvinceSpecialty.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n📊 Thống kê theo vùng miền:');
    stats.forEach(s => console.log(`   - ${s._id}: ${s.count} tỉnh/thành`));

    console.log('\n🎉 Seed dữ liệu đặc sản hoàn tất!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Đã ngắt kết nối MongoDB');
  }
}

// Chạy script
seedProvinceSpecialties();
