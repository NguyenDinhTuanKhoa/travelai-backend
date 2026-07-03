require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

async function sampleCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const categories = ['city', 'attraction', 'countryside', 'beach', 'mountain', 'restaurant', 'hotel'];
    
    for (const cat of categories) {
      console.log(`\n=== Category: ${cat} ===`);
      const samples = await Destination.aggregate([
        { $match: { category: cat } },
        { $sample: { size: 5 } },
        { $project: { name: 1, _id: 0 } }
      ]);
      console.log(samples.map(s => s.name).join(', '));
    }
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
sampleCategories();
