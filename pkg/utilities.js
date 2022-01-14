const fetch = require('node-fetch');
const randomFrog = require('random-frog')

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

function convertSecondsToMinutes(seconds) {
    return parseInt(seconds / 60) + " minutes, " + parseInt(seconds % 60) + " seconds";
}

function sendChannelMessageAndLog(msg, channelMessage, logMessage) {
    msg.channel.send(channelMessage);
    log(logMessage, msg);
}

function sendChannelReplyAndLog(msg, replyMessage, logMessage) {
    msg.reply(replyMessage);
    log(logMessage, msg);
}

function log(logMessage, msg) {
    const now = new Date();
    msg ?
        console.log(now + " - " + msg + " - " + logMessage) :
        console.log(now + " - " + logMessage);
}

function outputQueue(msg, server) {
    if (server.queue.length === 0) {
        sendChannelMessageAndLog(msg, "This shit empty, YEET!", "queue information sent");
    } else {
        const queueReply = server.queue.map(
            function(i) {
                return (server.queue.indexOf(i) + ". " + i.title);
            }
        );
        queueReply[0] = ":point_right: " + server.queue[0].title + (server.dispatcher.paused ? " (Paused)" : " (Now playing)");
        sendChannelMessageAndLog(msg, queueReply, "queue information sent");
    }
}

async function getRandomCat(msg) {
    const { file } = await fetch('https://aws.random.cat/meow').then(response => response.json());
    await msg.channel.send({
        files: [{
            attachment: file
        }]
    });
}

async function getRandomDog(msg) {
    await fetch('https://dog.ceo/api/breeds/image/random').then(
        response => response.json()
    ).then(
        data => {
            msg.channel.send({files: [data.message]});
        }
    )
}

module.exports = {
    isValidHttpUrl,
    convertSecondsToMinutes,
    log,
    outputQueue,
    sendChannelReplyAndLog,
    sendChannelMessageAndLog,
    getRandomCat,
    getRandomDog
}
