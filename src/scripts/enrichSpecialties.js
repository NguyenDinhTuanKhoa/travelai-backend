require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
const serperManager = require('../utils/serperManager');
const OpenAI = require('openai');

const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  timeout: 60 * 1000,
  maxRetries: 3,
});

async function getAISuggestions(province, currentDishes, currentSouvenirs) {
  const prompt = `You are an expert on Vietnamese cuisine and local specialties.
Province: ${province}
Currently known dishes: ${currentDishes.join(', ') || 'none'}
Currently known souvenirs: ${currentSouvenirs.join(', ') || 'none'}

Task: Provide 2 new, famous local dishes and 2 new, famous local souvenirs (gifts) for this province that are NOT in the current lists.
Format the output STRICTLY as a JSON object with this exact structure:
{
  "newDishes": [
    { "name": "Dish Name", "description": "Short delicious description in Vietnamese", "estimatedPrice": "approx price in VNĐ" }
  ],
  "newSouvenirs": [
    { "name": "Souvenir Name", "description": "Short appealing description in Vietnamese", "estimatedPrice": "approx price in VNĐ" }
  ]
}
Do not add any markdown formatting, backticks, or other text outside the JSON. Return only the raw JSON.`;

  try {
    const chatRes = await nvidiaClient.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }]
    });

    let rawJson = chatRes.choices[0].message.content.trim();
    // Clean up potential markdown formatting
    if (rawJson.startsWith('```json')) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    if (rawJson.startsWith('```')) rawJson = rawJson.replace(/```/g, '').trim();

    return JSON.parse(rawJson);
  } catch (error) {
    console.error(`❌ Lỗi AI khi xử lý tỉnh ${province}:`, error.message);
    return { newDishes: [], newSouvenirs: [] };
  }
}

async function enrichSpecialties() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const provinces = await ProvinceSpecialty.find().sort({ stt: 1 });
    console.log(`📊 Tổng số tỉnh thành: ${provinces.length}`);

    let addedCount = 0;

    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      console.log(`\n[${i + 1}/${provinces.length}] Đang phân tích đặc sản tỉnh: ${p.province}`);
      
      const currentDishNames = p.localDishes.map(d => d.name);
      const currentSouvNames = p.souvenirs.map(s => s.name);

      // Nếu đã có >= 6 món, có thể skip để tiết kiệm thời gian (có thể bỏ qua điều kiện này nếu muốn add liên tục)
      if (currentDishNames.length >= 6 && currentSouvNames.length >= 6) {
        console.log(`  ➡️ Tỉnh đã có nhiều món (${currentDishNames.length} dishes, ${currentSouvNames.length} souvenirs), bỏ qua.`);
        continue;
      }

      const suggestions = await getAISuggestions(p.province, currentDishNames, currentSouvNames);
      
      let modified = false;

      // Xử lý Dishes
      if (suggestions.newDishes && Array.isArray(suggestions.newDishes)) {
        for (const item of suggestions.newDishes) {
          if (!currentDishNames.includes(item.name)) {
            console.log(`  + Đang lấy ảnh cho món mới: ${item.name}`);
            const images = await serperManager.searchImages(`${item.name} ${p.province} vietnamese food`, 1);
            const imageUrl = images.length > 0 ? images[0] : '';
            p.localDishes.push({
              name: item.name,
              description: item.description,
              estimatedPrice: item.estimatedPrice,
              imageUrl
            });
            modified = true;
            addedCount++;
          }
        }
      }

      // Xử lý Souvenirs
      if (suggestions.newSouvenirs && Array.isArray(suggestions.newSouvenirs)) {
        for (const item of suggestions.newSouvenirs) {
          if (!currentSouvNames.includes(item.name)) {
            console.log(`  + Đang lấy ảnh cho quà mới: ${item.name}`);
            const images = await serperManager.searchImages(`${item.name} ${p.province} đặc sản làm quà`, 1);
            const imageUrl = images.length > 0 ? images[0] : '';
            p.souvenirs.push({
              name: item.name,
              description: item.description,
              estimatedPrice: item.estimatedPrice,
              imageUrl
            });
            modified = true;
            addedCount++;
          }
        }
      }

      if (modified) {
        await p.save();
        console.log(`  ✅ Đã lưu các món mới cho ${p.province}`);
      } else {
        console.log(`  ➖ Không có món mới được thêm.`);
      }
    }

    console.log(`\n🎉 HOÀN THÀNH! Tổng cộng đã thêm mới ${addedCount} món ăn / quà tặng cho 63 tỉnh thành.`);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

enrichSpecialties();
