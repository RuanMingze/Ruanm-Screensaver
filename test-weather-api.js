// 天气API测试脚本
const https = require('https');

// 天气API配置
const API_KEY = '41299d6667c2081a91b532e1eb508853';
const CITY = 'Guangzhou'; // 默认城市为广州

// 构建API请求URL
const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric&lang=zh_cn`;

console.log('正在测试天气API...');
console.log('请求URL:', url);

// 发送HTTP请求
https.get(url, (res) => {
    let data = '';
    
    // 接收数据
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    // 请求完成
    res.on('end', () => {
        try {
            const weatherData = JSON.parse(data);
            
            if (weatherData.cod === 200) {
                console.log('API请求成功!');
                console.log('完整响应数据:');
                console.log(JSON.stringify(weatherData, null, 2));
                
                // 简化输出
                console.log('\n=== 简化天气信息 ===');
                console.log(`城市: ${weatherData.name}`);
                console.log(`温度: ${Math.round(weatherData.main.temp)}°C`);
                console.log(`体感温度: ${Math.round(weatherData.main.feels_like)}°C`);
                console.log(`天气: ${weatherData.weather[0].description}`);
                console.log(`湿度: ${weatherData.main.humidity}%`);
                console.log(`气压: ${weatherData.main.pressure} hPa`);
            } else {
                console.error('API请求失败:', weatherData.message);
            }
        } catch (error) {
            console.error('解析响应数据时出错:', error.message);
        }
    });
}).on('error', (error) => {
    console.error('请求出错:', error.message);
});