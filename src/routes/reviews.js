const express = require('express');
const Review = require('../models/Review');
const Destination = require('../models/Destination');
const { protect } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /reviews/destination/{destinationId}:
 *   get:
 *     summary: Lấy danh sách đánh giá của điểm đến
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: destinationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách đánh giá
 */
// Get reviews for destination
router.get('/destination/:destinationId', async (req, res) => {
  try {
    const reviews = await Review.find({ destination: req.params.destinationId })
      .populate('user', 'name avatar').sort('-createdAt');
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /reviews/my:
 *   get:
 *     summary: Lấy danh sách đánh giá của user đang đăng nhập
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đánh giá của user
 */
// Get reviews by current user
router.get('/my', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('destination', 'name images location')
      .sort('-createdAt');
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Tạo đánh giá mới
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destination
 *               - rating
 *             properties:
 *               destination:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               visitDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
// Create review
router.post('/', protect, async (req, res) => {
  try {
    const { destination, rating, title, content, images, visitDate } = req.body;
    const review = await Review.create({
      user: req.user._id, destination, rating, title, content, images, visitDate
    });

    // Update destination rating
    const reviews = await Review.find({ destination });
    const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await Destination.findByIdAndUpdate(destination, { rating: avgRating.toFixed(1), reviewCount: reviews.length });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Xóa đánh giá
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
// Delete review
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (review) {
      res.json({ success: true, message: 'Review removed' });
    } else {
      res.status(404).json({ success: false, message: 'Review not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
