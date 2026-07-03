require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (const province of ['Nghệ An', 'Lạng Sơn']) {
    const dests = await Destination.find({ 'location.city': province });
    console.log(`\n=== ${province} (${dests.length} địa điểm) ===`);
    
    let noCoords = 0;
    let badCoords = 0;
    
    dests.forEach(d => {
      const lat = d.location?.coordinates?.lat;
      const lng = d.location?.coordinates?.lng;
      if (!lat || !lng) {
        console.log(`  ❌ NO COORDS: ${d.name} [${d.category}]`);
        noCoords++;
      } else if (lat === 0 || lng === 0) {
        console.log(`  ⚠️ ZERO COORDS: ${d.name} [${d.category}] (${lat}, ${lng})`);
        badCoords++;
      } else {
        console.log(`  ✅ ${d.name} [${d.category}] (${lat}, ${lng}) images:${d.images?.length || 0}`);
      }
    });
    
    console.log(`\n  Summary: ${noCoords} missing, ${badCoords} zero, ${dests.length - noCoords - badCoords} valid`);
  }
  
  await mongoose.disconnect();
})();
