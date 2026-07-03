const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');

const destinations = [
  { key: 'cover', query: 'Du lịch Trà Vinh cảnh đẹp' },
  { key: 'ao_ba_om', query: 'Ao Bà Om Trà Vinh' },
  { key: 'bao_tang_khmer', query: 'Bảo tàng Văn hóa Khmer Trà Vinh' },
  { key: 'den_tho_bac', query: 'Đền thờ Chủ tịch Hồ Chí Minh Trà Vinh' },
  { key: 'con_chim', query: 'Khu du lịch sinh thái Cồn Chim Trà Vinh' },
  { key: 'chua_co', query: 'Chùa Cò Trà Vinh Nodol Pagoda' },
  { key: 'chua_vam_ray', query: 'Chùa Vàm Ray Trà Vinh' },
  { key: 'rung_ngap_man', query: 'Rừng đước Long Khánh Trà Vinh' },
  { key: 'bien_ba_dong', query: 'Biển Ba Động Trà Vinh' }
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
  console.log('🚀 Fetching images for Tra Vinh tour stops...');
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
