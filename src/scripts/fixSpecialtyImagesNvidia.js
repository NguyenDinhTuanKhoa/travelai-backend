require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');
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
      if (!url || !url.startsWith('http')) return resolve(false);
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

// Generate search query for specialties
async function generateSearchQuery(itemName, province) {
  try {
    const response = await nvidiaClient.chat.completions.create({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        { 
          role: 'system', 
          content: 'You are an assistant that generates very short, precise Google Image Search queries to find high-quality photos of local Vietnamese dishes or souvenirs. Return ONLY the search query string, without quotes or extra text.' 
        },
        { 
          role: 'user', 
          content: `Item: ${itemName}, Province: ${province}` 
        }
      ],
      max_tokens: 30
    });
    let query = response.choices[0].message.content.trim();
    query = query.replace(/^"|"$/g, '');
    return query;
  } catch (error) {
    return `Đặc sản ${itemName} ${province} Vietnam`.trim();
  }
}

async function fetchImageForSpecialty(itemName, province) {
   const query = await generateSearchQuery(itemName, province);
   console.log(`  🔍 Query (NVIDIA): ${query}`);
   const fetchedImages = await serperManager.searchImages(query, 3);
   if (fetchedImages && fetchedImages.length > 0) {
      return fetchedImages[0]; // get the first good image
   }
   return null;
}

async function fixSpecialtyImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const allSpecialties = await ProvinceSpecialty.find({}).lean();
    console.log(`📊 Tổng: ${allSpecialties.length} tỉnh thành có đặc sản\n`);

    let fixedCount = 0;

    for (let i = 0; i < allSpecialties.length; i++) {
      const provinceObj = allSpecialties[i];
      let hasChanges = false;
      const provinceName = provinceObj.province;
      
      console.log(`[${i+1}/${allSpecialties.length}] Kiểm tra đặc sản tỉnh: ${provinceName}`);

      // Check Local Dishes
      if (provinceObj.localDishes && provinceObj.localDishes.length > 0) {
        for (let j = 0; j < provinceObj.localDishes.length; j++) {
           const dish = provinceObj.localDishes[j];
           let url = dish.imageUrl;
           const ok = await checkImageUrl(url, 4000);
           if (!ok || !url || url.includes('placeholder')) {
             console.log(`  ❌ Ảnh lỗi món: ${dish.name}. Đang tìm ảnh mới...`);
             const newImg = await fetchImageForSpecialty(dish.name, provinceName);
             if (newImg) {
                provinceObj.localDishes[j].imageUrl = newImg;
                hasChanges = true;
                console.log(`    ✅ Đã tìm thấy ảnh thay thế.`);
             } else {
                console.log(`    ⚠️ Không tìm thấy ảnh.`);
             }
           }
        }
      }

      // Check Souvenirs
      if (provinceObj.souvenirs && provinceObj.souvenirs.length > 0) {
        for (let j = 0; j < provinceObj.souvenirs.length; j++) {
           const souvenir = provinceObj.souvenirs[j];
           let url = souvenir.imageUrl;
           const ok = await checkImageUrl(url, 4000);
           if (!ok || !url || url.includes('placeholder')) {
             console.log(`  ❌ Ảnh lỗi quà: ${souvenir.name}. Đang tìm ảnh mới...`);
             const newImg = await fetchImageForSpecialty(souvenir.name, provinceName);
             if (newImg) {
                provinceObj.souvenirs[j].imageUrl = newImg;
                hasChanges = true;
                console.log(`    ✅ Đã tìm thấy ảnh thay thế.`);
             } else {
                console.log(`    ⚠️ Không tìm thấy ảnh.`);
             }
           }
        }
      }

      if (hasChanges) {
         await ProvinceSpecialty.updateOne(
           { _id: provinceObj._id },
           { 
             $set: { 
               localDishes: provinceObj.localDishes,
               souvenirs: provinceObj.souvenirs
             } 
           }
         );
         fixedCount++;
      }
    }

    console.log(`\n🎉 Hoàn thành! Đã xử lý ảnh đặc sản cho ${fixedCount} tỉnh thành.`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

fixSpecialtyImages();
