/*
{
  "coord": {
    "lon": -121.94,
    "lat": 37.7
  },
  "weather": [
    {
      "id": 800,
      "main": "Clear",
      "description": "clear sky",
      "icon": "01d"
    }
  ],
  "base": "stations",
  "main": {
    "temp": 294.69,
    "pressure": 1018,
    "humidity": 53,
    "temp_min": 290.15,
    "temp_max": 300.15
  },
  "visibility": 16093,
  "wind": {
    "speed": 3.1,
    "deg": 270
  },
  "clouds": {
    "all": 1
  },
  "dt": 1500573540,
  "sys": {
    "type": 1,
    "id": 409,
    "message": 0.0049,
    "country": "US",
    "sunrise": 1500555757,
    "sunset": 1500607520
  },
  "id": 5344157,
  "name": "Dublin",
  "cod": 200
}
*/
// Constructor
exports = module.exports = function WeatherObj(weatherData){
  this.cityName = weatherData.name;
  this.temperature = {
    min: weatherData.main.temp_min,
    max: weatherData.main.temp_max,
    current: weatherData.main.temp
  };
  this.weather = [];
  for(var i=0; i<weatherData.weather.length){
    this.weather.push({
      main: weatherData.weather[i].main,
      description: weatherData.weather[i].description
    });
  }
  this.solar = {
    sunrise: weatherData.sys.sunrise,
    sunset: weatherData.sys.sunset
  }
  return this;
}
