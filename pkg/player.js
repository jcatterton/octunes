const { isValidHttpUrl, log, convertSecondsToMinutes, sendChannelMessageAndLog } = require("./utilities");

const ytSearch = require("yt-search");
const ytdl = require("ytdl-core");

const config = require("../config.json");
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");

let startTimeOfCurrentSong;
let nowPlaying;
let pauseStartTime;
let timeSpentPaused;
let startingTimestamp;

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
                    totalQueueLength += (server.queue[0].length - (Date.now() - startTimeOfCurrentSong) / 1000) - startingTimestamp;

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
    // ts is undefined if there is no timestamp
    const ts = checkForTimestamp(server.queue[0].link);

    if (!ts) {
        startingTimestamp = 0;
    } else {
        startingTimestamp = ts;
    }
    timeSpentPaused = 0;

    const stream = () => {
        if (server.queue[0].live) {
            const format = ytdl.chooseFormat(server.queue[0].formats, { quality: [128,127,120,96,95,94,93] });
            return format.url;
        } else {
            return ytdl(server.queue[0].link, {
                filter: "audioonly",
                quality: "highestaudio",
                highWaterMark: 1 << 25
            });
        }
    }
    server.dispatcher = connection.play(stream(), { seek: (ts && !isNaN(ts)) ? ts : 0 });

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
            return "Currently " + (server.dispatcher.paused ? "paused " : "playing ") + nowPlaying.link + ", length is: " + convertSecondsToMinutes(nowPlaying.length) + " remaining time is: " + convertSecondsToMinutes(getRemainingTime(server) - startingTimestamp);
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

function checkForTimestamp(link) {
    let ts = link.split("t=")[1];

    if (!ts) {
        return ts;
    }

    ts = ts.replaceAll("M", "m");
    ts = ts.replaceAll("S", "s");

    if (ts.includes("m")) {
        const m = ts.split("m")[0];
        let s = ts.split("m")[1];

        if (s.endsWith("s")) {
            s = s.substring(0, s.length - 1);
        }

        ts = parseInt(m) * 60 + (s.length ? parseInt(s) : 0);
    } else {
        if (ts.endsWith("s")) {
            ts = parseInt(ts.substring(0, ts.length - 1));
        } else {
            ts = parseInt(ts);
        }
    }

    console.log(ts);
    return ts;
}

function shuffleQueue(server, msg) {
    if (!server.queue) {
        sendChannelMessageAndLog(msg, "Can't shuffle an empty queue :thinking:", "Attempted to shuffle empty queue");
        return;
    }

    if (server.queue.length === 1) {
        sendChannelMessageAndLog(msg, "There is nothing in the queue except the song playing, I can't shuffle.", "Attempted to shuffle queue of one");
        return;
    }

    if (server.queue.length === 2) {
        sendChannelMessageAndLog(msg, "There is only one pending song, I can't shuffle.", "Attempted to shuffle queue of two");
        return;
    }

    const pendingSongs = server.queue.slice(1);
    server.queue = [server.queue[0]];

    for (let i = pendingSongs.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = pendingSongs[i];
        pendingSongs[i] = pendingSongs[j];
        pendingSongs[j] = temp;
    }

    for (let s of pendingSongs) {
        server.queue.push(s);
    }

    sendChannelMessageAndLog(msg, "Shuffled queue!", "shuffled queue");
}

function bumpSong(msg, server, ind) {
    if (!ind) {
        sendChannelMessageAndLog(msg, "Which song should I bump? :thinking:", "Insufficient parameters message sent");
    } else {
        const index = parseInt(ind);
        if (index <= 0 || isNaN(index) || index > server.queue.length - 1) {
            sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
            return;
        }

        if (index === 1) {
            sendChannelMessageAndLog(msg, "I can't bump the song that's already next to play.", "Attempted to bump first song");
            return;
        }

        let pendingSongs = server.queue.slice(1);
        server.queue = [server.queue[0]];
        const bumpedSong = pendingSongs[index - 1];
        pendingSongs.splice(index - 1, 1);
        server.queue.push(bumpedSong);
        for (let s of pendingSongs) {
            server.queue.push(s);
        }

        sendChannelMessageAndLog(msg, server.queue[1].title + " moved up in queue.", "bumped song");
    }
}

module.exports = { playSong, getNowPlayingInfo, pause, resume, shuffleQueue, bumpSong };
