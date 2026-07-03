const fs = require('fs');
const https = require('https');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Truy vấn Overpass QL để lấy:
// 1. Khách sạn (tourism=hotel hoặc tourism=guest_house)
// 2. Nhà hàng (amenity=restaurant hoặc amenity=cafe)
// 3. Địa điểm du lịch (tourism=attraction hoặc tourism=viewpoint)
// Sử dụng Bounding Box khu vực Thành phố Bến Tre và lân cận để lấy dữ liệu siêu tốc
const query = `
[out:json][timeout:25];
(
  node["tourism"~"hotel|guest_house"](10.15,106.30,10.35,106.50);
  node["amenity"~"restaurant|cafe"](10.15,106.30,10.35,106.50);
  node["tourism"~"attraction|museum|viewpoint"](10.15,106.30,10.35,106.50);
);
out center;
`;

const postData = 'data=' + encodeURIComponent(query);

const options = {
  hostname: 'overpass-api.de',
  port: 443,
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'TravelAI-DataCollection/1.0'
  }
};

console.log('Đang gửi yêu cầu tới Overpass API để lấy dữ liệu Bến Tre...');

const req = https.request(options, (res) => {
  let rawData = '';
  res.on('data', (chunk) => {
    rawData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData);
      const elements = parsedData.elements;
      
      let hotels = [];
      let restaurants = [];
      let attractions = [];
      
      elements.forEach(el => {
        if (!el.tags) return;
        
        const item = {
          name: el.tags.name || 'Không có tên',
          lat: el.lat,
          lon: el.lon,
          tags: el.tags
        };
        
        if (el.tags.tourism === 'hotel' || el.tags.tourism === 'guest_house') {
          hotels.push(item);
        } else if (el.tags.amenity === 'restaurant' || el.tags.amenity === 'cafe') {
          restaurants.push(item);
        } else if (el.tags.tourism === 'attraction' || el.tags.tourism === 'museum' || el.tags.tourism === 'viewpoint') {
          attractions.push(item);
        }
      });
      
      console.log(`\n=== THỐNG KÊ KẾT QUẢ BẾN TRE ===`);
      console.log(`- Khách sạn / Nhà nghỉ: ${hotels.length}`);
      console.log(`- Nhà hàng / Quán Cafe: ${restaurants.length}`);
      console.log(`- Địa điểm du lịch: ${attractions.length}`);
      console.log(`- Tổng cộng: ${elements.length} địa điểm`);
      
      // Save full result to a file
      const outputPath = path.join(__dirname, 'bentre_data.json');
      fs.writeFileSync(outputPath, JSON.stringify({ hotels, restaurants, attractions }, null, 2));
      console.log(`\nĐã lưu toàn bộ dữ liệu thô vào: ${outputPath}`);
      
      // In ra vài mẫu
      console.log('\n--- MẪU 2 KHÁCH SẠN ---');
      console.log(hotels.filter(h => h.name !== 'Không có tên').slice(0, 2));
      
      console.log('\n--- MẪU 2 NHÀ HÀNG ---');
      console.log(restaurants.filter(r => r.name !== 'Không có tên').slice(0, 2));
      
      console.log('\n--- MẪU 2 ĐỊA ĐIỂM DU LỊCH ---');
      console.log(attractions.filter(a => a.name !== 'Không có tên').slice(0, 2));
      
    } catch (e) {
      console.error('Lỗi phân tích JSON:', e.message);
      console.error('Dữ liệu trả về (một phần):', rawData.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Lỗi request: ${e.message}`);
});

req.write(postData);
req.end();
