const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

const importData = async () => {
  try {
    const dataPath = path.join(__dirname, 'bentre_data.json');
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Không tìm thấy file bentre_data.json');
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const { hotels, restaurants, attractions } = JSON.parse(rawData);

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let totalImported = 0;

    const processItems = async (items, categoryStr) => {
      for (const item of items) {
        if (!item.name || item.name === 'Không có tên') continue;

        // Xây dựng object Destination từ dữ liệu OSM
        const dest = {
          name: item.name,
          location: {
            city: 'Bến Tre',
            country: 'Việt Nam',
            coordinates: {
              lat: item.lat,
              lng: item.lon
            }
          },
          category: categoryStr,
          // Extract amenities from tags
          amenities: [],
        };

        if (item.tags.phone) dest.description = `SĐT: ${item.tags.phone}`;
        if (item.tags.internet_access === 'wlan') dest.amenities.push('Wi-Fi');
        if (item.tags.wheelchair === 'yes') dest.amenities.push('Lối đi xe lăn');
        if (item.tags['addr:street']) {
           dest.description = (dest.description ? dest.description + ' | ' : '') + 
                              `Địa chỉ: ${item.tags['addr:street']}`;
        }

        const existing = await Destination.findOne({ name: dest.name, 'location.city': 'Bến Tre' });
        if (!existing) {
          await Destination.create(dest);
          totalImported++;
        }
      }
    };

    console.log('Đang import Khách sạn...');
    await processItems(hotels, 'hotel');
    
    console.log('Đang import Nhà hàng...');
    await processItems(restaurants, 'restaurant');
    
    console.log('Đang import Địa điểm du lịch...');
    await processItems(attractions, 'attraction');

    console.log(`\n🎉 Đã import thành công ${totalImported} địa điểm mới vào Database!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

importData();
