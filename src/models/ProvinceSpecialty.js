const mongoose = require('mongoose');

const provinceSpecialtySchema = new mongoose.Schema({
  stt: { type: Number, required: true },
  province: { type: String, required: true, unique: true },
  region: { type: String, enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Tây Nguyên'], required: true },
  localDishes: [{
    name: String,
    description: String,
    imageUrl: String,
    estimatedPrice: String
  }],
  souvenirs: [{
    name: String,
    description: String,
    imageUrl: String,
    estimatedPrice: String
  }],
  // Raw data for quick search
  localDishesText: { type: String },
  souvenirsText: { type: String }
}, { timestamps: true });

// Index for text search
provinceSpecialtySchema.index({
  province: 'text',
  localDishesText: 'text',
  souvenirsText: 'text'
});

module.exports = mongoose.model('ProvinceSpecialty', provinceSpecialtySchema);
