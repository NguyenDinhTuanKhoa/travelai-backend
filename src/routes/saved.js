const express = require('express');
const User = require('../models/User');
const Destination = require('../models/Destination');
const { protect } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /saved:
 *   get:
 *     summary: Lấy danh sách điểm đến đã lưu
 *     tags: [Saved]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách điểm đến đã lưu
 *       401:
 *         description: Chưa đăng nhập
 */
// GET /api/saved - Get user's saved destinations
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('savedDestinations', 'name images location category rating priceRange');
    
    res.json({ 
      success: true, 
      data: user.savedDestinations || [] 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /saved/{destinationId}:
 *   post:
 *     summary: Toggle lưu/bỏ lưu điểm đến
 *     tags: [Saved]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: destinationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của điểm đến
 *     responses:
 *       200:
 *         description: Trạng thái lưu đã thay đổi
 */
// POST /api/saved/:destinationId - Toggle save destination
router.post('/:destinationId', protect, async (req, res) => {
  try {
    const { destinationId } = req.params;
    const user = await User.findById(req.user._id);
    
    const index = user.savedDestinations.indexOf(destinationId);
    let saved = false;
    
    if (index === -1) {
      // Add to saved
      user.savedDestinations.push(destinationId);
      saved = true;
    } else {
      // Remove from saved
      user.savedDestinations.splice(index, 1);
      saved = false;
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      data: { saved, count: user.savedDestinations.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /saved/check/{destinationId}:
 *   get:
 *     summary: Kiểm tra điểm đến đã lưu chưa
 *     tags: [Saved]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: destinationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trạng thái đã lưu
 */
// GET /api/saved/check/:destinationId - Check if destination is saved
router.get('/check/:destinationId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isSaved = user.savedDestinations.includes(req.params.destinationId);
    
    res.json({ success: true, data: { saved: isSaved } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
