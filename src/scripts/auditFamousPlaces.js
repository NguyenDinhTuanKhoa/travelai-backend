require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

// Danh sách địa điểm nổi tiếng theo tỉnh - CHỈ những địa điểm PHẢI CÓ
const FAMOUS_PLACES = {
  'Hà Nội': [
    { name: 'Hoàng Thành Thăng Long', category: 'historical' },
    { name: 'Văn Miếu Quốc Tử Giám', category: 'historical' },
    { name: 'Hồ Hoàn Kiếm', category: 'attraction' },
    { name: 'Lăng Chủ tịch Hồ Chí Minh', category: 'historical' },
    { name: 'Chùa Một Cột', category: 'historical' },
    { name: 'Phố cổ Hà Nội', category: 'city' },
    { name: 'Nhà tù Hỏa Lò', category: 'historical' },
    { name: 'Cầu Long Biên', category: 'attraction' },
    { name: 'Hồ Tây', category: 'attraction' },
    { name: 'Chùa Trấn Quốc', category: 'historical' },
  ],
  'TP. Hồ Chí Minh': [
    { name: 'Nhà thờ Đức Bà Sài Gòn', category: 'historical' },
    { name: 'Bưu điện Trung tâm Sài Gòn', category: 'historical' },
    { name: 'Dinh Độc Lập', category: 'historical' },
    { name: 'Chợ Bến Thành', category: 'city' },
    { name: 'Phố đi bộ Nguyễn Huệ', category: 'city' },
    { name: 'Bến Nhà Rồng', category: 'historical' },
    { name: 'Landmark 81', category: 'city' },
    { name: 'Bitexco Financial Tower', category: 'city' },
    { name: 'Chùa Vĩnh Nghiêm', category: 'historical' },
    { name: 'Đường sách Nguyễn Văn Bình', category: 'attraction' },
  ],
  'Đà Nẵng': [
    { name: 'Cầu Rồng', category: 'attraction' },
    { name: 'Bà Nà Hills', category: 'attraction' },
    { name: 'Cầu Vàng', category: 'attraction' },
    { name: 'Bãi biển Mỹ Khê', category: 'beach' },
    { name: 'Ngũ Hành Sơn', category: 'attraction' },
    { name: 'Bán đảo Sơn Trà', category: 'attraction' },
    { name: 'Chùa Linh Ứng', category: 'historical' },
    { name: 'Cầu Tình Yêu Đà Nẵng', category: 'attraction' },
  ],
  'Quảng Ninh': [
    { name: 'Vịnh Hạ Long', category: 'beach' },
    { name: 'Đảo Ti Tốp', category: 'beach' },
    { name: 'Hang Sửng Sốt', category: 'attraction' },
    { name: 'Đảo Tuần Châu', category: 'beach' },
    { name: 'Yên Tử', category: 'historical' },
    { name: 'Bãi Cháy', category: 'beach' },
  ],
  'Lào Cai': [
    { name: 'Sa Pa', category: 'mountain' },
    { name: 'Đỉnh Fansipan', category: 'mountain' },
    { name: 'Bản Cát Cát', category: 'countryside' },
    { name: 'Thung lũng Mường Hoa', category: 'countryside' },
    { name: 'Ruộng bậc thang Sa Pa', category: 'countryside' },
    { name: 'Núi Hàm Rồng', category: 'mountain' },
  ],
  'Thừa Thiên Huế': [
    { name: 'Đại Nội Huế', category: 'historical' },
    { name: 'Chùa Thiên Mụ', category: 'historical' },
    { name: 'Lăng Tự Đức', category: 'historical' },
    { name: 'Lăng Khải Định', category: 'historical' },
    { name: 'Lăng Minh Mạng', category: 'historical' },
    { name: 'Cầu Trường Tiền', category: 'attraction' },
    { name: 'Sông Hương', category: 'attraction' },
  ],
  'Khánh Hòa': [
    { name: 'Vịnh Nha Trang', category: 'beach' },
    { name: 'Vinpearl Land Nha Trang', category: 'attraction' },
    { name: 'Tháp Bà Ponagar', category: 'historical' },
    { name: 'Đảo Hòn Mun', category: 'beach' },
    { name: 'Bãi Dài Cam Ranh', category: 'beach' },
  ],
  'Lâm Đồng': [
    { name: 'Hồ Xuân Hương Đà Lạt', category: 'attraction' },
    { name: 'Thung lũng Tình Yêu', category: 'attraction' },
    { name: 'Đồi Chè Cầu Đất', category: 'countryside' },
    { name: 'Thiền viện Trúc Lâm', category: 'historical' },
    { name: 'Đà Lạt Night Market', category: 'city' },
    { name: 'Hồ Tuyền Lâm', category: 'attraction' },
    { name: 'Đỉnh Langbiang', category: 'mountain' },
  ],
  'Quảng Nam': [
    { name: 'Phố cổ Hội An', category: 'historical' },
    { name: 'Chùa Cầu Hội An', category: 'historical' },
    { name: 'Thánh địa Mỹ Sơn', category: 'historical' },
    { name: 'Cù Lao Chàm', category: 'beach' },
    { name: 'Bãi biển An Bàng', category: 'beach' },
  ],
  'Ninh Bình': [
    { name: 'Tràng An', category: 'attraction' },
    { name: 'Tam Cốc - Bích Động', category: 'attraction' },
    { name: 'Hang Múa', category: 'attraction' },
    { name: 'Chùa Bái Đính', category: 'historical' },
    { name: 'Cố đô Hoa Lư', category: 'historical' },
  ],
  'Hà Giang': [
    { name: 'Đèo Mã Pí Lèng', category: 'mountain' },
    { name: 'Cao nguyên đá Đồng Văn', category: 'mountain' },
    { name: 'Cột cờ Lũng Cú', category: 'historical' },
    { name: 'Sông Nho Quế', category: 'attraction' },
    { name: 'Dinh thự họ Vương', category: 'historical' },
  ],
  'Quảng Bình': [
    { name: 'Động Phong Nha', category: 'attraction' },
    { name: 'Hang Sơn Đoòng', category: 'attraction' },
    { name: 'Động Thiên Đường', category: 'attraction' },
    { name: 'Suối Moọc', category: 'attraction' },
  ],
  'Phú Yên': [
    { name: 'Gành Đá Đĩa', category: 'attraction' },
    { name: 'Mũi Điện Đại Lãnh', category: 'beach' },
    { name: 'Bãi Xép', category: 'beach' },
    { name: 'Nhà thờ Mằng Lăng', category: 'historical' },
  ],
  'Bình Thuận': [
    { name: 'Đồi cát Mũi Né', category: 'attraction' },
    { name: 'Bãi biển Mũi Né', category: 'beach' },
    { name: 'Suối Tiên Mũi Né', category: 'attraction' },
    { name: 'Tháp Chàm Poshanu', category: 'historical' },
  ],
  'Kiên Giang': [
    { name: 'Đảo Phú Quốc', category: 'beach' },
    { name: 'Bãi Sao Phú Quốc', category: 'beach' },
    { name: 'Vinpearl Safari Phú Quốc', category: 'attraction' },
    { name: 'Grand World Phú Quốc', category: 'attraction' },
    { name: 'Chợ đêm Phú Quốc', category: 'city' },
  ],
  'Thanh Hóa': [
    { name: 'Thành Nhà Hồ', category: 'historical' },
    { name: 'Biển Sầm Sơn', category: 'beach' },
    { name: 'Suối cá thần Cẩm Lương', category: 'attraction' },
    { name: 'Vườn quốc gia Bến En', category: 'attraction' },
    { name: 'Lam Kinh', category: 'historical' },
    { name: 'Pù Luông', category: 'mountain' },
  ],
  'Nghệ An': [
    { name: 'Quê Bác Hồ Kim Liên', category: 'historical' },
    { name: 'Biển Cửa Lò', category: 'beach' },
    { name: 'Vườn quốc gia Pù Mát', category: 'attraction' },
    { name: 'Thành cổ Vinh', category: 'historical' },
  ],
  'Hà Tĩnh': [
    { name: 'Biển Thiên Cầm', category: 'beach' },
    { name: 'Ngã ba Đồng Lộc', category: 'historical' },
    { name: 'Chùa Hương Tích', category: 'historical' },
    { name: 'Khu di tích Nguyễn Du', category: 'historical' },
    { name: 'Vườn quốc gia Vũ Quang', category: 'attraction' },
    { name: 'Biển Xuân Thành', category: 'beach' },
  ],
  'Hải Phòng': [
    { name: 'Đảo Cát Bà', category: 'beach' },
    { name: 'Vịnh Lan Hạ', category: 'beach' },
    { name: 'Đồ Sơn', category: 'beach' },
    { name: 'Chùa Hang', category: 'historical' },
  ],
  'Cao Bằng': [
    { name: 'Thác Bản Giốc', category: 'attraction' },
    { name: 'Hang Pác Bó', category: 'historical' },
    { name: 'Hồ Thang Hen', category: 'attraction' },
    { name: 'Động Ngườm Ngao', category: 'attraction' },
  ],
  'Đắk Lắk': [
    { name: 'Hồ Lắk', category: 'attraction' },
    { name: 'Buôn Đôn', category: 'countryside' },
    { name: 'Thác Dray Nur', category: 'attraction' },
    { name: 'Thác Dray Sáp', category: 'attraction' },
  ],
  'An Giang': [
    { name: 'Núi Cấm', category: 'mountain' },
    { name: 'Miếu Bà Chúa Xứ', category: 'historical' },
    { name: 'Rừng tràm Trà Sư', category: 'attraction' },
    { name: 'Làng nổi Châu Đốc', category: 'countryside' },
  ],
  'Điện Biên': [
    { name: 'Di tích Điện Biên Phủ', category: 'historical' },
    { name: 'Đồi A1', category: 'historical' },
    { name: 'Hầm Đại tướng Võ Nguyên Giáp', category: 'historical' },
    { name: 'Cầu Mường Thanh', category: 'historical' },
  ],
  'Bà Rịa - Vũng Tàu': [
    { name: 'Tượng Chúa Kitô Vũng Tàu', category: 'historical' },
    { name: 'Bãi Sau Vũng Tàu', category: 'beach' },
    { name: 'Bãi Trước Vũng Tàu', category: 'beach' },
    { name: 'Côn Đảo', category: 'beach' },
    { name: 'Hải đăng Vũng Tàu', category: 'attraction' },
  ],
  'Quảng Ngãi': [
    { name: 'Đảo Lý Sơn', category: 'beach' },
    { name: 'Cổng Tò Vò', category: 'attraction' },
    { name: 'Thành cổ Châu Sa', category: 'historical' },
  ],
  'Sơn La': [
    { name: 'Mộc Châu', category: 'countryside' },
    { name: 'Nhà tù Sơn La', category: 'historical' },
    { name: 'Đồi chè Mộc Châu', category: 'countryside' },
    { name: 'Cao nguyên Mộc Châu', category: 'countryside' },
  ],
  'Bình Định': [
    { name: 'Tháp Bánh Ít', category: 'historical' },
    { name: 'Ghềnh Ráng Tiên Sa', category: 'beach' },
    { name: 'Bãi biển Quy Nhơn', category: 'beach' },
    { name: 'Eo Gió', category: 'attraction' },
    { name: 'Kỳ Co', category: 'beach' },
  ],
  'Cà Mau': [
    { name: 'Mũi Cà Mau', category: 'attraction' },
    { name: 'Vườn quốc gia U Minh Hạ', category: 'attraction' },
    { name: 'Đất Mũi', category: 'attraction' },
  ],
  'Quảng Trị': [
    { name: 'Thành cổ Quảng Trị', category: 'historical' },
    { name: 'Địa đạo Vịnh Mốc', category: 'historical' },
    { name: 'Nghĩa trang Trường Sơn', category: 'historical' },
    { name: 'Cầu Hiền Lương', category: 'historical' },
  ],
  'Lạng Sơn': [
    { name: 'Ải Chi Lăng', category: 'historical' },
    { name: 'Động Tam Thanh', category: 'attraction' },
    { name: 'Chùa Tam Thanh', category: 'historical' },
    { name: 'Nhị Thanh', category: 'attraction' },
  ],
  'Thái Nguyên': [
    { name: 'Hồ Núi Cốc', category: 'attraction' },
    { name: 'ATK Định Hóa', category: 'historical' },
    { name: 'Bảo tàng Văn hóa các dân tộc Việt Nam', category: 'historical' },
  ],
  'Phú Thọ': [
    { name: 'Đền Hùng', category: 'historical' },
    { name: 'Vườn quốc gia Xuân Sơn', category: 'attraction' },
  ],
  'Hòa Bình': [
    { name: 'Mai Châu', category: 'countryside' },
    { name: 'Hồ Hòa Bình', category: 'attraction' },
    { name: 'Bản Lác', category: 'countryside' },
  ],
  'Đồng Tháp': [
    { name: 'Vườn quốc gia Tràm Chim', category: 'attraction' },
    { name: 'Làng hoa Sa Đéc', category: 'attraction' },
    { name: 'Khu di tích Xẻo Quýt', category: 'historical' },
  ],
  'Cần Thơ': [
    { name: 'Chợ nổi Cái Răng', category: 'attraction' },
    { name: 'Bến Ninh Kiều', category: 'attraction' },
    { name: 'Chùa Ông Cần Thơ', category: 'historical' },
  ],
  'Bắc Ninh': [
    { name: 'Chùa Dâu', category: 'historical' },
    { name: 'Chùa Bút Tháp', category: 'historical' },
    { name: 'Đền Đô', category: 'historical' },
  ],
  'Nam Định': [
    { name: 'Nhà thờ Phát Diệm', category: 'historical' },
    { name: 'Phủ Dầy', category: 'historical' },
    { name: 'Chùa Cổ Lễ', category: 'historical' },
  ],
  'Tây Ninh': [
    { name: 'Núi Bà Đen', category: 'mountain' },
    { name: 'Tòa Thánh Cao Đài', category: 'historical' },
  ],
};

async function audit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const missing = [];
    let totalChecked = 0;
    let totalMissing = 0;

    for (const [province, places] of Object.entries(FAMOUS_PLACES)) {
      const provinceMissing = [];
      
      for (const place of places) {
        totalChecked++;
        // Tìm theo tên (fuzzy match)
        const exists = await Destination.findOne({
          name: { $regex: place.name.split(' ').slice(0, 3).join('.*'), $options: 'i' },
          'location.city': province
        });

        if (!exists) {
          provinceMissing.push(place);
          totalMissing++;
        }
      }

      if (provinceMissing.length > 0) {
        missing.push({ province, places: provinceMissing });
        console.log(`❌ ${province}: thiếu ${provinceMissing.length} địa điểm`);
        provinceMissing.forEach(p => console.log(`   - ${p.name}`));
      } else {
        console.log(`✅ ${province}: đầy đủ`);
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 TỔNG: Kiểm tra ${totalChecked} | Thiếu ${totalMissing}`);
    console.log(`${'═'.repeat(60)}\n`);

    if (missing.length === 0) {
      console.log('🎉 Tất cả địa điểm nổi tiếng đều đã có trong DB!');
      process.exit(0);
      return;
    }

    // Hỏi user có muốn bổ sung không
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const answer = await new Promise(resolve => {
      rl.question(`\n🔄 Bổ sung ${totalMissing} địa điểm thiếu bằng Serper API? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Đã hủy.');
      process.exit(0);
      return;
    }

    // Fetch & save missing places
    let saved = 0, failed = 0;

    for (const { province, places } of missing) {
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`🏙️  ${province}`);

      for (const place of places) {
        console.log(`  [${saved + failed + 1}/${totalMissing}] ${place.name}...`);

        try {
          const query = `${place.name} ${province} Vietnam`;
          const placeResult = await serperManager.searchPlaces(query);

          if (!placeResult.places || placeResult.places.length === 0) {
            console.log('     ⚠️ Không tìm thấy trên Maps');
            failed++;
            continue;
          }

          const p = placeResult.places[0];
          if (!p.latitude || !p.longitude) {
            console.log('     ⚠️ Không có tọa độ');
            failed++;
            continue;
          }

          // Fetch images
          const images = await serperManager.searchImages(`${place.name} ${province}`, 5);
          const validImages = images.slice(0, 3);

          if (validImages.length === 0) {
            console.log('     ⚠️ Không tìm thấy ảnh');
            failed++;
            continue;
          }

          const newDest = new Destination({
            name: place.name,
            description: `${place.name} - Điểm đến nổi tiếng tại ${province}, Việt Nam`,
            location: {
              city: province,
              country: 'Vietnam',
              coordinates: { lat: p.latitude, lng: p.longitude }
            },
            images: validImages,
            category: place.category,
            rating: p.rating || 4.5,
            reviewCount: p.ratingCount || 0,
          });

          await newDest.save();
          saved++;
          console.log(`     ✅ Đã lưu (${p.rating || 'N/A'}⭐)`);
        } catch (err) {
          console.log(`     ❌ Lỗi: ${err.message}`);
          failed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 600));
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 KẾT QUẢ: Đã lưu ${saved} | Thất bại ${failed}`);
    console.log(`${'═'.repeat(60)}`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

audit();
