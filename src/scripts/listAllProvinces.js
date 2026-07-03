require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const all = await Destination.find({});
  const cities = {};
  all.forEach(d => {
    const c = d.location?.city || 'Unknown';
    cities[c] = (cities[c] || 0) + 1;
  });
  const sorted = Object.entries(cities).sort((a,b) => b[1]-a[1]);
  sorted.forEach(([c, n]) => console.log(`${c}: ${n}`));
  console.log(`\nTOTAL: ${all.length}`);
  await mongoose.disconnect();
})();
