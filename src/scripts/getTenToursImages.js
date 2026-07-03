const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

const destinations = [
  // 1. Hạ Long
  { key: 'halong_cover', query: 'Vịnh Hạ Long cảnh đẹp' },
  { key: 'halong_vinhavinh', query: 'Vịnh Hạ Long' },
  { key: 'halong_titop', query: 'Đảo Ti Tốp Hạ Long' },
  { key: 'halong_sungsot', query: 'Hang Sửng Sốt Hạ Long' },
  { key: 'halong_chodem', query: 'Chợ đêm Hạ Long' },

  // 2. Huế
  { key: 'hue_cover', query: 'Kinh thành Huế thơ mộng' },
  { key: 'hue_dainoi', query: 'Đại Nội Huế' },
  { key: 'hue_thienmu', query: 'Chùa Thiên Mụ Huế' },
  { key: 'hue_khaidinh', query: 'Lăng Khải Định Huế' },
  { key: 'hue_dongba', query: 'Chợ Đông Ba Huế' },

  // 3. Nha Trang
  { key: 'nhatrang_cover', query: 'Biển Nha Trang cảnh đẹp' },
  { key: 'nhatrang_vinwonders', query: 'VinWonders Nha Trang' },
  { key: 'nhatrang_ponagar', query: 'Tháp Bà Ponagar Nha Trang' },
  { key: 'nhatrang_honchong', query: 'Hòn Chồng Nha Trang' },
  { key: 'nhatrang_longson', query: 'Chùa Long Sơn Nha Trang' },

  // 4. Vũng Tàu
  { key: 'vungtau_cover', query: 'Du lịch Vũng Tàu Bãi Trước Bãi Sau' },
  { key: 'vungtau_tuongchua', query: 'Tượng Chúa Kitô Vua Vũng Tàu' },
  { key: 'vungtau_haidang', query: 'Ngọn hải đăng Vũng Tàu' },
  { key: 'vungtau_baisau', query: 'Bãi Sau Vũng Tàu' },
  { key: 'vungtau_bachdinh', query: 'Bạch Dinh Vũng Tàu' },

  // 5. Cần Thơ
  { key: 'cantho_cover', query: 'Du lịch Cần Thơ miền Tây' },
  { key: 'cantho_cairang', query: 'Chợ nổi Cái Răng Cần Thơ' },
  { key: 'cantho_ninhkieu', query: 'Bến Ninh Kiều Cần Thơ' },
  { key: 'cantho_binhthuy', query: 'Nhà cổ Bình Thủy Cần Thơ' },
  { key: 'cantho_chuaong', query: 'Chùa Ông Cần Thơ' },

  // 6. Mũi Né
  { key: 'muine_cover', query: 'Du lịch Mũi Né Phan Thiết' },
  { key: 'muine_doicat', query: 'Đồi cát bay Mũi Né' },
  { key: 'muine_suoitien', query: 'Suối Tiên Mũi Né' },
  { key: 'muine_bautrang', query: 'Bàu Trắng Mũi Né' },
  { key: 'muine_langchai', query: 'Làng chài Mũi Né' },

  // 7. Côn Đảo
  { key: 'condao_cover', query: 'Du lịch Côn Đảo hoang sơ' },
  { key: 'condao_nhatu', query: 'Nhà tù Côn Đảo di tích' },
  { key: 'condao_hangduong', query: 'Nghĩa trang Hàng Dương Côn Đảo' },
  { key: 'condao_damtrau', query: 'Bãi Đầm Trầu Côn Đảo' },
  { key: 'condao_nuimot', query: 'Chùa Núi Một Côn Đảo' },

  // 8. Quảng Bình
  { key: 'quangbinh_cover', query: 'Phong Nha Kẻ Bàng Quảng Bình' },
  { key: 'quangbinh_phongnha', query: 'Động Phong Nha Quảng Bình' },
  { key: 'quangbinh_thienduong', query: 'Động Thiên Đường Quảng Bình' },
  { key: 'quangbinh_suoimooc', query: 'Suối nước Moọc Quảng Bình' },
  { key: 'quangbinh_hangtoi', query: 'Sông Chày Hang Tối Quảng Bình' },

  // 9. Quy Nhơn
  { key: 'quynhon_cover', query: 'Du lịch Quy Nhơn cảnh đẹp' },
  { key: 'quynhon_kyco', query: 'Bãi biển Kỳ Co Quy Nhơn' },
  { key: 'quynhon_eogio', query: 'Eo Gió Quy Nhơn' },
  { key: 'quynhon_thapdoi', query: 'Tháp Đôi Quy Nhơn' },
  { key: 'quynhon_ghenhrang', query: 'Ghềnh Ráng Tiên Sa Quy Nhơn' },

  // 10. Tây Ninh
  { key: 'tayninh_cover', query: 'Du lịch Tây Ninh cảnh đẹp' },
  { key: 'tayninh_baden', query: 'Núi Bà Đen Tây Ninh' },
  { key: 'tayninh_toathanh', query: 'Tòa Thánh Tây Ninh' },
  { key: 'tayninh_dautieng', query: 'Hồ Dầu Tiếng Tây Ninh' },
  { key: 'tayninh_mathienlanh', query: 'Ma Thiên Lãnh Tây Ninh' }
];

function checkImageUrl(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function run() {
  console.log('🚀 Fetching images for 10 new famous tours...');
  const results = {};
  
  for (const dest of destinations) {
    console.log(`Searching images for: "${dest.query}"...`);
    const images = await serperManager.searchImages(dest.query, 8);
    const validImages = [];
    
    for (const imgUrl of images) {
      if (validImages.length >= 3) break;
      const ok = await checkImageUrl(imgUrl);
      if (ok) {
        validImages.push(imgUrl);
      }
    }
    
    results[dest.key] = {
      query: dest.query,
      images: validImages
    };
    console.log(`  Found ${validImages.length} verified images`);
  }
  
  console.log('\n======================================');
  console.log('RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('======================================');
  process.exit(0);
}

run().catch(console.error);
