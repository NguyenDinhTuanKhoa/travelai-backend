const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

const destinations = [
  // 1. Phú Yên
  { key: 'phuyen_cover', query: 'Du lịch Phú Yên cảnh đẹp' },
  { key: 'phuyen_ganhdadia', query: 'Gành Đá Đĩa Phú Yên' },
  { key: 'phuyen_muidien', query: 'Mũi Điện hải đăng Đại Lãnh' },
  { key: 'phuyen_thapnghinhphong', query: 'Tháp Nghinh Phong Tuy Hòa' },
  { key: 'phuyen_damoloan', query: 'Đầm Ô Loan Phú Yên' },

  // 2. Sài Gòn
  { key: 'saigon_cover', query: 'Du lịch Sài Gòn cảnh đẹp' },
  { key: 'saigon_buudien', query: 'Bưu điện Trung tâm Sài Gòn' },
  { key: 'saigon_nhathoducba', query: 'Nhà thờ Đức Bà Sài Gòn' },
  { key: 'saigon_chobenthanh', query: 'Chợ Bến Thành' },
  { key: 'saigon_dinhdoclap', query: 'Dinh Độc Lập' },

  // 3. Mù Cang Chải
  { key: 'mucangchai_cover', query: 'Ruộng bậc thang Mù Cang Chải Yên Bái' },
  { key: 'mucangchai_lapan_tan', query: 'Ruộng bậc thang La Pán Tẩn' },
  { key: 'mucangchai_deokhaupha', query: 'Đèo Khau Phạ Yên Bái' },
  { key: 'mucangchai_banlimmong', query: 'Bản Lìm Mông Mù Cang Chải' },
  { key: 'mucangchai_caopha', query: 'Thung lũng Cao Phạ' },

  // 4. An Giang
  { key: 'angiang_cover', query: 'Du lịch An Giang cảnh đẹp' },
  { key: 'angiang_trasu', query: 'Rừng tràm Trà Sư An Giang' },
  { key: 'angiang_nuisam', query: 'Miếu Bà Chúa Xứ Núi Sam An Giang' },
  { key: 'angiang_chualau', query: 'Chùa Lầu Tịnh Biên An Giang' },
  { key: 'angiang_hotapa', query: 'Hồ Tà Pạ Tri Tôn An Giang' }
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
  console.log('🚀 Fetching images for 4 new tours...');
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
