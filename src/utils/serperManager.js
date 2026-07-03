const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

class SerperManager {
  constructor() {
    // Sử dụng API key từ .env
    this.apiKey = process.env.SERPER_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ CẢNH BÁO: Không tìm thấy SERPER_API_KEY trong file .env');
    } else {
      console.log(`✅ Đã load Serper API key`);
    }
  }

  /**
   * Lấy API key hiện tại
   */
  getCurrentApiKey() {
    return this.apiKey;
  }

  /**
   * Tìm kiếm địa điểm trên Google Maps
   * @param {string} query Từ khóa tìm kiếm (e.g., 'Grand World Phú Quốc')
   * @returns {Object} Dữ liệu địa điểm từ Serper.dev
   */
  async searchPlaces(query) {
    try {
      const response = await axios.post(
        'https://google.serper.dev/places',
        {
          q: query,
          gl: 'vn',
          hl: 'vi'
        },
        {
          headers: {
            'X-API-KEY': this.getCurrentApiKey(),
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
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
      const response = await axios.post(
        'https://google.serper.dev/images',
        {
          q: query,
          gl: 'vn',
          hl: 'vi',
          num: num
        },
        {
          headers: {
            'X-API-KEY': this.getCurrentApiKey(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.images) {
        return response.data.images
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
      const response = await axios.post(
        'https://google.serper.dev/search',
        {
          q: query,
          gl: 'vn',
          hl: 'vi'
        },
        {
          headers: {
            'X-API-KEY': this.getCurrentApiKey(),
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
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
}

// Export một instance dùng chung (Singleton)
module.exports = new SerperManager();
