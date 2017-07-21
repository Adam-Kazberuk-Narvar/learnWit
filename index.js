'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');

const { Wit, log } = require('node-wit');

// Webserver parameter
const PORT = process.env.PORT || 5000;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_ACCESS_TOKEN;

// Messenger API parameters
const FB_PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN;
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

let FB_VERIFY_TOKEN = null;
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

var WeatherObj = require('./models/weather');

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
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

  getWeather(req){
    var sessionId = req.sessionId;
    var recipientId = sessions[sessionId].fbid;
    return new Promise(function (resolve, reject) {
      var context = sessions[sessionId].context;
      request("http://api.openweathermap.org/data/2.5/weather?q=" + req.context.location[0].value + "&APPID=052a8ba39982fe46ea9ec930310db0eb",
        function (error, response, body) {
          var testObj = JSON.parse(body);
          var testWeatherObj = new WeatherObj(testObj);
          var context = {
            weather: testWeatherObj,
            query: req.context.weather_query[0].value
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
  },

  updateWeatherState(req){
    var sessionId = req.sessionId;
    var recipientId = sessions[sessionId].fbid;
    var self = this;
    var context = req.context;
    var entities = req.entities;
    //entity overwrites context overwrites nothing.
    var weather_query = entities.weather_query || context.weather_query || false;
    if(weather_query){
      context.weather_query = weather_query;
      context.missingQuery = false;
    }
    else{
      context.missingQuery = true;
    }

    var location = entities.location || context.location || false;
    if(location){
      context.location = location;
      context.missingLocation = false;
    }
    else{
      context.missingLocation = true;
    }

    return context;
  }
};

function customContinueRunActions(sessionId, currentRequest, message, prevContext, i){
  return function (json) {
    if (i < 0) {
      console.warn('Max steps reached, stopping.');
      return prevContext;
    }
    if (currentRequest !== _this._sessions[sessionId]) {
      console.warn("currentRequest !== _this._sessions[sessionId]");
      return prevContext;
    }
    if (!json.type) {
      console.error(JSON.stringify(json));
      throw new Error('Couldn\'t find type in Wit response');
    }

    console.log('Context: ' + JSON.stringify(prevContext));
    console.log('Response type: ' + json.type);

    //don't believe this is needed
    // backwards-compatibility with API version 20160516
/*      if (json.type === 'merge') {
      json.type = 'action';
      json.action = 'merge';
    }*/

    if (json.type === 'error') {
      console.error(JSON.stringify(json));
      throw new Error('Oops, I don\'t know what to do.');
    }

    if(json.type === 'stop'){
      console.warn("stopping!");
      return prevContext;
    }

    var request = {
      sessionId: sessionId,
      context: clone(prevContext),
      text: message,
      entities: json.entities
    };

    console.log("we've got some JSON:"+JSON.stringify(json));
    if (json.type === 'msg') {
      console.log("we've got a message!");
      var response = {
        text: json.msg,
        quickreplies: json.quickreplies
      };
      return runAction(actions, 'send', request, response).then(function (ctx) {
        if (ctx) {
          throw new Error('Cannot update context after \'send\' action');
        }
        if (currentRequest !== _this._sessions[sessionId]) {
          console.error("currentRequest !== _this._sessions[sessionId] in send");
          return ctx;
        }
        return _this.converse(sessionId, null, prevContext).then(customContinueRunActions(sessionId, currentRequest, message, prevContext, i - 1));
      });
    } else if (json.type === 'action') {
      return runAction(actions, json.action, request).then(function (ctx) {
        var nextContext = ctx || {};
        if (currentRequest !== _this._sessions[sessionId]) {
          console.error("currentRequest !== _this._sessions[sessionId] in action");
          return nextContext;
        }
        return _this.converse(sessionId, null, nextContext).then(customContinueRunActions(sessionId, currentRequest, message, nextContext, i - 1));
      });
    } else {
      logger.debug('unknown response type ' + json.type);
      throw new Error('unknown response type ' + json.type);
    }

  }
}

function customRunActions(sessionId, message, context, maxSteps){
  console.log("now what is this? " + JSON.stringify(this));
  //there is a check to make sure actions exist, where does that var come from?
  console.log("Checking to make sure there are actions:"+JSON.stringify(this.config.actions));
  if(!this.config.actions){
    console.error("no actions");
    throw NoActionError;
  }
  var defaultMaxSteps = 5;
  var steps = maxSteps ? maxSteps : defaultMaxSteps; //default max 5;

  var currentRequest = (this._sessions[sessionId] || 0) + 1;
  this._sessions[sessionId] = currentRequest;
  var cleanup = function cleanup(ctx) {
    //delete if it's the last step?
    console.log("cleanup current:"+JSON.stringify(currentRequest));
    console.log("this2 sessions:"+JSON.stringify(_this2._sessions[sessionId]));
    if (currentRequest === _this2._sessions[sessionId]) {
      delete _this2._sessions[sessionId];
    }
    return ctx;
  };
  return this.converse(sessionId, message, context, currentRequest > 1).then(customContinueRunActions(sessionId, currentRequest, message, context, steps)).then(cleanup);
}


// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message








/*            wit.converse(sessionId, text, {})
              .then((response) => {
                console.log('Wit.ai response (special converse log look at me look at me):\n' + JSON.stringify(response));
              })*/








            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            console.log("Those important things:"+JSON.stringify(wit));
            customRunActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).bind(wit).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');
