const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');

/**
 * @swagger
 * /weather/current:
 *   get:
 *     summary: Lấy thời tiết hiện tại
 *     tags: [Weather]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Vĩ độ
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Kinh độ
 *     responses:
 *       200:
 *         description: Thông tin thời tiết hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Weather'
 */
// GET /api/weather/current?lat=...&lng=...
router.get('/current', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng cung cấp tọa độ (lat, lng)' 
      });
    }

    const weather = await weatherService.getCurrentWeather(
      parseFloat(lat), 
      parseFloat(lng)
    );

    if (!weather) {
      return res.status(500).json({ 
        success: false, 
        message: 'Không thể lấy dữ liệu thời tiết' 
      });
    }

    res.json({ success: true, data: weather });
  } catch (error) {
    console.error('Weather route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /weather/forecast:
 *   get:
 *     summary: Lấy dự báo thời tiết 5 ngày
 *     tags: [Weather]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Vĩ độ
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Kinh độ
 *     responses:
 *       200:
 *         description: Dự báo 5 ngày
 */
// GET /api/weather/forecast?lat=...&lng=...
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng cung cấp tọa độ (lat, lng)' 
      });
    }

    const forecast = await weatherService.getForecast(
      parseFloat(lat), 
      parseFloat(lng)
    );

    if (!forecast) {
      return res.status(500).json({ 
        success: false, 
        message: 'Không thể lấy dữ liệu dự báo' 
      });
    }

    res.json({ success: true, data: forecast });
  } catch (error) {
    console.error('Forecast route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
