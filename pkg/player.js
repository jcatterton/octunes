const { isValidHttpUrl, log, convertSecondsToMinutes, sendChannelMessageAndLog } = require("./utilities");

const ytSearch = require("yt-search");
const ytdl = require("ytdl-core");

const config = require("../config.json");
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");

let startTimeOfCurrentSong;
let nowPlaying;
let pauseStartTime;
let timeSpentPaused;

function playSong(bot, msg, args, server) {
    if (!args[1]) {
        msg.channel.send("Play what? :thinking:")
        return;
    }

    if (!msg.member) {
        sendChannelMessageAndLog(msg, "You need to be in a voice channel to listen to music, ya dingus!", "Sent message to " + msg.member.name);
        return;
    }

    if (!allowedVoiceChannels.some(c => c === msg.member.voice.channelID)) {
        sendChannelMessageAndLog(msg, "I'm not allowed to join the channel you're in. :(", "Sent message to " + msg.member.name);
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
                addToQueue(bot, msg, server, response.videos[0].url);
            }, err => {
                sendChannelMessageAndLog(msg, "Uh oh! Looks like I experienced an error while trying to search YouTube. Try again, it's probably nothing... maybe", "Error conduction search: " + err);
            }
        );
    } else {
        addToQueue(bot, msg, server, songLink);
    }
}

function addToQueue(bot, msg, server, songLink) {
    ytdl.getInfo(songLink).then(
        response => {
            if (Math.random() <= 0.01) {
                server.queue.push(
                    {
                        "title": response.videoDetails.title,
                        "runTime": response.videoDetails.lengthSeconds,
                        "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        "length": response.videoDetails.lengthSeconds,
                        "live": false,
                        "formats": response.formats
                    }
                );
            } else {
                server.queue.push(
                    {
                        "title": response.videoDetails.title,
                        "runTime": response.videoDetails.lengthSeconds,
                        "link": songLink,
                        "length": response.videoDetails.lengthSeconds,
                        "live": response.videoDetails.isLiveContent,
                        "formats": response.formats
                    }
                );
            }

            if (server.queue.length > 1) {
                if (server.queue.slice(0, -1).some(s => s.live)) {
                    const reply = "Song added to queue. One of the songs in queue is a livestream so there is no estimated time until played."
                    sendChannelMessageAndLog(msg, reply, "Song added to queue");
                } else {
                    let totalQueueLength = 0;
                    for (let i = 1; i < server.queue.length - 1; i++) {
                        totalQueueLength += parseInt(server.queue[i].runTime, 10);
                    }
                    totalQueueLength += (server.queue[0].length - (Date.now() - startTimeOfCurrentSong) / 1000);

                    const reply = (server.queue[server.queue.length - 1].title + " added to queue. There are " +
                        "currently " + (server.queue.length - 1) + " songs ahead of it, and it will play in approximately " +
                        convertSecondsToMinutes(totalQueueLength));

                    sendChannelMessageAndLog(msg, reply, "Song added to queue");
                }
            } else {
                sendChannelMessageAndLog(msg, "Now playing " + server.queue[0].title, "Now playing song");
                nowPlaying = server.queue[0];
            }

            if (bot.voice.connections.size === 0) {
                bot.channels.cache.get(msg.member.voice.channelID).join().then(function(connection) {
                    play(connection, msg, server);
                }, err => {
                    log("Error joining voice channel: " + err, null);
                });
            }
        }, err => {
            sendChannelMessageAndLog(msg, "I encountered an error getting info on that song. Try again, it's probably nothing... maybe", "Error adding to queue: " + err);
        }
    )
}

function play(connection, msg, server) {
    timeSpentPaused = 0;

    const stream = () => {
        if (server.queue[0].live) {
            const format = ytdl.chooseFormat(server.queue[0].formats, { quality: [128,127,120,96,95,94,93] });
            return format.url;
        } else {
            return ytdl(server.queue[0].link, { filter: "audioonly", quality: "highestaudio", highWaterMark: 1 << 25});
        }
    }
    server.dispatcher = connection.play(stream());

    startTimeOfCurrentSong = Date.now();

    server.dispatcher.on("finish", () => {
        shiftQueue(connection, msg, server);
    });

    server.dispatcher.on("error", err => {
       shiftQueue(connection, msg, server);
       sendChannelMessageAndLog(msg, "Error during playback", "Error occurred during playback: " + err);
       console.trace();
    });

    server.dispatcher.player.on("error", err => {
        shiftQueue(connection, msg, server);
        sendChannelMessageAndLog(msg, "Error during playback", "Error occurred during playback: " + err);
        console.trace();
    });
}

function shiftQueue(connection, msg, server) {
    server.queue.shift();
    if (server.queue[0]) {
        nowPlaying = server.queue[0];
        play(connection, msg, server);
    } else {
        nowPlaying = null;
        connection.disconnect();
        sendChannelMessageAndLog(msg, "Playback finished", "playback finished");
    }
}

function getNowPlayingInfo(msg, server) {
    if (!nowPlaying) {
        sendChannelMessageAndLog(msg, "There isn't anything playing. :thinking:", "nowplaying information sent");
        return;
    }

    const reply = () => {
        if (!server.queue[0].live) {
            return "Currently " + (server.dispatcher.paused ? "paused " : "playing ") + nowPlaying.link + ", length is: " + convertSecondsToMinutes(nowPlaying.length) + " remaining time is: " + convertSecondsToMinutes(getRemainingTime(server));
        } else {
            return "Current livestreaming " + nowPlaying.link;
        }
    }
    sendChannelMessageAndLog(msg, reply(), "nowplaying information sent");
}

function getRemainingTime(server) {
    if (server.dispatcher.paused) {
        return nowPlaying.length - ((pauseStartTime - startTimeOfCurrentSong)/1000) + timeSpentPaused;
    } else {
        return nowPlaying.length - ((Date.now() - startTimeOfCurrentSong)/1000) + timeSpentPaused;
    }
}

function pause(msg, server) {
    if (!server.dispatcher || !nowPlaying) {
        sendChannelMessageAndLog(msg, "I can't pause if there isn't anything playing :thinking:", "Attempted to pause, but nothing was playing");
        return;
    }
    if (server.dispatcher.paused) {
        sendChannelMessageAndLog(msg, "Already paused!", "Attempted to pause, but already paused");
        return;
    }

    server.dispatcher.pause();
    pauseStartTime = Date.now();

    sendChannelMessageAndLog(msg, "Playback paused", "playback paused");
}

function resume(msg, server) {
    if (!server.dispatcher || !nowPlaying) {
        sendChannelMessageAndLog(msg, "I can't resume if there isn't anything playing :thinking:", "Attempted to resume, but nothing was playing");
        return;
    }
    if (!server.dispatcher.paused) {
        sendChannelMessageAndLog(msg, "I can't resume if the song isn't paused!", "Attempted to resume, but song wasn't paused");
        return;
    }

    // Kind of weird but for some reason in this version of DiscordJS on this version of Node you have to call pause and resume again to actually resume
    server.dispatcher.resume();
    server.dispatcher.pause();
    server.dispatcher.resume();

    timeSpentPaused = timeSpentPaused + ((Date.now() - pauseStartTime)/1000);

    sendChannelMessageAndLog(msg, "Playback resumed", "playback resumed");
}

module.exports = { playSong, getNowPlayingInfo, pause, resume };
