require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
const serperManager = require('../utils/serperManager');
const OpenAI = require('openai');

const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  timeout: 60 * 1000,
  maxRetries: 2,
});

async function addSpecialty(provinceName, type, name, description, price) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const province = await ProvinceSpecialty.findOne({ province: provinceName });
    if (!province) {
      console.log(`Không tìm thấy tỉnh ${provinceName}`);
      process.exit(1);
    }

    // Generate query
    const chatRes = await nvidiaClient.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'system', content: 'You generate short Google Image Search queries for Vietnamese food/souvenirs. Return ONLY the query.' },
        { role: 'user', content: `Item: ${name}, Province: ${provinceName}` }
      ]
    });
    const query = chatRes.choices[0].message.content.replace(/["']/g, '').trim();
    
    // Fetch image
    const images = await serperManager.searchImages(query, 1);
    const imageUrl = images.length > 0 ? images[0] : '';
    
    const newItem = {
      name,
      description,
      imageUrl,
      estimatedPrice: price
    };

    const targetList = type === 'dish' ? province.localDishes : province.souvenirs;
    const existingIndex = targetList.findIndex(item => item.name === name);
    
    if (existingIndex !== -1) {
      targetList[existingIndex] = newItem;
    } else {
      targetList.push(newItem);
    }
    
    await province.save();
    console.log(`✅ Đã thêm ${name} vào ${provinceName} với ảnh: ${imageUrl}`);
    process.exit(0);
  } catch (error) {
    console.error('Lỗi:', error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length >= 3) {
  addSpecialty(args[0], args[1], args[2], args[3] || '', args[4] || '');
} else {
  console.log('Usage: node addSpecialty.js <province> <dish|souvenir> <name> [description] [price]');
  process.exit(1);
}
