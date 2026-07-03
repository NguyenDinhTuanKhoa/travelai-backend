const UserBehavior = require('../models/UserBehavior');
const Destination = require('../models/Destination');
const User = require('../models/User');

class RecommendationService {
  
  // Ghi nhận hành vi xem điểm đến
  async trackView(userId, destinationId, timeSpent = 0) {
    let behavior = await UserBehavior.findOne({ user: userId });
    
    if (!behavior) {
      behavior = new UserBehavior({ user: userId });
    }

    const existingView = behavior.viewedDestinations.find(
      v => v.destination.toString() === destinationId
    );

    if (existingView) {
      existingView.viewCount += 1;
      existingView.totalTimeSpent += timeSpent;
      existingView.lastViewed = new Date();
    } else {
      behavior.viewedDestinations.push({
        destination: destinationId,
        viewCount: 1,
        totalTimeSpent: timeSpent
      });
    }

    await behavior.save();
    await this.updateAnalyzedPreferences(userId);
  }

  // Ghi nhận tìm kiếm
  async trackSearch(userId, query, filters = {}) {
    let behavior = await UserBehavior.findOne({ user: userId });
    
    if (!behavior) {
      behavior = new UserBehavior({ user: userId });
    }

    behavior.searchHistory.push({ query, filters });
    
    // Giữ tối đa 100 lịch sử tìm kiếm gần nhất
    if (behavior.searchHistory.length > 100) {
      behavior.searchHistory = behavior.searchHistory.slice(-100);
    }

    await behavior.save();
    await this.updateAnalyzedPreferences(userId);
  }

  // Lưu/bỏ lưu điểm đến
  async toggleSave(userId, destinationId) {
    let behavior = await UserBehavior.findOne({ user: userId });
    
    if (!behavior) {
      behavior = new UserBehavior({ user: userId });
    }

    const existingIndex = behavior.savedDestinations.findIndex(
      s => s.destination.toString() === destinationId
    );

    if (existingIndex > -1) {
      behavior.savedDestinations.splice(existingIndex, 1);
      await behavior.save();
      return { saved: false };
    } else {
      behavior.savedDestinations.push({ destination: destinationId });
      await behavior.save();
      return { saved: true };
    }
  }

  // Phân tích và cập nhật sở thích từ hành vi
  async updateAnalyzedPreferences(userId) {
    const behavior = await UserBehavior.findOne({ user: userId })
      .populate('viewedDestinations.destination', 'category priceRange location');

    if (!behavior) return;

    // Phân tích categories yêu thích
    const categoryScores = {};
    const priceRangeScores = {};
    const locationScores = {};

    behavior.viewedDestinations.forEach(view => {
      if (!view.destination) return;
      
      const weight = view.viewCount * (1 + view.totalTimeSpent / 60); // Trọng số dựa trên số lần xem và thời gian
      
      const cat = view.destination.category;
      if (cat) {
        categoryScores[cat] = (categoryScores[cat] || 0) + weight;
      }

      const price = view.destination.priceRange;
      if (price) {
        priceRangeScores[price] = (priceRangeScores[price] || 0) + weight;
      }

      const loc = view.destination.location?.city;
      if (loc) {
        locationScores[loc] = (locationScores[loc] || 0) + weight;
      }
    });

    // Phân tích từ lịch sử tìm kiếm
    behavior.searchHistory.slice(-50).forEach(search => {
      if (search.filters?.category) {
        categoryScores[search.filters.category] = (categoryScores[search.filters.category] || 0) + 2;
      }
      if (search.filters?.priceRange) {
        priceRangeScores[search.filters.priceRange] = (priceRangeScores[search.filters.priceRange] || 0) + 2;
      }
    });

    // Sắp xếp và lấy top preferences
    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, score]) => ({ category, score }));

    const preferredPriceRange = Object.entries(priceRangeScores)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'mid-range';

    const preferredLocations = Object.entries(locationScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([loc]) => loc);

    behavior.analyzedPreferences = {
      topCategories,
      preferredPriceRange,
      preferredLocations,
      lastUpdated: new Date()
    };

    await behavior.save();
  }

  // Lấy gợi ý cá nhân hóa
  async getPersonalizedRecommendations(userId, limit = 10) {
    const behavior = await UserBehavior.findOne({ user: userId });
    const user = await User.findById(userId);

    // Nếu user mới, trả về điểm đến phổ biến
    if (!behavior || behavior.viewedDestinations.length < 3) {
      return this.getPopularDestinations(limit);
    }

    const { analyzedPreferences } = behavior;
    const viewedIds = behavior.viewedDestinations.map(v => v.destination);

    // Query điểm đến dựa trên sở thích đã phân tích
    const query = {
      _id: { $nin: viewedIds } // Loại bỏ đã xem
    };

    // Ưu tiên categories yêu thích
    if (analyzedPreferences.topCategories?.length > 0) {
      query.category = { 
        $in: analyzedPreferences.topCategories.map(c => c.category) 
      };
    }

    // Kết hợp với preferences user đã set
    if (user?.preferences?.budget) {
      query.priceRange = user.preferences.budget;
    }

    let recommendations = await Destination.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limit);

    // Nếu không đủ, bổ sung từ điểm đến phổ biến
    if (recommendations.length < limit) {
      const moreDestinations = await Destination.find({
        _id: { $nin: [...viewedIds, ...recommendations.map(r => r._id)] }
      })
        .sort({ rating: -1, reviewCount: -1 })
        .limit(limit - recommendations.length);
      
      recommendations = [...recommendations, ...moreDestinations];
    }

    return recommendations;
  }

  // Gợi ý "Vì bạn đã xem..."
  async getSimilarDestinations(destinationId, limit = 6) {
    const destination = await Destination.findById(destinationId);
    if (!destination) return [];

    return Destination.find({
      _id: { $ne: destinationId },
      $or: [
        { category: destination.category },
        { priceRange: destination.priceRange },
        { 'location.city': destination.location?.city }
      ]
    })
      .sort({ rating: -1 })
      .limit(limit);
  }

  // Gợi ý dựa trên user có sở thích tương tự (Collaborative Filtering)
  async getCollaborativeRecommendations(userId, limit = 10) {
    const userBehavior = await UserBehavior.findOne({ user: userId });
    if (!userBehavior) return [];

    const userSavedIds = userBehavior.savedDestinations.map(s => s.destination.toString());
    
    // Tìm users có saved destinations tương tự
    const similarUsers = await UserBehavior.find({
      user: { $ne: userId },
      'savedDestinations.destination': { $in: userSavedIds }
    }).limit(20);

    // Lấy destinations mà similar users đã lưu nhưng user hiện tại chưa
    const recommendedIds = new Set();
    similarUsers.forEach(su => {
      su.savedDestinations.forEach(s => {
        if (!userSavedIds.includes(s.destination.toString())) {
          recommendedIds.add(s.destination.toString());
        }
      });
    });

    return Destination.find({
      _id: { $in: Array.from(recommendedIds) }
    })
      .sort({ rating: -1 })
      .limit(limit);
  }

  // Điểm đến phổ biến (cho user mới)
  async getPopularDestinations(limit = 10) {
    return Destination.find()
      .sort({ reviewCount: -1, rating: -1 })
      .limit(limit);
  }

  // Điểm đến trending (nhiều người xem gần đây)
  async getTrendingDestinations(limit = 10) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const trending = await UserBehavior.aggregate([
      { $unwind: '$viewedDestinations' },
      { $match: { 'viewedDestinations.lastViewed': { $gte: oneWeekAgo } } },
      { $group: {
        _id: '$viewedDestinations.destination',
        viewCount: { $sum: '$viewedDestinations.viewCount' }
      }},
      { $sort: { viewCount: -1 } },
      { $limit: limit }
    ]);

    const trendingIds = trending.map(t => t._id);
    return Destination.find({ _id: { $in: trendingIds } });
  }

  // Lấy thống kê hành vi user
  async getUserStats(userId) {
    const behavior = await UserBehavior.findOne({ user: userId });
    if (!behavior) return null;

    return {
      totalSearches: behavior.searchHistory.length,
      totalViewed: behavior.viewedDestinations.length,
      totalSaved: behavior.savedDestinations.length,
      topCategories: behavior.analyzedPreferences?.topCategories || [],
      preferredPriceRange: behavior.analyzedPreferences?.preferredPriceRange,
      recentSearches: behavior.searchHistory.slice(-5).reverse()
    };
  }
}

module.exports = new RecommendationService();
