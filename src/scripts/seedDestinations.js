const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

const destinations = [
  // 🌊 BIỂN (Beach) - 10 địa điểm
  {
    name: 'Vịnh Hạ Long',
    description: 'Di sản thiên nhiên thế giới UNESCO với hàng nghìn đảo đá vôi hùng vĩ.',
    location: { city: 'Quảng Ninh', country: 'Việt Nam', coordinates: { lat: 20.9101, lng: 107.1839 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.8, reviewCount: 2340,
    amenities: ['Du thuyền', 'Khách sạn', 'Nhà hàng hải sản'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Chèo kayak', 'Tham quan hang động', 'Bơi lội']
  },
  {
    name: 'Bãi biển Mỹ Khê',
    description: 'Một trong những bãi biển đẹp nhất hành tinh theo Forbes với bờ cát trắng mịn.',
    location: { city: 'Đà Nẵng', country: 'Việt Nam', coordinates: { lat: 16.0544, lng: 108.2472 } },
    images: ['https://images.unsplash.com/photo-1559628233-100c798642d4?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.7, reviewCount: 1890,
    amenities: ['Resort', 'Quán bar bãi biển', 'Dịch vụ thể thao nước'],
    bestTimeToVisit: ['Tháng 5', 'Tháng 6', 'Tháng 7'],
    activities: ['Lướt sóng', 'Bơi lội', 'Chơi bóng chuyền bãi biển']
  },
  {
    name: 'Phú Quốc',
    description: 'Đảo ngọc của Việt Nam với những bãi biển hoang sơ và rừng nguyên sinh.',
    location: { city: 'Kiên Giang', country: 'Việt Nam', coordinates: { lat: 10.2899, lng: 103.9840 } },
    images: ['https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800'],
    category: 'beach', priceRange: 'luxury', rating: 4.9, reviewCount: 3120,
    amenities: ['Resort 5 sao', 'Sân golf', 'Công viên giải trí'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1'],
    activities: ['Lặn biển', 'Câu cá', 'Safari']
  },
  {
    name: 'Nha Trang',
    description: 'Thành phố biển sôi động với vịnh biển đẹp và hệ thống đảo phong phú.',
    location: { city: 'Khánh Hòa', country: 'Việt Nam', coordinates: { lat: 12.2388, lng: 109.1967 } },
    images: ['https://images.unsplash.com/photo-1573270689103-d7a4e42b609a?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.6, reviewCount: 2780,
    amenities: ['Vinpearl Land', 'Tháp Bà Ponagar', 'Bùn khoáng'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Lặn biển', 'Tắm bùn', 'Tham quan đảo']
  },
  {
    name: 'Côn Đảo',
    description: 'Quần đảo hoang sơ với lịch sử hào hùng và thiên nhiên nguyên vẹn.',
    location: { city: 'Bà Rịa – Vũng Tàu', country: 'Việt Nam', coordinates: { lat: 8.6833, lng: 106.6000 } },
    images: ['https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.8, reviewCount: 1560,
    amenities: ['Resort sinh thái', 'Bảo tàng', 'Bãi biển hoang sơ'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Lặn ngắm san hô', 'Tham quan di tích', 'Xem rùa đẻ trứng']
  },

  {
    name: 'Bãi biển Mũi Né',
    description: 'Thiên đường của những đồi cát và thể thao mạo hiểm, nổi tiếng với lướt ván diều.',
    location: { city: 'Bình Thuận', country: 'Việt Nam', coordinates: { lat: 10.9333, lng: 108.2833 } },
    images: ['https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=800'],
    category: 'beach', priceRange: 'budget', rating: 4.5, reviewCount: 2100,
    amenities: ['Resort', 'Trường dạy lướt ván', 'Nhà hàng hải sản'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1'],
    activities: ['Lướt ván diều', 'Trượt cát', 'Tham quan đồi cát']
  },
  {
    name: 'Bãi Sao',
    description: 'Bãi biển đẹp nhất Phú Quốc với cát trắng mịn như bột và nước biển trong vắt.',
    location: { city: 'Phú Quốc', country: 'Việt Nam', coordinates: { lat: 10.0500, lng: 104.0167 } },
    images: ['https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.7, reviewCount: 1450,
    amenities: ['Nhà hàng bãi biển', 'Ghế tắm nắng', 'Dịch vụ massage'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1'],
    activities: ['Bơi lội', 'Chèo thuyền kayak', 'Tắm nắng']
  },
  {
    name: 'Bãi Dài Cam Ranh',
    description: 'Bãi biển dài 15km với cát vàng mịn và nước biển trong xanh.',
    location: { city: 'Cam Ranh', country: 'Việt Nam', coordinates: { lat: 11.9167, lng: 109.2167 } },
    images: ['https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800'],
    category: 'beach', priceRange: 'luxury', rating: 4.6, reviewCount: 980,
    amenities: ['Resort 5 sao', 'Sân golf', 'Spa cao cấp'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Nghỉ dưỡng', 'Chơi golf', 'Spa']
  },
  {
    name: 'Lăng Cô',
    description: 'Vịnh biển đẹp nằm giữa đèo Hải Vân với phong cảnh hữu tình.',
    location: { city: 'Huế', country: 'Việt Nam', coordinates: { lat: 16.2667, lng: 108.0667 } },
    images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
    category: 'beach', priceRange: 'mid-range', rating: 4.4, reviewCount: 890,
    amenities: ['Resort', 'Nhà hàng hải sản', 'Tour đèo Hải Vân'],
    bestTimeToVisit: ['Tháng 4', 'Tháng 5', 'Tháng 6'],
    activities: ['Bơi lội', 'Ngắm cảnh', 'Thưởng thức hải sản']
  },
  {
    name: 'Bãi biển Cửa Lò',
    description: 'Bãi biển nổi tiếng xứ Nghệ với bờ cát dài và sóng êm.',
    location: { city: 'Nghệ An', country: 'Việt Nam', coordinates: { lat: 18.8000, lng: 105.7167 } },
    images: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
    category: 'beach', priceRange: 'budget', rating: 4.3, reviewCount: 1200,
    amenities: ['Khách sạn', 'Nhà hàng', 'Chợ hải sản'],
    bestTimeToVisit: ['Tháng 5', 'Tháng 6', 'Tháng 7'],
    activities: ['Bơi lội', 'Thưởng thức hải sản', 'Tham quan đền Cuông']
  },
  // ⛰️ NÚI (Mountain) - 10 địa điểm
  {
    name: 'Fansipan',
    description: 'Nóc nhà Đông Dương cao 3143m, điểm đến chinh phục của những người yêu leo núi.',
    location: { city: 'Lào Cai', country: 'Việt Nam', coordinates: { lat: 22.3033, lng: 103.7750 } },
    images: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800'],
    category: 'mountain', priceRange: 'mid-range', rating: 4.9, reviewCount: 2890,
    amenities: ['Cáp treo', 'Nhà hàng trên đỉnh', 'Đường leo núi'],
    bestTimeToVisit: ['Tháng 10', 'Tháng 11', 'Tháng 3', 'Tháng 4'],
    activities: ['Leo núi', 'Đi cáp treo', 'Ngắm mây']
  },
  {
    name: 'Sa Pa',
    description: 'Thị trấn trong sương với ruộng bậc thang tuyệt đẹp và văn hóa dân tộc đặc sắc.',
    location: { city: 'Lào Cai', country: 'Việt Nam', coordinates: { lat: 22.3364, lng: 103.8438 } },
    images: ['https://images.unsplash.com/photo-1570366583862-f91883984fde?w=800'],
    category: 'mountain', priceRange: 'mid-range', rating: 4.8, reviewCount: 3450,
    amenities: ['Homestay', 'Chợ phiên', 'Tour trekking'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 3', 'Tháng 4'],
    activities: ['Trekking', 'Tham quan bản làng', 'Ngắm ruộng bậc thang']
  },

  {
    name: 'Núi Bà Đen',
    description: 'Ngọn núi cao nhất Nam Bộ với hệ thống cáp treo hiện đại và chùa linh thiêng.',
    location: { city: 'Tây Ninh', country: 'Việt Nam', coordinates: { lat: 11.3667, lng: 106.1833 } },
    images: ['https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.5, reviewCount: 1890,
    amenities: ['Cáp treo', 'Chùa', 'Nhà hàng'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Đi cáp treo', 'Viếng chùa', 'Leo núi']
  },
  {
    name: 'Tam Đảo',
    description: 'Thị trấn nghỉ mát trên núi với khí hậu mát mẻ quanh năm, cách Hà Nội 70km.',
    location: { city: 'Vĩnh Phúc', country: 'Việt Nam', coordinates: { lat: 21.4667, lng: 105.6500 } },
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.4, reviewCount: 1560,
    amenities: ['Khách sạn', 'Nhà hàng', 'Thác nước'],
    bestTimeToVisit: ['Tháng 4', 'Tháng 5', 'Tháng 9', 'Tháng 10'],
    activities: ['Nghỉ dưỡng', 'Tham quan thác', 'Đi bộ rừng']
  },
  {
    name: 'Núi Langbiang',
    description: 'Biểu tượng của Đà Lạt với truyền thuyết tình yêu và cảnh quan hùng vĩ.',
    location: { city: 'Đà Lạt', country: 'Việt Nam', coordinates: { lat: 12.0500, lng: 108.4333 } },
    images: ['https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.6, reviewCount: 2100,
    amenities: ['Xe jeep', 'Quán cà phê', 'Đường leo núi'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1'],
    activities: ['Leo núi', 'Đi xe jeep', 'Ngắm bình minh']
  },
  {
    name: 'Mẫu Sơn',
    description: 'Vùng núi cao với khí hậu lạnh giá, nơi có thể ngắm băng tuyết vào mùa đông.',
    location: { city: 'Lạng Sơn', country: 'Việt Nam', coordinates: { lat: 21.8333, lng: 106.9167 } },
    images: ['https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.3, reviewCount: 780,
    amenities: ['Homestay', 'Nhà hàng địa phương', 'Tour săn tuyết'],
    bestTimeToVisit: ['Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Săn tuyết', 'Cắm trại', 'Ngắm cảnh']
  },
  {
    name: 'Núi Hàm Rồng',
    description: 'Vườn hoa và đài quan sát ngay trung tâm Sa Pa với tầm nhìn toàn cảnh.',
    location: { city: 'Sa Pa', country: 'Việt Nam', coordinates: { lat: 22.3400, lng: 103.8400 } },
    images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.4, reviewCount: 1340,
    amenities: ['Vườn hoa', 'Đài quan sát', 'Quán cà phê'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Ngắm hoa', 'Chụp ảnh', 'Ngắm toàn cảnh Sa Pa']
  },
  {
    name: 'Núi Cấm',
    description: 'Ngọn núi linh thiêng nhất vùng Thất Sơn với nhiều chùa chiền cổ kính.',
    location: { city: 'An Giang', country: 'Việt Nam', coordinates: { lat: 10.5167, lng: 105.0000 } },
    images: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.5, reviewCount: 1120,
    amenities: ['Cáp treo', 'Chùa', 'Nhà hàng chay'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Viếng chùa', 'Đi cáp treo', 'Ngắm cảnh']
  },
  {
    name: 'Yên Tử',
    description: 'Trung tâm Phật giáo Trúc Lâm với hệ thống chùa tháp cổ kính trên núi.',
    location: { city: 'Quảng Ninh', country: 'Việt Nam', coordinates: { lat: 21.0833, lng: 106.7167 } },
    images: ['https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.7, reviewCount: 2340,
    amenities: ['Cáp treo', 'Chùa', 'Nhà hàng chay'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Hành hương', 'Leo núi', 'Tham quan chùa']
  },
  {
    name: 'Đèo Mã Pí Lèng',
    description: 'Một trong tứ đại đỉnh đèo Việt Nam với cảnh quan hùng vĩ bên sông Nho Quế.',
    location: { city: 'Hà Giang', country: 'Việt Nam', coordinates: { lat: 23.2667, lng: 105.4000 } },
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'],
    category: 'mountain', priceRange: 'budget', rating: 4.9, reviewCount: 2780,
    amenities: ['Điểm dừng chân', 'Quán cà phê', 'Tour xe máy'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 11'],
    activities: ['Phượt xe máy', 'Ngắm cảnh', 'Chụp ảnh']
  },

  // 🏙️ THÀNH PHỐ (City) - 10 địa điểm
  {
    name: 'Hà Nội',
    description: 'Thủ đô ngàn năm văn hiến với phố cổ, hồ Hoàn Kiếm và ẩm thực đường phố nổi tiếng.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.0285, lng: 105.8542 } },
    images: ['https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800'],
    category: 'city', priceRange: 'mid-range', rating: 4.7, reviewCount: 4560,
    amenities: ['Khách sạn', 'Nhà hàng', 'Phố cổ', 'Bảo tàng'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 3', 'Tháng 4'],
    activities: ['Tham quan phố cổ', 'Ăn phở', 'Xem múa rối nước']
  },
  {
    name: 'TP. Hồ Chí Minh',
    description: 'Thành phố năng động nhất Việt Nam với kiến trúc Pháp và cuộc sống về đêm sôi động.',
    location: { city: 'TP. Hồ Chí Minh', country: 'Việt Nam', coordinates: { lat: 10.8231, lng: 106.6297 } },
    images: ['https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800'],
    category: 'city', priceRange: 'mid-range', rating: 4.6, reviewCount: 5230,
    amenities: ['Khách sạn', 'Trung tâm thương mại', 'Quán bar', 'Bảo tàng'],
    bestTimeToVisit: ['Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3'],
    activities: ['Tham quan Dinh Độc Lập', 'Mua sắm', 'Ăn uống đường phố']
  },
  {
    name: 'Đà Nẵng',
    description: 'Thành phố đáng sống với cầu Rồng, Bà Nà Hills và bãi biển tuyệt đẹp.',
    location: { city: 'Đà Nẵng', country: 'Việt Nam', coordinates: { lat: 16.0544, lng: 108.2022 } },
    images: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800'],
    category: 'city', priceRange: 'mid-range', rating: 4.8, reviewCount: 3890,
    amenities: ['Resort', 'Bà Nà Hills', 'Cầu Rồng', 'Chợ Hàn'],
    bestTimeToVisit: ['Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Tham quan Bà Nà', 'Ngắm cầu Rồng phun lửa', 'Tắm biển']
  },
  {
    name: 'Huế',
    description: 'Cố đô với Đại Nội, lăng tẩm và ẩm thực cung đình tinh tế.',
    location: { city: 'Huế', country: 'Việt Nam', coordinates: { lat: 16.4637, lng: 107.5909 } },
    images: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800'],
    category: 'city', priceRange: 'budget', rating: 4.7, reviewCount: 2890,
    amenities: ['Khách sạn', 'Đại Nội', 'Lăng tẩm', 'Sông Hương'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4'],
    activities: ['Tham quan Đại Nội', 'Du thuyền sông Hương', 'Ăn bún bò Huế']
  },
  {
    name: 'Hội An',
    description: 'Phố cổ di sản UNESCO với đèn lồng lung linh và kiến trúc cổ kính.',
    location: { city: 'Quảng Nam', country: 'Việt Nam', coordinates: { lat: 15.8801, lng: 108.3380 } },
    images: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800'],
    category: 'city', priceRange: 'mid-range', rating: 4.9, reviewCount: 4120,
    amenities: ['Homestay', 'Phố cổ', 'Chợ đêm', 'Làng rau Trà Quế'],
    bestTimeToVisit: ['Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Dạo phố cổ', 'Thả đèn hoa đăng', 'May áo dài']
  },
  {
    name: 'Đà Lạt',
    description: 'Thành phố ngàn hoa với khí hậu mát mẻ, kiến trúc Pháp và cảnh quan thơ mộng.',
    location: { city: 'Lâm Đồng', country: 'Việt Nam', coordinates: { lat: 11.9404, lng: 108.4583 } },
    images: ['https://images.unsplash.com/photo-1555217851-6141535bd771?w=800'],
    category: 'city', priceRange: 'mid-range', rating: 4.8, reviewCount: 3670,
    amenities: ['Khách sạn', 'Vườn hoa', 'Thác nước', 'Chợ đêm'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Tham quan vườn hoa', 'Cắm trại', 'Uống cà phê']
  },
  {
    name: 'Cần Thơ',
    description: 'Thủ phủ miền Tây với chợ nổi Cái Răng và vườn trái cây bạt ngàn.',
    location: { city: 'Cần Thơ', country: 'Việt Nam', coordinates: { lat: 10.0452, lng: 105.7469 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'city', priceRange: 'budget', rating: 4.5, reviewCount: 1890,
    amenities: ['Khách sạn', 'Chợ nổi', 'Vườn trái cây', 'Bến Ninh Kiều'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Đi chợ nổi', 'Tham quan vườn trái cây', 'Nghe đờn ca tài tử']
  },
  {
    name: 'Hải Phòng',
    description: 'Thành phố cảng với kiến trúc Pháp, hoa phượng đỏ và ẩm thực đặc sắc.',
    location: { city: 'Hải Phòng', country: 'Việt Nam', coordinates: { lat: 20.8449, lng: 106.6881 } },
    images: ['https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800'],
    category: 'city', priceRange: 'budget', rating: 4.4, reviewCount: 1450,
    amenities: ['Khách sạn', 'Nhà hát lớn', 'Đồ Sơn', 'Cát Bà'],
    bestTimeToVisit: ['Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8'],
    activities: ['Tham quan Cát Bà', 'Tắm biển Đồ Sơn', 'Ăn bánh đa cua']
  },
  {
    name: 'Vũng Tàu',
    description: 'Thành phố biển gần Sài Gòn với tượng Chúa Kitô và hải sản tươi ngon.',
    location: { city: 'Bà Rịa – Vũng Tàu', country: 'Việt Nam', coordinates: { lat: 10.4114, lng: 107.1362 } },
    images: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
    category: 'city', priceRange: 'budget', rating: 4.3, reviewCount: 2340,
    amenities: ['Khách sạn', 'Bãi biển', 'Tượng Chúa Kitô', 'Hải đăng'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Tắm biển', 'Leo núi Nhỏ', 'Ăn hải sản']
  },

  // 🌾 NÔNG THÔN (Countryside) - 10 địa điểm
  {
    name: 'Làng cổ Đường Lâm',
    description: 'Làng cổ đá ong duy nhất còn nguyên vẹn ở đồng bằng Bắc Bộ.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.1500, lng: 105.4500 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.5, reviewCount: 1230,
    amenities: ['Homestay', 'Nhà cổ', 'Đình làng', 'Quán ăn địa phương'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 11'],
    activities: ['Tham quan nhà cổ', 'Ăn kẹo lạc', 'Chụp ảnh']
  },
  {
    name: 'Làng rau Trà Quế',
    description: 'Làng rau hữu cơ nổi tiếng Hội An với trải nghiệm làm nông dân.',
    location: { city: 'Hội An', country: 'Việt Nam', coordinates: { lat: 15.9000, lng: 108.3333 } },
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.4, reviewCount: 890,
    amenities: ['Tour trải nghiệm', 'Nhà hàng', 'Spa thảo dược'],
    bestTimeToVisit: ['Tháng 2', 'Tháng 3', 'Tháng 4'],
    activities: ['Trồng rau', 'Đạp xe', 'Massage thảo dược']
  },
  {
    name: 'Bản Cát Cát',
    description: 'Bản làng người HMông với thác nước đẹp và nghề dệt thổ cẩm truyền thống.',
    location: { city: 'Sa Pa', country: 'Việt Nam', coordinates: { lat: 22.3167, lng: 103.8333 } },
    images: ['https://images.unsplash.com/photo-1570366583862-f91883984fde?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.6, reviewCount: 1560,
    amenities: ['Homestay', 'Thác nước', 'Cầu treo', 'Chợ thổ cẩm'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 3', 'Tháng 4'],
    activities: ['Trekking', 'Tham quan bản làng', 'Mua thổ cẩm']
  },
  {
    name: 'Bản Lác Mai Châu',
    description: 'Bản làng người Thái với nhà sàn truyền thống và múa xòe đặc sắc.',
    location: { city: 'Hòa Bình', country: 'Việt Nam', coordinates: { lat: 20.6667, lng: 105.0833 } },
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.5, reviewCount: 1340,
    amenities: ['Homestay nhà sàn', 'Múa xòe', 'Rượu cần', 'Xe đạp'],
    bestTimeToVisit: ['Tháng 10', 'Tháng 11', 'Tháng 3', 'Tháng 4'],
    activities: ['Ngủ nhà sàn', 'Xem múa xòe', 'Đạp xe quanh bản']
  },
  {
    name: 'Làng hoa Sa Đéc',
    description: 'Vương quốc hoa miền Tây với hàng trăm loài hoa rực rỡ quanh năm.',
    location: { city: 'Đồng Tháp', country: 'Việt Nam', coordinates: { lat: 10.2833, lng: 105.7667 } },
    images: ['https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.4, reviewCount: 980,
    amenities: ['Vườn hoa', 'Nhà cổ Huỳnh Thủy Lê', 'Chợ hoa'],
    bestTimeToVisit: ['Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Tham quan vườn hoa', 'Chụp ảnh', 'Mua hoa']
  },
  {
    name: 'Làng chài Cửa Vạn',
    description: 'Làng chài nổi trên vịnh Hạ Long với cuộc sống ngư dân độc đáo.',
    location: { city: 'Hạ Long', country: 'Việt Nam', coordinates: { lat: 20.8500, lng: 107.1000 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'countryside', priceRange: 'mid-range', rating: 4.6, reviewCount: 1120,
    amenities: ['Tour thuyền', 'Nhà nổi', 'Hải sản tươi sống'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Chèo thuyền kayak', 'Câu cá', 'Tham quan làng chài']
  },
  {
    name: 'Bản Pom Coọng',
    description: 'Bản làng người Thái yên bình với ruộng bậc thang và nhà sàn cổ.',
    location: { city: 'Mai Châu', country: 'Việt Nam', coordinates: { lat: 20.6500, lng: 105.0667 } },
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.3, reviewCount: 670,
    amenities: ['Homestay', 'Ruộng bậc thang', 'Suối'],
    bestTimeToVisit: ['Tháng 5', 'Tháng 6', 'Tháng 9', 'Tháng 10'],
    activities: ['Trekking', 'Ngủ homestay', 'Tắm suối']
  },
  {
    name: 'Làng nổi Tân Lập',
    description: 'Rừng tràm ngập nước với hệ sinh thái độc đáo và cầu tre dài nhất Việt Nam.',
    location: { city: 'Long An', country: 'Việt Nam', coordinates: { lat: 10.7000, lng: 106.2000 } },
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.5, reviewCount: 890,
    amenities: ['Cầu tre', 'Thuyền', 'Nhà hàng', 'Chòi nghỉ'],
    bestTimeToVisit: ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11'],
    activities: ['Đi thuyền', 'Đi bộ cầu tre', 'Ngắm sen']
  },
  {
    name: 'Làng gốm Bát Tràng',
    description: 'Làng nghề gốm sứ 500 năm tuổi với trải nghiệm tự tay làm gốm.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.0000, lng: 105.9167 } },
    images: ['https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.4, reviewCount: 1450,
    amenities: ['Xưởng gốm', 'Chợ gốm', 'Quán ăn'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Làm gốm', 'Mua sắm', 'Tham quan xưởng']
  },
  {
    name: 'Làng cổ Phước Tích',
    description: 'Làng cổ 500 năm bên sông Ô Lâu với nhà rường và nghề gốm truyền thống.',
    location: { city: 'Huế', country: 'Việt Nam', coordinates: { lat: 16.5500, lng: 107.4000 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'countryside', priceRange: 'budget', rating: 4.3, reviewCount: 560,
    amenities: ['Nhà rường cổ', 'Lò gốm', 'Sông Ô Lâu'],
    bestTimeToVisit: ['Tháng 2', 'Tháng 3', 'Tháng 4'],
    activities: ['Tham quan nhà cổ', 'Làm gốm', 'Đi thuyền']
  },

  // 🏛️ DI TÍCH (Historical) - 10 địa điểm
  {
    name: 'Quần thể di tích Cố đô Huế',
    description: 'Di sản văn hóa thế giới UNESCO với Đại Nội, lăng tẩm và kiến trúc cung đình.',
    location: { city: 'Huế', country: 'Việt Nam', coordinates: { lat: 16.4698, lng: 107.5796 } },
    images: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.8, reviewCount: 3450,
    amenities: ['Hướng dẫn viên', 'Bảo tàng', 'Nhà hàng cung đình'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4'],
    activities: ['Tham quan Đại Nội', 'Viếng lăng tẩm', 'Xem nhã nhạc cung đình']
  },
  {
    name: 'Văn Miếu – Quốc Tử Giám',
    description: 'Trường đại học đầu tiên của Việt Nam, biểu tượng của nền giáo dục.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.0285, lng: 105.8356 } },
    images: ['https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.7, reviewCount: 2890,
    amenities: ['Hướng dẫn viên', 'Bia tiến sĩ', 'Khuê Văn Các'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Tham quan', 'Cầu may mắn', 'Chụp ảnh']
  },
  {
    name: 'Hoàng thành Thăng Long',
    description: 'Di sản văn hóa thế giới UNESCO, trung tâm quyền lực của các triều đại Việt Nam.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.0350, lng: 105.8400 } },
    images: ['https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.6, reviewCount: 2340,
    amenities: ['Bảo tàng', 'Hướng dẫn viên', 'Khu khảo cổ'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Tham quan', 'Tìm hiểu lịch sử', 'Chụp ảnh']
  },
  {
    name: 'Thánh địa Mỹ Sơn',
    description: 'Di sản văn hóa thế giới UNESCO với quần thể đền tháp Chăm Pa cổ kính.',
    location: { city: 'Quảng Nam', country: 'Việt Nam', coordinates: { lat: 15.7644, lng: 108.1250 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.7, reviewCount: 2120,
    amenities: ['Hướng dẫn viên', 'Bảo tàng', 'Biểu diễn Apsara'],
    bestTimeToVisit: ['Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Tham quan đền tháp', 'Xem múa Apsara', 'Tìm hiểu văn hóa Chăm']
  },
  {
    name: 'Địa đạo Củ Chi',
    description: 'Hệ thống địa đạo huyền thoại trong kháng chiến chống Mỹ.',
    location: { city: 'TP. Hồ Chí Minh', country: 'Việt Nam', coordinates: { lat: 11.1417, lng: 106.4625 } },
    images: ['https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.6, reviewCount: 2780,
    amenities: ['Hướng dẫn viên', 'Bảo tàng', 'Trường bắn'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Chui địa đạo', 'Bắn súng', 'Xem phim tài liệu']
  },
  {
    name: 'Nhà tù Côn Đảo',
    description: 'Di tích lịch sử ghi dấu tội ác thực dân và tinh thần bất khuất của chiến sĩ cách mạng.',
    location: { city: 'Côn Đảo', country: 'Việt Nam', coordinates: { lat: 8.6833, lng: 106.6000 } },
    images: ['https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.8, reviewCount: 1890,
    amenities: ['Bảo tàng', 'Hướng dẫn viên', 'Nghĩa trang Hàng Dương'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 5'],
    activities: ['Tham quan nhà tù', 'Viếng nghĩa trang', 'Tìm hiểu lịch sử']
  },
  {
    name: 'Khu di tích Pác Bó',
    description: 'Nơi Bác Hồ sống và làm việc khi mới về nước, với hang Cốc Bó và suối Lê Nin.',
    location: { city: 'Cao Bằng', country: 'Việt Nam', coordinates: { lat: 22.8500, lng: 106.0667 } },
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.5, reviewCount: 1120,
    amenities: ['Bảo tàng', 'Hang Cốc Bó', 'Suối Lê Nin'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 11'],
    activities: ['Tham quan hang', 'Tìm hiểu lịch sử', 'Ngắm cảnh']
  },
  {
    name: 'Thành Nhà Hồ',
    description: 'Di sản văn hóa thế giới UNESCO, thành đá độc đáo của triều Hồ.',
    location: { city: 'Thanh Hóa', country: 'Việt Nam', coordinates: { lat: 20.0833, lng: 105.6167 } },
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.4, reviewCount: 780,
    amenities: ['Hướng dẫn viên', 'Bảo tàng', 'Cổng thành'],
    bestTimeToVisit: ['Tháng 9', 'Tháng 10', 'Tháng 11'],
    activities: ['Tham quan thành', 'Tìm hiểu lịch sử', 'Chụp ảnh']
  },
  {
    name: 'Chùa Một Cột',
    description: 'Biểu tượng của Hà Nội với kiến trúc độc đáo hình hoa sen.',
    location: { city: 'Hà Nội', country: 'Việt Nam', coordinates: { lat: 21.0358, lng: 105.8336 } },
    images: ['https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.5, reviewCount: 2340,
    amenities: ['Chùa', 'Lăng Bác', 'Công viên'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Viếng chùa', 'Tham quan Lăng Bác', 'Chụp ảnh']
  },
  {
    name: 'Dinh Độc Lập',
    description: 'Biểu tượng lịch sử của Sài Gòn, nơi chứng kiến thời khắc thống nhất đất nước.',
    location: { city: 'TP. Hồ Chí Minh', country: 'Việt Nam', coordinates: { lat: 10.7769, lng: 106.6953 } },
    images: ['https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800'],
    category: 'historical', priceRange: 'budget', rating: 4.7, reviewCount: 3120,
    amenities: ['Bảo tàng', 'Hướng dẫn viên', 'Hầm ngầm'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Tham quan', 'Tìm hiểu lịch sử', 'Chụp ảnh']
  }
];

const seedDestinations = async () => {
  console.log('Starting seed script...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'NOT FOUND');
  
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing destinations
    await Destination.deleteMany({});
    console.log('Cleared existing destinations');

    // Insert new destinations
    console.log(`Inserting ${destinations.length} destinations...`);
    const result = await Destination.insertMany(destinations);
    console.log(`✅ Successfully seeded ${result.length} destinations!`);
    
    // Show summary by category
    const categories = ['beach', 'mountain', 'city', 'countryside', 'historical'];
    for (const cat of categories) {
      const count = result.filter(d => d.category === cat).length;
      console.log(`   - ${cat}: ${count} destinations`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding destinations:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

seedDestinations();
