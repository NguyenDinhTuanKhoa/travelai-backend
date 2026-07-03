require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');

async function checkStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const stats = await Destination.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    console.log(stats);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkStats();
