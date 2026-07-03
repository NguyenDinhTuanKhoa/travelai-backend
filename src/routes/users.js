const express = require('express');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Lấy thông tin profile của user đang đăng nhập
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user
 *       401:
 *         description: Chưa đăng nhập
 */
// Get profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Cập nhật thông tin profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               avatar:
 *                 type: string
 *               preferences:
 *                 type: object
 *                 properties:
 *                   travelStyle:
 *                     type: array
 *                     items:
 *                       type: string
 *                   budget:
 *                     type: string
 *                     enum: [low, medium, high]
 *                   interests:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
// Update profile
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      if (req.body.avatar !== undefined) {
        user.avatar = req.body.avatar;
      }
      user.preferences = req.body.preferences || user.preferences;
      const updatedUser = await user.save();
      res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          preferences: updatedUser.preferences
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Lấy thông tin user theo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 6784a1b2c3d4e5f678901234
 *         description: MongoDB ObjectId của user
 *     responses:
 *       200:
 *         description: Thông tin user (không bao gồm password)
 *       404:
 *         description: Không tìm thấy user
 */
// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      res.json({ success: true, data: user });
    } else {
      res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /users/search/{name}:
 *   get:
 *     summary: Tìm kiếm user theo tên
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên user cần tìm (tìm kiếm gần đúng)
 *     responses:
 *       200:
 *         description: Danh sách user phù hợp
 */
// Search users by name
router.get('/search/:name', async (req, res) => {
  try {
    const users = await User.find({
      name: { $regex: req.params.name, $options: 'i' }
    }).select('-password').limit(20);
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách tất cả users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách users
 *       403:
 *         description: Không có quyền admin
 */
// Get all users (admin)
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find()
      .select('-password')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    const total = await User.countDocuments();
    
    res.json({ 
      success: true, 
      data: users, 
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
