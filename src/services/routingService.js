const axios = require('axios');
const geocodingService = require('./geocodingService');

/**
 * Service tính khoảng cách và thời gian di chuyển
 * Sử dụng OSRM API (OpenStreetMap) - MIỄN PHÍ 100%
 */
class RoutingService {
  constructor() {
    this.osrmBaseURL = 'https://router.project-osrm.org/route/v1';
    this.cache = new Map(); // Cache kết quả để tránh gọi API nhiều lần
    this.CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 ngày
  }

  /**
   * Tạo cache key từ 2 địa điểm
   */
  getCacheKey(from, to) {
    return `${from.toLowerCase()}|${to.toLowerCase()}`;
  }

  /**
   * Format thời gian từ giây sang giờ/phút dễ đọc
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return minutes > 0
        ? `${hours} giờ ${minutes} phút`
        : `${hours} giờ`;
    }
    return `${minutes} phút`;
  }

  /**
   * Format khoảng cách từ mét sang km dễ đọc
   */
  formatDistance(meters) {
    const km = Math.round(meters / 1000);
    return `${km} km`;
  }

  /**
   * Tính khoảng cách và thời gian giữa 2 địa điểm
   * @param {string} fromLocation - Tên địa điểm xuất phát
   * @param {string} toLocation - Tên địa điểm đích
   * @returns {Promise<Object>} - {distance, duration, distanceText, durationText}
   */
  async getRoute(fromLocation, toLocation) {
    if (!fromLocation || !toLocation) {
      return null;
    }

    // Kiểm tra cache trước
    const cacheKey = this.getCacheKey(fromLocation, toLocation);
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      console.log(`✓ Using cached route: ${fromLocation} → ${toLocation}`);
      return cached.data;
    }

    try {
      // 1. Lấy tọa độ của 2 địa điểm
      console.log(`→ Getting route: ${fromLocation} → ${toLocation}`);
      const [fromCoords, toCoords] = await Promise.all([
        geocodingService.getCoordinates(fromLocation),
        geocodingService.getCoordinates(toLocation)
      ]);

      if (!fromCoords || !toCoords) {
        console.log('✗ Could not geocode locations');
        return null;
      }

      // 2. Gọi OSRM API
      const url = `${this.osrmBaseURL}/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}`;

      const response = await axios.get(url, {
        params: {
          overview: false,
          alternatives: false,
          steps: false
        },
        timeout: 10000
      });

      if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
        console.log('✗ OSRM API returned no routes');
        return null;
      }

      const route = response.data.routes[0];

      const result = {
        from: fromCoords.name,
        to: toCoords.name,
        distance: route.distance, // meters
        duration: route.duration, // seconds
        distanceText: this.formatDistance(route.distance),
        durationText: this.formatDuration(route.duration),
        durationRange: this.getDurationRange(route.duration) // Thêm khoảng thời gian ước tính
      };

      // Lưu vào cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log(`✓ Route calculated: ${result.distanceText}, ${result.durationText}`);
      return result;

    } catch (error) {
      console.error(`Routing error (${fromLocation} → ${toLocation}):`, error.message);
      return null;
    }
  }

  /**
   * Tạo khoảng thời gian ước tính (vì thực tế có thể khác nhau)
   */
  getDurationRange(seconds) {
    const hours = seconds / 3600;
    const min = Math.floor(hours * 0.9 * 10) / 10; // -10%
    const max = Math.ceil(hours * 1.1 * 10) / 10; // +10%

    if (min === max) {
      return `${min} giờ`;
    }
    return `${min}-${max} giờ`;
  }

  /**
   * Detect các địa điểm trong câu hỏi của user
   * Sử dụng regex để tìm pattern "từ X đến Y" hoặc "X → Y"
   */
  detectLocations(text) {
    if (!text) return null;

    const normalized = text.toLowerCase().trim();

    // Pattern 1: "từ X đến/tới Y"
    const pattern1 = /từ\s+((?:tp\.|thành phố\s+)?[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?)\s+(?:đến|tới)\s+((?:tp\.|thành phố\s+)?[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?)/i;

    // Pattern 2: "X → Y" hoặc "X - Y"
    const pattern2 = /((?:tp\.|thành phố\s+)?[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?)\s*(?:→|->|−)\s*((?:tp\.|thành phố\s+)?[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?)/i;

    // Pattern 3: "X đến/tới Y" (không có "từ") - nhưng X phải là tên thành phố hợp lệ
    const pattern3 = /\b((?:tp\.|thành phố\s+)?(?:hà nội|đà nẵng|huế|hội an|nha trang|đà lạt|tp\.?hcm|sài gòn|cần thơ|hải phòng|[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?))\s+(?:đến|tới)\s+((?:tp\.|thành phố\s+)?[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)?)/i;

    let match = normalized.match(pattern1) || normalized.match(pattern2) || normalized.match(pattern3);

    if (match) {
      const from = match[1].trim();
      const to = match[2].trim();

      // Validate: không chấp nhận tên địa điểm chứa các từ không hợp lệ
      const invalidWords = ['mất', 'bao', 'lâu', 'xa', 'không', 'nhiêu', 'km', 'gợi', 'ngày', 'triệu'];
      if (invalidWords.some(word => from.includes(word) || to.includes(word))) {
        return null;
      }

      return { from, to };
    }

    return null;
  }

  /**
   * Xử lý câu hỏi của user và trả về thông tin routing nếu phát hiện
   */
  async processUserQuery(userMessage) {
    const locations = this.detectLocations(userMessage);

    if (!locations) {
      return null;
    }

    const route = await this.getRoute(locations.from, locations.to);

    if (!route) {
      return null;
    }

    return {
      detected: true,
      from: route.from,
      to: route.to,
      distance: route.distanceText,
      duration: route.durationText,
      durationRange: route.durationRange,
      injectionText: `\n\n[THÔNG TIN DI CHUYỂN CHÍNH XÁC - Sử dụng trong câu trả lời]\n- Từ ${route.from} đến ${route.to}\n- Khoảng cách: ${route.distanceText}\n- Thời gian di chuyển: ${route.durationRange} (ước tính)\n- Phương tiện: Xe ô tô/xe khách`
    };
  }

  /**
   * Tính route cho nhiều điểm (multi-stop trip)
   * @param {Array<string>} locations - Mảng các địa điểm theo thứ tự
   */
  async getMultiStopRoute(locations) {
    if (!locations || locations.length < 2) {
      return null;
    }

    const routes = [];
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < locations.length - 1; i++) {
      const route = await this.getRoute(locations[i], locations[i + 1]);
      if (route) {
        routes.push(route);
        totalDistance += route.distance;
        totalDuration += route.duration;
      }
    }

    return {
      routes,
      totalDistance: this.formatDistance(totalDistance),
      totalDuration: this.formatDuration(totalDuration),
      stops: locations.length
    };
  }

  /**
   * Clear cache (nếu cần)
   */
  clearCache() {
    this.cache.clear();
    console.log('✓ Routing cache cleared');
  }
}

module.exports = new RoutingService();
