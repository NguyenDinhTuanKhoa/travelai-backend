const mongoose = require('mongoose');

const userBehaviorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Lịch sử tìm kiếm
  searchHistory: [{
    query: String,
    filters: {
      category: String,
      priceRange: String,
      location: String
    },
    timestamp: { type: Date, default: Date.now }
  }],

  // Điểm đến đã xem
  viewedDestinations: [{
    destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination' },
    viewCount: { type: Number, default: 1 },
    totalTimeSpent: { type: Number, default: 0 }, // seconds
    lastViewed: { type: Date, default: Date.now }
  }],

  // Điểm đến đã lưu/yêu thích
  savedDestinations: [{
    destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination' },
    savedAt: { type: Date, default: Date.now }
  }],

  // Click tracking
  clickHistory: [{
    itemType: { type: String, enum: ['destination', 'hotel', 'restaurant', 'activity'] },
    itemId: mongoose.Schema.Types.ObjectId,
    timestamp: { type: Date, default: Date.now }
  }],

  // Phân tích sở thích tự động (được tính toán từ hành vi)
  analyzedPreferences: {
    topCategories: [{ category: String, score: Number }],
    preferredPriceRange: String,
    preferredLocations: [String],
    travelStyle: [String],
    lastUpdated: Date
  }

}, { timestamps: true });

// Index để query nhanh
userBehaviorSchema.index({ user: 1 });
userBehaviorSchema.index({ 'viewedDestinations.destination': 1 });

module.exports = mongoose.model('UserBehavior', userBehaviorSchema);
