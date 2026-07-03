require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const ngheAn = await Destination.find({ 'location.city': 'Nghệ An' });
  const langSon = await Destination.find({ 'location.city': 'Lạng Sơn' });
  
  console.log('=== NGHỆ AN ===');
  console.log('Total:', ngheAn.length);
  ngheAn.forEach(d => console.log(`  - ${d.name} [${d.category}] images:${d.images?.length || 0}`));
  
  console.log('\n=== LẠNG SƠN ===');
  console.log('Total:', langSon.length);
  langSon.forEach(d => console.log(`  - ${d.name} [${d.category}] images:${d.images?.length || 0}`));
  
  await mongoose.disconnect();
})();
