const express = require('express');
const Itinerary = require('../models/Itinerary');
const Destination = require('../models/Destination');
const { protect } = require('../middleware/auth');
const optimizeService = require('../services/optimizeService');
const router = express.Router();

// ── Smart: Tạo lịch trình từ text AI + tự động match điểm đến trong DB ──
router.post('/from-ai', protect, async (req, res) => {
  try {
    const { title, description, startDate, endDate, aiText, status = 'planning' } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu title, startDate hoặc endDate' });
    }

    const fullText = aiText || description || '';

    // ── BƯỚC 1: Thử parse JSON block do AI tạo ra ──────────────────────────────
    let jsonDestinationNames = [];
    const jsonBlockMatch = fullText.match(/```json_itinerary\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1].trim());
        if (Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
          jsonDestinationNames = parsed.destinations;
          console.log(`[from-ai] ✓ JSON block found: ${jsonDestinationNames.length} destinations:`, jsonDestinationNames);
        }
      } catch (e) {
        console.warn('[from-ai] JSON block parse failed:', e.message);
      }
    }

    // Strip JSON block khỏi text hiển thị trước khi lưu description
    const cleanText = fullText.replace(/```json_itinerary[\s\S]*?```/g, '').trim();

    // ── BƯỚC 2: Phát hiện tỉnh/thành phố (luôn cần cho cả 2 nhánh) ────────────
    const provinces = [
      'hà nội', 'hồ chí minh', 'đà nẵng', 'hội an', 'nha trang', 'phú quốc',
      'đà lạt', 'huế', 'sapa', 'hạ long', 'mũi né', 'cần thơ', 'trà vinh',
      'vũng tàu', 'phan thiết', 'quy nhơn', 'buôn ma thuột', 'kon tum',
      'pleiku', 'cô tô', 'phong nha', 'long an', 'tiền giang', 'bến tre',
      'vĩnh long', 'đồng tháp', 'an giang', 'kiên giang', 'bạc liêu', 'cà mau',
      'sóc trăng', 'hậu giang', 'tây ninh', 'bình dương', 'bình phước',
      'đồng nai', 'bà rịa', 'bình thuận', 'ninh thuận', 'khánh hòa',
      'phú yên', 'bình định', 'quảng ngãi', 'quảng nam', 'thừa thiên',
      'quảng trị', 'quảng bình', 'hà tĩnh', 'nghệ an', 'thanh hóa',
      'ninh bình', 'nam định', 'thái bình', 'hải phòng', 'quảng ninh'
    ];

    const fullTextLower = fullText.toLowerCase();
    const titleLower = title.toLowerCase();

    let detectedProvince = null;
    for (const prov of provinces) {
      if (titleLower.includes(prov)) { detectedProvince = prov; break; }
    }
    if (!detectedProvince) {
      let maxCount = 0;
      for (const prov of provinces) {
        const escaped = prov.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = (fullTextLower.match(new RegExp(`(^|[\\s.,:'"\\-])${escaped}`, 'gi')) || []).length;
        if (count > maxCount) { maxCount = count; detectedProvince = prov; }
      }
      if (detectedProvince) console.log(`[from-ai] Province from TEXT: "${detectedProvince}"`);
    }

    // ── BƯỚC 3: Lấy tất cả destinations từ DB ──────────────────────────────────
    const allDestinations = await Destination.find({}, 'name _id location');

    let matchedDestinations = [];

    if (jsonDestinationNames.length > 0) {
      // ── Nhánh A: Match theo tên từ JSON block (chính xác hơn) ─────────────
      for (const name of jsonDestinationNames) {
        const nameLower = name.toLowerCase().trim();
        // Tìm dest có tên khớp gần nhất
        const exact = allDestinations.find(d => d.name.toLowerCase() === nameLower);
        if (exact) { matchedDestinations.push(exact._id); continue; }
        // Fuzzy: tên DB nằm trong JSON name hoặc ngược lại
        const fuzzy = allDestinations.find(d => {
          const dl = d.name.toLowerCase();
          return nameLower.includes(dl) || dl.includes(nameLower);
        });
        if (fuzzy) matchedDestinations.push(fuzzy._id);
      }
      console.log(`[from-ai] JSON match result: ${matchedDestinations.length}/${jsonDestinationNames.length}`);
    }

    if (matchedDestinations.length === 0) {
      // ── Nhánh B: Fallback về text matching cũ ─────────────────────────────
      const noiseMarkers = ['gợi ý thêm', 'lưu ý', 'tips', 'note:', '📝', '⚠️'];
      let mainText = cleanText;
      for (const m of noiseMarkers) {
        const idx = mainText.toLowerCase().indexOf(m);
        if (idx !== -1) mainText = mainText.substring(0, idx);
      }
      const mainTextLower = mainText.toLowerCase();

      const textMatch = (textLower, provinceFilter) => {
        const matched = [];
        for (const dest of allDestinations) {
          const destName = dest.name.toLowerCase();
          if (destName.length < 3 || !textLower.includes(destName)) continue;
          if (provinceFilter) {
            const destCity = (dest.location?.city || '').toLowerCase();
            const inProvince = destCity.includes(provinceFilter) ||
              provinceFilter.includes(destCity.split(',')[0].trim()) ||
              destCity.split(',').some(c => provinceFilter.includes(c.trim().toLowerCase()));
            if (!inProvince) continue;
          }
          matched.push(dest._id);
        }
        return matched;
      };

      matchedDestinations = textMatch(mainTextLower, detectedProvince);
      if (matchedDestinations.length === 0 && detectedProvince) {
        matchedDestinations = textMatch(mainTextLower, null);
      }
      console.log(`[from-ai] Text match fallback: ${matchedDestinations.length} destinations`);
    }

    const uniqueDestIds = [...new Set(matchedDestinations.map(id => id.toString()))];

    // ── BƯỚC 4: Tối ưu thứ tự bằng optimizeService ────────────────────────────
    let orderedDestIds = uniqueDestIds;
    try {
      if (uniqueDestIds.length >= 2) {
        const destDocs = await Destination.find({ _id: { $in: uniqueDestIds } }, 'name coordinates');
        const locations = uniqueDestIds.map(id => {
          const doc = destDocs.find(d => d._id.toString() === id);
          if (!doc?.coordinates?.lat || !doc?.coordinates?.lng) return null;
          return { id, name: doc.name, lat: doc.coordinates.lat, lng: doc.coordinates.lng };
        }).filter(Boolean);

        if (locations.length >= 2) {
          const optimizeService = require('../services/optimizeService');
          const result = await optimizeService.optimizeRoute(locations, { lat: locations[0].lat, lng: locations[0].lng }, 'auto');
          const optimizedIds = result.optimizedLocations.map(l => l.id);
          const missingIds = uniqueDestIds.filter(id => !optimizedIds.includes(id));
          orderedDestIds = [...optimizedIds, ...missingIds];
          console.log(`[from-ai] ✓ Optimized ${orderedDestIds.length} stops | ${result.method} | saved ${result.stats.improvementPercent}%`);
        }
      }
    } catch (optErr) {
      console.warn('[from-ai] optimizeService failed:', optErr.message);
    }

    // ── BƯỚC 5: Tạo lịch trình ─────────────────────────────────────────────────
    const itinerary = await Itinerary.create({
      user: req.user._id,
      title,
      description: description || cleanText || '',
      startDate,
      endDate,
      status,
      destinations: orderedDestIds.map((id, idx) => ({
        destination: id, order: idx + 1, notes: '', activities: []
      }))
    });

    const populated = await Itinerary.findById(itinerary._id)
      .populate('destinations.destination', 'name images location category rating');

    res.status(201).json({
      success: true,
      data: populated,
      matchedCount: uniqueDestIds.length,
      detectedProvince,
      usedJsonBlock: jsonDestinationNames.length > 0
    });
  } catch (error) {
    console.error('from-ai error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


/**
 * @swagger
 * /itineraries:
 *   get:
 *     summary: Lấy danh sách lịch trình của user
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lịch trình
 */
// Get user's itineraries
router.get('/', protect, async (req, res) => {
  try {
    const itineraries = await Itinerary.find({ user: req.user._id })
      .populate('destinations.destination', 'name images location category')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: itineraries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries/{id}:
 *   get:
 *     summary: Lấy chi tiết lịch trình
 *     tags: [Itineraries]
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
 *         description: Chi tiết lịch trình
 *       404:
 *         description: Không tìm thấy
 */
// Get single itinerary
router.get('/:id', protect, async (req, res) => {
  try {
    // Cho phép xem nếu là owner HOẶC nếu đã được chia sẻ qua chat (có message itinerary_share trong conversation user là participant)
    const itinerary = await Itinerary.findById(req.params.id)
      .populate('destinations.destination', 'name images location category rating');

    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    }

    const isOwner = itinerary.user.toString() === req.user._id.toString();
    if (!isOwner) {
      const Conversation = require('../models/Conversation');
      const Message = require('../models/Message');
      const sharedMsg = await Message.findOne({
        type: 'itinerary_share',
        itineraryId: itinerary._id,
      }).populate('conversation', 'participants');

      const isShared = sharedMsg && sharedMsg.conversation &&
        sharedMsg.conversation.participants.some(p => p.toString() === req.user._id.toString());

      if (!isShared) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem lịch trình này' });
      }
    }

    res.json({ success: true, data: itinerary, isOwner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries:
 *   post:
 *     summary: Tạo lịch trình mới
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *                 example: Du lịch Đà Nẵng
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
// Create itinerary
router.post('/', protect, async (req, res) => {
  try {
    const itinerary = await Itinerary.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: itinerary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries/{id}/destinations:
 *   post:
 *     summary: Thêm điểm đến vào lịch trình
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destinationId
 *             properties:
 *               destinationId:
 *                 type: string
 *               notes:
 *                 type: string
 *               activities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Thêm thành công
 */
// Add destination to itinerary
router.post('/:id/destinations', protect, async (req, res) => {
  try {
    const { destinationId, notes, activities } = req.body;
    const itinerary = await Itinerary.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    }

    // Check if destination already in itinerary
    const exists = itinerary.destinations.some(d => d.destination.toString() === destinationId);
    if (exists) {
      return res.status(400).json({ success: false, message: 'Điểm đến đã có trong lịch trình' });
    }

    itinerary.destinations.push({
      destination: destinationId,
      order: itinerary.destinations.length + 1,
      notes: notes || '',
      activities: activities || []
    });

    await itinerary.save();
    
    const populated = await Itinerary.findById(itinerary._id)
      .populate('destinations.destination', 'name images location');
    
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries/{id}/destinations/{destId}:
 *   delete:
 *     summary: Xóa điểm đến khỏi lịch trình
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: destId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
// Remove destination from itinerary
router.delete('/:id/destinations/:destId', protect, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    }

    itinerary.destinations = itinerary.destinations.filter(
      d => d.destination.toString() !== req.params.destId
    );

    await itinerary.save();
    res.json({ success: true, data: itinerary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries/{id}:
 *   put:
 *     summary: Cập nhật lịch trình
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [planning, ongoing, completed]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
// Update itinerary
router.put('/:id', protect, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body, { new: true }
    ).populate('destinations.destination', 'name images location');
    
    if (itinerary) res.json({ success: true, data: itinerary });
    else res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /itineraries/{id}:
 *   delete:
 *     summary: Xóa lịch trình
 *     tags: [Itineraries]
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
// Delete itinerary
router.delete('/:id', protect, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (itinerary) res.json({ success: true, message: 'Đã xóa lịch trình' });
    else res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Tối ưu lại thứ tự điểm đến trong lịch trình (OSRM / Haversine) ──
router.post('/:id/optimize', protect, async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({ _id: req.params.id, user: req.user._id })
      .populate('destinations.destination', 'name coordinates');

    if (!itinerary) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình' });
    }

    if (itinerary.destinations.length < 2) {
      return res.json({ success: true, message: 'Không cần tối ưu (<2 điểm)', data: itinerary });
    }

    // Lấy các điểm có đầy đủ tọa độ
    const locations = itinerary.destinations
      .filter(d => d.destination?.coordinates?.lat && d.destination?.coordinates?.lng)
      .map(d => ({
        id: d.destination._id.toString(),
        name: d.destination.name,
        lat: d.destination.coordinates.lat,
        lng: d.destination.coordinates.lng,
        notes: d.notes,
        activities: d.activities,
      }));

    if (locations.length < 2) {
      return res.json({ success: true, message: 'Thiếu tọa độ, không thể tối ưu', data: itinerary });
    }

    const startPoint = { lat: locations[0].lat, lng: locations[0].lng };
    const result = await optimizeService.optimizeRoute(locations, startPoint, 'auto');

    // Rebuild mảng destinations theo thứ tự tối ưu
    const optimizedMap = new Map(locations.map(l => [l.id, l]));
    const optimizedDestinations = result.optimizedLocations.map((loc, idx) => {
      const original = itinerary.destinations.find(
        d => d.destination._id.toString() === loc.id
      );
      return {
        destination: loc.id,
        order: idx + 1,
        notes: original?.notes || '',
        activities: original?.activities || [],
      };
    });

    // Bổ sung các điểm thiếu tọa độ vào cuối
    const optimizedIds = new Set(result.optimizedLocations.map(l => l.id));
    itinerary.destinations.forEach((d, idx) => {
      const id = d.destination._id.toString();
      if (!optimizedIds.has(id)) {
        optimizedDestinations.push({
          destination: id,
          order: optimizedDestinations.length + 1,
          notes: d.notes,
          activities: d.activities,
        });
      }
    });

    itinerary.destinations = optimizedDestinations;
    await itinerary.save();

    // Trả về dữ liệu đã populate
    const populated = await Itinerary.findById(itinerary._id)
      .populate('destinations.destination', 'name images location category rating coordinates');

    res.json({
      success: true,
      message: `Đã tối ưu ${result.stats.locationCount} trạm | Tiết kiệm ${result.stats.improvementPercent}% quãng đường`,
      stats: result.stats,
      method: result.method,
      data: populated,
    });
  } catch (error) {
    console.error('optimize route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
