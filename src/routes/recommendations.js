const express = require('express');
const recommendationService = require('../services/recommendationService');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Lấy gợi ý cá nhân hóa cho user
router.get('/personalized', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recommendations = await recommendationService.getPersonalizedRecommendations(
      req.user._id, 
      parseInt(limit)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy gợi ý "Vì bạn đã xem..."
router.get('/similar/:destinationId', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const similar = await recommendationService.getSimilarDestinations(
      req.params.destinationId,
      parseInt(limit)
    );
    res.json(similar);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy gợi ý từ users có sở thích tương tự
router.get('/collaborative', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recommendations = await recommendationService.getCollaborativeRecommendations(
      req.user._id,
      parseInt(limit)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Điểm đến phổ biến
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const popular = await recommendationService.getPopularDestinations(parseInt(limit));
    res.json(popular);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Điểm đến trending
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const trending = await recommendationService.getTrendingDestinations(parseInt(limit));
    res.json(trending);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ghi nhận xem điểm đến
router.post('/track/view', protect, async (req, res) => {
  try {
    const { destinationId, timeSpent } = req.body;
    await recommendationService.trackView(req.user._id, destinationId, timeSpent);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ghi nhận tìm kiếm
router.post('/track/search', protect, async (req, res) => {
  try {
    const { query, filters } = req.body;
    await recommendationService.trackSearch(req.user._id, query, filters);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lưu/bỏ lưu điểm đến
router.post('/save/:destinationId', protect, async (req, res) => {
  try {
    const result = await recommendationService.toggleSave(
      req.user._id, 
      req.params.destinationId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy thống kê hành vi user
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await recommendationService.getUserStats(req.user._id);
    res.json(stats || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lấy điểm đến đã lưu
router.get('/saved', protect, async (req, res) => {
  try {
    const UserBehavior = require('../models/UserBehavior');
    const behavior = await UserBehavior.findOne({ user: req.user._id })
      .populate('savedDestinations.destination');
    
    const saved = behavior?.savedDestinations?.map(s => s.destination) || [];
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
