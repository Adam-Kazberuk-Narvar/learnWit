var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var WeatherSchema = new Schema({
  user_id: {type: String},
  coord_lat: {type: String},
  coord_long: {type: String},
  temp: {type: String},
  temp_min: {type: String},
  temp_max: {type: String},
  pressure: {type: String},
  humidity: {type: String},
  visibility: {type: String},
  wind_speed: {type: String},
  wind_deg: {type: String},
  clouds: {type: String},
  sunrise: {type: String},
  sunset: {type: String},
  name: {type: String}
});

module.exports = mongoose.model("Weather", MovieSchema);
