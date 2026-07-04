const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

class SerpApiManager {
  constructor() {
    // Đọc danh sách key từ biến môi trường và lọc bỏ các key rỗng
    const keysRaw = process.env.SERPAPI_KEYS || '';
    this.keys = keysRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (this.keys.length === 0) {
      console.warn('⚠️ CẢNH BÁO: Không tìm thấy SERPAPI_KEYS trong file .env');
    }
    
    this.currentIndex = 0;
  }

  getCurrentKey() {
    if (this.keys.length === 0) throw new Error('Không có SerpApi Key nào được cấu hình.');
    return this.keys[this.currentIndex];
  }

  rotateKey() {
    this.currentIndex++;
    if (this.currentIndex >= this.keys.length) {
      throw new Error('Tất cả các SerpApi Keys đều đã cạn kiệt (Quá giới hạn hoặc lỗi). Vui lòng thêm Key mới!');
    }
    console.log(`🔄 Đã chuyển sang API Key thứ ${this.currentIndex + 1}/${this.keys.length}: ${this.getCurrentKey().substring(0, 10)}...`);
  }

  /**
   * Gọi SerpApi với cơ chế tự động xoay vòng Key khi gặp lỗi giới hạn
   * @param {Object} params Tham số truy vấn (e.g., { engine: 'google_maps', q: 'khách sạn Bến Tre' })
   * @returns {Object} Dữ liệu JSON trả về từ SerpApi
   */
  // Phân loại lỗi RIÊNG 1 key (hết credit / key sai / rate-limit) → nên xoay sang key khác.
  // Lỗi hạ tầng (network/timeout/5xx) xoay key vô ích → để caller xử lý.
  isKeyError(error) {
    const errorMsg = error.response?.data?.error || error.message || '';
    const status = error.response?.status;
    return (
      errorMsg.includes('Account is out of credits') ||
      errorMsg.includes('run out of searches') ||
      errorMsg.includes('Invalid API key') ||
      errorMsg.includes('is not included in the list') ||
      status === 401 || status === 429 || status === 400
    );
  }

  /**
   * Gọi SerpApi với XOAY VÒNG TRÒN key: bắt đầu từ key đang dùng, gặp lỗi HẾT QUOTA/CHẶN thì
   * sang key kế (modulo, nên LUÔN thử đủ n key dù currentIndex đang ở giữa danh sách — khác bản
   * cũ chỉ xoay TIẾN, dễ báo "cạn hết key" oan khi chưa thử các key phía trước). Key nào chạy
   * được thì ghim currentIndex vào đó để request sau bắt đầu thẳng từ key sống.
   * @param {Object} params Tham số truy vấn (e.g., { engine: 'google_maps', q: 'khách sạn Bến Tre' })
   * @returns {Object} Dữ liệu JSON trả về từ SerpApi
   */
  async fetchWithRotation(params) {
    const n = this.keys.length;
    if (n === 0) throw new Error('Không có SerpApi Key nào được cấu hình.');

    let lastErr;
    for (let attempt = 0; attempt < n; attempt++) {
      const idx = (this.currentIndex + attempt) % n;
      const currentKey = this.keys[idx];

      try {
        const response = await axios.get('https://serpapi.com/search', {
          params: { ...params, api_key: currentKey }
        });

        // Đôi khi HTTP 200 nhưng body chứa error (vd hết credit) → coi như lỗi để xoay key
        if (response.data && response.data.error) {
          throw new Error(response.data.error);
        }

        this.currentIndex = idx; // key này chạy được → ghim để các request sau bắt đầu từ đây
        return response.data;

      } catch (error) {
        lastErr = error;
        const errorMsg = error.response?.data?.error || error.message;
        console.error(`❌ Lỗi với Key ${idx + 1}/${n} (${currentKey.substring(0, 10)}...): ${errorMsg}`);

        if (this.isKeyError(error)) {
          if (attempt < n - 1) {
            console.log(`🔄 Xoay sang key kế tiếp (đã thử ${attempt + 1}/${n})...`);
            continue;
          }
          // Đã thử hết n key mà đều lỗi key → cạn thật
          throw new Error(`Tất cả ${n} SerpApi key đều hết hạn mức hoặc bị chặn. Vui lòng thêm key mới!`);
        }
        // Lỗi hạ tầng (network/timeout/sai query) → xoay key vô ích, ném thẳng
        throw error;
      }
    }

    throw lastErr || new Error('Đã thử tất cả các Keys nhưng không thành công.');
  }
}

// Export một instance dùng chung (Singleton)
module.exports = new SerpApiManager();
