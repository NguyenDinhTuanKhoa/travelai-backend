const axios = require('axios');

async function testKey() {
  const key = '479d724c77450b0ec97fb259a68d135db6ff4f18';
  try {
    const response = await axios.post('https://google.serper.dev/images', {
      q: 'test',
      gl: 'vn',
      hl: 'vi',
      num: 1
    }, {
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json'
      }
    });
    console.log('Key is valid!', response.data.images ? response.data.images.length : 0, 'images found');
  } catch (error) {
    console.error('Key error:', error.response ? error.response.data : error.message);
  }
}
testKey();
