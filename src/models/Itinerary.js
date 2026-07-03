const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  destinations: [{
    destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination' },
    order: Number,
    notes: String,
    activities: [String]
  }],
  hotels: [{
    name: String,
    address: String,
    checkIn: Date,
    checkOut: Date,
    price: Number
  }],
  restaurants: [{
    name: String,
    address: String,
    cuisine: String,
    priceRange: String
  }],
  budget: { estimated: Number, actual: Number },
  isPublic: { type: Boolean, default: false },
  status: { type: String, enum: ['planning', 'ongoing', 'completed'], default: 'planning' }
}, { timestamps: true });

module.exports = mongoose.model('Itinerary', itinerarySchema);
