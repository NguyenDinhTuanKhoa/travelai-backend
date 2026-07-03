require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const serperManager = require('../utils/serperManager');

async function addSaDecSpecialPlaces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Adding special places for Sa Đéc, Đồng Tháp...\n');
    console.log('═══════════════════════════════════════════════════════════');

    const specialQueries = [
      'Làng hoa Sa Đéc Đồng Tháp',
      'Khu du lịch Sẻo Quýt Đồng Tháp',
      'Vườn hoa kiểng Sa Đéc',
      'Chợ hoa Sa Đéc'
    ];

    let savedCount = 0;
    let skippedCount = 0;

    for (const query of specialQueries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
      try {
        const placesData = await serperManager.searchPlaces(query);
        
        if (!placesData.places || placesData.places.length === 0) {
          console.log(`   ⚠️  No places found`);
          continue;
        }

        for (const place of placesData.places) {
          if (!place.latitude || !place.longitude) {
            console.log(`   ⏭️  Skipped "${place.title}" - No GPS coordinates`);
            skippedCount++;
            continue;
          }

          // Check if within Đồng Tháp (10.46°N, 105.63°E ±0.5°)
          const latDiff = Math.abs(place.latitude - 10.46);
          const lngDiff = Math.abs(place.longitude - 105.63);
          
          if (latDiff > 0.5 || lngDiff > 0.5) {
            console.log(`   ⏭️  Skipped "${place.title}" - Outside Đồng Tháp`);
            skippedCount++;
            continue;
          }

          const existing = await Destination.findOne({
            name: place.title,
            'location.city': 'Đồng Tháp'
          });

          if (existing) {
            console.log(`   ⏭️  Skipped "${place.title}" - Already exists`);
            skippedCount++;
            continue;
          }

          console.log(`   📸 Fetching images for "${place.title}"...`);
          const images = await serperManager.searchImages(`${place.title} Đồng Tháp`, 3);

          if (images.length === 0) {
            console.log(`   ⚠️  No images found for "${place.title}" - Skipping`);
            skippedCount++;
            continue;
          }

          const destination = {
            name: place.title,
            description: `${place.title} tại Sa Đéc, Đồng Tháp - ${place.address || ''}`,
            category: 'countryside',
            location: {
              city: 'Đồng Tháp',
              address: place.address || 'Sa Đéc, Đồng Tháp',
              coordinates: {
                lat: place.latitude,
                lng: place.longitude
              }
            },
            images: images,
            rating: place.rating || 4.5,
            price: 0
          };

          await Destination.create(destination);
          savedCount++;
          console.log(`   ✅ Added "${place.title}" - ${images.length} images - Rating: ${place.rating || 'N/A'}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing "${query}":`, error.message);
      }
    }

    const totalDongThap = await Destination.countDocuments({ 'location.city': 'Đồng Tháp' });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 SA ĐÉC SPECIAL PLACES ADDED!');
    console.log(`💾 Saved: ${savedCount} destinations`);
    console.log(`⏭️  Skipped: ${skippedCount} destinations`);
    console.log(`📍 Total Đồng Tháp destinations: ${totalDongThap}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addSaDecSpecialPlaces();
