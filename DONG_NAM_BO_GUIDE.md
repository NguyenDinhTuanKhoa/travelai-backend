# Hướng dẫn thu thập dữ liệu Đông Nam Bộ

## Tổng quan

Đông Nam Bộ gồm **7 tỉnh thành**:
1. ✅ **Tây Ninh** - Đã hoàn thành (92 địa điểm)
2. 🔄 **Bà Rịa - Vũng Tàu** - Sẵn sàng chạy
3. 🔄 **Bình Thuận** - Sẵn sàng chạy
4. 🔄 **Đồng Nai** - Sẵn sàng chạy
5. 🔄 **Bình Dương** - Sẵn sàng chạy
6. 🔄 **Bình Phước** - Sẵn sàng chạy
7. 🔄 **TP. Hồ Chí Minh** - Sẵn sàng chạy

## Tọa độ trung tâm các tỉnh

| Tỉnh | Tọa độ | Bán kính |
|------|--------|----------|
| Tây Ninh | 11.31°N, 106.10°E | ±0.6° |
| Bà Rịa - Vũng Tàu | 10.41°N, 107.14°E | ±0.6° |
| Bình Thuận | 10.93°N, 108.10°E | ±0.7° |
| Đồng Nai | 10.95°N, 107.17°E | ±0.6° |
| Bình Dương | 11.08°N, 106.64°E | ±0.5° |
| Bình Phước | 11.75°N, 106.72°E | ±0.6° |
| TP. Hồ Chí Minh | 10.82°N, 106.63°E | ±0.5° |

## Cách chạy từng tỉnh

### 1. Bà Rịa - Vũng Tàu (Bãi biển nổi tiếng)

```bash
cd backend
node src/scripts/fetchBaRiaVungTau.js
```

**Điểm nổi bật:**
- Bãi Sau, Bãi Trước, Bãi Dứa
- Tượng Chúa Kitô, Ngọn Hải Đăng
- Hồ Cốc, Hồ Tràm
- Dinh Thắng Tam, Bạch Dinh

**Ước tính:** ~35 queries × 2 API calls = ~70 API calls

---

### 2. Bình Thuận (Mũi Né - Phan Thiết)

```bash
cd backend
node src/scripts/fetchBinhThuan.js
```

**Điểm nổi bật:**
- Đồi cát bay, Đồi cát vàng, Đồi cát đỏ
- Suối Tiên, Suối Hồng
- Tháp Chàm Poshanu
- Ngọn Hải Đăng Kê Gà

**Ước tính:** ~30 queries × 2 API calls = ~60 API calls

---

### 3. Đồng Nai (Sinh thái - Công nghiệp)

```bash
cd backend
node src/scripts/fetchDongNai.js
```

**Điểm nổi bật:**
- Khu du lịch Giang Điền, Bửu Long
- Hồ Trị An
- Vườn Quốc gia Cát Tiên
- Chùa Bửu Long

**Ước tính:** ~24 queries × 2 API calls = ~48 API calls

---

### 4. Bình Dương (Công nghiệp - Đại Nam)

```bash
cd backend
node src/scripts/fetchBinhDuong.js
```

**Điểm nổi bật:**
- Khu du lịch Đại Nam
- Chùa Hội Khánh
- Aeon Bình Dương

**Ước tính:** ~22 queries × 2 API calls = ~44 API calls

---

### 5. Bình Phước (Rừng - Sinh thái)

```bash
cd backend
node src/scripts/fetchBinhPhuoc.js
```

**Điểm nổi bật:**
- Vườn Quốc gia Bù Gia Mập
- Vườn Quốc gia Nam Cát Tiên
- Hồ Suối Cam
- Thác Đá Hàn

**Ước tính:** ~18 queries × 2 API calls = ~36 API calls

---

### 6. TP. Hồ Chí Minh (Thành phố lớn nhất)

```bash
cd backend
node src/scripts/fetchHoChiMinh.js
```

**Điểm nổi bật:**
- Nhà Thờ Đức Bà, Bưu Điện Trung Tâm
- Dinh Độc Lập, Bảo tàng Chiến tranh
- Chợ Bến Thành, Phố đi bộ Nguyễn Huệ
- Bitexco, Landmark 81
- Địa đạo Củ Chi
- Thảo Cầm Viên, Đầm Sen, Suối Tiên

**Ước tính:** ~48 queries × 2 API calls = ~96 API calls

---

## Tổng ước tính API calls

| Tỉnh | Queries | API Calls |
|------|---------|-----------|
| Tây Ninh | 17 | ~34 ✅ |
| Bà Rịa - Vũng Tàu | 35 | ~70 |
| Bình Thuận | 30 | ~60 |
| Đồng Nai | 24 | ~48 |
| Bình Dương | 22 | ~44 |
| Bình Phước | 18 | ~36 |
| TP. Hồ Chí Minh | 48 | ~96 |
| **TỔNG** | **194** | **~388** |

## Chiến lược tiết kiệm API

### Serper.dev API
- **Free tier:** 2,500 searches/month
- **Đã dùng:** ~3,730 (Mekong Delta)
- **Cần thêm:** ~388 (Đông Nam Bộ)
- **Tổng:** ~4,118 API calls

### Khuyến nghị:
1. **Chạy từng tỉnh một** - Kiểm tra kết quả trước khi chạy tiếp
2. **Ưu tiên tỉnh du lịch:** Bà Rịa - Vũng Tàu, Bình Thuận, TP.HCM
3. **Delay 1 giây** giữa mỗi query để tránh rate limit
4. **Kiểm tra database** sau mỗi tỉnh:

```bash
cd backend
node check_database_summary.js
```

## Thứ tự khuyến nghị

### Giai đoạn 1: Tỉnh du lịch nổi tiếng (Ưu tiên cao)
1. **Bà Rịa - Vũng Tàu** - Bãi biển, resort
2. **Bình Thuận** - Mũi Né, đồi cát
3. **TP. Hồ Chí Minh** - Thành phố lớn nhất

### Giai đoạn 2: Tỉnh công nghiệp có du lịch (Ưu tiên trung bình)
4. **Đồng Nai** - Sinh thái, Cát Tiên
5. **Bình Dương** - Đại Nam

### Giai đoạn 3: Tỉnh ít du lịch (Ưu tiên thấp)
6. **Bình Phước** - Rừng, sinh thái

## Kiểm tra kết quả

### Xem tổng quan database:
```bash
cd backend
node check_database_summary.js
```

### Xem chi tiết từng tỉnh:
```bash
cd backend
node check_by_city.js
```

## Lưu ý quan trọng

1. ✅ **Tất cả scripts đã sẵn sàng** - Chỉ cần chạy
2. ✅ **GPS validation tự động** - Chỉ lưu địa điểm trong phạm vi tỉnh
3. ✅ **Image validation** - Chỉ lưu địa điểm có ít nhất 3 hình ảnh
4. ✅ **Duplicate check** - Tự động bỏ qua địa điểm đã tồn tại
5. ⚠️ **API quota** - Theo dõi usage để tránh vượt quota

## Sau khi hoàn thành

1. Chạy database summary để xem tổng quan
2. Kiểm tra GPS coordinates có đúng không
3. Kiểm tra images có hiển thị không
4. Test frontend với dữ liệu mới
5. Update frontend filters nếu cần (đã có sẵn: beach, attraction, hotel, restaurant, city, countryside, historical, mountain)

---

**Chúc may mắn! 🚀**
