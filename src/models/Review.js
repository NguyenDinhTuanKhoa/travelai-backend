const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  content: { type: String, required: true },
  images: [String],
  helpful: { type: Number, default: 0 },
  visitDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
