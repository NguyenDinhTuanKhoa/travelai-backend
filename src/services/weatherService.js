const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

const weatherService = {
  // Get current weather by coordinates
  async getCurrentWeather(lat, lng) {
    try {
      const response = await fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`
      );
      const data = await response.json();
      
      if (data.cod !== 200) {
        throw new Error(data.message);
      }

      return {
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        iconUrl: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        cityName: data.name
      };
    } catch (error) {
      console.error('Weather API Error:', error.message);
      return null;
    }
  },

  // Get 5-day forecast by coordinates
  async getForecast(lat, lng) {
    try {
      const response = await fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`
      );
      const data = await response.json();

      if (data.cod !== '200') {
        throw new Error(data.message);
      }

      // Group by day and get daily summary
      const dailyForecasts = {};
      data.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!dailyForecasts[date]) {
          dailyForecasts[date] = {
            date,
            temps: [],
            icons: [],
            descriptions: []
          };
        }
        dailyForecasts[date].temps.push(item.main.temp);
        dailyForecasts[date].icons.push(item.weather[0].icon);
        dailyForecasts[date].descriptions.push(item.weather[0].description);
      });

      // Convert to array and calculate daily averages
      return Object.values(dailyForecasts).slice(0, 5).map(day => ({
        date: day.date,
        tempMin: Math.round(Math.min(...day.temps)),
        tempMax: Math.round(Math.max(...day.temps)),
        icon: day.icons[Math.floor(day.icons.length / 2)], // Get midday icon
        iconUrl: `https://openweathermap.org/img/wn/${day.icons[Math.floor(day.icons.length / 2)]}@2x.png`,
        description: day.descriptions[Math.floor(day.descriptions.length / 2)]
      }));
    } catch (error) {
      console.error('Forecast API Error:', error.message);
      return null;
    }
  }
};

module.exports = weatherService;
