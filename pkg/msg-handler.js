const { playSong, getNowPlayingInfo, pause, resume } = require("./player");
const { log, outputQueue, sendChannelReplyAndLog, sendChannelMessageAndLog, getRandomCat } = require("./utilities");

const config = require("../config.json");
const allowedTextChannels = config.ALLOWED_TEXT_CHANNELS.split(",");

const fs = require('fs');
require.extensions['.txt'] = function (module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};
const version = require('../version');
const info = require('../text-files/info');
const help = require('../text-files/help');

const prefix = "!"

function handleMessage(servers, server, msg) {
    if (!allowedTextChannels.some(chan => chan === (msg.guild?.channels.find(c => c.id === msg.channel.id).id))) {
        return;
    }

    if (!servers[msg.guild.id]) {
        servers[msg.guild.id] = {
            queue: []
        }
    }
    server = servers[msg.guild.id]

    let args = msg.content.substring(prefix.length).split(" ")
    if (msg.content.startsWith(prefix)) {
        switch(args[0]) {
            case "ping":
                sendChannelMessageAndLog(msg, "pong!", "Responded to ping");
                break;
            case "pl":
            case "play":
                playSong(msg, args, server);
                break;
            case "sk":
            case "skip":
                if (server.dispatcher) {
                    server.dispatcher.end({skip: true});
                }
                sendChannelMessageAndLog(msg, "Skipping song", "Song skipped");
                break;
            case "st":
            case "stop":
                if (msg.guild.voiceConnection) {
                    server.queue = [];
                    server.dispatcher.end({skip: true});
                    sendChannelMessageAndLog(msg, "Stopping playback and purging queue", "Queue purged");
                }
                break;
            case "q":
            case "queue":
                outputQueue(msg, server);
                break;
            case "np":
            case "nowplaying":
                getNowPlayingInfo(msg, server);
                break;
            case "rm":
            case "remove":
                if (!args[1]) {
                    sendChannelMessageAndLog(msg, "Which song should I remove? :thinking:", "Insufficient parameters message sent");
                } else {
                    const index = parseInt(args[1]);
                    console.log(index);
                    if (index <= 0 || isNaN(index)) {
                        sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
                        return;
                    }

                    try {
                        sendChannelMessageAndLog(msg, server.queue.splice(args[1], 1)[0].title + " removed from queue.", "Queue splice notification sent");
                    } catch {
                        sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
                    }
                }
                break;
            case "h":
            case "help":
                msg.author.send(help).then(() => {
                    log(msg, "Sent help message to " + msg.author)
                }, err => {
                    log(msg, "Error: " + err);
                });
                break;
            case "i":
            case "info":
                sendChannelMessageAndLog(msg, info.replace("<<version>>", version.replace("\n", "")), "Sent info block");
                break;
            case "ps":
            case "pause":
                pause(msg, server);
                break;
            case "rs":
            case "resume":
                resume(msg, server);
                break;
            case "pspsps":
                getRandomCat(msg);
                break;
            default:
                sendChannelReplyAndLog(msg, "I don't recognize that command. Try '!help' if you're having trouble.", "Replied to unrecognized command by " + msg.author);
        }
    }
}

module.exports = { handleMessage };
