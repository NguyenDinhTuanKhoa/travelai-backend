/**
 * genMoreCommunityTours.js
 *
 * Sinh thêm 15 tour cộng đồng (ct-23 → ct-37) cho trang /my-tours.
 * Quy trình giống getTenToursImages.js: dùng Serper tìm ảnh thật cho cover +
 * từng trạm, verify URL còn sống, rồi lắp vào object Tour và CHÈN trực tiếp vào
 * mảng COMMUNITY_TOURS trong frontend/app/my-tours/page.tsx.
 *
 * Chạy:  node src/scripts/genMoreCommunityTours.js
 *   --dry  : chỉ tìm ảnh + in JSON, KHÔNG sửa page.tsx
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const serperManager = require('../utils/serperManager');

const DRY = process.argv.includes('--dry');
const PAGE = path.resolve(__dirname, '../../../frontend/app/my-tours/page.tsx');

// Ảnh dự phòng theo category (Unsplash — luôn tải được) nếu Serper không trả URL sống.
const FALLBACK = {
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80',
  island: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&q=80',
  mountain: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
  nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&q=80',
  heritage: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=900&q=80',
  city: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=900&q=80',
  countryside: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80',
};

function checkImageUrl(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

async function firstValidImage(query, fallbackCategory) {
  try {
    const images = await serperManager.searchImages(query, 10);
    // Chỉ thử tối đa 6 URL đầu để tránh treo lâu khi gặp nhiều link chết.
    for (const url of images.slice(0, 6)) {
      if (await checkImageUrl(url, 3500)) return url;
    }
  } catch { /* ignore */ }
  return FALLBACK[fallbackCategory] || FALLBACK.nature;
}

// ── Dữ liệu 15 tour mới ───────────────────────────────────────────────────────
const DATA = [
  {
    id: 'ct-23',
    title: '2 Ngày Hà Nội — Thủ Đô Ngàn Năm Văn Hiến',
    coverQuery: 'Hồ Hoàn Kiếm Hà Nội cảnh đẹp',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Thành phố', categoryIcon: '🏙️', region: 'Miền Bắc',
    priceRange: 'budget', priceLabel: '1.700.000 ₫',
    rating: 4.7, reviewCount: 305, viewCount: 11800,
    tags: ['Phố cổ 36 phố phường', 'Kiến trúc Pháp', 'Văn hóa lịch sử', 'Ẩm thực đường phố'],
    highlights: ['Dạo quanh Hồ Hoàn Kiếm & Đền Ngọc Sơn', 'Tham quan Văn Miếu Quốc Tử Giám', 'Viếng Lăng Chủ tịch Hồ Chí Minh', 'Thưởng thức ẩm thực Phố cổ về đêm'],
    badge: '🏙️ Cổ kính', badgeColor: 'bg-rose-500',
    author: 'Thu Phương', authorAvatar: 'TP', completedDate: '04/2026',
    description: 'Hành trình 2 ngày khám phá trái tim của cả nước. Hà Nội với những con phố cổ rêu phong, hồ Gươm thơ mộng, kiến trúc Pháp cổ kính và thiên đường ẩm thực đường phố làm say lòng du khách.',
    stops: [
      { name: 'Hồ Hoàn Kiếm', city: 'Hà Nội', query: 'Hồ Hoàn Kiếm Đền Ngọc Sơn Hà Nội', category: 'city', rating: 4.8, description: 'Trái tim của thủ đô với Tháp Rùa và Đền Ngọc Sơn cổ kính', coordinates: { lat: 21.0287, lng: 105.8524 } },
      { name: 'Văn Miếu — Quốc Tử Giám', city: 'Hà Nội', query: 'Văn Miếu Quốc Tử Giám Hà Nội', category: 'heritage', rating: 4.7, description: 'Trường đại học đầu tiên của Việt Nam, biểu tượng hiếu học', coordinates: { lat: 21.0294, lng: 105.8355 } },
      { name: 'Lăng Chủ tịch Hồ Chí Minh', city: 'Hà Nội', query: 'Lăng Chủ tịch Hồ Chí Minh Ba Đình', category: 'heritage', rating: 4.8, description: 'Nơi an nghỉ của Bác Hồ trên quảng trường Ba Đình lịch sử', coordinates: { lat: 21.0368, lng: 105.8344 } },
      { name: 'Phố cổ Hà Nội', city: 'Hà Nội', query: 'Phố cổ Hà Nội 36 phố phường về đêm', category: 'city', rating: 4.6, description: 'Khu 36 phố phường sầm uất, thiên đường ẩm thực đường phố', coordinates: { lat: 21.034, lng: 105.85 } },
    ],
    reviews: [
      { name: 'Gia Hân', avatar: 'GH', date: '04/2026', rating: 5, text: 'Phố cổ về đêm cực kỳ nhộn nhịp, ăn bún chả, phở, cà phê trứng ngon mê ly. Hồ Gươm sáng sớm yên bình lắm.', helpful: 47 },
      { name: 'Tiến Đạt', avatar: 'TĐ', date: '03/2026', rating: 4, text: 'Văn Miếu rất đẹp và ý nghĩa, nên thuê hướng dẫn viên để hiểu hết lịch sử. Giao thông hơi đông nhưng đáng trải nghiệm.', helpful: 23 },
    ],
  },
  {
    id: 'ct-24',
    title: '3 Ngày Cát Bà — Vịnh Lan Hạ Hoang Sơ',
    coverQuery: 'Đảo Cát Bà Vịnh Lan Hạ cảnh đẹp',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Biển', categoryIcon: '🏖️', region: 'Miền Bắc',
    priceRange: 'mid-range', priceLabel: '4.300.000 ₫',
    rating: 4.8, reviewCount: 214, viewCount: 7300,
    tags: ['Vịnh biển hoang sơ', 'Chèo kayak', 'Vườn quốc gia', 'Hải sản tươi'],
    highlights: ['Du thuyền khám phá Vịnh Lan Hạ', 'Chèo kayak qua các hòn đảo đá vôi', 'Trekking Vườn quốc gia Cát Bà', 'Tắm biển bãi Cát Cò trong xanh'],
    badge: '🌊 Hoang sơ', badgeColor: 'bg-cyan-500',
    author: 'Hải Đăng', authorAvatar: 'HĐ', completedDate: '04/2026',
    description: 'Hành trình 3 ngày khám phá hòn đảo lớn nhất vịnh Bắc Bộ. Vịnh Lan Hạ được ví như Hạ Long thu nhỏ nhưng hoang sơ hơn, nước trong xanh và ít tàu thuyền, lý tưởng cho chèo kayak và tắm biển.',
    stops: [
      { name: 'Vịnh Lan Hạ', city: 'Cát Bà', query: 'Vịnh Lan Hạ Cát Bà Hải Phòng', category: 'nature', rating: 4.9, description: 'Vịnh biển hoang sơ với hàng trăm hòn đảo đá vôi kỳ vĩ', coordinates: { lat: 20.7167, lng: 107.0833 } },
      { name: 'Đảo Cát Bà', city: 'Hải Phòng', query: 'Thị trấn Cát Bà Hải Phòng', category: 'island', rating: 4.6, description: 'Hòn đảo lớn nhất quần đảo Cát Bà nhộn nhịp về đêm', coordinates: { lat: 20.7283, lng: 107.0489 } },
      { name: 'Vườn quốc gia Cát Bà', city: 'Cát Bà', query: 'Vườn quốc gia Cát Bà', category: 'nature', rating: 4.7, description: 'Khu dự trữ sinh quyển thế giới với loài voọc Cát Bà quý hiếm', coordinates: { lat: 20.795, lng: 106.9986 } },
      { name: 'Bãi tắm Cát Cò', city: 'Cát Bà', query: 'Bãi tắm Cát Cò Cát Bà', category: 'beach', rating: 4.6, description: 'Bãi tắm nước trong vắt nép mình dưới chân vách núi', coordinates: { lat: 20.7197, lng: 107.0506 } },
    ],
    reviews: [
      { name: 'Phương Anh', avatar: 'PA', date: '04/2026', rating: 5, text: 'Vịnh Lan Hạ đẹp không kém Hạ Long mà vắng hơn nhiều. Chèo kayak luồn lách qua các đảo đá cực thích. Hải sản tươi và rẻ!', helpful: 35 },
      { name: 'Minh Quân', avatar: 'MQ', date: '03/2026', rating: 4, text: 'Bãi Cát Cò nước xanh ngắt. Trekking vườn quốc gia hơi mệt nhưng view trên cao toàn đảo rất đáng.', helpful: 18 },
    ],
  },
  {
    id: 'ct-25',
    title: '3 Ngày Cao Bằng — Thác Bản Giốc Hùng Vĩ',
    coverQuery: 'Thác Bản Giốc Cao Bằng hùng vĩ',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Núi', categoryIcon: '🏔️', region: 'Đông Bắc',
    priceRange: 'mid-range', priceLabel: '3.900.000 ₫',
    rating: 4.9, reviewCount: 176, viewCount: 5600,
    tags: ['Thác nước hùng vĩ', 'Hang động kỳ bí', 'Di tích cách mạng', 'Hồ trên núi'],
    highlights: ['Chiêm ngưỡng Thác Bản Giốc hùng vĩ', 'Khám phá Động Ngườm Ngao thạch nhũ', 'Về nguồn tại Khu di tích Pác Bó', 'Ngắm Hồ Thang Hen xanh biếc'],
    badge: '💧 Thác đẹp nhất', badgeColor: 'bg-teal-600',
    author: 'Đức Trung', authorAvatar: 'ĐT', completedDate: '03/2026',
    description: 'Hành trình 3 ngày chinh phục vùng non nước Cao Bằng. Đứng trước thác Bản Giốc — thác nước tự nhiên lớn nhất Đông Nam Á, len lỏi trong động Ngườm Ngao kỳ ảo và về nguồn nơi Bác Hồ từng sống.',
    stops: [
      { name: 'Thác Bản Giốc', city: 'Cao Bằng', query: 'Thác Bản Giốc Cao Bằng', category: 'nature', rating: 5.0, description: 'Thác nước tự nhiên lớn nhất Đông Nam Á nơi biên giới Việt-Trung', coordinates: { lat: 22.8533, lng: 106.7236 } },
      { name: 'Động Ngườm Ngao', city: 'Cao Bằng', query: 'Động Ngườm Ngao Cao Bằng', category: 'nature', rating: 4.8, description: 'Hang động thạch nhũ kỳ ảo dài hàng cây số', coordinates: { lat: 22.8417, lng: 106.7053 } },
      { name: 'Khu di tích Pác Bó', city: 'Cao Bằng', query: 'Khu di tích Pác Bó suối Lê Nin', category: 'heritage', rating: 4.7, description: 'Nơi Bác Hồ trở về sau 30 năm bôn ba với suối Lê Nin, núi Các Mác', coordinates: { lat: 22.9744, lng: 105.9986 } },
      { name: 'Hồ Thang Hen', city: 'Cao Bằng', query: 'Hồ Thang Hen Cao Bằng', category: 'nature', rating: 4.6, description: 'Hồ nước ngọt xanh biếc giữa thung lũng núi đá tai mèo', coordinates: { lat: 22.7117, lng: 106.1747 } },
    ],
    reviews: [
      { name: 'Hoàng Nam', avatar: 'HN', date: '03/2026', rating: 5, text: 'Bản Giốc hùng vĩ ngoài sức tưởng tượng, tiếng nước đổ ầm ầm. Đi bè tre tới sát chân thác cực đã. Cảnh đẹp nhất Đông Bắc!', helpful: 41 },
      { name: 'Lan Phương', avatar: 'LP', date: '02/2026', rating: 5, text: 'Động Ngườm Ngao thạch nhũ lung linh, mát lạnh. Người Tày ở đây hiền hậu, ăn vịt quay 7 vị Cao Bằng siêu ngon.', helpful: 24 },
    ],
  },
  {
    id: 'ct-26',
    title: '2 Ngày Mộc Châu — Cao Nguyên Xanh Tây Bắc',
    coverQuery: 'Đồi chè Mộc Châu Sơn La cảnh đẹp',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Núi', categoryIcon: '🏔️', region: 'Tây Bắc',
    priceRange: 'budget', priceLabel: '1.600.000 ₫',
    rating: 4.7, reviewCount: 201, viewCount: 6900,
    tags: ['Đồi chè xanh mướt', 'Thác nước', 'Mùa hoa mận hoa cải', 'Bản làng dân tộc'],
    highlights: ['Check-in Đồi chè trái tim biểu tượng', 'Tắm mát tại Thác Dải Yếm', 'Cắm trại tại Rừng thông bản Áng', 'Ngắm thung lũng mận Nà Ka mùa hoa'],
    badge: '🍃 Mát lành', badgeColor: 'bg-green-600',
    author: 'Bảo Ngọc', authorAvatar: 'BN', completedDate: '02/2026',
    description: 'Hành trình 2 ngày trốn nóng tại cao nguyên Mộc Châu xanh mát. Lạc giữa những đồi chè trải dài bất tận, tắm dưới dòng thác Dải Yếm trắng xóa và ngắm sắc trắng hoa mận phủ kín thung lũng.',
    stops: [
      { name: 'Đồi chè trái tim', city: 'Mộc Châu', query: 'Đồi chè trái tim Mộc Châu', category: 'countryside', rating: 4.8, description: 'Đồi chè hình trái tim biểu tượng check-in của Mộc Châu', coordinates: { lat: 20.8369, lng: 104.6692 } },
      { name: 'Thác Dải Yếm', city: 'Mộc Châu', query: 'Thác Dải Yếm Mộc Châu', category: 'nature', rating: 4.7, description: 'Thác nước trắng xóa đổ xuống từ độ cao 100m', coordinates: { lat: 20.8197, lng: 104.6256 } },
      { name: 'Rừng thông bản Áng', city: 'Mộc Châu', query: 'Rừng thông bản Áng Mộc Châu', category: 'countryside', rating: 4.6, description: 'Rừng thông bên hồ nước thơ mộng, điểm cắm trại lý tưởng', coordinates: { lat: 20.85, lng: 104.6892 } },
      { name: 'Thung lũng mận Nà Ka', city: 'Mộc Châu', query: 'Thung lũng mận Nà Ka Mộc Châu', category: 'countryside', rating: 4.7, description: 'Thung lũng mận bạt ngàn nở trắng vào mùa xuân', coordinates: { lat: 20.8742, lng: 104.6606 } },
    ],
    reviews: [
      { name: 'Khánh Vy', avatar: 'KV', date: '02/2026', rating: 5, text: 'Đồi chè xanh mướt mắt, không khí trong lành mát rượi. Sữa chua, bê chao Mộc Châu ăn là ghiền. Rất hợp đi cuối tuần!', helpful: 38 },
      { name: 'Trọng Nghĩa', avatar: 'TN', date: '01/2026', rating: 4, text: 'Thác Dải Yếm mùa nước đẹp lắm. Cắm trại rừng thông bản Áng buổi tối se lạnh rất chill.', helpful: 17 },
    ],
  },
  {
    id: 'ct-27',
    title: '2 Ngày Hồ Ba Bể — Viên Ngọc Xanh Bắc Kạn',
    coverQuery: 'Hồ Ba Bể Bắc Kạn cảnh đẹp',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Núi', categoryIcon: '🏔️', region: 'Đông Bắc',
    priceRange: 'budget', priceLabel: '1.500.000 ₫',
    rating: 4.7, reviewCount: 132, viewCount: 4100,
    tags: ['Hồ nước ngọt tự nhiên', 'Đi thuyền độc mộc', 'Hang động', 'Vườn quốc gia'],
    highlights: ['Du thuyền trên Hồ Ba Bể yên ả', 'Khám phá Động Puông kỳ bí', 'Ngắm Thác Đầu Đẳng nhiều tầng', 'Ghé Ao Tiên huyền thoại'],
    badge: '💎 Yên bình', badgeColor: 'bg-emerald-600',
    author: 'Thanh Tùng', authorAvatar: 'TT', completedDate: '03/2026',
    description: 'Hành trình 2 ngày thư thái giữa lòng hồ nước ngọt tự nhiên lớn nhất Việt Nam. Lênh đênh trên thuyền độc mộc giữa Hồ Ba Bể phẳng lặng, len qua Động Puông rộng lớn và nghỉ tại homestay người Tày.',
    stops: [
      { name: 'Hồ Ba Bể', city: 'Bắc Kạn', query: 'Hồ Ba Bể Bắc Kạn', category: 'nature', rating: 4.9, description: 'Hồ nước ngọt tự nhiên trên núi lớn nhất Việt Nam', coordinates: { lat: 22.4019, lng: 105.6178 } },
      { name: 'Động Puông', city: 'Bắc Kạn', query: 'Động Puông Ba Bể Bắc Kạn', category: 'nature', rating: 4.7, description: 'Hang động lớn nơi sông Năng chảy xuyên qua lòng núi', coordinates: { lat: 22.45, lng: 105.6167 } },
      { name: 'Thác Đầu Đẳng', city: 'Bắc Kạn', query: 'Thác Đầu Đẳng Ba Bể', category: 'nature', rating: 4.6, description: 'Thác nước nhiều tầng đổ qua những tảng đá lớn giữa rừng', coordinates: { lat: 22.3667, lng: 105.6333 } },
      { name: 'Ao Tiên', city: 'Bắc Kạn', query: 'Ao Tiên Hồ Ba Bể', category: 'nature', rating: 4.5, description: 'Hồ nước nhỏ trong vắt gắn với truyền thuyết tiên giáng trần', coordinates: { lat: 22.405, lng: 105.62 } },
    ],
    reviews: [
      { name: 'Quỳnh Anh', avatar: 'QA', date: '03/2026', rating: 5, text: 'Hồ Ba Bể yên bình đến lạ, ngồi thuyền độc mộc giữa hồ cảm giác thư giãn vô cùng. Homestay người Tày ấm cúng, đồ ăn ngon.', helpful: 29 },
      { name: 'Đăng Khoa', avatar: 'ĐK', date: '02/2026', rating: 4, text: 'Động Puông đi thuyền xuyên qua rất thích, nhiều dơi. Đường lên hơi xa nhưng cảnh quan bù đắp xứng đáng.', helpful: 13 },
    ],
  },
  {
    id: 'ct-28',
    title: '2 Ngày Tam Đảo — Thị Trấn Trong Mây',
    coverQuery: 'Thị trấn Tam Đảo Vĩnh Phúc trong sương',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Núi', categoryIcon: '🏔️', region: 'Miền Bắc',
    priceRange: 'budget', priceLabel: '1.400.000 ₫',
    rating: 4.6, reviewCount: 256, viewCount: 9100,
    tags: ['Thị trấn trong mây', 'Khí hậu mát mẻ', 'Nhà thờ đá', 'Săn mây'],
    highlights: ['Săn mây tại thị trấn Tam Đảo', 'Check-in Nhà thờ đá cổ kính', 'Khám phá Thác Bạc mát lạnh', 'Ngắm toàn cảnh từ Tháp truyền hình'],
    badge: '☁️ Săn mây', badgeColor: 'bg-slate-500',
    author: 'Mỹ Linh', authorAvatar: 'ML', completedDate: '04/2026',
    description: 'Hành trình 2 ngày đổi gió tại thị trấn nghỉ mát trong mây Tam Đảo. Chỉ cách Hà Nội hơn 80km, nơi đây quanh năm mát mẻ với màn sương mờ ảo, nhà thờ đá Pháp cổ và những quán cà phê view núi tuyệt đẹp.',
    stops: [
      { name: 'Thị trấn Tam Đảo', city: 'Vĩnh Phúc', query: 'Thị trấn Tam Đảo Vĩnh Phúc', category: 'city', rating: 4.7, description: 'Thị trấn nghỉ dưỡng trên núi quanh năm mây mù bao phủ', coordinates: { lat: 21.4561, lng: 105.6447 } },
      { name: 'Nhà thờ đá Tam Đảo', city: 'Tam Đảo', query: 'Nhà thờ đá Tam Đảo', category: 'heritage', rating: 4.7, description: 'Nhà thờ Pháp cổ bằng đá, biểu tượng check-in của Tam Đảo', coordinates: { lat: 21.4567, lng: 105.645 } },
      { name: 'Thác Bạc', city: 'Tam Đảo', query: 'Thác Bạc Tam Đảo', category: 'nature', rating: 4.4, description: 'Dòng thác trắng xóa len qua khe núi giữa rừng cây', coordinates: { lat: 21.4592, lng: 105.6442 } },
      { name: 'Tháp truyền hình Tam Đảo', city: 'Tam Đảo', query: 'Tháp truyền hình Tam Đảo đỉnh núi', category: 'mountain', rating: 4.5, description: 'Đỉnh cao nhất Tam Đảo với hơn 1.300 bậc thang săn mây', coordinates: { lat: 21.4486, lng: 105.6494 } },
    ],
    reviews: [
      { name: 'Hồng Nhung', avatar: 'HN', date: '04/2026', rating: 5, text: 'Trốn nóng Hà Nội lên Tam Đảo quá hợp lý. Sáng sớm mây phủ kín đường đẹp như tiên cảnh. Nhà thờ đá chụp ảnh siêu nghệ.', helpful: 44 },
      { name: 'Văn Hậu', avatar: 'VH', date: '03/2026', rating: 4, text: 'Leo tháp truyền hình hơi mệt nhưng săn mây trên đỉnh đáng giá. Đồ nướng và ngọn su su Tam Đảo ăn ngon.', helpful: 19 },
    ],
  },
  {
    id: 'ct-29',
    title: '2 Ngày Bắc Ninh — Miền Quan Họ Kinh Bắc',
    coverQuery: 'Đền Đô Bắc Ninh kiến trúc cổ',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Di sản', categoryIcon: '🏛️', region: 'Miền Bắc',
    priceRange: 'budget', priceLabel: '1.300.000 ₫',
    rating: 4.6, reviewCount: 118, viewCount: 3500,
    tags: ['Dân ca Quan họ', 'Chùa cổ', 'Làng tranh dân gian', 'Văn hóa Kinh Bắc'],
    highlights: ['Viếng Đền Đô thờ 8 vị vua Lý', 'Chiêm bái Chùa Bút Tháp cổ kính', 'Tham quan Chùa Dâu ngôi chùa cổ nhất', 'Khám phá Làng tranh Đông Hồ'],
    badge: '🎎 Văn hóa', badgeColor: 'bg-amber-600',
    author: 'Quốc Huy', authorAvatar: 'QH', completedDate: '03/2026',
    description: 'Hành trình 2 ngày về miền Kinh Bắc — cái nôi của dân ca Quan họ. Lắng nghe những làn điệu giao duyên ngọt ngào, chiêm bái các ngôi chùa cổ nghìn năm tuổi và tìm hiểu nghề tranh dân gian Đông Hồ.',
    stops: [
      { name: 'Đền Đô', city: 'Bắc Ninh', query: 'Đền Đô Đền Lý Bát Đế Bắc Ninh', category: 'heritage', rating: 4.7, description: 'Đền thờ 8 vị vua nhà Lý với kiến trúc bề thế cổ kính', coordinates: { lat: 21.1306, lng: 105.9569 } },
      { name: 'Chùa Bút Tháp', city: 'Bắc Ninh', query: 'Chùa Bút Tháp Bắc Ninh', category: 'heritage', rating: 4.8, description: 'Ngôi chùa cổ lưu giữ tượng Phật Quan Âm nghìn mắt nghìn tay', coordinates: { lat: 21.0606, lng: 106.0667 } },
      { name: 'Chùa Dâu', city: 'Bắc Ninh', query: 'Chùa Dâu Bắc Ninh', category: 'heritage', rating: 4.6, description: 'Ngôi chùa Phật giáo cổ nhất Việt Nam gần 2.000 năm tuổi', coordinates: { lat: 21.05, lng: 106.0333 } },
      { name: 'Làng tranh Đông Hồ', city: 'Bắc Ninh', query: 'Làng tranh Đông Hồ Bắc Ninh', category: 'countryside', rating: 4.5, description: 'Làng nghề làm tranh dân gian truyền thống nổi tiếng', coordinates: { lat: 21.0497, lng: 106.0703 } },
    ],
    reviews: [
      { name: 'Diệu Linh', avatar: 'DL', date: '03/2026', rating: 5, text: 'Được nghe các liền anh liền chị hát Quan họ rất xúc động. Chùa Bút Tháp kiến trúc tinh xảo, tượng nghìn tay nghìn mắt quá ấn tượng.', helpful: 22 },
      { name: 'Bá Lộc', avatar: 'BL', date: '02/2026', rating: 4, text: 'Tour văn hóa nhẹ nhàng, hợp cho người thích lịch sử. Mua tranh Đông Hồ về làm quà rất ý nghĩa. Bánh phu thê Bắc Ninh ngon.', helpful: 11 },
    ],
  },
  {
    id: 'ct-30',
    title: '3 Ngày Buôn Ma Thuột — Thủ Phủ Cà Phê',
    coverQuery: 'Thác Dray Nur Đắk Lắk Buôn Ma Thuột',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Núi', categoryIcon: '🏔️', region: 'Tây Nguyên',
    priceRange: 'mid-range', priceLabel: '3.400.000 ₫',
    rating: 4.7, reviewCount: 163, viewCount: 4800,
    tags: ['Cà phê Tây Nguyên', 'Thác nước hùng vĩ', 'Văn hóa cồng chiêng', 'Cưỡi voi'],
    highlights: ['Chiêm ngưỡng Thác Dray Nur hùng vĩ', 'Tham quan Bảo tàng Thế giới Cà phê', 'Trải nghiệm Buôn Đôn cưỡi voi', 'Du thuyền ngắm hoàng hôn Hồ Lắk'],
    badge: '☕ Đậm đà', badgeColor: 'bg-amber-700',
    author: 'Hữu Tài', authorAvatar: 'HT', completedDate: '03/2026',
    description: 'Hành trình 3 ngày khám phá thủ phủ cà phê Việt Nam giữa đại ngàn Tây Nguyên. Đắm mình trong hương cà phê nồng nàn, đứng trước thác Dray Nur tung bọt trắng xóa và nghe tiếng cồng chiêng vang vọng bên Hồ Lắk.',
    stops: [
      { name: 'Thác Dray Nur', city: 'Đắk Lắk', query: 'Thác Dray Nur Đắk Lắk', category: 'nature', rating: 4.8, description: 'Thác nước hùng vĩ rộng lớn được mệnh danh đệ nhất Tây Nguyên', coordinates: { lat: 12.5347, lng: 107.9986 } },
      { name: 'Bảo tàng Thế giới Cà phê', city: 'Buôn Ma Thuột', query: 'Bảo tàng Thế giới Cà phê Buôn Ma Thuột', category: 'city', rating: 4.7, description: 'Không gian trưng bày văn hóa cà phê độc đáo bậc nhất', coordinates: { lat: 12.685, lng: 108.0289 } },
      { name: 'Buôn Đôn', city: 'Đắk Lắk', query: 'Buôn Đôn Đắk Lắk cầu treo', category: 'countryside', rating: 4.5, description: 'Buôn làng nổi tiếng với nghề săn voi và cầu treo bắc qua sông', coordinates: { lat: 12.8983, lng: 107.7686 } },
      { name: 'Hồ Lắk', city: 'Đắk Lắk', query: 'Hồ Lắk Đắk Lắk', category: 'nature', rating: 4.6, description: 'Hồ nước ngọt tự nhiên lớn bên buôn làng người M\'Nông', coordinates: { lat: 12.4197, lng: 108.1817 } },
    ],
    reviews: [
      { name: 'Thành Long', avatar: 'TL', date: '03/2026', rating: 5, text: 'Thác Dray Nur quá hùng vĩ, đứng gần cảm nhận hơi nước mát lạnh. Cà phê Buôn Ma Thuột uống tại gốc đậm đà khác hẳn.', helpful: 31 },
      { name: 'Ái Vân', avatar: 'AV', date: '02/2026', rating: 4, text: 'Bảo tàng cà phê thiết kế rất đẹp và lạ. Hoàng hôn trên Hồ Lắk yên bình, được nghe cồng chiêng rất đặc sắc.', helpful: 16 },
    ],
  },
  {
    id: 'ct-31',
    title: '3 Ngày Pleiku — Phố Núi Gia Lai Mộng Mơ',
    coverQuery: 'Biển Hồ T\'Nưng Pleiku Gia Lai',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Núi', categoryIcon: '🏔️', region: 'Tây Nguyên',
    priceRange: 'budget', priceLabel: '2.700.000 ₫',
    rating: 4.7, reviewCount: 141, viewCount: 4300,
    tags: ['Hồ nước trên núi', 'Núi lửa', 'Chùa kiến trúc độc đáo', 'Thác nước'],
    highlights: ['Ngắm Biển Hồ — đôi mắt Pleiku', 'Chiêm bái Chùa Minh Thành nguy nga', 'Leo núi lửa Chư Đăng Ya', 'Khám phá Thác Phú Cường'],
    badge: '🌋 Phố núi', badgeColor: 'bg-orange-600',
    author: 'Nhật Minh', authorAvatar: 'NM', completedDate: '04/2026',
    description: 'Hành trình 3 ngày khám phá phố núi Pleiku mộng mơ. Ngắm Biển Hồ trong xanh được ví như đôi mắt Pleiku, chiêm bái ngôi chùa Minh Thành mang kiến trúc Nhật Bản và chinh phục ngọn núi lửa đã ngủ yên Chư Đăng Ya.',
    stops: [
      { name: 'Biển Hồ (Hồ T\'Nưng)', city: 'Gia Lai', query: 'Biển Hồ T\'Nưng Pleiku Gia Lai', category: 'nature', rating: 4.8, description: 'Hồ nước ngọt trên núi xanh biếc được ví như đôi mắt Pleiku', coordinates: { lat: 14.0586, lng: 108.0006 } },
      { name: 'Chùa Minh Thành', city: 'Pleiku', query: 'Chùa Minh Thành Pleiku Gia Lai', category: 'heritage', rating: 4.8, description: 'Ngôi chùa nguy nga mang đậm kiến trúc Phật giáo Nhật Bản', coordinates: { lat: 13.9656, lng: 107.9986 } },
      { name: 'Núi lửa Chư Đăng Ya', city: 'Gia Lai', query: 'Núi lửa Chư Đăng Ya Gia Lai', category: 'mountain', rating: 4.7, description: 'Núi lửa đã tắt phủ kín hoa dã quỳ vàng rực mùa khô', coordinates: { lat: 14.1561, lng: 108.0747 } },
      { name: 'Thác Phú Cường', city: 'Gia Lai', query: 'Thác Phú Cường Gia Lai', category: 'nature', rating: 4.6, description: 'Dòng thác đổ xuống nền nham thạch núi lửa độc đáo', coordinates: { lat: 13.7406, lng: 108.1186 } },
    ],
    reviews: [
      { name: 'Tường Vy', avatar: 'TV', date: '04/2026', rating: 5, text: 'Biển Hồ buổi sáng trong xanh phẳng lặng, hàng thông hai bên đường đẹp như phim. Chùa Minh Thành kiến trúc cực hoành tráng.', helpful: 27 },
      { name: 'Gia Khang', avatar: 'GK', date: '03/2026', rating: 4, text: 'Núi lửa Chư Đăng Ya mùa dã quỳ vàng rực rất đáng đi. Phở khô Gia Lai (phở hai tô) ăn lạ miệng và ngon.', helpful: 14 },
    ],
  },
  {
    id: 'ct-32',
    title: '3 Ngày Lý Sơn — Đảo Tiền Tiêu Quảng Ngãi',
    coverQuery: 'Đảo Lý Sơn Quảng Ngãi cổng Tò Vò',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Biển', categoryIcon: '🏖️', region: 'Miền Trung',
    priceRange: 'mid-range', priceLabel: '3.300.000 ₫',
    rating: 4.8, reviewCount: 172, viewCount: 5400,
    tags: ['Đảo núi lửa', 'Cánh đồng tỏi', 'Lặn ngắm san hô', 'Biển xanh hoang sơ'],
    highlights: ['Săn ảnh bình minh tại Cổng Tò Vò', 'Leo đỉnh Thới Lới ngắm toàn đảo', 'Tắm biển hoang sơ tại Hang Câu', 'Khám phá vương quốc tỏi Lý Sơn'],
    badge: '🧄 Đảo tỏi', badgeColor: 'bg-cyan-600',
    author: 'Hải Yến', authorAvatar: 'HY', completedDate: '04/2026',
    description: 'Hành trình 3 ngày khám phá đảo tiền tiêu Lý Sơn — hòn đảo núi lửa giữa biển khơi. Đón bình minh nơi Cổng Tò Vò huyền thoại, đứng trên miệng núi lửa Thới Lới ngắm biển trời và đắm mình trong làn nước xanh ngọc bích.',
    stops: [
      { name: 'Cổng Tò Vò', city: 'Lý Sơn', query: 'Cổng Tò Vò Lý Sơn Quảng Ngãi', category: 'nature', rating: 4.9, description: 'Vòm đá núi lửa tự nhiên, điểm săn bình minh đẹp nhất đảo', coordinates: { lat: 15.3853, lng: 109.1064 } },
      { name: 'Đỉnh Thới Lới', city: 'Lý Sơn', query: 'Đỉnh Thới Lới núi lửa Lý Sơn', category: 'mountain', rating: 4.8, description: 'Miệng núi lửa đã tắt cao nhất đảo nhìn toàn cảnh Lý Sơn', coordinates: { lat: 15.3839, lng: 109.1267 } },
      { name: 'Hang Câu', city: 'Lý Sơn', query: 'Hang Câu Lý Sơn', category: 'beach', rating: 4.7, description: 'Bãi tắm hoang sơ dưới chân vách đá nham thạch nước trong vắt', coordinates: { lat: 15.3892, lng: 109.1219 } },
      { name: 'Đảo Lý Sơn', city: 'Quảng Ngãi', query: 'Cánh đồng tỏi Lý Sơn', category: 'island', rating: 4.6, description: 'Vương quốc tỏi với những cánh đồng tỏi xanh mướt bên biển', coordinates: { lat: 15.3833, lng: 109.1167 } },
    ],
    reviews: [
      { name: 'Phương Thảo', avatar: 'PT', date: '04/2026', rating: 5, text: 'Bình minh ở Cổng Tò Vò đẹp xuất sắc, nước biển xanh màu ngọc bích. Hải sản tươi rói, gỏi tỏi Lý Sơn ăn rất lạ và ngon.', helpful: 33 },
      { name: 'Đình Phúc', avatar: 'ĐP', date: '03/2026', rating: 4, text: 'Leo đỉnh Thới Lới hơi nắng nhưng view 360 độ toàn đảo quá đỉnh. Hang Câu tắm cực mát. Nên thuê xe máy chạy quanh đảo.', helpful: 18 },
    ],
  },
  {
    id: 'ct-33',
    title: '3 Ngày Ninh Thuận — Vịnh Vĩnh Hy Hoang Sơ',
    coverQuery: 'Vịnh Vĩnh Hy Ninh Thuận cảnh đẹp',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Biển', categoryIcon: '🏖️', region: 'Nam Trung Bộ',
    priceRange: 'mid-range', priceLabel: '3.500.000 ₫',
    rating: 4.8, reviewCount: 158, viewCount: 5100,
    tags: ['Vịnh biển đẹp', 'Cánh đồng cừu', 'Tháp Chăm cổ', 'San hô rạn biển'],
    highlights: ['Ngắm Vịnh Vĩnh Hy một trong tứ đại danh thắng', 'Check-in Hang Rái với rạn san hô cổ', 'Chụp ảnh Cánh đồng cừu An Hòa', 'Tham quan Tháp Po Klong Garai cổ kính'],
    badge: '🐑 Độc lạ', badgeColor: 'bg-amber-500',
    author: 'Vĩnh Khang', authorAvatar: 'VK', completedDate: '03/2026',
    description: 'Hành trình 3 ngày khám phá vùng đất nắng gió Ninh Thuận. Vịnh Vĩnh Hy xanh biếc được xếp vào tứ đại danh thắng biển, Hang Rái với rạn san hô hóa thạch độc đáo và những đàn cừu thong dong trên đồng cỏ như trời Âu.',
    stops: [
      { name: 'Vịnh Vĩnh Hy', city: 'Ninh Thuận', query: 'Vịnh Vĩnh Hy Ninh Thuận', category: 'nature', rating: 4.9, description: 'Một trong tứ đại danh thắng vịnh biển đẹp nhất Việt Nam', coordinates: { lat: 11.7106, lng: 109.2017 } },
      { name: 'Hang Rái', city: 'Ninh Thuận', query: 'Hang Rái Ninh Thuận', category: 'nature', rating: 4.8, description: 'Ghềnh đá san hô cổ độc đáo nơi sóng tạo thác nước ngược', coordinates: { lat: 11.685, lng: 109.1817 } },
      { name: 'Cánh đồng cừu An Hòa', city: 'Ninh Thuận', query: 'Cánh đồng cừu An Hòa Ninh Thuận', category: 'countryside', rating: 4.6, description: 'Đồng cỏ với những đàn cừu thong dong như khung cảnh trời Âu', coordinates: { lat: 11.6483, lng: 109.1333 } },
      { name: 'Tháp Po Klong Garai', city: 'Phan Rang', query: 'Tháp Po Klong Garai Ninh Thuận', category: 'heritage', rating: 4.7, description: 'Cụm tháp Chăm cổ kính còn nguyên vẹn nhất Việt Nam', coordinates: { lat: 11.5814, lng: 108.9667 } },
    ],
    reviews: [
      { name: 'Cẩm Tú', avatar: 'CT', date: '03/2026', rating: 5, text: 'Vịnh Vĩnh Hy nước xanh trong, đi tàu đáy kính ngắm san hô rất đẹp. Cánh đồng cừu chụp ảnh dễ thương như trời Âu vậy.', helpful: 28 },
      { name: 'Hoàng Sơn', avatar: 'HS', date: '02/2026', rating: 4, text: 'Hang Rái lúc thủy triều tạo thác nước ngược độc đáo lắm. Nho và táo Ninh Thuận tươi ngon, mua về làm quà rất hợp.', helpful: 15 },
    ],
  },
  {
    id: 'ct-34',
    title: '2 Ngày Hà Tiên — Phố Biển Mộng Mơ Kiên Giang',
    coverQuery: 'Hà Tiên Kiên Giang Mũi Nai cảnh đẹp',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Biển', categoryIcon: '🏖️', region: 'Tây Nam Bộ',
    priceRange: 'mid-range', priceLabel: '2.200.000 ₫',
    rating: 4.7, reviewCount: 149, viewCount: 4600,
    tags: ['Phố biển', 'Hang động ven biển', 'Hòn Phụ Tử', 'Đầm nước lợ'],
    highlights: ['Tắm biển ngắm hoàng hôn Mũi Nai', 'Khám phá Thạch Động trời sinh', 'Chiêm bái Chùa Hang & Hòn Phụ Tử', 'Dạo thuyền trên Đầm Đông Hồ'],
    badge: '🌅 Thơ mộng', badgeColor: 'bg-rose-500',
    author: 'Thúy Quỳnh', authorAvatar: 'TQ', completedDate: '04/2026',
    description: 'Hành trình 2 ngày dạo bước phố biển Hà Tiên thơ mộng nơi cực Tây Nam Tổ quốc. Vùng đất Hà Tiên thập cảnh nổi tiếng với những hang động kỳ thú, biển Mũi Nai hoàng hôn rực rỡ và biểu tượng Hòn Phụ Tử giữa biển khơi.',
    stops: [
      { name: 'Bãi biển Mũi Nai', city: 'Hà Tiên', query: 'Bãi biển Mũi Nai Hà Tiên', category: 'beach', rating: 4.6, description: 'Bãi biển cát nâu với hoàng hôn rực rỡ nơi cực Tây', coordinates: { lat: 10.3506, lng: 104.4533 } },
      { name: 'Thạch Động', city: 'Hà Tiên', query: 'Thạch Động Hà Tiên Kiên Giang', category: 'nature', rating: 4.6, description: 'Khối núi đá vôi rỗng giữa đồng bằng gắn với truyện Thạch Sanh', coordinates: { lat: 10.4083, lng: 104.4694 } },
      { name: 'Hòn Phụ Tử & Chùa Hang', city: 'Kiên Lương', query: 'Hòn Phụ Tử Chùa Hang Kiên Giang', category: 'heritage', rating: 4.7, description: 'Biểu tượng cha con bằng đá giữa biển và ngôi chùa trong hang núi', coordinates: { lat: 10.2167, lng: 104.65 } },
      { name: 'Đầm Đông Hồ', city: 'Hà Tiên', query: 'Đầm Đông Hồ Hà Tiên', category: 'nature', rating: 4.5, description: 'Đầm nước lợ thơ mộng được mệnh danh hồ trăng của Hà Tiên', coordinates: { lat: 10.3878, lng: 104.4831 } },
    ],
    reviews: [
      { name: 'Ngọc Trâm', avatar: 'NT', date: '04/2026', rating: 5, text: 'Hà Tiên yên bình và lãng mạn, hoàng hôn Mũi Nai đẹp não nề. Hải sản rẻ, ghẹ và sò huyết tươi ngon. Rất đáng đi.', helpful: 26 },
      { name: 'Anh Kiệt', avatar: 'AK', date: '03/2026', rating: 4, text: 'Thạch Động và Hòn Phụ Tử khá độc đáo. Có thể kết hợp đi tiếp Phú Quốc hoặc qua cửa khẩu Campuchia tiện đường.', helpful: 12 },
    ],
  },
  {
    id: 'ct-35',
    title: '2 Ngày Đồng Tháp — Sen Hồng Tháp Mười',
    coverQuery: 'Đồng sen Tháp Mười Đồng Tháp',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Di sản', categoryIcon: '🪷', region: 'Tây Nam Bộ',
    priceRange: 'budget', priceLabel: '1.400.000 ₫',
    rating: 4.7, reviewCount: 134, viewCount: 3800,
    tags: ['Đồng sen bát ngát', 'Rừng tràm', 'Sân chim', 'Làng hoa'],
    highlights: ['Chèo xuồng giữa Đồng sen Tháp Mười', 'Ngắm chim trời tại Vườn quốc gia Tràm Chim', 'Dạo Làng hoa Sa Đéc rực rỡ', 'Về nguồn tại Khu di tích Gò Tháp'],
    badge: '🪷 Thuần khiết', badgeColor: 'bg-pink-500',
    author: 'Mỹ Duyên', authorAvatar: 'MD', completedDate: '03/2026',
    description: 'Hành trình 2 ngày về vùng đất Sen hồng Đồng Tháp Mười. Chèo xuồng len giữa đầm sen bát ngát thơm ngát, ngắm đàn sếu đầu đỏ quý hiếm tại Tràm Chim và lạc bước giữa làng hoa Sa Đéc trăm sắc ngàn hương.',
    stops: [
      { name: 'Vườn quốc gia Tràm Chim', city: 'Đồng Tháp', query: 'Vườn quốc gia Tràm Chim Đồng Tháp', category: 'nature', rating: 4.8, description: 'Khu Ramsar với hệ sinh thái đất ngập nước và sếu đầu đỏ quý hiếm', coordinates: { lat: 10.7186, lng: 105.5631 } },
      { name: 'Làng hoa Sa Đéc', city: 'Đồng Tháp', query: 'Làng hoa Sa Đéc Đồng Tháp', category: 'countryside', rating: 4.7, description: 'Làng hoa lớn nhất miền Tây rực rỡ trăm loài khoe sắc', coordinates: { lat: 10.2939, lng: 105.7456 } },
      { name: 'Khu di tích Gò Tháp', city: 'Đồng Tháp', query: 'Khu di tích Gò Tháp Đồng Tháp', category: 'heritage', rating: 4.6, description: 'Di tích quốc gia đặc biệt với dấu tích văn hóa Óc Eo cổ', coordinates: { lat: 10.7325, lng: 105.7397 } },
      { name: 'Đồng sen Tháp Mười', city: 'Đồng Tháp', query: 'Đồng sen Tháp Mười Đồng Tháp', category: 'nature', rating: 4.7, description: 'Cánh đồng sen hồng bát ngát đặc trưng của vùng Đồng Tháp Mười', coordinates: { lat: 10.565, lng: 105.842 } },
    ],
    reviews: [
      { name: 'Thanh Trúc', avatar: 'TT', date: '03/2026', rating: 5, text: 'Đồng sen mênh mông thơm ngát, mặc áo bà ba chèo xuồng chụp ảnh cực đẹp. Ăn các món từ sen rất thanh mát và lạ miệng.', helpful: 24 },
      { name: 'Hữu Nghĩa', avatar: 'HN', date: '02/2026', rating: 4, text: 'Tràm Chim sáng sớm ngắm chim trời rất thư giãn. Làng hoa Sa Đéc nhiều góc sống ảo. Nên đi mùa nước nổi sẽ đẹp hơn.', helpful: 13 },
    ],
  },
  {
    id: 'ct-36',
    title: '3 Ngày Cà Mau — Đất Mũi Cực Nam Tổ Quốc',
    coverQuery: 'Mũi Cà Mau Đất Mũi cực Nam',
    duration: '3 ngày 2 đêm', days: 3,
    category: 'Di sản', categoryIcon: '🏛️', region: 'Tây Nam Bộ',
    priceRange: 'mid-range', priceLabel: '2.900.000 ₫',
    rating: 4.8, reviewCount: 156, viewCount: 4700,
    tags: ['Cực Nam đất nước', 'Rừng ngập mặn', 'Đầm nước tự nhiên', 'Đảo đá ven biển'],
    highlights: ['Check-in cột mốc tọa độ GPS 0001 Đất Mũi', 'Xuyên rừng Vườn quốc gia U Minh Hạ', 'Ngắm hoàng hôn trên Đầm Thị Tường', 'Khám phá Hòn Đá Bạc ven biển'],
    badge: '📍 Cực Nam', badgeColor: 'bg-emerald-700',
    author: 'Trọng Phúc', authorAvatar: 'TP', completedDate: '03/2026',
    description: 'Hành trình 3 ngày về với Đất Mũi Cà Mau — điểm cực Nam thiêng liêng của Tổ quốc. Đặt chân tới cột mốc tọa độ quốc gia, ngắm bạt ngàn rừng đước rừng tràm và thưởng thức hải sản trù phú nơi đất chín rồng đổ ra biển.',
    stops: [
      { name: 'Mũi Cà Mau (Đất Mũi)', city: 'Cà Mau', query: 'Mũi Cà Mau Đất Mũi cột mốc', category: 'heritage', rating: 4.9, description: 'Điểm cực Nam Tổ quốc với cột mốc tọa độ và biểu tượng con tàu', coordinates: { lat: 8.6, lng: 104.7167 } },
      { name: 'Vườn quốc gia U Minh Hạ', city: 'Cà Mau', query: 'Vườn quốc gia U Minh Hạ Cà Mau', category: 'nature', rating: 4.6, description: 'Rừng tràm ngập nước nguyên sinh với hệ sinh thái phong phú', coordinates: { lat: 9.6, lng: 104.95 } },
      { name: 'Đầm Thị Tường', city: 'Cà Mau', query: 'Đầm Thị Tường Cà Mau', category: 'nature', rating: 4.7, description: 'Đầm nước tự nhiên lớn nhất miền Tây với hoàng hôn tuyệt đẹp', coordinates: { lat: 9.0833, lng: 104.9833 } },
      { name: 'Hòn Đá Bạc', city: 'Cà Mau', query: 'Hòn Đá Bạc Cà Mau', category: 'nature', rating: 4.6, description: 'Cụm đảo đá nhỏ ven biển với di tích lịch sử và đền thờ', coordinates: { lat: 9.0892, lng: 104.8147 } },
    ],
    reviews: [
      { name: 'Bích Phương', avatar: 'BP', date: '03/2026', rating: 5, text: 'Đặt chân tới cột mốc Đất Mũi cảm giác rất thiêng liêng và tự hào. Ngồi vỏ lãi xuyên rừng đước rất thú vị. Cua Cà Mau ngon số 1!', helpful: 30 },
      { name: 'Văn Toàn', avatar: 'VT', date: '02/2026', rating: 4, text: 'Hoàng hôn trên Đầm Thị Tường đẹp mê. Đường đi hơi xa nhưng trải nghiệm về cực Nam đáng giá. Hải sản tươi và rẻ.', helpful: 15 },
    ],
  },
  {
    id: 'ct-37',
    title: '2 Ngày Sầm Sơn — Biển Gọi Hè Về Thanh Hóa',
    coverQuery: 'Biển Sầm Sơn Thanh Hóa',
    duration: '2 ngày 1 đêm', days: 2,
    category: 'Biển', categoryIcon: '🏖️', region: 'Bắc Trung Bộ',
    priceRange: 'budget', priceLabel: '1.500.000 ₫',
    rating: 4.5, reviewCount: 268, viewCount: 9600,
    tags: ['Biển gần Hà Nội', 'Hòn Trống Mái', 'Đền cổ ven biển', 'Hải sản bình dân'],
    highlights: ['Tắm biển sôi động tại bãi Sầm Sơn', 'Check-in danh thắng Hòn Trống Mái', 'Chiêm bái Đền Độc Cước linh thiêng', 'Ngắm biển từ Đền Cô Tiên'],
    badge: '🌴 Vui hè', badgeColor: 'bg-sky-500',
    author: 'Đức Anh', authorAvatar: 'ĐA', completedDate: '05/2026',
    description: 'Hành trình 2 ngày tận hưởng mùa hè sôi động tại bãi biển Sầm Sơn. Một trong những bãi tắm lâu đời và nhộn nhịp nhất miền Bắc với bờ cát thoai thoải, danh thắng Hòn Trống Mái độc đáo và những ngôi đền cổ linh thiêng bên biển.',
    stops: [
      { name: 'Biển Sầm Sơn', city: 'Thanh Hóa', query: 'Bãi biển Sầm Sơn Thanh Hóa', category: 'beach', rating: 4.5, description: 'Bãi tắm lâu đời sôi động với bờ cát dài thoai thoải', coordinates: { lat: 19.7506, lng: 105.9072 } },
      { name: 'Hòn Trống Mái', city: 'Sầm Sơn', query: 'Hòn Trống Mái Sầm Sơn', category: 'nature', rating: 4.6, description: 'Cụm đá tự nhiên hình đôi chim gắn với truyền thuyết tình yêu', coordinates: { lat: 19.7406, lng: 105.9111 } },
      { name: 'Đền Độc Cước', city: 'Sầm Sơn', query: 'Đền Độc Cước Sầm Sơn', category: 'heritage', rating: 4.6, description: 'Ngôi đền cổ trên núi Trường Lệ thờ vị thần một chân', coordinates: { lat: 19.7472, lng: 105.9097 } },
      { name: 'Đền Cô Tiên', city: 'Sầm Sơn', query: 'Đền Cô Tiên Sầm Sơn', category: 'heritage', rating: 4.5, description: 'Ngôi đền cổ nằm trên đỉnh núi nhìn ra toàn cảnh biển', coordinates: { lat: 19.7383, lng: 105.9136 } },
    ],
    reviews: [
      { name: 'Hà My', avatar: 'HM', date: '05/2026', rating: 5, text: 'Biển Sầm Sơn sóng to tắm rất đã, bãi rộng. Hải sản chợ Sầm Sơn tươi và bình dân. Đi cùng gia đình đông vui cực hợp.', helpful: 36 },
      { name: 'Tuấn Vũ', avatar: 'TV', date: '04/2026', rating: 4, text: 'Hòn Trống Mái và đền Độc Cước trên núi Trường Lệ ngắm biển đẹp. Mùa cao điểm hơi đông, nên đặt phòng trước.', helpful: 19 },
    ],
  },
];

// ── Build object Tour đầy đủ ───────────────────────────────────────────────────
function buildTour(d, coverImage, stopImages) {
  return {
    id: d.id,
    title: d.title,
    coverImage,
    duration: d.duration,
    days: d.days,
    category: d.category,
    categoryIcon: d.categoryIcon,
    region: d.region,
    priceRange: d.priceRange,
    priceLabel: d.priceLabel,
    rating: d.rating,
    reviewCount: d.reviewCount,
    viewCount: d.viewCount,
    tags: d.tags,
    highlights: d.highlights,
    badge: d.badge,
    badgeColor: d.badgeColor,
    author: d.author,
    authorAvatar: d.authorAvatar,
    completedDate: d.completedDate,
    description: d.description,
    stops: d.stops.map((s, i) => ({
      name: s.name,
      city: s.city,
      image: stopImages[i],
      category: s.category,
      rating: s.rating,
      description: s.description,
      coordinates: s.coordinates,
    })),
    reviews: d.reviews,
  };
}

// Serialize 1 object Tour thành literal TS, indent 2 space, đệm thêm `pad`.
function serialize(obj, pad) {
  const json = JSON.stringify(obj, null, 2);
  return json.split('\n').map((line, i) => (i === 0 ? pad + line : pad + line)).join('\n');
}

function insertIntoPage(tours) {
  let src = fs.readFileSync(PAGE, 'utf8');
  if (src.includes("id: 'ct-23'") || src.includes('"id": "ct-23"')) {
    console.log('⚠️ page.tsx đã có ct-23 — bỏ qua việc chèn (idempotent).');
    return;
  }
  const marker = '\n];\n\nconst CATEGORIES';
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error('Không tìm thấy điểm chèn (kết thúc COMMUNITY_TOURS) trong page.tsx');

  const block = tours.map((t) => serialize(t, '  ')).join(',\n');
  // Chèn dấu phẩy sau phần tử ct-22 hiện tại + block tour mới, trước `\n];`
  const before = src.slice(0, idx);
  const after = src.slice(idx + 2); // bỏ '\n]' đầu marker, giữ lại phần còn lại bắt đầu từ ';\n\nconst...'
  // after hiện bắt đầu bằng ';\n\nconst CATEGORIES' -> dựng lại đúng cấu trúc
  src = before + ',\n' + block + '\n]' + after;
  fs.writeFileSync(PAGE, src, 'utf8');
  console.log(`✅ Đã chèn ${tours.length} tour mới vào ${PAGE}`);
}

async function run() {
  console.log(`🚀 Sinh ${DATA.length} tour mới (ct-23 → ct-37)...`);
  const tours = [];
  for (const d of DATA) {
    console.log(`\n📍 ${d.id} — ${d.title}`);
    process.stdout.write('   cover... ');
    const coverImage = await firstValidImage(d.coverQuery, d.stops[0].category);
    console.log('ok');
    const stopImages = [];
    for (const s of d.stops) {
      process.stdout.write(`   ${s.name}... `);
      stopImages.push(await firstValidImage(s.query, s.category));
      console.log('ok');
    }
    tours.push(buildTour(d, coverImage, stopImages));
  }

  fs.writeFileSync(path.join(__dirname, 'moreCommunityTours.generated.json'), JSON.stringify(tours, null, 2), 'utf8');
  console.log('\n💾 Đã ghi moreCommunityTours.generated.json');

  if (DRY) {
    console.log('🧪 --dry: không sửa page.tsx.');
  } else {
    insertIntoPage(tours);
  }
  console.log('\n🎉 Hoàn tất.');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
