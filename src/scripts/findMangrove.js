require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Searching in DB for Trà Vinh destinations containing forest keywords...');
  const results = await Destination.find({
    'location.city': 'Trà Vinh',
    name: { $regex: 'rừng|ngập|mặn|long khánh|cánh đồng|sinh thái', $options: 'i' }
  });
  results.forEach(r => {
    console.log(`- Name: "${r.name}" (${r.category})`);
    console.log(`  Images:`, r.images);
  });
  await mongoose.disconnect();
})();
