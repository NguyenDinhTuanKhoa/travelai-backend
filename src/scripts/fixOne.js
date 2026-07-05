require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const OpenAI = require('openai');

const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  timeout: 60 * 1000,
  maxRetries: 2,
});

async function generateSearchQuery(destName, city) {
  try {
    const response = await nvidiaClient.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        { 
          role: 'system', 
          content: 'You are an assistant that generates very short, precise Google Image Search queries to find high-quality photos of tourist destinations in Vietnam. Return ONLY the search query string, without quotes or extra text.' 
        },
        { 
          role: 'user', 
          content: `Destination: ${destName}, City: ${city || 'Vietnam'}` 
        }
      ],
      max_tokens: 30
    });
    let query = response.choices[0].message.content.trim();
    query = query.replace(/^"|"$/g, '');
    return query;
  } catch (error) {
    return `${destName} ${city || ''} Vietnam du lịch`.trim();
  }
}

async function fixSpecific() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Chùa Khmer Cham Ka វដ្ដចម្ការ
    const dest = await Destination.findOne({ name: /Chùa Khmer Cham Ka/i });
    if (!dest) {
      console.log('Không tìm thấy địa điểm');
      process.exit(0);
    }
    
    console.log(`Đang lấy ảnh mới cho: ${dest.name}`);
    
    const query = await generateSearchQuery(dest.name, dest.location?.city);
    console.log(`🔍 Query (NVIDIA): ${query}`);
    
    const fetchedImages = await serperManager.searchImages(query, 5);
    
    if (fetchedImages.length > 0) {
      await Destination.updateOne({ _id: dest._id }, { $set: { images: fetchedImages.slice(0, 3) } });
      console.log(`✅ Đã lưu ${Math.min(3, fetchedImages.length)} ảnh.`);
    } else {
      console.log(`⚠️ Không tìm thấy ảnh.`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixSpecific();
