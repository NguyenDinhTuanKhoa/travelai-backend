const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const axios = require('axios');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
const aiService = require('../services/aiService'); 

const SERPER_API_KEY = process.env.SERPER_API_KEY;



async function searchGoogle(query) {
  try {
    const data = JSON.stringify({
      "q": query,
      "gl": "vn",
      "hl": "vi"
    });

    const config = {
      method: 'post',
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error searching Google for "${query}":`, error.message);
    return null;
  }
}

async function extractPriceFromSearch(dishName, province, searchData) {
  if (!searchData || !searchData.organic) return null;
  
  // Dựng văn bản snippet để gửi cho AI
  let contextText = searchData.organic.slice(0, 5).map(result => `Title: ${result.title}\nSnippet: ${result.snippet}`).join('\n\n');
  if (searchData.answerBox) {
    contextText = `Answer Box: ${searchData.answerBox.answer || searchData.answerBox.snippet}\n\n` + contextText;
  }

  const prompt = `Bạn là trợ lý phân tích dữ liệu. Dưới đây là các kết quả tìm kiếm trên Google cho câu hỏi "giá ${dishName} tại ${province}".
Dựa vào các kết quả này, hãy trích xuất khoảng giá bán lẻ phổ biến nhất của món "${dishName}".
YÊU CẦU QUAN TRỌNG: 
- Chỉ trả về duy nhất 1 chuỗi ký tự thể hiện giá (VD: "30.000 - 50.000 VNĐ", "Khoảng 40.000 VNĐ/tô", "150.000 - 200.000 VNĐ/kg").
- Nếu trong kết quả tìm kiếm không đề cập đến giá, hãy trả về chính xác chữ "Không có thông tin".
- KHÔNG giải thích, KHÔNG thêm bất kỳ từ ngữ nào khác.

Kết quả tìm kiếm:
${contextText}`;

  try {
    const aiResponse = await aiService.chatComplete([{ role: 'user', content: prompt }]);
    const estimatedPrice = aiResponse.trim().replace(/^['"](.*)['"]$/, '$1'); // Loại bỏ ngoặc kép nếu AI vô tình sinh ra
    
    // Nếu AI vẫn nói luyên thuyên, lọc cơ bản
    if (estimatedPrice.length > 50 && !estimatedPrice.toLowerCase().includes('không có thông tin')) {
       console.log(`[Warning] AI response too long for ${dishName}: ${estimatedPrice}`);
       return null;
    }
    
    return estimatedPrice === 'Không có thông tin' ? null : estimatedPrice;
  } catch (error) {
    console.error(`Error extracting price for ${dishName}:`, error.message);
    return null;
  }
}

async function updatePricesForProvince(provinceName) {
  console.log(`\n--- Bắt đầu cập nhật giá cho tỉnh: ${provinceName} ---`);
  
  const specialty = await ProvinceSpecialty.findOne({ province: provinceName });
  if (!specialty) {
    console.log(`Không tìm thấy dữ liệu cho tỉnh ${provinceName}`);
    return;
  }

  let isUpdated = false;

  // Cập nhật giá món ăn
  for (let dish of specialty.localDishes) {
    if (!dish.estimatedPrice) {
      console.log(`Đang tìm giá cho món ăn: ${dish.name} (${provinceName})...`);
      const searchData = await searchGoogle(`giá ${dish.name} ${provinceName} bao nhiêu tiền`);
      const price = await extractPriceFromSearch(dish.name, provinceName, searchData);
      
      if (price) {
        dish.estimatedPrice = price;
        isUpdated = true;
        console.log(`=> Đã tìm thấy giá: ${price}`);
      } else {
        console.log(`=> Không tìm thấy thông tin giá.`);
      }
      
      // Delay nhỏ để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Cập nhật giá đặc sản mang về
  for (let souvenir of specialty.souvenirs) {
    if (!souvenir.estimatedPrice) {
      console.log(`Đang tìm giá cho đặc sản: ${souvenir.name} (${provinceName})...`);
      const searchData = await searchGoogle(`giá ${souvenir.name} ${provinceName} bao nhiêu tiền 1kg`);
      const price = await extractPriceFromSearch(souvenir.name, provinceName, searchData);
      
      if (price) {
        souvenir.estimatedPrice = price;
        isUpdated = true;
        console.log(`=> Đã tìm thấy giá: ${price}`);
      } else {
        console.log(`=> Không tìm thấy thông tin giá.`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (isUpdated) {
    await specialty.save();
    console.log(`\nĐã lưu thành công dữ liệu giá mới cho tỉnh ${provinceName}.`);
  } else {
    console.log(`\nKhông có cập nhật giá nào mới cho tỉnh ${provinceName}.`);
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const targetProvince = process.argv[2]; // Optional: pass province name as arg

    if (targetProvince) {
      // Chỉ cập nhật một tỉnh cụ thể
      await updatePricesForProvince(targetProvince);
    } else {
      // Cập nhật toàn bộ 63 tỉnh thành trong database
      const allSpecialties = await ProvinceSpecialty.find({}).select('province').sort({ stt: 1 });
      console.log(`\nBắt đầu cập nhật giá cho ${allSpecialties.length} tỉnh thành...\n`);
      
      for (let i = 0; i < allSpecialties.length; i++) {
        const p = allSpecialties[i];
        console.log(`[${i + 1}/${allSpecialties.length}] ${p.province}`);
        await updatePricesForProvince(p.province);
        // Delay giữa các tỉnh để tránh rate limit Serper
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('\n✅ Hoàn thành cập nhật giá toàn bộ tỉnh thành!');
    }

  } catch (error) {
    console.error('Lỗi khi chạy script:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();

