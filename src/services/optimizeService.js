const axios = require('axios');

/**
 * ============================================================
 *  optimizeService.js
 *  Sắp xếp tối ưu thứ tự địa điểm du lịch
 *  Thuật toán: Nearest Neighbor (Láng giềng gần nhất)
 *  Khoảng cách: Haversine (nhanh) hoặc OSRM (chính xác, async)
 * ============================================================
 */
class OptimizeService {
  constructor() {
    this.osrmBaseURL = 'https://router.project-osrm.org/route/v1/driving';
    this.OSRM_TIMEOUT = 8000; // 8 giây timeout mỗi request
    this.OSRM_MAX_LOCATIONS = 12; // OSRM Table API giới hạn thực tế
  }

  // ─────────────────────────────────────────────────────────
  //  1. HAVERSINE — Tính khoảng cách đường chim bay (km)
  // ─────────────────────────────────────────────────────────
  /**
   * Tính khoảng cách Haversine giữa 2 tọa độ
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} Khoảng cách tính bằng km
   */
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Bán kính Trái Đất (km)
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // km
  }

  // ─────────────────────────────────────────────────────────
  //  2. OSRM TABLE API — Ma trận khoảng cách đường thực tế
  // ─────────────────────────────────────────────────────────
  /**
   * Lấy ma trận khoảng cách từ OSRM Table API (thời gian di chuyển thực tế)
   * @param {Array<{lat, lng}>} points - Mảng các điểm (bao gồm startPoint ở index 0)
   * @returns {Promise<number[][]|null>} Ma trận duration (seconds), hoặc null nếu lỗi
   */
  async getOSRMDistanceMatrix(points) {
    try {
      // Format: lng,lat;lng,lat;...
      const coords = points
        .map((p) => `${p.lng},${p.lat}`)
        .join(';');

      const url = `https://router.project-osrm.org/table/v1/driving/${coords}`;

      const response = await axios.get(url, {
        params: { annotations: 'duration' },
        timeout: this.OSRM_TIMEOUT,
      });

      if (response.data.code !== 'Ok') {
        console.warn('[OptimizeService] OSRM Table API error:', response.data.code);
        return null;
      }

      return response.data.durations; // seconds matrix [i][j]
    } catch (err) {
      console.warn('[OptimizeService] OSRM Table API failed, fallback to Haversine:', err.message);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  //  3. NEAREST NEIGHBOR — Thuật toán lõi
  // ─────────────────────────────────────────────────────────
  /**
   * Áp dụng thuật toán Nearest Neighbor
   * @param {number[][]} distMatrix - Ma trận khoảng cách [n+1][n+1] (index 0 = startPoint)
   * @param {number} n - Số địa điểm cần sắp xếp (không tính startPoint)
   * @returns {number[]} Mảng chỉ số đã sắp xếp (index vào mảng gốc locations, 0-based)
   */
  nearestNeighbor(distMatrix, n) {
    const visited = new Array(n).fill(false);
    const order = [];
    let currentIdx = 0; // index 0 trong matrix = startPoint

    for (let step = 0; step < n; step++) {
      let nearestIdx = -1;
      let minDist = Infinity;

      // Tìm điểm chưa thăm gần nhất từ vị trí hiện tại
      // Các điểm locations nằm tại index 1..n trong distMatrix
      for (let j = 1; j <= n; j++) {
        const locationIdx = j - 1; // index trong mảng locations gốc
        if (!visited[locationIdx]) {
          const dist = distMatrix[currentIdx][j];
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = j;
          }
        }
      }

      if (nearestIdx === -1) break;

      const locationIdx = nearestIdx - 1;
      visited[locationIdx] = true;
      order.push(locationIdx);
      currentIdx = nearestIdx;
    }

    return order;
  }

  // ─────────────────────────────────────────────────────────
  //  4. PUBLIC API — Hàm chính được gọi từ route
  // ─────────────────────────────────────────────────────────
  /**
   * Tối ưu thứ tự danh sách địa điểm du lịch
   *
   * @param {Array<{id, name, lat, lng}>} locations - Danh sách địa điểm
   * @param {{lat: number, lng: number, name?: string}} startPoint - Điểm xuất phát
   * @param {'haversine'|'osrm'|'auto'} mode - Chế độ tính khoảng cách
   *   - 'haversine': Luôn dùng Haversine (nhanh, offline)
   *   - 'osrm': Luôn dùng OSRM (chính xác, cần mạng)
   *   - 'auto': Thử OSRM trước, fallback sang Haversine nếu lỗi hoặc quá nhiều điểm
   *
   * @returns {Promise<{
   *   optimizedLocations: Array,
   *   method: string,
   *   totalDistance: number,
   *   stats: Object
   * }>}
   */
  async optimizeRoute(locations, startPoint, mode = 'auto') {
    if (!locations || locations.length === 0) {
      return { optimizedLocations: [], method: 'none', totalDistance: 0, stats: {} };
    }

    if (locations.length === 1) {
      return {
        optimizedLocations: locations,
        method: 'trivial',
        totalDistance: this.haversineDistance(
          startPoint.lat, startPoint.lng,
          locations[0].lat, locations[0].lng
        ),
        stats: { locationCount: 1 }
      };
    }

    const n = locations.length;
    // Tất cả points: [startPoint, ...locations]
    const allPoints = [startPoint, ...locations];

    let distMatrix = null;
    let method = 'haversine';

    // ── Quyết định phương pháp tính ──
    const shouldTryOSRM = (mode === 'osrm') || (mode === 'auto' && n <= this.OSRM_MAX_LOCATIONS);

    if (shouldTryOSRM) {
      console.log(`[OptimizeService] Trying OSRM Table API for ${n} locations...`);
      distMatrix = await this.getOSRMDistanceMatrix(allPoints);
      if (distMatrix) {
        method = 'osrm';
        console.log('[OptimizeService] ✓ Using OSRM distance matrix');
      }
    }

    // Fallback hoặc chủ động dùng Haversine
    if (!distMatrix) {
      console.log(`[OptimizeService] Using Haversine for ${n} locations`);
      distMatrix = this._buildHaversineMatrix(allPoints);
      method = 'haversine';
    }

    // ── Chạy thuật toán Nearest Neighbor ──
    const startTime = Date.now();
    const orderedIndices = this.nearestNeighbor(distMatrix, n);
    const elapsedMs = Date.now() - startTime;

    // ── Xây dựng kết quả ──
    const optimizedLocations = orderedIndices.map((idx) => locations[idx]);

    // Tính tổng khoảng cách (Haversine để nhất quán)
    const totalDistance = this._calcTotalHaversine(startPoint, optimizedLocations);

    // Tổng khoảng cách ban đầu (thứ tự gốc) để so sánh
    const originalDistance = this._calcTotalHaversine(startPoint, locations);
    const improvement = originalDistance > 0
      ? (((originalDistance - totalDistance) / originalDistance) * 100).toFixed(1)
      : '0';

    console.log(
      `[OptimizeService] ✓ Optimized ${n} locations | ` +
      `Method: ${method} | ` +
      `${originalDistance.toFixed(1)}km → ${totalDistance.toFixed(1)}km | ` +
      `Saved ${improvement}% | ${elapsedMs}ms`
    );

    return {
      optimizedLocations,
      method,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      stats: {
        locationCount: n,
        originalDistanceKm: parseFloat(originalDistance.toFixed(2)),
        optimizedDistanceKm: parseFloat(totalDistance.toFixed(2)),
        improvementPercent: parseFloat(improvement),
        elapsedMs,
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  //  Private Helpers
  // ─────────────────────────────────────────────────────────

  /** Xây dựng ma trận Haversine cho n+1 điểm */
  _buildHaversineMatrix(points) {
    const n = points.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = this.haversineDistance(
          points[i].lat, points[i].lng,
          points[j].lat, points[j].lng
        );
        matrix[i][j] = d;
        matrix[j][i] = d;
      }
    }
    return matrix;
  }

  /** Tính tổng khoảng cách Haversine của một lộ trình */
  _calcTotalHaversine(startPoint, orderedLocations) {
    let total = 0;
    let prev = startPoint;
    for (const loc of orderedLocations) {
      total += this.haversineDistance(prev.lat, prev.lng, loc.lat, loc.lng);
      prev = loc;
    }
    return total;
  }
}

module.exports = new OptimizeService();
