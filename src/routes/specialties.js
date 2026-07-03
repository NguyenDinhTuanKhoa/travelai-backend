const express = require('express');
const router = express.Router();
const ProvinceSpecialty = require('../models/ProvinceSpecialty');

/**
 * @swagger
 * /api/specialties:
 *   get:
 *     summary: Lấy danh sách đặc sản tất cả tỉnh thành
 *     tags: [Specialties]
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           enum: [Miền Bắc, Miền Trung, Miền Nam, Tây Nguyên]
 *         description: Lọc theo vùng miền
 *     responses:
 *       200:
 *         description: Danh sách đặc sản
 */
router.get('/', async (req, res) => {
  try {
    const { region } = req.query;
    const filter = region ? { region } : {};

    const specialties = await ProvinceSpecialty.find(filter)
      .sort({ stt: 1 })
      .select('-__v');

    res.json({
      success: true,
      count: specialties.length,
      data: specialties
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/specialties/search:
 *   get:
 *     summary: Tìm kiếm đặc sản theo từ khóa
 *     tags: [Specialties]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm (tên tỉnh, món ăn, đặc sản)
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp từ khóa tìm kiếm (q)'
      });
    }

    // Tìm kiếm trong tên tỉnh, món ăn địa phương và đặc sản
    const regex = new RegExp(q, 'i');
    const results = await ProvinceSpecialty.find({
      $or: [
        { province: regex },
        { localDishesText: regex },
        { souvenirsText: regex }
      ]
    }).select('-__v');

    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/specialties/province/{name}:
 *   get:
 *     summary: Lấy đặc sản theo tên tỉnh thành
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên tỉnh/thành phố (ví dụ Hà Nội, Đà Nẵng)
 *     responses:
 *       200:
 *         description: Thông tin đặc sản của tỉnh
 *       404:
 *         description: Không tìm thấy tỉnh
 */
router.get('/province/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Tìm chính xác hoặc tương tự
    let specialty = await ProvinceSpecialty.findOne({
      province: new RegExp(`^${name}$`, 'i')
    }).select('-__v');

    // Nếu không tìm thấy, thử tìm tương tự
    if (!specialty) {
      specialty = await ProvinceSpecialty.findOne({
        province: new RegExp(name, 'i')
      }).select('-__v');
    }

    if (!specialty) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đặc sản của tỉnh "${name}"`
      });
    }

    res.json({
      success: true,
      data: specialty
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/specialties/region/{region}:
 *   get:
 *     summary: Lấy đặc sản theo vùng miền
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [mien-bac, mien-trung, mien-nam, tay-nguyen]
 *         description: Vùng miền (mien-bac, mien-trung, mien-nam, tay-nguyen)
 *     responses:
 *       200:
 *         description: Danh sách đặc sản theo vùng
 */
router.get('/region/:region', async (req, res) => {
  try {
    const { region } = req.params;

    // Map slug to Vietnamese name
    const regionMap = {
      'mien-bac': 'Miền Bắc',
      'mien-trung': 'Miền Trung',
      'mien-nam': 'Miền Nam',
      'tay-nguyen': 'Tây Nguyên'
    };

    const regionName = regionMap[region.toLowerCase()];

    if (!regionName) {
      return res.status(400).json({
        success: false,
        message: 'Vùng miền không hợp lệ. Chọn: mien-bac, mien-trung, mien-nam, tay-nguyen'
      });
    }

    const specialties = await ProvinceSpecialty.find({ region: regionName })
      .sort({ stt: 1 })
      .select('-__v');

    res.json({
      success: true,
      region: regionName,
      count: specialties.length,
      data: specialties
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/specialties/dish/{dishName}:
 *   get:
 *     summary: Tìm tỉnh có món ăn cụ thể
 *     tags: [Specialties]
 *     parameters:
 *       - in: path
 *         name: dishName
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên món ăn cần tìm (ví dụ Phở, Bún bò)
 *     responses:
 *       200:
 *         description: Danh sách tỉnh có món ăn này
 */
router.get('/dish/:dishName', async (req, res) => {
  try {
    const { dishName } = req.params;

    const regex = new RegExp(dishName, 'i');
    const results = await ProvinceSpecialty.find({
      $or: [
        { localDishesText: regex },
        { souvenirsText: regex }
      ]
    }).select('province region localDishesText souvenirsText');

    res.json({
      success: true,
      dish: dishName,
      count: results.length,
      data: results.map(item => ({
        province: item.province,
        region: item.region,
        foundIn: {
          localDishes: item.localDishesText.toLowerCase().includes(dishName.toLowerCase()),
          souvenirs: item.souvenirsText.toLowerCase().includes(dishName.toLowerCase())
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/specialties/stats:
 *   get:
 *     summary: Thống kê đặc sản theo vùng miền
 *     tags: [Specialties]
 *     responses:
 *       200:
 *         description: Thống kê số lượng tỉnh theo vùng
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await ProvinceSpecialty.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          provinces: { $push: '$province' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = await ProvinceSpecialty.countDocuments();

    res.json({
      success: true,
      total,
      byRegion: stats.map(s => ({
        region: s._id,
        count: s.count,
        provinces: s.provinces
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
