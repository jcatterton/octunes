const { playSong, getNowPlayingInfo, pause, resume, shuffleQueue, bumpSong, swapSongs, move, stop, outputQueue } = require("./player");
const { log, sendChannelReplyAndLog, sendChannelMessageAndLog, getRandomCat, getRandomDog, getRandomFrog, getRandomFarmAnimal, getRandomOctopus, getRandomDinosaur, getRandomCapybara } = require("./utilities");
const { runTests } = require("./tests");

const config = require("../config.json");
const allowedTextChannels = config.ALLOWED_TEXT_CHANNELS.split(",");
const spotifyRefreshToken = config.SPOTIFY_REFRESH_TOKEN;
const spotifyAuth = config.SPOTIFY_AUTH;

const fs = require('fs');
require.extensions['.txt'] = function (module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};
const version = require('../version');
const info = require('../text-files/info');
const help = require('../text-files/help');

const prefix = "!"

function handleMessage(bot, servers, server, msg) {
    if (msg.channel.type === "dm") {
        handleDirectMessage(bot, servers, server, msg);
    }

    if (!allowedTextChannels.some(chan => chan === (msg.channel.id))) {
        return;
    }

    if (msg.content.startsWith(prefix)) {
        sendChannelMessageAndLog(msg, "Octunes now supports slash commands! My commands should appear automatically if you type '/', you can also try '/help' for a full list of commands.")
    }

    /*if (!servers[msg.guild.id]) {
        servers[msg.guild.id] = {
            queue: [],
            mix: [],
            mixIndex: -1
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
                playSong(bot, msg, args, server, false);
                break;
            case "m":
            case "mix":
                playSong(bot, msg, args, server, true);
                break;
            case "sk":
            case "skip":
                if (server.dispatcher) {
                    server.dispatcher.emit("skip");
                } else {
                    sendChannelMessageAndLog(msg, "There isn't anything playing. :thinking:", "cannot skip if nothing is playing");
                }
                break;
            case "st":
            case "stop":
                stop(msg, bot, server, msg.guild.id);
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
            case "ding":
                if (msg.author.id === "230081914776715264") {
                    msg.channel.send("Fuck you, Moss");
                } else {
                    msg.channel.send("dong!")
                }
                break;
            case "yo":
                const r = Math.random();
                if (r <= 0.2) {
                    msg.reply("Yo!")
                } else if (r <= 0.4) {
                    msg.reply("Yooooo")
                } else if (r <= 0.6) {
                    msg.reply("YOOOO!")
                } else if (r <= 0.8) {
                    msg.reply("yooo...")
                } else {
                    msg.reply("YOOOOoooooooo")
                }
                break;
            case "shuffle":
            case "sh":
                shuffleQueue(server, msg);
                break;
            case "bump":
            case "b":
                bumpSong(msg, server, args[1])
                break;
            case "swap":
            case "sw":
                swapSongs(msg, server, args[1], args[2]);
                break;
            case "move":
            case "mv":
                move(msg, server, args[1], args[2]);
                break;
            case "pspsps":
                getRandomCat(msg);
                break;
            case "woof":
                getRandomDog(msg);
                break;
            case "ribbit":
                getRandomFrog(msg);
                break;
            case "eieio":
                getRandomFarmAnimal(msg);
                break;
            case "octo":
                getRandomOctopus(msg);
                break;
            case "rawr":
                getRandomDinosaur(msg);
                break;
            case "capybara":
                getRandomCapybara(msg);
                break;
            case "test":
                if (msg.author.id === "316005270423732227") {
                    runTests(msg, bot);
                }
                break;
            default:
                sendChannelReplyAndLog(msg, "I don't recognize that command. Try '!help' if you're having trouble.", "Replied to unrecognized command by " + msg.author);
        }
    }*/
}

function handleDirectMessage(bot, servers, server, msg) {
    if (msg.author.id === "316005270423732227") {
        let args = msg.content.substring(prefix.length).split(" ")
        if (msg.content.startsWith(prefix)) {
            switch (args[0]) {
                case "sendChannelMessage":
                    const channelId = args[1];
                    if (!allowedTextChannels.some(chan => chan === (channelId))) {
                        return;
                    }

                    args.shift();
                    args.shift();

                    bot.channels.cache.get(channelId).send(args.join(" ")).then(() => {
                        log("sent message", msg);
                    }, err => {
                        log("error sending message: " + err, msg);
                    });
                    break;
                case "serverInfo":
                    const serverID = args[1];

                    if (bot.guilds.cache.get(serverID).channels.cache.map(function(chan) {
                        return (allowedTextChannels.some(c => c === chan.id))
                    }).some(a => a === true)) {

                    } else {
                        return;
                    }

                    const m = bot.guilds.cache.get(serverID).channels.cache.map(function(chan) {
                        return (chan.name + " " + chan.type + " " + chan.id);
                    });
                    msg.author.send(m).then(() => {
                        console.log(m);
                        log("dm sent", msg);
                    }, err => {
                        log("error sending dm: " + err, msg);
                    });
            }
        }
    }
}

module.exports = { handleMessage };
