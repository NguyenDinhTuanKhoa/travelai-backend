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
  async fetchWithRotation(params) {
    let attempts = 0;
    const maxAttempts = this.keys.length;

    while (attempts < maxAttempts) {
      const currentKey = this.getCurrentKey();
      
      try {
        const response = await axios.get('https://serpapi.com/search', {
          params: {
            ...params,
            api_key: currentKey
          }
        });

        // Kiểm tra xem API có thông báo lỗi trong body không (đôi khi HTTP 200 nhưng body chứa error)
        if (response.data && response.data.error) {
          throw new Error(response.data.error);
        }

        return response.data;

      } catch (error) {
        const errorMsg = error.response?.data?.error || error.message;
        console.error(`❌ Lỗi với Key ${currentKey.substring(0, 10)}...: ${errorMsg}`);

        // Nếu lỗi là do hết hạn mức, quá tải, key sai, hoặc lỗi 400
        if (
          errorMsg.includes('Account is out of credits') || 
          errorMsg.includes('Invalid API key') ||
          errorMsg.includes('is not included in the list') ||
          error.response?.status === 429 ||
          error.response?.status === 400
        ) {
          console.log('⚠️ Đang thực hiện xoay vòng API Key...');
          this.rotateKey();
          attempts++;
        } else {
          // Lỗi khác (vd: sai cú pháp query) thì ném ra ngoài, không xoay vòng
          throw error;
        }
      }
    }

    throw new Error('Đã thử tất cả các Keys nhưng không thành công.');
  }
}

// Export một instance dùng chung (Singleton)
module.exports = new SerpApiManager();
