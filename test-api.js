const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing API...');
    
    // 测试随机壁纸API
    console.log('Testing random wallpaper API...');
    const response1 = await axios.get('https://wp.upx8.com/api.php');
    console.log('Random wallpaper response:', response1.data);
    
    // 测试关键词壁纸API
    console.log('Testing keyword wallpaper API...');
    const response2 = await axios.get('https://wp.upx8.com/api.php?content=风景');
    console.log('Keyword wallpaper response:', response2.data);
    
  } catch (error) {
    console.error('API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

testAPI();