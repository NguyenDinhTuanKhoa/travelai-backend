const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  location: {
    city: String,
    country: String,
    coordinates: { lat: Number, lng: Number }
  },
  images: [String],
  category: { type: String, enum: ['beach', 'mountain', 'city', 'countryside', 'historical', 'hotel', 'restaurant', 'cafe', 'temple', 'attraction', 'amusement', 'culture', 'landmark'] },
  priceRange: { type: String, enum: ['budget', 'mid-range', 'luxury'] },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  amenities: [String],
  bestTimeToVisit: [String],
  activities: [String],
  cuisine: {
    name: String,
    description: String
  },
  isIconic: { type: Boolean, default: false, index: true },
  iconicRank: { type: Number, default: 999 }
}, { timestamps: true });

module.exports = mongoose.model('Destination', destinationSchema);
