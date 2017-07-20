exports = module.exports = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    console.log("session id:"+sessionId);
    console.log("text:"+text);
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart

  setLocation(req){
    console.log("the important one:"+JSON.stringify(req));
    var location = req.entities.location[0].value
    return new Promise(function(resolve, reject){
      var context = {
        location: location
      }
      return resolve(context);
    });
  },

  getWeather(req){
    var sessionId = req.sessionId;
    var recipientId = sessions[sessionId].fbid;
    return new Promise(function (resolve, reject) {
      var context = sessions[sessionId].context;
      console.log("pre getWeather context:"+JSON.stringify(context));
      console.log("getWeather request context:"+JSON.stringify(req.context));
      console.log("entities:"+JSON.stringify(req.entities));
      request("http://api.openweathermap.org/data/2.5/weather?q=" + req.entities.location[0].value + "&APPID=052a8ba39982fe46ea9ec930310db0eb",
        function (error, response, body) {
          var testObj = JSON.parse(body);
          var testWeatherObj = new WeatherObj(testObj);
          var context = {
            weather: testWeatherObj,
            query: req.entities.weather_query[0].value
          }
          return resolve(context);
        });
    })
  },

  sendQuery(req){
    var sessionId = req.sessionId;
    var recipientId = sessions[sessionId].fbid;
    var self = this;
    var weather = req.context.weather;
    return new Promise(function (resolve, reject) {
      var context = req.context;
      var string;
      console.log("THE IMPORTANT THING FOR RIGHT NOW:"+context.query);
      switch(context.query){
        case "temperature":
          string = weather.getTempString();
          break;
        case "sun":
          string = weather.getSunString();
          break;
        case 'weather':
        default:
          string = weather.getWeatherString();
          break;
      }
      self.send({sessionId: sessionId}, {text:string});
      return resolve(context);
    });

  }
};
