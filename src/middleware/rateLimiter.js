// ── Rate Limiter (in-memory sliding window) ────────────────────────────────
// Bảo vệ AI endpoint khỏi abuse: guest gọi không auth dễ đốt quota NVIDIA/SerpApi.
// Mỗi IP có một sliding window riêng; authenticated user được limit cao hơn.

const store = new Map(); // key → timestamps[]
const CLEANUP_INTERVAL = 2 * 60 * 1000; // dọn dẹp mỗi 2 phút

// Auto-cleanup stale entries
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    const windowStart = now - entry.windowMs;
    while (entry.timestamps.length > 0 && entry.timestamps[0] < windowStart) {
      entry.timestamps.shift();
    }
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, CLEANUP_INTERVAL);
// Cho phép process exit bình thường (không giữ event loop)
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Tạo rate limiter middleware với cấu hình tuỳ chỉnh.
 * @param {Object} opts
 * @param {number} opts.windowMs - Cửa sổ trượt (ms), mặc định 60s
 * @param {number} opts.max - Số request tối đa trong cửa sổ
 * @param {string}  opts.keyMode - 'ip' (mặc định) | 'user' (dùng userId nếu có, fallback IP)
 */
function createRateLimiter(opts = {}) {
  const windowMs = opts.windowMs || 60 * 1000;
  const max = opts.max || 20;
  const keyMode = opts.keyMode || 'ip';

  return (req, res, next) => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Xác định key
    let key;
    if (keyMode === 'user') {
      key = req.user?._id?.toString() || req.ip || req.connection?.remoteAddress || 'unknown';
    } else {
      key = req.ip || req.connection?.remoteAddress || 'unknown';
    }

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [], windowMs };
      store.set(key, entry);
    }

    // Xoá timestamp cũ ngoài cửa sổ
    while (entry.timestamps.length > 0 && entry.timestamps[0] < windowStart) {
      entry.timestamps.shift();
    }

    if (entry.timestamps.length >= max) {
      const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        success: false,
        message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter}s.`,
      });
    }

    entry.timestamps.push(now);

    // Rate limit headers
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(max - entry.timestamps.length));

    next();
  };
}

// ── Pre-built limiters ──────────────────────────────────────────────────────
// Guest: 15 req/phút — gọi không auth, dễ abuse
const aiGuestLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 15, keyMode: 'ip' });

// Authenticated: 40 req/phút — user đã đăng nhập
const aiAuthLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyMode: 'user' });

module.exports = { createRateLimiter, aiGuestLimiter, aiAuthLimiter };
