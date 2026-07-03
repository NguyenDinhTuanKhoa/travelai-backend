const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const Destination = require('../models/Destination');

const deleteData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const result = await Destination.deleteMany({ 'location.city': 'Bến Tre' });
    console.log(`🗑️ Đã xóa thành công ${result.deletedCount} địa điểm thuộc Bến Tre.`);

    process.exit(0);
  } catch (err) {
    console.error('Lỗi:', err.message);
    process.exit(1);
  }
};

deleteData();
