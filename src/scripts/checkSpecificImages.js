require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.collection('destinations');
  
  const dests = await db.find({
    name: { $in: ['CLB chim cảnh Bến Tre', 'Quán 379, phú tự, phú hưng, bến tre', 'Chè Thái Yaya Mini Bến Tre'] }
  }).toArray();
  
  console.log(JSON.stringify(dests.map(d => ({ name: d.name, images: d.images })), null, 2));
  process.exit(0);
}
check();
