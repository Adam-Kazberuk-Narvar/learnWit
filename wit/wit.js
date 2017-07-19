/* jshint node: true, devel: true */
'use strict';
const config   = require('config');
const rightNow = new Date().toISOString();

const WIT_ACCESS_TOKEN = process.env.WIT_ACCESS_TOKEN;

/*
 *
 * WIT.AI
 *
 */
const { Wit, log } = require('node-wit');
var context = {};
const session = 'my-user-session-42';
const context0 = {};

// Contains user sessions.
// Each session has an entry:
const sessions = {};


let findOrCreateSession = (roomId) => {
    let sessionId;
    console.log('creating session for: ', roomId);
    // Check if session exists for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].room === roomId) {
            // Yes
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for given ID, create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {
            room: roomId,
            access_token: 'none'
        };
    }
    return sessionId;
};


// WIT.ai init for production
const wit = new Wit({
    accessToken: WIT_ACCESS_TOKEN,
    // actions,
    logger: new log.Logger(log.INFO)
});

const  message = function(msg) {

    return new Promise((resolve, reject) => {

        let sessionId = findOrCreateSession(msg.uuid);
        let messageText = msg.message.text;

        wit.message(mssageText, msg.context, {})
            .then((data) => {
                console.log('Wit.ai response: ' + JSON.stringify(data));
                data.original_msg = msg;
                resolve(data);
            })
            .catch(function(error){
                reject(error);
            });
    });
}


const getResponse = function(data) {

    return new Promise(function (resolve, reject) {

        // var sessionId = findOrCreateSession(msg.uuid);
        let messageText = data.message.text;
        let sessionID   = rightNow; //msg.session_id;

        wit.converse(sessionID, messageText, {})
            .then((response) => {
                console.log('Wit.ai response: ' + JSON.stringify(data));
                response.original_msg = data;
                response.room = data.room;
                response.socket_id = data.socket_id;
                response.assist_channel = data.assist_channel;
                response.nlp = 'wit';
                response.session_id = data.session_id;
                resolve(response);
            })
            .catch((error) => {
//                logger.error('WIT Error: ', error);
                reject(error);
            });

    });
}

const API = {
    getResponse
}

module.exports = API;
