require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

async function checkLowest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const stats = await Destination.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: 1 } }
    ]);
    console.log(stats.map(s => `${s._id}: ${s.count}`).slice(0, 15).join('\n'));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkLowest();
