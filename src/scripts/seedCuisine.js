const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Destination = require('../models/Destination');

// Map cuisine to destinations
const cuisineData = {
  // Biển
  'Vịnh Hạ Long': { name: 'Chả mực', description: 'Chả mực Hạ Long giòn dai, thơm ngon, được làm từ mực tươi đánh nhuyễn' },
  'Bãi biển Mỹ Khê': { name: 'Mì Quảng hải sản', description: 'Mì Quảng với tôm, mực, thịt heo và nước dùng đậm đà' },
  'Phú Quốc': { name: 'Gỏi cá trích', description: 'Gỏi cá trích tươi trộn với rau sống, đậu phộng và nước mắm Phú Quốc' },
  'Nha Trang': { name: 'Bún chả cá', description: 'Bún chả cá Nha Trang với nước dùng trong, chả cá chiên giòn' },
  'Côn Đảo': { name: 'Ốc vú nàng', description: 'Ốc vú nàng nướng mỡ hành, đặc sản quý hiếm của Côn Đảo' },
  'Bãi biển Mũi Né': { name: 'Bánh căn hải sản', description: 'Bánh căn nóng hổi với nhân tôm, mực, ăn kèm nước mắm chua ngọt' },
  'Bãi Dài Cam Ranh': { name: 'Tôm hùm nướng', description: 'Tôm hùm Cam Ranh nướng phô mai hoặc nướng mỡ hành' },
  'Lăng Cô': { name: 'Hàu nướng mỡ hành', description: 'Hàu Lăng Cô tươi ngon, nướng với mỡ hành và đậu phộng' },
  'Bãi biển Cửa Lò': { name: 'Mực nhảy', description: 'Mực tươi sống nhúng nước sôi, chấm mù tạt wasabi' },
  'Vũng Tàu': { name: 'Bánh khọt', description: 'Bánh khọt giòn rụm với nhân tôm, ăn kèm rau sống và nước mắm' },
  
  // Núi
  'Sa Pa': { name: 'Lẩu cá hồi', description: 'Lẩu cá hồi Sa Pa với rau cải mèo, nấm và thảo quả' },
  'Fansipan': { name: 'Thắng cố', description: 'Món thắng cố truyền thống của người HMông, nấu từ nội tạng ngựa' },
  'Tam Đảo': { name: 'Su su xào tỏi', description: 'Su su Tam Đảo giòn ngọt, xào với tỏi thơm lừng' },
  'Núi Bà Đen': { name: 'Bánh tráng phơi sương', description: 'Bánh tráng phơi sương Tây Ninh dẻo mềm, cuốn với thịt và rau' },
  'Núi Langbiang': { name: 'Lẩu gà lá é', description: 'Lẩu gà ta nấu với lá é thơm, đặc sản Đà Lạt' },
  'Mẫu Sơn': { name: 'Gà 6 cựa', description: 'Gà 6 cựa Mẫu Sơn quý hiếm, thịt săn chắc và thơm ngon' },
  'Đèo Mã Pí Lèng': { name: 'Cháo ấu tẩu', description: 'Cháo ấu tẩu - món ăn độc đáo của người HMông Hà Giang' },
  'Yên Tử': { name: 'Cơm chay thiền', description: 'Cơm chay thanh đạm với các món đậu hũ, rau củ' },
  'Núi Cấm': { name: 'Gà đốt lá chúc', description: 'Gà đốt với lá chúc thơm, đặc sản vùng Thất Sơn' },
  'Bản Lác Mai Châu': { name: 'Cơm lam', description: 'Cơm nếp nướng trong ống tre, ăn kèm thịt gà hoặc thịt lợn' },
  
  // Thành phố
  'Hà Nội': { name: 'Phở bò', description: 'Phở bò Hà Nội với nước dùng trong, thịt bò tái chín' },
  'TP. Hồ Chí Minh': { name: 'Cơm tấm', description: 'Cơm tấm sườn bì chả với nước mắm pha đặc trưng Sài Gòn' },
  'Đà Nẵng': { name: 'Bún mắm nêm', description: 'Bún mắm nêm với thịt heo luộc, rau sống và mắm nêm đậm đà' },
  'Huế': { name: 'Bún bò Huế', description: 'Bún bò Huế cay nồng với giò heo, thịt bò và mắm ruốc' },
  'Hội An': { name: 'Cao lầu', description: 'Cao lầu với sợi mì vàng đặc trưng, thịt xá xíu và rau sống' },
  'Đà Lạt': { name: 'Bánh tráng nướng', description: 'Bánh tráng nướng "pizza Đà Lạt" với trứng, hành, xúc xích' },
  'Cần Thơ': { name: 'Lẩu mắm', description: 'Lẩu mắm miền Tây với cá, tôm, mực và rau đồng' },
  'Hải Phòng': { name: 'Bánh đa cua', description: 'Bánh đa cua Hải Phòng với gạch cua, chả lá lốt' },
  
  // Nông thôn
  'Làng cổ Đường Lâm': { name: 'Thịt quay đòn', description: 'Thịt lợn quay giòn bì, thơm ngon đặc sản làng cổ' },
  'Làng rau Trà Quế': { name: 'Tam hữu', description: 'Món tam hữu với tôm, thịt và rau Trà Quế tươi ngon' },
  'Bản Cát Cát': { name: 'Cá suối nướng', description: 'Cá suối tươi nướng than, ăn kèm muối ớt' },
  'Làng hoa Sa Đéc': { name: 'Hủ tiếu Sa Đéc', description: 'Hủ tiếu Sa Đéc với sợi mềm dai, nước dùng ngọt thanh' },
  'Làng chài Cửa Vạn': { name: 'Cá nướng than', description: 'Cá biển tươi nướng than hồng, chấm muối tiêu chanh' },
  'Làng gốm Bát Tràng': { name: 'Canh măng mực', description: 'Canh măng nấu mực khô, món ăn truyền thống' },
  'Làng nổi Tân Lập': { name: 'Cá lóc nướng trui', description: 'Cá lóc nướng trui cuốn bánh tráng, rau sống' },
  'Làng cổ Phước Tích': { name: 'Bánh tét Huế', description: 'Bánh tét Huế với nhân đậu xanh, thịt mỡ' },
  'Bản Pom Coọng': { name: 'Lợn mán nướng', description: 'Thịt lợn mán nướng lá chuối, đặc sản Mai Châu' },
  
  // Di tích
  'Quần thể di tích Cố đô Huế': { name: 'Bánh bèo', description: 'Bánh bèo Huế với tôm chấy, hành phi và nước mắm' },
  'Văn Miếu – Quốc Tử Giám': { name: 'Chè sen', description: 'Chè sen Hồ Tây thanh mát, ngọt dịu' },
  'Hoàng thành Thăng Long': { name: 'Bún thang', description: 'Bún thang Hà Nội với trứng, giò, thịt gà xé' },
  'Thánh địa Mỹ Sơn': { name: 'Mì Quảng', description: 'Mì Quảng với tôm, thịt, trứng và bánh tráng' },
  'Địa đạo Củ Chi': { name: 'Khoai mì chấm muối mè', description: 'Khoai mì luộc chấm muối mè, món ăn thời chiến' },
  'Nhà tù Côn Đảo': { name: 'Cháo hàu', description: 'Cháo hàu Côn Đảo bổ dưỡng, thơm ngon' },
  'Khu di tích Pác Bó': { name: 'Xôi ngũ sắc', description: 'Xôi ngũ sắc của người Tày với 5 màu tự nhiên' },
  'Thành Nhà Hồ': { name: 'Nem chua Thanh Hóa', description: 'Nem chua Thanh Hóa chua cay, ăn kèm lá đinh lăng' },
  'Chùa Một Cột': { name: 'Bánh cốm', description: 'Bánh cốm Hà Nội xanh mướt, ngọt thanh' },
  'Dinh Độc Lập': { name: 'Bánh mì Sài Gòn', description: 'Bánh mì Sài Gòn giòn rụm với nhân thịt, pate, rau' }
};

const seedCuisine = async () => {
  console.log('Starting cuisine seed...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let updated = 0;
    let notFound = [];

    for (const [destName, cuisine] of Object.entries(cuisineData)) {
      const result = await Destination.findOneAndUpdate(
        { name: { $regex: destName, $options: 'i' } },
        { cuisine: cuisine },
        { new: true }
      );
      
      if (result) {
        console.log(`✓ Updated: ${result.name} -> ${cuisine.name}`);
        updated++;
      } else {
        notFound.push(destName);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} destinations with cuisine!`);
    
    if (notFound.length > 0) {
      console.log(`\n⚠️ Not found (${notFound.length}):`);
      notFound.forEach(n => console.log(`   - ${n}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

seedCuisine();
