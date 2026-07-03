const axios = require('axios');

/**
 * Service để chuyển đổi tên địa điểm thành tọa độ
 * Sử dụng Nominatim API (OpenStreetMap) - MIỄN PHÍ 100%
 */
class GeocodingService {
  constructor() {
    this.baseURL = 'https://nominatim.openstreetmap.org';
    this.cache = new Map(); // Cache để tránh gọi API nhiều lần
  }

  /**
   * Danh sách tọa độ tĩnh cho TẤT CẢ 63 tỉnh/thành phố Việt Nam
   * Để giảm API calls và tăng tốc độ
   */
  staticCoordinates = {
    // ===== 5 THÀNH PHỐ TRỰC THUỘC TRUNG ƯƠNG =====
    'hà nội': { lat: 21.0285, lon: 105.8542, name: 'Hà Nội' },
    'hanoi': { lat: 21.0285, lon: 105.8542, name: 'Hà Nội' },

    'hồ chí minh': { lat: 10.8231, lon: 106.6297, name: 'TP. Hồ Chí Minh' },
    'sài gòn': { lat: 10.8231, lon: 106.6297, name: 'TP. Hồ Chí Minh' },
    'tp.hcm': { lat: 10.8231, lon: 106.6297, name: 'TP. Hồ Chí Minh' },
    'saigon': { lat: 10.8231, lon: 106.6297, name: 'TP. Hồ Chí Minh' },

    'hải phòng': { lat: 20.8449, lon: 106.6881, name: 'Hải Phòng' },
    'haiphong': { lat: 20.8449, lon: 106.6881, name: 'Hải Phòng' },

    'đà nẵng': { lat: 16.0544, lon: 108.2022, name: 'Đà Nẵng' },
    'danang': { lat: 16.0544, lon: 108.2022, name: 'Đà Nẵng' },

    'cần thơ': { lat: 10.0452, lon: 105.7469, name: 'Cần Thơ' },
    'cantho': { lat: 10.0452, lon: 105.7469, name: 'Cần Thơ' },

    // ===== MIỀN BẮC =====
    // Vùng Đông Bắc
    'hà giang': { lat: 22.8026, lon: 104.9784, name: 'Hà Giang' },
    'cao bằng': { lat: 22.6666, lon: 106.2587, name: 'Cao Bằng' },
    'bắc kạn': { lat: 22.1474, lon: 105.8348, name: 'Bắc Kạn' },
    'tuyên quang': { lat: 21.8236, lon: 105.2281, name: 'Tuyên Quang' },
    'lào cai': { lat: 22.4809, lon: 103.9755, name: 'Lào Cai' },
    'sapa': { lat: 22.3364, lon: 103.8438, name: 'Sa Pa' },
    'sa pa': { lat: 22.3364, lon: 103.8438, name: 'Sa Pa' },
    'lạng sơn': { lat: 21.8537, lon: 106.7611, name: 'Lạng Sơn' },
    'quảng ninh': { lat: 21.0064, lon: 107.2925, name: 'Quảng Ninh' },
    'hạ long': { lat: 20.9501, lon: 107.0843, name: 'Hạ Long' },
    'bắc giang': { lat: 21.2819, lon: 106.1975, name: 'Bắc Giang' },
    'phú thọ': { lat: 21.2686, lon: 105.2045, name: 'Phú Thọ' },
    'việt trì': { lat: 21.3227, lon: 105.4029, name: 'Việt Trì' },
    'thái nguyên': { lat: 21.5671, lon: 105.8252, name: 'Thái Nguyên' },

    // Vùng Tây Bắc
    'điện biên': { lat: 21.3874, lon: 103.0164, name: 'Điện Biên' },
    'điện biên phủ': { lat: 21.3833, lon: 103.0167, name: 'Điện Biên Phủ' },
    'lai châu': { lat: 22.3864, lon: 103.4702, name: 'Lai Châu' },
    'sơn la': { lat: 21.3256, lon: 103.9188, name: 'Sơn La' },
    'yên bái': { lat: 21.7168, lon: 104.8986, name: 'Yên Bái' },
    'hòa bình': { lat: 20.8142, lon: 105.3380, name: 'Hòa Bình' },

    // Đồng bằng sông Hồng
    'vĩnh phúc': { lat: 21.3608, lon: 105.5474, name: 'Vĩnh Phúc' },
    'bắc ninh': { lat: 21.1861, lon: 106.0763, name: 'Bắc Ninh' },
    'hải dương': { lat: 20.9373, lon: 106.3145, name: 'Hải Dương' },
    'hưng yên': { lat: 20.6463, lon: 106.0510, name: 'Hưng Yên' },
    'thái bình': { lat: 20.4464, lon: 106.3365, name: 'Thái Bình' },
    'hà nam': { lat: 20.5835, lon: 105.9230, name: 'Hà Nam' },
    'nam định': { lat: 20.4388, lon: 106.1621, name: 'Nam Định' },
    'ninh bình': { lat: 20.2506, lon: 105.9745, name: 'Ninh Bình' },

    // ===== BẮC TRUNG BỘ =====
    'thanh hóa': { lat: 19.8067, lon: 105.7851, name: 'Thanh Hóa' },
    'nghệ an': { lat: 19.2342, lon: 104.9200, name: 'Nghệ An' },
    'vinh': { lat: 18.6796, lon: 105.6811, name: 'Vinh' },
    'hà tĩnh': { lat: 18.3559, lon: 105.8877, name: 'Hà Tĩnh' },
    'quảng bình': { lat: 17.4676, lon: 106.6229, name: 'Quảng Bình' },
    'đồng hới': { lat: 17.4829, lon: 106.6217, name: 'Đồng Hới' },
    'quảng trị': { lat: 16.7474, lon: 107.1854, name: 'Quảng Trị' },
    'thừa thiên huế': { lat: 16.4637, lon: 107.5909, name: 'Thừa Thiên Huế' },
    'huế': { lat: 16.4637, lon: 107.5909, name: 'Huế' },

    // ===== NAM TRUNG BỘ =====
    'quảng nam': { lat: 15.5394, lon: 108.0192, name: 'Quảng Nam' },
    'hội an': { lat: 15.8801, lon: 108.3380, name: 'Hội An' },
    'tam kỳ': { lat: 15.5738, lon: 108.4729, name: 'Tam Kỳ' },
    'quảng ngãi': { lat: 15.1214, lon: 108.8044, name: 'Quảng Ngãi' },
    'bình định': { lat: 13.7800, lon: 109.2196, name: 'Bình Định' },
    'quy nhơn': { lat: 13.7830, lon: 109.2196, name: 'Quy Nhơn' },
    'phú yên': { lat: 13.0881, lon: 109.0929, name: 'Phú Yên' },
    'tuy hòa': { lat: 13.0955, lon: 109.2964, name: 'Tuy Hòa' },
    'khánh hòa': { lat: 12.2388, lon: 109.1967, name: 'Khánh Hòa' },
    'nha trang': { lat: 12.2388, lon: 109.1967, name: 'Nha Trang' },
    'ninh thuận': { lat: 11.6739, lon: 108.8629, name: 'Ninh Thuận' },
    'phan rang': { lat: 11.5643, lon: 108.9889, name: 'Phan Rang' },
    'bình thuận': { lat: 10.9273, lon: 108.1010, name: 'Bình Thuận' },
    'phan thiết': { lat: 10.9280, lon: 108.1020, name: 'Phan Thiết' },
    'mũi né': { lat: 10.9333, lon: 108.2667, name: 'Mũi Né' },

    // ===== TÂY NGUYÊN =====
    'kon tum': { lat: 14.3545, lon: 108.0007, name: 'Kon Tum' },
    'gia lai': { lat: 13.9830, lon: 108.0005, name: 'Gia Lai' },
    'pleiku': { lat: 13.9830, lon: 108.0005, name: 'Pleiku' },
    'đắk lắk': { lat: 12.7100, lon: 108.2377, name: 'Đắk Lắk' },
    'buôn ma thuột': { lat: 12.6676, lon: 108.0380, name: 'Buôn Ma Thuột' },
    'đắk nông': { lat: 12.2646, lon: 107.6098, name: 'Đắk Nông' },
    'lâm đồng': { lat: 11.9404, lon: 108.4583, name: 'Lâm Đồng' },
    'đà lạt': { lat: 11.9404, lon: 108.4583, name: 'Đà Lạt' },
    'dalat': { lat: 11.9404, lon: 108.4583, name: 'Đà Lạt' },

    // ===== ĐÔNG NAM BỘ =====
    'bình phước': { lat: 11.7511, lon: 106.7234, name: 'Bình Phước' },
    'tây ninh': { lat: 11.3351, lon: 106.0989, name: 'Tây Ninh' },
    'bình dương': { lat: 11.3254, lon: 106.4770, name: 'Bình Dương' },
    'thủ dầu một': { lat: 10.9804, lon: 106.6519, name: 'Thủ Dầu Một' },
    'đồng nai': { lat: 10.9465, lon: 106.8340, name: 'Đồng Nai' },
    'biên hòa': { lat: 10.9510, lon: 106.8220, name: 'Biên Hòa' },
    'bà rịa - vũng tàu': { lat: 10.5417, lon: 107.2429, name: 'Bà Rịa - Vũng Tàu' },
    'vũng tàu': { lat: 10.3460, lon: 107.0843, name: 'Vũng Tàu' },
    'bà rịa': { lat: 10.5117, lon: 107.1648, name: 'Bà Rịa' },

    // ===== ĐỒNG BẰNG SÔNG CỬU LONG =====
    'long an': { lat: 10.5333, lon: 106.4167, name: 'Long An' },
    'tân an': { lat: 10.5385, lon: 106.4166, name: 'Tân An' },
    'tiền giang': { lat: 10.3599, lon: 106.3621, name: 'Tiền Giang' },
    'mỹ tho': { lat: 10.3600, lon: 106.3597, name: 'Mỹ Tho' },
    'bến tre': { lat: 10.2431, lon: 106.3755, name: 'Bến Tre' },
    'tp.bến tre': { lat: 10.2431, lon: 106.3755, name: 'TP. Bến Tre' },
    'tp. bến tre': { lat: 10.2431, lon: 106.3755, name: 'TP. Bến Tre' },
    'trà vinh': { lat: 9.9347, lon: 106.3417, name: 'Trà Vinh' },
    'tp.trà vinh': { lat: 9.9347, lon: 106.3417, name: 'TP. Trà Vinh' },
    'tp. trà vinh': { lat: 9.9347, lon: 106.3417, name: 'TP. Trà Vinh' },
    'vĩnh long': { lat: 10.2396, lon: 105.9571, name: 'Vĩnh Long' },
    'đồng tháp': { lat: 10.4938, lon: 105.6881, name: 'Đồng Tháp' },
    'cao lãnh': { lat: 10.4596, lon: 105.6325, name: 'Cao Lãnh' },
    'an giang': { lat: 10.3866, lon: 105.4359, name: 'An Giang' },
    'long xuyên': { lat: 10.3833, lon: 105.4333, name: 'Long Xuyên' },
    'châu đốc': { lat: 10.7050, lon: 105.1167, name: 'Châu Đốc' },
    'kiên giang': { lat: 10.0125, lon: 105.0808, name: 'Kiên Giang' },
    'rạch giá': { lat: 10.0125, lon: 105.0808, name: 'Rạch Giá' },
    'phú quốc': { lat: 10.2899, lon: 103.9862, name: 'Phú Quốc' },
    'hậu giang': { lat: 9.7578, lon: 105.4709, name: 'Hậu Giang' },
    'vị thanh': { lat: 9.7845, lon: 105.4702, name: 'Vị Thanh' },
    'sóc trăng': { lat: 9.6037, lon: 105.9740, name: 'Sóc Trăng' },
    'bạc liêu': { lat: 9.2515, lon: 105.7244, name: 'Bạc Liêu' },
    'cà mau': { lat: 9.1527, lon: 105.1960, name: 'Cà Mau' },
  };

  /**
   * Chuẩn hóa tên địa điểm
   */
  normalizeName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/tp\s*\./gi, 'tp.')
      .replace(/thành phố/gi, 'tp.');
  }

  /**
   * Lấy tọa độ từ tên địa điểm
   */
  async getCoordinates(locationName) {
    if (!locationName) return null;

    const normalized = this.normalizeName(locationName);

    // 1. Kiểm tra static coordinates trước
    if (this.staticCoordinates[normalized]) {
      console.log(`✓ Found static coordinates for: ${locationName}`);
      return this.staticCoordinates[normalized];
    }

    // 2. Kiểm tra cache
    if (this.cache.has(normalized)) {
      console.log(`✓ Found cached coordinates for: ${locationName}`);
      return this.cache.get(normalized);
    }

    // 3. Gọi Nominatim API
    try {
      console.log(`→ Fetching coordinates for: ${locationName}`);
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          q: `${locationName}, Vietnam`,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'TravelAI/1.0' // Nominatim yêu cầu User-Agent
        },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const coords = {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          name: result.display_name.split(',')[0]
        };

        // Lưu vào cache
        this.cache.set(normalized, coords);
        console.log(`✓ Geocoded: ${locationName} → ${coords.lat}, ${coords.lon}`);
        return coords;
      }

      console.log(`✗ No coordinates found for: ${locationName}`);
      return null;
    } catch (error) {
      console.error(`Geocoding error for ${locationName}:`, error.message);
      return null;
    }
  }

  /**
   * Lấy tọa độ cho nhiều địa điểm cùng lúc
   */
  async getMultipleCoordinates(locationNames) {
    const results = await Promise.all(
      locationNames.map(name => this.getCoordinates(name))
    );
    return results;
  }

  /**
   * Thêm địa điểm mới vào static coordinates
   */
  addStaticCoordinate(name, lat, lon, displayName = null) {
    const normalized = this.normalizeName(name);
    this.staticCoordinates[normalized] = {
      lat,
      lon,
      name: displayName || name
    };
  }
}

module.exports = new GeocodingService();
