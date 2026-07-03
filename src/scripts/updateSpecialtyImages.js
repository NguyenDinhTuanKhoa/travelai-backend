require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const ProvinceSpecialty = require('../models/ProvinceSpecialty');

const MONGODB_URI = process.env.MONGODB_URI;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

if (!SERPER_API_KEY) {
  console.error("SERPER_API_KEY is not set in .env");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSpecialtyImage(specialtyName, provinceName) {
  let data = JSON.stringify({
    "q": `${specialtyName} đặc sản ${provinceName}`,
    "gl": "vn",
    "hl": "vi"
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://google.serper.dev/images',
    headers: { 
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    data : data
  };

  try {
    const response = await axios.request(config);
    if (response.data && response.data.images && response.data.images.length > 0) {
        return response.data.images[0].imageUrl;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching image for ${specialtyName}:`, error.message);
    return null;
  }
}

async function updateSpecialtyImages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const specialties = await ProvinceSpecialty.find({});
    console.log(`Found ${specialties.length} provinces to process.`);

    for (const doc of specialties) {
      console.log(`Processing province: ${doc.province}`);
      let updated = false;

      // Process localDishes
      for (let i = 0; i < doc.localDishes.length; i++) {
        const dish = doc.localDishes[i];
        if (!dish.imageUrl) {
          console.log(`  Fetching image for dish: ${dish.name}`);
          const imageUrl = await getSpecialtyImage(dish.name, doc.province);
          if (imageUrl) {
            dish.imageUrl = imageUrl;
            updated = true;
            console.log(`    Found image: ${imageUrl}`);
          } else {
            console.log(`    No image found for ${dish.name}`);
          }
          await sleep(300); // 300ms delay to avoid rate limit
        }
      }

      // Process souvenirs
      for (let i = 0; i < doc.souvenirs.length; i++) {
        const souvenir = doc.souvenirs[i];
        if (!souvenir.imageUrl) {
          console.log(`  Fetching image for souvenir: ${souvenir.name}`);
          const imageUrl = await getSpecialtyImage(souvenir.name, doc.province);
          if (imageUrl) {
            souvenir.imageUrl = imageUrl;
            updated = true;
            console.log(`    Found image: ${imageUrl}`);
          } else {
            console.log(`    No image found for ${souvenir.name}`);
          }
          await sleep(300); // 300ms delay to avoid rate limit
        }
      }

      if (updated) {
        await doc.save();
        console.log(`  Saved updates for ${doc.province}`);
      } else {
        console.log(`  No updates needed for ${doc.province}`);
      }
    }

    console.log("Finished updating specialty images.");
  } catch (error) {
    console.error("Script error:", error);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

updateSpecialtyImages();
