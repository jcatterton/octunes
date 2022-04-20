const { isValidHttpUrl, log, convertSecondsToMinutes, sendChannelMessageAndLog } = require("./utilities");

const ytSearch = require("yt-search");
const ytpl = require('ytpl');
const ytdl = require("ytdl-core");
const ytmpl = require('yt-mix-playlist');

const config = require("../config.json");
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");

let startTimeOfCurrentSong;
let nowPlaying;
let pauseStartTime;
let timeSpentPaused;
let startingTimestamp;

function playSong(bot, msg, args, server, mix) {
    if (!args[1]) {
        msg.channel.send("Play what? :thinking:")
        return;
    }

    if (!msg.member.voice.channel) {
        sendChannelMessageAndLog(msg, "You need to be in a voice channel to listen to music, ya dingus!", "Sent message to " + msg.member.name);
        return;
    }

    if (!allowedVoiceChannels.some(c => c === msg.member.voice.channel.id)) {
        sendChannelMessageAndLog(msg, "I'm not allowed to join the channel you're in. :(", "Sent message to " + msg.member.name);
        return;
    }

    let songLink = args[1]
    if (songLink.startsWith("<") && songLink.endsWith(">")) {
        songLink = songLink.substring(1, songLink.length - 1);
    }

    if (!isValidHttpUrl(songLink)) {
        let query = "";
        for (let i = 1; i < args.length; i++) {
            query = query + args[i];
            query = query + " ";
        }
        ytSearch.search(query).then(
            response => {
                if (response.videos === []) {
                    sendChannelMessageAndLog(msg, "I didn't get any results for that search query :(", "no results")
                }
                if (!mix) {
                    server.mix = [];
                    server.mixIndex = -1;
                    addToQueue(bot, msg, server, response.videos[0].url, true, null);
                } else {
                    ytmpl(response.videos[0].videoId).then(res => {
                        sendChannelMessageAndLog(msg, "Fetching mix", "Fetching mix");
                        server.mix = res.items;
                        server.mixIndex = 0;
                        addToQueue(bot, msg, server, server.mix[server.mixIndex].url, false, null)
                    });
                }
            }, err => {
                sendChannelMessageAndLog(msg, "Uh oh! Looks like I experienced an error while trying to search YouTube. Try again, it's probably nothing... maybe", "Error conduction search: " + err);
            }
        );
    } else {
        if (songLink.includes("/playlist")) {
            ytpl(songLink.split("list=")[1]).then(res => {

                sendChannelMessageAndLog(msg, "Adding " + res.items.length + " songs to queue, this may take a minute", "Adding playlist to queue");

                for (let i = 0; i < res.items.length; i++) {
                    addToQueue(bot, msg, server, res.items[i].url, false, null);
                }
            }, () => {
                sendChannelMessageAndLog(msg, "I wasn't able to fetch that playlist. Remember that I cannot play private playlists, and I also cannot play mixes with this command, only discrete playlists. If you want to listen to a mix, try the '!mix' followed by a link or song name.", "Error fetching playlist");
            })
        }

        else {
            if (!mix) {
                server.mix = []
                server.mixIndex = -1
                addToQueue(bot, msg, server, songLink, true, null);
            } else {
                ytdl.getInfo(songLink).then(res => {
                    ytmpl(res.videoDetails.videoId).then(r => {
                        sendChannelMessageAndLog(msg, "Fetching mix", "Fetching mix");
                        server.mix = r.items;
                        server.mixIndex = 0;
                        addToQueue(bot, msg, server, server.mix[server.mixIndex].url, false, null)
                    });
                });
            }
        }
    }
}

function addToQueue(bot, msg, server, songLink, echo, c) {
    ytdl.getInfo(songLink).then(
        response => {
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

            if (server.queue.length > 1) {
                if (server.queue.slice(0, -1).some(s => s.live)) {
                    const reply = "Song added to queue. One of the songs in queue is a livestream so there is no estimated time until played."
                    if (echo) {
                        sendChannelMessageAndLog(msg, reply, "Song added to queue");
                    } else {
                        log("Song added to queue")
                    }
                } else {
                    let totalQueueLength = 0;
                    for (let i = 1; i < server.queue.length - 1; i++) {
                        totalQueueLength += parseInt(server.queue[i].runTime, 10);
                    }
                    totalQueueLength += (server.queue[0].length - (Date.now() - startTimeOfCurrentSong) / 1000) - startingTimestamp;

                    const reply = (server.queue[server.queue.length - 1].title + " added to queue. There are " +
                        "currently " + (server.queue.length - 1) + " songs ahead of it, and it will play in approximately " +
                        convertSecondsToMinutes(totalQueueLength));

                    if (echo) {
                        sendChannelMessageAndLog(msg, reply, "Song added to queue");
                    } else {
                        log("Song added to queue");
                    }
                }
            } else {
                sendChannelMessageAndLog(msg, "Now playing " + server.queue[0].title, "Now playing song");
                nowPlaying = server.queue[0];
            }

            if (bot.voice.connections?.size === 0) {
                bot.channels.cache.get(msg.member.voice.channel.id).join().then(function(connection) {
                    play(connection, msg, server, bot);
                }, err => {
                    log("Error joining voice channel: " + err, null);
                });
            } else if (c) {
                play(c, msg, server, bot);
            }
        }, err => {
            sendChannelMessageAndLog(msg, "I encountered an error getting info on that song. Try again, it's probably nothing... maybe", "Error adding to queue: " + err);
        }
    )
}

function play(connection, msg, server, bot) {
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
            console.log(server.queue[0])
            return ytdl(server.queue[0].link, {
                filter: "audioonly",
                quality: "highestaudio",
                highWaterMark: 1 << 25
            });
        }
    }
    server.dispatcher = connection.play(stream(), { seek: (ts && !isNaN(ts)) ? ts : 0 });

    bot.user.setPresence({
        status: 'online',
        activity: {
            name: server.queue[0].title,
            type: 'PLAYING',
            url: server.queue[0].link
        }
    });

    startTimeOfCurrentSong = Date.now();

    server.dispatcher.on("finish", () => {
        shiftQueue(connection, msg, server, bot, true);
    });

    server.dispatcher.on("error", err => {
        sendChannelMessageAndLog(msg, "Error during playback, attempting to continue...", "Error occurred during playback: " + err);
        const temp = server.queue;
        server.queue = [null, server.queue[0]];
        server.queue[1].link = server.queue[1].link.split("t=")[0] + "&t=" + (nowPlaying.length - (getRemainingTime(server) - startingTimestamp)) + "s";
        for (let i = 1; i < temp.length; i++) {
            server.queue.push(temp[i]);
        }
        shiftQueue(connection, msg, server, bot, false);
        console.trace();
    });

    server.dispatcher.player.on("error", err => {
        sendChannelMessageAndLog(msg, "Error during playback, attempting to continue...", "Error occurred during playback: " + err);
        const temp = server.queue;
        server.queue = [null, server.queue[0]];
        server.queue[1].link = server.queue[1].link.split("t=")[0] + "&t=" + (nowPlaying.length - (getRemainingTime(server) - startingTimestamp)) + "s";
        for (let i = 1; i < temp.length; i++) {
            server.queue.push(temp[i]);
        }
        shiftQueue(connection, msg, server, bot, false);
        console.trace();
    });
}

function shiftQueue(connection, msg, server, bot, rickRollable) {
    if (server.mixIndex !== -1 && server.mixIndex < server.mix.length) {
        addToQueue(bot, msg, server, server.mix[++server.mixIndex].url, false, connection);
        server.queue.shift();
    } else {
        if (server.mixIndex !== -1) {
            server.mixIndex = -1;
            server.mix = [];
        }

        server.queue.shift();
        if (server.queue[0]) {
            if (Math.random() <= 0.01 && rickRollable) {
                rickRoll(server);
            }

            nowPlaying = server.queue[0];
            play(connection, msg, server, bot);
        } else {
            nowPlaying = null;
            connection.disconnect();
            sendChannelMessageAndLog(msg, "Playback finished", "playback finished");
            bot.user.setPresence({ activity: null })
        }
    }
}

function rickRoll(server) {
    const tempQueue = server.queue;
    server.queue = [
        {
            "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
            "runTime": 212,
            "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "length": 212,
            "live": false,
            "formats": []
        }
    ];
    tempQueue.forEach(t => {
        server.queue.push(t);
    })
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

    return ts;
}

function shuffleQueue(server, msg) {
    if (server.queue.length === 0) {
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

function swapSongs(msg, server, indexOne, indexTwo) {
    if (!indexOne || !indexTwo) {
        sendChannelMessageAndLog(msg, "I need two indexes to swap songs", "unable to swap, two indexes not provided");
    }

    const indOne = parseInt(indexOne);
    const indTwo = parseInt(indexTwo);
    if (indOne <= 0 || isNaN(indOne) || indOne > server.queue.length - 1 || indTwo <= 0 || isNaN(indTwo) || indTwo > server.queue.length) {
        sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
        return;
    }

    if (indOne === indTwo) {
        sendChannelMessageAndLog(msg, "I can't swap the same index!", "Attempted to swap the same index");
        return;
    }

    const temp = server.queue[indOne];
    server.queue[indOne] = server.queue[indTwo];
    server.queue[indTwo] = temp;

    sendChannelMessageAndLog(msg, "Swapped " + server.queue[indexTwo].title + " and " + server.queue[indexOne].title);
}

function move(msg, server, indexOne, indexTwo) {
    if (!indexOne || !indexTwo) {
        sendChannelMessageAndLog(msg, "I need two indexes to swap songs", "unable to swap, two indexes not provided");
    }

    const indOne = parseInt(indexOne);
    const indTwo = parseInt(indexTwo);
    if (indOne <= 0 || isNaN(indOne) || indOne > server.queue.length - 1 || indTwo <= 0 || isNaN(indTwo) || indTwo > server.queue.length) {
        sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
        return;
    }

    if (indOne === indTwo) {
        sendChannelMessageAndLog(msg, "I can't swap the same index!", "Attempted to swap the same index");
        return;
    }

    const temp = server.queue[indexOne];
    server.queue.splice(indOne, 1)
    server.queue.splice(indTwo, 0, temp);

    sendChannelMessageAndLog(msg, "Moved " + server.queue[indTwo].title + " into position " + indTwo);
}

module.exports = { playSong, getNowPlayingInfo, pause, resume, shuffleQueue, bumpSong, swapSongs, move };
