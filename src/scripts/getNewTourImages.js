const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

const destinations = [
  // Bến Tre
  { key: 'bentre_cover', query: 'Du lịch Bến Tre sông nước miền Tây' },
  { key: 'con_phung', query: 'Cồn Phụng Bến Tre' },
  { key: 'lan_vuong', query: 'Khu du lịch Lan Vương Bến Tre' },
  { key: 'vam_ho', query: 'Sân chim Vàm Hồ Bến Tre' },
  { key: 'nguyen_dinh_chieu', query: 'Lăng mộ Nguyễn Đình Chiểu Bến Tre' },

  // Hà Giang
  { key: 'hagiang_cover', query: 'Du lịch Hà Giang hùng vĩ' },
  { key: 'ma_pi_leng', query: 'Đèo Mã Pí Lèng Hà Giang' },
  { key: 'lung_cu', query: 'Cột cờ Lũng Cú Hà Giang' },
  { key: 'dinh_vua_meo', query: 'Dinh thự họ Vương Vua Mèo Hà Giang' },
  { key: 'dong_van', query: 'Phố cổ Đồng Văn Hà Giang' }
];

function checkImageUrl(url, timeoutMs = 3000) {
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
  console.log('🚀 Fetching images for new Bến Tre and Hà Giang tours...');
  const results = {};
  
  for (const dest of destinations) {
    console.log(`Searching images for: "${dest.query}"...`);
    const images = await serperManager.searchImages(dest.query, 10);
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
