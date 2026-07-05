require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');
const https = require('https');
const http = require('http');
const OpenAI = require('openai');

const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  timeout: 60 * 1000,
  maxRetries: 2,
});

// Check if a URL returns a valid image
function checkImageUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve(ok);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// Use NVIDIA API to generate an optimized search query
async function generateSearchQuery(destName, city) {
  try {
    const response = await nvidiaClient.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct', // Standard NVIDIA API model
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
    query = query.replace(/^"|"$/g, ''); // Remove quotes if any
    return query;
  } catch (error) {
    console.error('Nvidia API Error:', error.message);
    // Fallback if NVIDIA fails
    return `${destName} ${city || ''} Vietnam du lịch`.trim();
  }
}

async function fixMissingImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // To not scan the whole DB and run forever, let's filter for ones with no images or we can just scan all
    // Since we need to find missing/broken images, we have to scan. 
    // To speed up, we can limit to specific categories or do all. Let's do all.
    const allDests = await Destination.find({}).lean();
    console.log(`📊 Tổng: ${allDests.length} địa điểm\n`);

    let fixedCount = 0;

    for (let i = 0; i < allDests.length; i++) {
      const dest = allDests[i];
      let hasBroken = false;
      const validImages = [];

      if (dest.images && dest.images.length > 0) {
        for (const url of dest.images) {
          if (!url || url.includes('placeholder') || !url.startsWith('http')) {
             hasBroken = true;
             continue;
          }
          const ok = await checkImageUrl(url, 4000);
          if (ok) {
            validImages.push(url);
          } else {
            hasBroken = true;
          }
        }
      } else {
        hasBroken = true;
      }

      if (hasBroken || validImages.length === 0) {
        console.log(`[${i+1}/${allDests.length}] ${dest.name} - Cần cập nhật ảnh. Đang lấy ảnh mới...`);
        
        let newImages = [...validImages];
        if (newImages.length < 3) {
           const query = await generateSearchQuery(dest.name, dest.location?.city);
           console.log(`  🔍 Query sinh bởi NVIDIA: ${query}`);
           
           const fetchedImages = await serperManager.searchImages(query, 5);
           
           for (const img of fetchedImages) {
             if (newImages.length >= 3) break;
             if (!newImages.includes(img)) {
               newImages.push(img);
             }
           }
        }
        
        if (newImages.length > 0) {
          await Destination.updateOne({ _id: dest._id }, { $set: { images: newImages } });
          console.log(`  ✅ Đã lưu ${newImages.length} ảnh cho ${dest.name}`);
        } else {
          console.log(`  ⚠️ Vẫn không tìm thấy ảnh cho ${dest.name}`);
        }
        fixedCount++;
      }
    }

    console.log(`\n🎉 Hoàn thành! Đã xử lý ${fixedCount} địa điểm có ảnh lỗi/thiếu.`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

fixMissingImages();
