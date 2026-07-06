const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

class SerperManager {
  constructor() {
    // Hỗ trợ nhiều key: SERPER_API_KEYS (phân cách phẩy) hoặc fallback SERPER_API_KEY (đơn lẻ)
    const raw = process.env.SERPER_API_KEYS || process.env.SERPER_API_KEY || '';
    this.keys = raw.split(',').map(k => k.trim()).filter(Boolean);
    this.currentIndex = 0;
    this.deadKeys = new Set(); // key đã hết quota → bỏ qua

    if (!this.keys.length) {
      console.warn('⚠️ CẢNH BÁO: Không tìm thấy SERPER_API_KEYS trong file .env');
    } else {
      console.log(`✅ Đã load ${this.keys.length} Serper API key(s) — xoay vòng khi hết quota`);
    }
  }

  /**
   * Lấy API key hiện tại (bỏ qua key đã chết)
   */
  getCurrentApiKey() {
    const alive = this.keys.filter(k => !this.deadKeys.has(k));
    if (!alive.length) {
      console.error('❌ TẤT CẢ Serper API key đều đã hết quota!');
      return null;
    }
    return alive[this.currentIndex % alive.length];
  }

  /**
   * Đánh dấu key hiện tại là hết quota và chuyển sang key tiếp theo
   */
  _rotateKey(failedKey) {
    this.deadKeys.add(failedKey);
    const alive = this.keys.filter(k => !this.deadKeys.has(k));
    if (alive.length) {
      this.currentIndex = 0; // reset index về 0 trên danh sách alive
      console.warn(`🔄 Serper key ...${failedKey.slice(-6)} hết quota → chuyển sang key ...${alive[0].slice(-6)} (còn ${alive.length} key)`);
      return true;
    }
    console.error('❌ TẤT CẢ Serper API key đều đã hết quota!');
    return false;
  }

  /**
   * Gọi Serper API với tự động xoay key khi hết quota
   * @param {string} url  endpoint (e.g. https://google.serper.dev/search)
   * @param {Object} body request body
   * @returns {Object} response data
   */
  async _request(url, body) {
    let lastError = null;

    // Thử tối đa số key còn sống
    const maxRetries = this.keys.length - this.deadKeys.size;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const key = this.getCurrentApiKey();
      if (!key) break;

      try {
        const response = await axios.post(url, body, {
          headers: {
            'X-API-KEY': key,
            'Content-Type': 'application/json'
          }
        });
        return response.data;
      } catch (error) {
        const status = error.response?.status;
        // 429 = rate limit / hết quota, 403 = forbidden (key bị vô hiệu hoá)
        if (status === 429 || status === 403) {
          console.warn(`⚠️ Serper key ...${key.slice(-6)} → HTTP ${status} (hết quota/bị khoá)`);
          const rotated = this._rotateKey(key);
          if (!rotated) {
            lastError = error;
            break;
          }
          // Tiếp tục vòng lặp để thử key tiếp theo
        } else {
          // Lỗi khác (network, 5xx, ...) → throw ngay
          throw error;
        }
      }
    }

    // Đã hết tất cả key
    if (lastError) throw lastError;
    throw new Error('Không còn Serper API key nào khả dụng');
  }

  /**
   * Tìm kiếm địa điểm trên Google Maps
   * @param {string} query Từ khóa tìm kiếm (e.g., 'Grand World Phú Quốc')
   * @param {string} [ll] Toạ độ để lấy kết quả LOCAL quanh 1 điểm, dạng '@lat,lng,15z'
   *                      (Serper places nhận field `ll`) — dùng cho "tìm ... gần tôi".
   * @returns {Object} Dữ liệu địa điểm từ Serper.dev
   */
  async searchPlaces(query, ll) {
    try {
      const body = { q: query, gl: 'vn', hl: 'vi' };
      if (ll) body.ll = ll;
      return await this._request('https://google.serper.dev/places', body);
    } catch (error) {
      console.error(`❌ Lỗi khi tìm kiếm địa điểm "${query}":`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Tìm kiếm hình ảnh trên Google Images
   * @param {string} query Từ khóa tìm kiếm (e.g., 'Grand World Phú Quốc')
   * @param {number} num Số lượng hình ảnh cần lấy (mặc định 3)
   * @returns {Array} Danh sách URL hình ảnh
   */
  async searchImages(query, num = 3) {
    try {
      const data = await this._request('https://google.serper.dev/images', {
        q: query,
        gl: 'vn',
        hl: 'vi',
        num: num
      });

      if (data && data.images) {
        return data.images
          .map(img => img.imageUrl)
          .filter(url => {
            const lower = url.toLowerCase();
            return !lower.includes('facebook.com') && 
                   !lower.includes('lookaside.fbsbx.com') &&
                   !lower.includes('instagram.com') &&
                   !lower.includes('tiktok.com') &&
                   !lower.includes('googleusercontent.com');
          });
      }

      return [];
    } catch (error) {
      console.error(`❌ Lỗi khi tìm kiếm hình ảnh "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Tìm kiếm tổng hợp (search + places + images)
   * @param {string} query Từ khóa tìm kiếm
   * @returns {Object} Dữ liệu đầy đủ từ Serper.dev
   */
  async search(query) {
    try {
      return await this._request('https://google.serper.dev/search', {
        q: query,
        gl: 'vn',
        hl: 'vi'
      });
    } catch (error) {
      console.error(`❌ Lỗi khi tìm kiếm "${query}":`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Kiểm tra số credits còn lại (nếu API hỗ trợ)
   */
  getCreditsUsed() {
    // Serper.dev trả về credits trong response
    // Có thể track ở đây nếu cần
    return 'Check dashboard at https://serper.dev';
  }

  /**
   * Trạng thái hiện tại: bao nhiêu key còn sống
   */
  getStatus() {
    const alive = this.keys.filter(k => !this.deadKeys.has(k));
    return {
      total: this.keys.length,
      alive: alive.length,
      dead: this.deadKeys.size,
    };
  }
}

// Export một instance dùng chung (Singleton)
module.exports = new SerperManager();
