const mongoose = require('mongoose');
const serpApiManager = require('../utils/serpApiManager');
const Destination = require('../models/Destination');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Tìm tất cả các điểm thuộc danh mục "Biển" ở Bến Tre
    const beaches = await Destination.find({ 'location.city': 'Bến Tre', category: 'beach' });
    console.log(`🌊 Tìm thấy ${beaches.length} địa điểm thuộc danh mục Biển.`);

    let updated = 0;

    for (const beach of beaches) {
      console.log(`\n📸 Đang tìm data_id và kho ảnh cho: ${beach.name}`);
      
      // Bước 1: Tìm data_id của địa điểm này
      const searchParams = {
        engine: 'google_maps',
        q: beach.name + ' Bến Tre',
        type: 'search'
      };

      const searchData = await serpApiManager.fetchWithRotation(searchParams);
      const localResult = searchData.local_results?.[0];

      if (localResult && localResult.data_id) {
        // Bước 2: Dùng data_id để lấy kho ảnh (Gallery)
        console.log(`   => Đã lấy được data_id: ${localResult.data_id}. Đang tải kho ảnh...`);
        
        const photoParams = {
          engine: 'google_maps_photos',
          data_id: localResult.data_id
        };

        const photoData = await serpApiManager.fetchWithRotation(photoParams);
        const photos = photoData.photos || [];
        
        if (photos.length > 0) {
          // Lấy 10 ảnh đẹp nhất
          const imageUrls = photos.slice(0, 10).map(p => p.image);
          
          beach.images = imageUrls;
          await beach.save();
          console.log(`   => ✅ Đã lưu ${imageUrls.length} ảnh sắc nét vào Database!`);
          updated++;
        } else {
          console.log('   => ⚠️ Không tìm thấy ảnh nào trên Google Maps.');
        }
      } else {
        console.log('   => ❌ Không lấy được data_id.');
      }
    }

    console.log(`\n🎉 Hoàn tất! Đã cập nhật ảnh cho ${updated} bãi biển/cồn ở Bến Tre.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
};

run();
