const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// 🌴 Địa điểm du lịch Trà Vinh
// 💡 LƯU Ý: Để có ảnh thực tế, vui lòng:
//    1. Chụp ảnh tại địa điểm hoặc tìm từ nguồn chính thống
//    2. Upload lên CDN/Cloud Storage (Cloudinary, AWS S3, etc.)
//    3. Cập nhật URL ảnh trong database qua Admin Dashboard
const traVinhDestinations = [
  // 🏝️ 1. Địa điểm thiên nhiên – check-in đẹp
  {
    name: 'Ao Bà Om',
    description: 'Hồ nước nổi tiếng với hàng cây cổ thụ, không gian cực mát và yên bình, mang nhiều giá trị lịch sử văn hóa. Đây là điểm du lịch tâm linh quan trọng của người Khmer ở Trà Vinh.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9450, lng: 106.3450 }
    },
    images: [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', // Lake with trees
      'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800'  // Peaceful lake
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.5,
    reviewCount: 820,
    amenities: ['Bãi đỗ xe', 'Nhà hàng', 'Khu vui chơi trẻ em', 'Đình chùa'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 11', 'Tháng 12'],
    activities: ['Đi dạo quanh hồ', 'Chụp ảnh', 'Tìm hiểu văn hóa Khmer', 'Nghỉ ngơi thư giãn'],
    cuisine: {
      name: 'Bánh xèo Khmer',
      description: 'Bánh xèo đặc trưng của người Khmer Trà Vinh với nhân dừa và đậu xanh'
    }
  },
  {
    name: 'Biển Ba Động',
    description: 'Bãi biển hoang sơ, thích hợp đi chill, ăn hải sản tươi ngon và ngắm hoàng hôn tuyệt đẹp. Nơi lý tưởng cho những ai muốn tìm sự yên bình.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.5833, lng: 106.4500 }
    },
    images: [
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800', // Beach sunset
      'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800'  // Beach shoreline
    ],
    category: 'beach',
    priceRange: 'budget',
    rating: 4.3,
    reviewCount: 650,
    amenities: ['Nhà hàng hải sản', 'Bãi đỗ xe', 'Khu cắm trại', 'Ghế tắm nắng'],
    bestTimeToVisit: ['Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7'],
    activities: ['Tắm biển', 'Ngắm hoàng hôn', 'Ăn hải sản', 'Cắm trại', 'Chụp ảnh'],
    cuisine: {
      name: 'Hải sản tươi sống',
      description: 'Hải sản tươi ngon được đánh bắt trực tiếp từ biển Ba Động'
    }
  },
  {
    name: 'Rừng ngập mặn Long Khánh',
    description: 'Hệ sinh thái rừng ven biển độc đáo với đa dạng sinh học phong phú, thích hợp cho những ai yêu thích khám phá thiên nhiên và tìm hiểu về môi trường.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.7000, lng: 106.5000 }
    },
    images: [
      'https://images.unsplash.com/photo-1511497584788-876760111969?w=800', // Mangrove forest
      'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800'  // Wetland ecosystem
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.4,
    reviewCount: 480,
    amenities: ['Tour thuyền', 'Hướng dẫn viên', 'Đường mòn sinh thái', 'Bãi đỗ xe'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 11', 'Tháng 12'],
    activities: ['Đi thuyền khám phá', 'Ngắm chim', 'Tìm hiểu sinh thái', 'Chụp ảnh thiên nhiên'],
    cuisine: {
      name: 'Cá lóc nướng trui',
      description: 'Món ăn dân dã đặc trưng miền sông nước'
    }
  },
  {
    name: 'Điện gió Duyên Hải',
    description: 'Cánh đồng quạt gió siêu đẹp trải dài bờ biển, rất hợp chụp ảnh "xịn xò" và check-in sống ảo. Cảnh quan hùng vĩ và hiện đại.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.6000, lng: 106.4800 }
    },
    images: [
      'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800', // Wind turbines field
      'https://images.unsplash.com/photo-1548337138-e87d889cc369?w=800'  // Wind energy farm
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.6,
    reviewCount: 920,
    amenities: ['Bãi đỗ xe', 'Điểm check-in', 'Khu vực ngắm cảnh'],
    bestTimeToVisit: ['Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 10', 'Tháng 11'],
    activities: ['Chụp ảnh', 'Ngắm cảnh', 'Bay flycam', 'Check-in sống ảo'],
    cuisine: {
      name: 'Ốc hút nước dừa',
      description: 'Món ăn đặc sản độc đáo của Trà Vinh'
    }
  },

  // 🏝️ 2. Du lịch sinh thái – miệt vườn
  {
    name: 'Cồn Chim',
    description: 'Du lịch cộng đồng, trải nghiệm đời sống miền Tây đích thực như làm bánh, câu cua, đi ghe trên sông. Nơi lý tưởng để hiểu về văn hóa miệt vườn.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.8500, lng: 106.2800 }
    },
    images: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.5,
    reviewCount: 580,
    amenities: ['Homestay', 'Tour trải nghiệm', 'Nhà hàng địa phương', 'Bến thuyền'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Làm bánh dân gian', 'Câu cua', 'Đi ghe', 'Tham quan vườn trái cây', 'Ngủ homestay'],
    cuisine: {
      name: 'Bánh tét lá cẩm',
      description: 'Đặc sản Trà Vinh làm từ gạo nếp và lá cẩm tím'
    }
  },
  {
    name: 'Cù lao Tân Quy',
    description: 'Nổi tiếng với vườn trái cây sum suê, đi ghe ngắm cảnh, đạp xe quanh cù lao và thưởng thức trái cây tươi ngon. Không gian yên bình của miền sông nước.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9800, lng: 106.2500 }
    },
    images: [
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800',
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800'
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.4,
    reviewCount: 670,
    amenities: ['Vườn trái cây', 'Tour thuyền', 'Cho thuê xe đạp', 'Nhà hàng'],
    bestTimeToVisit: ['Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8'],
    activities: ['Tham quan vườn trái cây', 'Đi ghe', 'Đạp xe', 'Thưởng thức trái cây tươi'],
    cuisine: {
      name: 'Trái cây miệt vườn',
      description: 'Trái cây tươi ngon như sầu riêng, chôm chôm, măng cụt'
    }
  },
  {
    name: 'Cù lao Long Trị',
    description: 'Điểm du lịch sinh thái với không khí trong lành, cảnh quan miệt vườn đẹp mắt. Nơi lý tưởng để nghỉ dưỡng cuối tuần.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.8800, lng: 106.3200 }
    },
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
      'https://images.unsplash.com/photo-1511497584788-876760111969?w=800'
    ],
    category: 'countryside',
    priceRange: 'budget',
    rating: 4.3,
    reviewCount: 420,
    amenities: ['Homestay', 'Vườn trái cây', 'Bến thuyền', 'Nhà hàng'],
    bestTimeToVisit: ['Tháng 3', 'Tháng 4', 'Tháng 11', 'Tháng 12'],
    activities: ['Nghỉ dưỡng', 'Đi thuyền', 'Tham quan vườn', 'Câu cá'],
    cuisine: {
      name: 'Cá lóc kho tộ',
      description: 'Món ăn đặc trưng miền sông nước'
    }
  },
  {
    name: 'Khu du lịch Huỳnh Kha',
    description: 'Khu vui chơi giải trí tổng hợp với cả nghỉ dưỡng và ẩm thực khá đầy đủ. Điểm đến lý tưởng cho gia đình.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9200, lng: 106.3100 }
    },
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'
    ],
    category: 'countryside',
    priceRange: 'mid-range',
    rating: 4.2,
    reviewCount: 530,
    amenities: ['Resort', 'Nhà hàng', 'Hồ bơi', 'Khu vui chơi trẻ em', 'Sân golf mini'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Nghỉ dưỡng', 'Vui chơi', 'Ăn uống', 'Bơi lội', 'Câu cá'],
    cuisine: {
      name: 'Buffet miền Tây',
      description: 'Đa dạng món ăn đặc sản miền Tây'
    }
  },

  // 🛕 3. Du lịch tâm linh – văn hóa Khmer
  {
    name: 'Chùa Âng',
    description: 'Ngôi chùa Khmer cổ kính với kiến trúc rất đẹp mắt, là biểu tượng văn hóa Khmer ở Trà Vinh. Không gian thanh tịnh và trang nghiêm.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9600, lng: 106.3400 }
    },
    images: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
      'https://images.unsplash.com/photo-1509390874766-8fd77baa9c40?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.6,
    reviewCount: 780,
    amenities: ['Hướng dẫn viên', 'Bãi đỗ xe', 'Chùa', 'Bảo tàng nhỏ'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4'],
    activities: ['Viếng chùa', 'Tìm hiểu văn hóa Khmer', 'Chụp ảnh kiến trúc', 'Thiền định'],
    cuisine: {
      name: 'Cơm chay Khmer',
      description: 'Món chay đặc trưng theo phong cách Khmer'
    }
  },
  {
    name: 'Chùa Vàm Ray (Ang Pagoda)',
    description: 'Chùa Khmer lớn nhất Việt Nam với kiến trúc kiểu Angkor cực kỳ hoành tráng. Điểm nhấn của du lịch tâm linh Trà Vinh với hơn 150 năm tuổi.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.8200, lng: 106.2900 }
    },
    images: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
      'https://images.unsplash.com/photo-1548013146-72479768bada?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.8,
    reviewCount: 1240,
    amenities: ['Bảo tàng', 'Hướng dẫn viên', 'Bãi đỗ xe', 'Khu vực ngắm cảnh'],
    bestTimeToVisit: ['Tháng 1', 'Tháng 2', 'Tháng 11', 'Tháng 12'],
    activities: ['Viếng chùa', 'Tham quan bảo tàng', 'Chụp ảnh kiến trúc', 'Tìm hiểu lịch sử Khmer'],
    cuisine: {
      name: 'Bánh ít lá gai',
      description: 'Đặc sản Khmer làm từ lá gai và đậu xanh'
    }
  },
  {
    name: 'Chùa Cò (Nodol Pagoda)',
    description: 'Nơi có hàng nghìn con cò sinh sống, tạo nên cảnh quan rất đặc biệt và độc đáo. Điểm đến kết hợp giữa tâm linh và thiên nhiên.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9100, lng: 106.3300 }
    },
    images: [
      'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800',
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.7,
    reviewCount: 890,
    amenities: ['Chùa', 'Khu ngắm chim', 'Bãi đỗ xe', 'Nhà hàng chay'],
    bestTimeToVisit: ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
    activities: ['Viếng chùa', 'Ngắm cò', 'Chụp ảnh thiên nhiên', 'Tìm hiểu sinh thái'],
    cuisine: {
      name: 'Cơm chay miền Tây',
      description: 'Món chay thanh đạm đậm chất miền sông nước'
    }
  },
  {
    name: 'Nhà thờ Mặc Bắc',
    description: 'Nhà thờ Công giáo lâu đời với kiến trúc cổ kính pha trộn phong cách Á – Âu. Di tích kiến trúc độc đáo ở Trà Vinh.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9500, lng: 106.3500 }
    },
    images: [
      'https://images.unsplash.com/photo-1509390874766-8fd77baa9c40?w=800',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.4,
    reviewCount: 520,
    amenities: ['Nhà thờ', 'Bãi đỗ xe', 'Khu vườn'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Tham quan', 'Chụp ảnh kiến trúc', 'Tìm hiểu lịch sử Công giáo'],
    cuisine: {
      name: 'Bánh bò nướng',
      description: 'Món bánh đặc sản của người Hoa ở Trà Vinh'
    }
  },

  // 🏛️ 4. Di tích lịch sử – văn hóa
  {
    name: 'Đền thờ Chủ tịch Hồ Chí Minh',
    description: 'Di tích lịch sử quan trọng của tỉnh Trà Vinh, nơi tưởng nhớ Chủ tịch Hồ Chí Minh. Điểm đến giáo dục truyền thống cách mạng.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9350, lng: 106.3420 }
    },
    images: [
      'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=800',
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.5,
    reviewCount: 640,
    amenities: ['Đền thờ', 'Bảo tàng', 'Bãi đỗ xe', 'Công viên'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Dâng hương', 'Tìm hiểu lịch sử', 'Tham quan bảo tàng', 'Chụp ảnh'],
    cuisine: {
      name: 'Bún nước lèo',
      description: 'Món ăn đặc sản Trà Vinh với nước dùng đậm đà'
    }
  },
  {
    name: 'Bảo tàng Văn hóa Khmer',
    description: 'Tìm hiểu sâu về văn hóa Khmer đặc trưng của vùng Trà Vinh. Nơi lưu giữ và trưng bày những nét văn hóa độc đáo của dân tộc Khmer.',
    location: {
      city: 'Trà Vinh',
      country: 'Việt Nam',
      coordinates: { lat: 9.9380, lng: 106.3450 }
    },
    images: [
      'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800'
    ],
    category: 'historical',
    priceRange: 'budget',
    rating: 4.3,
    reviewCount: 480,
    amenities: ['Bảo tàng', 'Hướng dẫn viên', 'Cửa hàng lưu niệm', 'Bãi đỗ xe'],
    bestTimeToVisit: ['Quanh năm'],
    activities: ['Tham quan bảo tàng', 'Tìm hiểu văn hóa Khmer', 'Xem hiện vật cổ', 'Mua quà lưu niệm'],
    cuisine: {
      name: 'Bánh căn Khmer',
      description: 'Món bánh nhỏ xinh đặc trưng của người Khmer'
    }
  }
];

const seedTraVinh = async () => {
  console.log('🌴 Starting Trà Vinh destinations seed script...');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found ✅' : 'NOT FOUND ❌');

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Không xóa destinations cũ, chỉ thêm mới
    console.log(`📍 Inserting ${traVinhDestinations.length} Trà Vinh destinations...`);
    const result = await Destination.insertMany(traVinhDestinations);
    console.log(`✅ Successfully seeded ${result.length} Trà Vinh destinations!`);

    // Show summary by category
    console.log('\n📊 Summary by category:');
    const categories = {
      'beach': '🏖️ Biển',
      'countryside': '🌾 Nông thôn/Sinh thái',
      'historical': '🏛️ Di tích/Tâm linh'
    };

    for (const [catKey, catName] of Object.entries(categories)) {
      const count = result.filter(d => d.category === catKey).length;
      if (count > 0) {
        console.log(`   ${catName}: ${count} địa điểm`);
      }
    }

    console.log('\n🎉 Hoàn thành! Các địa điểm Trà Vinh đã được thêm vào database.');
    console.log('💡 Bạn có thể xem trên frontend tại: http://localhost:3000/destinations');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding Trà Vinh destinations:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

seedTraVinh();
