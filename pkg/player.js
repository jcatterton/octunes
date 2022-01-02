const { isValidHttpUrl, log, convertSecondsToMinutes, sendChannelMessageAndLog } = require("./utilities");

const ytSearch = require("yt-search");
const ytdl = require("ytdl-core");

const config = require("../config.json");
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");

let startTimeOfCurrentSong;
let nowPlaying;
let pauseStartTime;
let timeSpentPaused;

function playSong(msg, args, server) {
    if (!args[1]) {
        msg.channel.send("Play what? :thinking:")
        return;
    }

    if (!msg.member.voiceChannel) {
        sendChannelMessageAndLog(msg, "You need to be in a void channel to listen to music, ya dingus!", "Sent message to " + msg.member.name);
        return;
    }

    if (!allowedVoiceChannels.some(c => c === msg.member.voiceChannel.name)) {
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
                addToQueue(msg, server, response.videos[0].url);
            }, err => {
                sendChannelMessageAndLog(msg, "Uh oh! Looks like I experienced an error while trying to search YouTube. Try again, it's probably nothing... maybe", "Error conduction search: " + err);
            }
        );
    } else {
        addToQueue(msg, server, songLink);
    }
}

function addToQueue(msg, server, songLink) {
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

                sendChannelMessageAndLog(msg, reply, "Song added to queue");
            } else {
                sendChannelMessageAndLog(msg, "Now playing " + server.queue[0].title, "Now playing song");
                nowPlaying = server.queue[0];
            }

            if (!msg.guild.voiceConnection) {
                msg.member.voiceChannel.join().then(function(connection) {
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
    server.dispatcher = connection.playStream(ytdl(server.queue[0].link, { filter: "audioonly", quality: "lowestaudio" }));
    startTimeOfCurrentSong = Date.now();
    server.dispatcher.on("end", function(reason) {
        if (parseInt((Date.now() - startTimeOfCurrentSong)/1000) < parseInt(server.queue[0]?.length) && !reason.skip) {
            log(server.queue[0].title + " ended after " + convertSecondsToMinutes((Date.now() - startTimeOfCurrentSong)/1000) + ", but length should have been " + convertSecondsToMinutes(server.queue[0].length), null);
            msg.channel.send("Oopsy poopsy, I made a fucky wucky and the audio ended early :point_right::point_left::pleading_face:\n\nPwease don't tell Sova or he'll have to fix me uwu.")
        }
        server.queue.shift();
        if(server.queue[0]) {
            nowPlaying = server.queue[0];
            play(connection, msg, server);
        } else {
            nowPlaying = null;
            connection.disconnect();
            log("Playback finished", null);
        }
    });
}

function getNowPlayingInfo(msg, server) {
    if (!nowPlaying) {
        sendChannelMessageAndLog(msg, "There isn't anything playing. :thinking:", "nowplaying information sent");
        return;
    }

    const reply = "Currently " + (server.dispatcher.paused ? "paused " : "playing ") + nowPlaying.link + ", length is: " + convertSecondsToMinutes(nowPlaying.length) + " remaining time is: " + convertSecondsToMinutes(getRemainingTime(server));
    sendChannelMessageAndLog(msg, reply, "nowplaying information sent");
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

    server.dispatcher.resume();
    timeSpentPaused = timeSpentPaused + ((Date.now() - pauseStartTime)/1000);
    console.log(timeSpentPaused);

    sendChannelMessageAndLog(msg, "Playback resumed", "playback resumed");
}

module.exports = { playSong, getNowPlayingInfo, pause, resume };
