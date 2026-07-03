/**
 * GPS Validator - Kiểm tra tọa độ có nằm trong ranh giới tỉnh không
 * Sử dụng ranh giới hành chính thực tế + kiểm tra khoảng cách đến trung tâm
 */

// Ranh giới hành chính các tỉnh (theo bản đồ)
const PROVINCE_BOUNDS = {
  // Đông Nam Bộ
  'Tây Ninh': {
    minLat: 10.9, maxLat: 11.7,
    minLng: 105.7, maxLng: 106.5,
    center: { lat: 11.31, lng: 106.10 }
  },
  'Bà Rịa - Vũng Tàu': {
    minLat: 10.1, maxLat: 10.7,
    minLng: 106.8, maxLng: 107.5,
    center: { lat: 10.41, lng: 107.14 }
  },
  'Bình Thuận': {
    minLat: 10.5, maxLat: 11.3,
    minLng: 107.5, maxLng: 108.5,
    center: { lat: 10.93, lng: 108.10 }
  },
  'Đồng Nai': {
    minLat: 10.5, maxLat: 11.4,
    minLng: 106.7, maxLng: 107.6,
    center: { lat: 10.95, lng: 107.17 }
  },
  'Bình Dương': {
    minLat: 10.7, maxLat: 11.4,
    minLng: 106.3, maxLng: 106.9,
    center: { lat: 11.08, lng: 106.64 }
  },
  'Bình Phước': {
    minLat: 11.3, maxLat: 12.2,
    minLng: 106.3, maxLng: 107.2,
    center: { lat: 11.75, lng: 106.72 }
  },
  'TP. Hồ Chí Minh': {
    minLat: 10.3, maxLat: 11.2,
    minLng: 106.3, maxLng: 107.0,
    center: { lat: 10.82, lng: 106.63 }
  },
  
  // Duyên hải Nam Trung Bộ
  'Ninh Thuận': {
    minLat: 11.3, maxLat: 12.0,
    minLng: 108.5, maxLng: 109.3,
    center: { lat: 11.67, lng: 108.99 }
  },
  'Khánh Hòa': {
    minLat: 11.7, maxLat: 12.8,
    minLng: 108.8, maxLng: 109.5,
    center: { lat: 12.25, lng: 109.19 }
  },
  'Phú Yên': {
    minLat: 12.7, maxLat: 13.5,
    minLng: 108.7, maxLng: 109.5,
    center: { lat: 13.09, lng: 109.10 }
  },
  'Bình Định': {
    minLat: 13.5, maxLat: 14.5,
    minLng: 108.5, maxLng: 109.3,
    center: { lat: 13.78, lng: 109.22 }
  },
  'Quảng Ngãi': {
    minLat: 14.5, maxLat: 15.5,
    minLng: 108.3, maxLng: 109.2,
    center: { lat: 15.12, lng: 108.80 }
  },
  'Quảng Nam': {
    minLat: 15.0, maxLat: 16.1,
    minLng: 107.2, maxLng: 108.8,
    center: { lat: 15.88, lng: 108.33 }  // Điều chỉnh center về Hội An để ưu tiên Quảng Nam
  },
  'Đà Nẵng': {
    minLat: 15.9, maxLat: 16.3,
    minLng: 107.9, maxLng: 108.3,
    center: { lat: 16.07, lng: 108.22 }
  },
  'Thừa Thiên Huế': {
    minLat: 16.0, maxLat: 16.8,
    minLng: 107.0, maxLng: 108.0,
    center: { lat: 16.46, lng: 107.59 }
  },
  
  // Tây Nguyên
  'Lâm Đồng': {
    minLat: 10.8, maxLat: 12.5,
    minLng: 107.3, maxLng: 108.7,
    center: { lat: 11.94, lng: 108.44 }  // Đà Lạt
  },
  'Đắk Lắk': {
    minLat: 12.2, maxLat: 13.2,
    minLng: 107.5, maxLng: 108.7,
    center: { lat: 12.67, lng: 108.04 }  // Buôn Ma Thuột
  },
  'Gia Lai': {
    minLat: 13.2, maxLat: 14.7,
    minLng: 107.5, maxLng: 108.5,
    center: { lat: 13.98, lng: 108.00 }  // Pleiku
  },
  'Kon Tum': {
    minLat: 14.2, maxLat: 15.5,
    minLng: 107.5, maxLng: 108.5,
    center: { lat: 14.35, lng: 108.00 }  // Kon Tum
  },
  'Đắk Nông': {
    minLat: 11.8, maxLat: 12.8,
    minLng: 107.3, maxLng: 108.2,
    center: { lat: 12.26, lng: 107.69 }  // Gia Nghĩa
  },
  
  // Bắc Trung Bộ
  'Quảng Bình': {
    minLat: 17.0, maxLat: 18.2,
    minLng: 105.8, maxLng: 107.0,
    center: { lat: 17.47, lng: 106.60 }  // Đồng Hới
  },
  'Quảng Trị': {
    minLat: 16.5, maxLat: 17.2,
    minLng: 106.8, maxLng: 107.5,
    center: { lat: 16.81, lng: 107.10 }  // Đông Hà
  },
  'Hà Tĩnh': {
    minLat: 17.8, maxLat: 18.7,
    minLng: 105.3, maxLng: 106.3,
    center: { lat: 18.34, lng: 105.91 }  // Hà Tĩnh
  },
  'Nghệ An': {
    minLat: 18.3, maxLat: 19.8,
    minLng: 104.0, maxLng: 105.8,
    center: { lat: 18.68, lng: 105.68 }  // Vinh
  },
  'Thanh Hóa': {
    minLat: 19.3, maxLat: 20.5,
    minLng: 104.5, maxLng: 106.0,
    center: { lat: 19.81, lng: 105.78 }  // Thanh Hóa
  },
  
  // Đồng Bằng Sông Hồng
  'Hà Nội': {
    minLat: 20.8, maxLat: 21.4,
    minLng: 105.5, maxLng: 106.0,
    center: { lat: 21.03, lng: 105.85 }  // Hà Nội
  },
  'Hải Phòng': {
    minLat: 20.7, maxLat: 21.0,
    minLng: 106.5, maxLng: 107.1,
    center: { lat: 20.86, lng: 106.68 }  // Hải Phòng
  },
  'Quảng Ninh': {
    minLat: 20.8, maxLat: 21.6,
    minLng: 106.8, maxLng: 108.0,
    center: { lat: 21.01, lng: 107.29 }  // Hạ Long
  },
  'Ninh Bình': {
    minLat: 20.0, maxLat: 20.5,
    minLng: 105.7, maxLng: 106.2,
    center: { lat: 20.25, lng: 105.98 }  // Ninh Bình
  },
  'Nam Định': {
    minLat: 20.1, maxLat: 20.6,
    minLng: 106.0, maxLng: 106.5,
    center: { lat: 20.42, lng: 106.17 }  // Nam Định
  },
  'Thái Bình': {
    minLat: 20.3, maxLat: 20.7,
    minLng: 106.2, maxLng: 106.6,
    center: { lat: 20.45, lng: 106.34 }  // Thái Bình
  },
  'Hà Nam': {
    minLat: 20.4, maxLat: 20.7,
    minLng: 105.8, maxLng: 106.1,
    center: { lat: 20.54, lng: 105.92 }  // Phủ Lý
  },
  'Hưng Yên': {
    minLat: 20.8, maxLat: 21.1,
    minLng: 105.9, maxLng: 106.3,
    center: { lat: 20.65, lng: 106.05 }  // Hưng Yên
  },
  'Hải Dương': {
    minLat: 20.8, maxLat: 21.1,
    minLng: 106.2, maxLng: 106.6,
    center: { lat: 20.94, lng: 106.31 }  // Hải Dương
  },
  'Bắc Ninh': {
    minLat: 21.0, maxLat: 21.3,
    minLng: 106.0, maxLng: 106.3,
    center: { lat: 21.19, lng: 106.08 }  // Bắc Ninh
  },
  'Vĩnh Phúc': {
    minLat: 21.2, maxLat: 21.6,
    minLng: 105.3, maxLng: 105.8,
    center: { lat: 21.31, lng: 105.60 }  // Vĩnh Yên
  }
};

/**
 * Tính khoảng cách Euclidean giữa 2 điểm
 */
function getDistance(lat1, lng1, lat2, lng2) {
  return Math.sqrt(
    Math.pow(lat1 - lat2, 2) + 
    Math.pow(lng1 - lng2, 2)
  );
}

/**
 * Kiểm tra tọa độ có nằm trong ranh giới tỉnh không
 * @param {number} lat - Vĩ độ
 * @param {number} lng - Kinh độ
 * @param {string} provinceName - Tên tỉnh
 * @returns {boolean} - true nếu nằm trong tỉnh
 */
function isWithinProvince(lat, lng, provinceName) {
  const bounds = PROVINCE_BOUNDS[provinceName];
  
  if (!bounds) {
    console.warn(`⚠️  Không tìm thấy ranh giới cho tỉnh: ${provinceName}`);
    return false;
  }
  
  // Bước 1: Kiểm tra trong ranh giới hành chính
  const withinBounds = lat >= bounds.minLat && 
                       lat <= bounds.maxLat &&
                       lng >= bounds.minLng && 
                       lng <= bounds.maxLng;
  
  if (!withinBounds) {
    return false;
  }
  
  // Bước 2: Kiểm tra khoảng cách đến trung tâm tỉnh
  const distToProvince = getDistance(lat, lng, bounds.center.lat, bounds.center.lng);
  
  // Bước 3: So sánh với các tỉnh lân cận (tránh vùng chồng lấn)
  let closestProvince = provinceName;
  let minDistance = distToProvince;
  
  for (const [name, otherBounds] of Object.entries(PROVINCE_BOUNDS)) {
    if (name === provinceName) continue;
    
    const distToOther = getDistance(lat, lng, otherBounds.center.lat, otherBounds.center.lng);
    
    if (distToOther < minDistance) {
      minDistance = distToOther;
      closestProvince = name;
    }
  }
  
  // Chỉ chấp nhận nếu gần tỉnh này nhất
  return closestProvince === provinceName;
}

/**
 * Lấy tỉnh gần nhất với tọa độ
 */
function getClosestProvince(lat, lng) {
  let closestProvince = null;
  let minDistance = Infinity;
  
  for (const [name, bounds] of Object.entries(PROVINCE_BOUNDS)) {
    const distance = getDistance(lat, lng, bounds.center.lat, bounds.center.lng);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestProvince = name;
    }
  }
  
  return { province: closestProvince, distance: minDistance };
}

module.exports = {
  isWithinProvince,
  getClosestProvince,
  PROVINCE_BOUNDS
};
