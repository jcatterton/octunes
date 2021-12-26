const discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const config = require('./config.json');

const bot = new discord.Client();
const prefix = "!"
const token = config.TOKEN;
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");
const allowedTextChannels = config.ALLOWED_TEXT_CHANNELS.split(",");

let servers = {};
let server;
let startTimeOfCurrentSong;

bot.on('ready', () => {
    console.log("bot is online");
})

bot.on('message', msg => {
    if (!allowedTextChannels.some(chan => chan === (msg.guild?.channels.find(c => c.id === msg.channel.id).name))) {
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
                msg.channel.send("pong!").then(() => {
                    log(msg, "Responded to ping")
                }, err => {
                    log(msg, "Error: " + err);
                });
                break;
            case "play":
                playSong(msg, args);
                break;
            case "skip":
                if (server.dispatcher) {
                    server.dispatcher.end();
                }
                msg.channel.send("Skipping song").then(() => {
                    log(msg, "Song skipped");
                }, err => {
                    log(msg, "Error: " + err);
                });
                break;
            case "stop":
                if (msg.guild.voiceConnection) {
                    server.queue = [];
                    server.dispatcher.end();
                    msg.channel.send("Stopping playback and purging queue").then(() => {
                        log(msg, "Queue purged");
                    }, err => {
                        log(msg, "Error: " + err);
                    });
                }
                break;
            case "queue":
                outputQueue(msg);
                break;
            case "nowplaying":
                msg.channel.send("Currently playing " + server.queue[0].link + ", length is: " + convertSecondsToMinutes(server.queue[0].length) + " remaining time is: " + convertSecondsToMinutes(server.queue[0].length - ((Date.now() - startTimeOfCurrentSong)/1000))).then(() => {
                    log(msg, "nowplaying information sent");
                }, err => {
                    log(msg, "Error: " + err);
                });
                break;
            case "remove":
                if (!args[1]) {
                    msg.channel.send("Which song should I remove? :thinking:").then(() => {
                        log(msg, "Insufficient parameters message sent");
                    }, err => {
                        log(msg, "Error: " + err);
                    });
                } else {
                    try {
                        msg.channel.send(server.queue.splice(args[1], 1)[0].title + " removed from the queue.").then(() => {
                            log(msg, "Queue splice notification sent");
                        }, err => {
                            log(msg, "Error: " + err);
                        });
                    } catch {
                        msg.channel.send("Invalid index provided. Learn you count, ya dingus.").then(() => {
                            log(msg, "Invalid index indication initiated");
                        }, err => {
                            log(msg, "Error: " + err);
                        });
                    }
                }
                break;
            case "help":
                helpOptions(msg);
                break;
            case "info":
                msg.channel.send("I am Octunes™, Discord music bot developed by Sovaros™.\n\nI'm a capable of playing a direct link from YouTube, or searching YouTube for a video based on provided keywords. Try typing '!help' for more information on my commands.\n\nOctunes was written in Javascript, Sovaros 2020 All Rights Reserved... or something like that.").then(() => {
                    log(msg, "Sent info block");
                }, err => {
                    log(msg, "Error: " + err);
                });
                break;
            default:
                msg.reply("I don't recognize that command. Try '!help' if you're having trouble.").then(() => {
                    log(msg, "Replied to unrecognized command by " + msg.author);
                }, err => {
                    log(msg, "Error: " + err);
                });
        }
    }
})

bot.login(token);

function helpOptions(msg) {
    const response = `Octunes help menu\n\nAll commands must start with '!'\n\nCommands:\n- !play {link} - Plays song from provided youtube link.\n- !play {keywords} - Searches youtube based on your keywords and plays first result.\n- !skip - Skips currently playing song\n- !stop - Stops playback and removes songs from queue\n- !queue - Lists the current queue of songs\n- !nowplaying - States the currently playing song\n- !remove {index} - Removes a song from the queue, use the index provided by the !queue operation.\n\nAny bugs? Tell Sova!`

    msg.author.send(response).then(() => {
        log(msg, "Sent help message to " + msg.author)
    }, err => {
        log(msg, "Error: " + err);
    });
}

function playSong(msg, args) {
    if (!args[1]) {
        msg.channel.send("Play what? :thinking:")
        return;
    }

    if (!msg.member.voiceChannel) {
        msg.member.send("You need to be in a void channel to listen to music, ya dingus!").then(() => {
            log(msg, "Sent message to " + msg.member.name);
        }, err => {
            log(msg, "Error: " + err);
        });
        return;
    }

    if (!allowedVoiceChannels.some(c => c === msg.member.voiceChannel.name)) {
        msg.member.send("I'm not allowed to join the channel you're in. :(").then(() => {
            log(msg, "Sent message to " + msg.member.name);
        }, err => {
            log(msg, "Error: " + err);
        });
        return;
    }

    let songLink = args[1]
    if (!isValidHttpUrl(songLink)) {
        let query = "";
        for (let i = 1; i < args.length; i++) {
            query = query + args[i];
        }
        ytSearch.search(query).then(
            response => {
                addToQueue(msg, response.videos[0].url);
            }, err => {
                console.log("Error conducting search: " + err);
            }
        );
    } else {
        addToQueue(msg, songLink);
    }
}

function addToQueue(msg, songLink) {
    ytdl.getInfo(songLink).then(
        response => {
            if (Math.random() <= 0.01) {
                server.queue.push(
                    {
                        "title": response.videoDetails.title,
                        "runTime": response.videoDetails.lengthSeconds,
                        "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        "length": response.videoDetails.lengthSeconds
                    }
                );
            } else {
                server.queue.push(
                    {
                        "title": response.videoDetails.title,
                        "runTime": response.videoDetails.lengthSeconds,
                        "link": songLink,
                        "length": response.videoDetails.lengthSeconds
                    }
                );
            }

            if (server.queue.length > 1) {
                let totalQueueLength = 0;
                for (let i = 1; i < server.queue.length - 1; i++) {
                    totalQueueLength += parseInt(server.queue[i].runTime, 10);
                }
                totalQueueLength += (server.queue[0].length - (Date.now() - startTimeOfCurrentSong)/1000);

                const reply = (server.queue[server.queue.length - 1].title + " added to queue. There are " +
                    "currently " + (server.queue.length - 1) + " songs ahead of it, and it will play in approximately " +
                    convertSecondsToMinutes(totalQueueLength));

                msg.channel.send(reply);
            } else {
                msg.channel.send("Now playing " + server.queue[0].title);
            }

            if (!msg.guild.voiceConnection) {
                msg.member.voiceChannel.join().then(function(connection) {
                    play(connection, msg, server);
                }, err => {
                    log(msg, "Error joining voice channel: " + err);
                });
            }
        }, err => {
            console.log("Error adding to queue: " + err);
        }
    )
}

function play(connection, msg, server) {
    server.dispatcher = connection.playStream(ytdl(server.queue[0].link, { filter: "audioonly"}));
    startTimeOfCurrentSong = Date.now();
    server.dispatcher.on("end", function() {
        if (parseInt((Date.now() - startTimeOfCurrentSong)/1000) < parseInt(server.queue[0].length)) {
            log(msg, server.queue[0].title + " ended after " + convertSecondsToMinutes((Date.now() - startTimeOfCurrentSong)/1000) + ", but length should have been " + convertSecondsToMinutes(server.queue[0].length));
        }
        server.queue.shift();
        if(server.queue[0]) {
            play(connection, msg, server);
        } else {
            connection.disconnect();
            log(msg, "Playback finished");
        }
    });
}

function outputQueue(msg) {
    if (server.queue.length === 0) {
        msg.channel.send("This shit empty, YEET!")
    } else {
        const queueReply = server.queue.map(
            function(i) {
                return (server.queue.indexOf(i) + ". " + i.title);
            }
        );
        queueReply[0] = ":point_right: " + server.queue[0].title + " (Now playing)"
        msg.channel.send(queueReply);
    }
}

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

function log(msg, logMessage) {
    const now = new Date();
    console.log(now + " - " + msg + " - " + logMessage);
}
