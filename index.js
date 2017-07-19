var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

var Weather = require('./models/weather');

var db = mongoose.connect(process.env.MONGODB_URI);

var witApi = require('./wit/wit');

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
    res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function(entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.postback) {
                    processPostback(event);
                } else if (event.message) {
                    processMessage(event);
                }
            });
        });

        res.sendStatus(200);
    }
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function(error, response, body) {
            var greeting = "";
            if (error) {
                console.log("Error getting user's name: " +  error);
            } else {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                greeting = "Hi " + name + ". ";
            }
            var message = greeting + "My name is SP Movie Bot. I can tell you various details regarding movies. What movie would you like to know about?";
            sendMessage(senderId, {text: message});
        });
    } else if (payload === "Correct") {
        sendMessage(senderId, {text: "Awesome! What would you like to find out? Enter 'plot', 'date', 'runtime', 'director', 'cast' or 'rating' for the various details."});
    } else if (payload === "Incorrect") {
        sendMessage(senderId, {text: "Oops! Sorry about that. Try using the exact title of the movie"});
    }
}

function processMessage(event) {
    if (!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;

        console.log("Received message from senderId: " + senderId);
        console.log("Event is: " + JSON.stringify(event));

        // You may get a text or attachment but not both
        witApi.getResponse(event)
          .then(function(res){
            console.log("IMPORTANT RES:"+res);
          })
        if (message.text) {
            var formattedMsg = message.text.toLowerCase().trim();

            // If we receive a text message, check to see if it matches any special
            // keywords and send back the corresponding movie detail.
            // Otherwise search for new movie.
            switch (formattedMsg) {
                case "coord_lat":
                case "coord_long":
                    getWeatherDetail(senderId, formattedMsg);
                    break;

                default:
                  findWeather(senderId, formattedMsg);
            }
        } else if (message.attachments) {
            sendMessage(senderId, {text: "Sorry, I don't understand your request."});
        }
    }
}

// sends message to user
function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
}


function findWeather(userId, cityName) {
  request("http://api.openweathermap.org/data/2.5/weather?q=" + cityName + "&APPID=052a8ba39982fe46ea9ec930310db0eb",
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
            var weatherObj = JSON.parse(body);
            var query = {user_id: userId};

            var update = {
              user_id: userId,
              coord_lat: weatherObj.coord.lat,
              coord_long: weatherObj.coord.lon,
              temp: weatherObj.main.temp,
              temp_min: weatherObj.main.temp_min,
              temp_max: weatherObj.main.temp_max,
              pressure: weatherObj.main.pressure,
              humidity: weatherObj.main.humidity,
              visibility: weatherObj.visibility,
              wind_speed: weatherObj.wind.speed,
              wind_deg: weatherObj.wind.deg,
              clouds: weatherObj.clouds.all,
              sunrise: weatherObj.sys.sunrise,
              sunset: weatherObj.sys.sunset,
              name: weatherObj.name
            }

            var options = {upsert: true};
            Weather.findOneAndUpdate(query, update, options, function(err, weatherInfo) {
                if (err) {
                    console.log("Database error: " + err);
                } else {
                    message = {
                        attachment: {
                            type: "template",
                            payload: {
                                template_type: "generic",
                                elements: [{
                                    title: weatherObj.name,
                                    subtitle: "Is this the city you are looking for?",
                                    buttons: [{
                                        type: "postback",
                                        title: "Yes",
                                        payload: "Correct"
                                    }, {
                                        type: "postback",
                                        title: "No",
                                        payload: "Incorrect"
                                    }]
                                }]
                            }
                        }
                    };
                    sendMessage(userId, message);
                }
            });
        } else {
            sendMessage(userId, {text: "Something went wrong findWeather. Try again."});
        }
    });
}

function getWeatherDetail(userId, field) {
    Weather.findOne({user_id: userId}, function(err, weather) {
        if(err) {
            sendMessage(userId, {text: "Something went wrong getWeatherDetail. Try again"});
        } else {
            sendMessage(userId, {text: weather[field]});
        }
    });
}
