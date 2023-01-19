const { isValidHttpUrl, log, convertSecondsToMinutes, sendChannelMessageAndLog, getSpotifyToken } = require("./utilities");

const ytSearch = require("yt-search");
const ytpl = require('ytpl');
const ytdl = require("ytdl-core");
const playdl = require("play-dl");
const ytmpl = require('yt-mix-playlist');
const Spotify = require('spotify-web-api-node');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource, getVoiceConnection,
    NoSubscriberBehavior
} = require('@discordjs/voice');
const fluentFfmpeg = require('fluent-ffmpeg')

const config = require("../config.json");
const allowedVoiceChannels = config.ALLOWED_VOICE_CHANNELS.split(",");
const spotifyRefreshToken = config.SPOTIFY_REFRESH_TOKEN;
const spotifyAuth = config.SPOTIFY_AUTH;
const spotifyApi = new Spotify();

let startTimeOfCurrentSong;
let nowPlaying;
let pauseStartTime;
let timeSpentPaused;
let startingTimestamp;
let paused;

// playSong function is called by message handler
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

    // If argument is not a URL, then use it as search instead
    if (!isValidHttpUrl(songLink)) {
        handleYoutubeSearch(msg, bot, songLink, server, args, mix);
    } else {
        // If argument is a URL...
        if (songLink.includes("open.spotify.com")) {
            // Check if it is a spotify link
            handleSpotifyLink(msg, bot, songLink, server);
        } else if (songLink.includes("/playlist")) {
            // Check if it is a youtube playlist link and extract ID from link if it is
            playlistId = songLink.split("list=")[1]
            playlistId = songLink.split("&")[0]

            // Use ytpl lib to get playlist information
            ytpl(playlistId).then(res => {

                sendChannelMessageAndLog(msg, "Adding " + res.items.length + " songs to queue", "Adding playlist to queue");

                addPlaylistToQueue(bot, msg, server, res.items.map(function(i) {
                    return (i.url);
                }));
            }, err => {
                console.log(err)
                sendChannelMessageAndLog(msg, "I wasn't able to fetch that playlist. Remember that I cannot play private playlists, and I also cannot play mixes with this command, only discrete playlists. If you want to listen to a mix, try the '!mix' followed by a link or song name.", "Error fetching playlist");
            })
        } else {
            if (!mix) {
                // If not a mix, simply add the linked song to queue
                server.mix = []
                server.mixIndex = -1
                addToQueue(bot, msg, server, songLink, true).then(() => {
                    connectToVoice(msg, bot, server);
                });
            } else {
                // If a mix, use ytmpl lib to generate mix
                ytdl.getInfo(songLink).then(res => {
                    ytmpl(res.videoDetails.videoId).then(r => {
                        sendChannelMessageAndLog(msg, "Fetching mix", "Fetching mix");
                        server.mix = r.items;
                        server.mixIndex = 0;
                        addToQueue(bot, msg, server, server.mix[server.mixIndex].url, false).then(response => {
                           connectToVoice(msg, bot, server);
                        });
                    });
                });
            }
        }
    }
}

function handleYoutubeSearch(msg, bot, songLink, server, args, mix) {
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
                addToQueue(bot, msg, server, response.videos[0].url, true).then(response => {
                    connectToVoice(msg, bot, server);
                });
            } else {
                ytmpl(response.videos[0].videoId).then(res => {
                    sendChannelMessageAndLog(msg, "Fetching mix", "Fetching mix");
                    if (!res.items) {
                        sendChannelMessageAndLog(msg, "Unable to fetch mix :(", "Error fetching mix");
                        return;
                    }
                    server.mix = res.items;
                    server.mixIndex = 0;
                    addToQueue(bot, msg, server, server.mix[server.mixIndex].url, false).then(() => {
                       connectToVoice(msg, bot, server);
                    });
                });
            }
        }, err => {
            sendChannelMessageAndLog(msg, "Uh oh! Looks like I experienced an error while trying to search YouTube. Try again, it's probably nothing... maybe", "Error conduction search: " + err);
        }
    );
}

function handleSpotifyLink(msg, bot, songLink, server) {
    getSpotifyToken(spotifyRefreshToken, spotifyAuth).then(response => {
        spotifyApi.setAccessToken(response["access_token"]);

        if (songLink.includes("/playlist")) {
            const playListId = songLink.split("/playlist/")[1].split("?si=")[0];
            spotifyApi.getPlaylistTracks(playListId).then(r => {
                let tracks = [];
                tracks = tracks.concat(r.body.items);
                const p = [];
                let i = 1;

                while (i * 100 < r.body.total) {
                    p.push(spotifyApi.getPlaylistTracks(playListId, {offset: i * 100}).then(r => {
                        tracks = tracks.concat(r.body.items);
                    }));
                    i++;
                }

                Promise.all(p).then(() => {
                    sendChannelMessageAndLog(msg, "Adding " + tracks.length + " songs to queue.", "Adding playlist to queue");

                    server.mix = [];
                    server.mixIndex = -1;
                    addPlaylistToQueue(bot, msg, server, tracks);
                });
            }, err => {
                sendChannelMessageAndLog(msg, "I couldn't get a playlist from that link :(", "error with spotify link: " + err);
            })
        } else if (songLink.includes("/track")) {
            const trackId = songLink.split("/track/")[1].split("?si=")[0];
            spotifyApi.getTrack(trackId).then(r => {
                playSong(bot, msg, r.body.name + " " + r.body["artists"][0].name, server, false);
            }, err => {
                sendChannelMessageAndLog(msg, "I couldn't get a track from that link :(", "error with spotify link: " + err);
            });
        }
    });
}

function addPlaylistToQueue(bot, msg, server, playlist) {
    let promises = [];

    playlist.forEach(song => {
        console.log(song)
        promises.push(addToQueue(bot, msg, server, song, false))
    });

    console.log(server.queue.length)

    Promise.all(promises).then(() => {
        const pendingSongs = server.queue.slice(1);
        server.queue = [server.queue[0]];

        for (let i = pendingSongs.length - 1; i >= 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = pendingSongs[i];
            pendingSongs[i] = pendingSongs[j];
            pendingSongs[j] = temp;
        }

        for (let s of pendingSongs) {
            server.queue.push(s);
        }

        connectToVoice(msg, bot, server);
    });
}

function connectToVoice(msg, bot, server) {
    if (!nowPlaying) {
        const connection = joinVoiceChannel({
            channelId: msg.member.voice.channel.id,
            guildId: msg.guild.id,
            adapterCreator: msg.guild.voiceAdapterCreator
        })
        play(connection, msg, server, bot)
    }
}

function addToQueue(bot, msg, server, songLink, echo) {
    if (typeof(songLink) === typeof(" ")) {
        return ytdl.getInfo(songLink).then(
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

                setNowPlayingInfo(msg, server, echo);
            }, err => {
                if (echo) {
                    sendChannelMessageAndLog(msg, "I encountered an error getting info on that song. Try again, it's probably nothing... maybe", "Error adding to queue: " + err);
                }
            }
        )
    } else {
        server.queue.push(
            {
                "title": songLink.track.name,
                "runTime": songLink.track["duration_ms"]/1000,
                "query": songLink.track.name + " " + songLink.track["artists"][0].name,
                "length": songLink.track["duration_ms"]/1000,
                "live": false,
                "formats": null
            }
        );

        setNowPlayingInfo(msg, server, echo)
    }
}

function setNowPlayingInfo(msg, server, echo) {
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

            totalQueueLength += (server.queue[0].length - (Date.now() - startTimeOfCurrentSong) / 1000 + (paused ? (Date.now() - pauseStartTime) / 1000 : 0)) - startingTimestamp;

            const reply = (server.queue[server.queue.length - 1].title + " added to queue. There are " +
                "currently " + (server.queue.length - 1) + " songs ahead of it, and it will play in approximately " +
                convertSecondsToMinutes(totalQueueLength));

            if (echo) {
                sendChannelMessageAndLog(msg, reply, "Song added to queue");
            } else {
                log("Song added to queue");
            }
        }
    }
}

function checkForEmptyChannel(msg, bot, connection) {
    return bot.channels.cache.get(connection.packets.state.channel_id).members.size <= 1;
}

function play(connection, msg, server, bot) {
    if (!server.queue[0].link) {
        ytSearch.search(server.queue[0].query).then(
            response => {
                server.queue[0].link = response.videos[0].url;
                server.queue[0].formats = response.formats;

                setUpStream(msg, bot, server, connection);
            }
        )
    } else {
        setUpStream(msg, bot, server, connection);
    }
}

/*export function createYTStream(song, info){
    const chunkSize = 512 * 1024;
    const stream = new PassThrough();
    let current = -1;
    const contentLength = song.length;
    if (contentLength < chunkSize) {
        // stream is tiny so unnecessary to split
        ytdl(song.link).pipe(stream);
    } else {
        // stream is big so necessary to split
        const pipeNextStream = () => {
            current++;
            let end = chunkSize * (current + 1) - 1;
            if(end >= contentLength) end = undefined;
            const nextStream = ytdl(info, { range: {
                    start: chunkSize * current, end
                }});
            nextStream.pipe(stream, {end: end === undefined});
            if(end !== undefined){
                // schedule to pipe next partial stream
                nextStream.on("end", () => {
                    pipeNextStream();
                });
            }
        };
        pipeNextStream();
    }
    return stream;
}*/

function setUpStream(msg, bot, server, connection) {
    sendChannelMessageAndLog(msg, "Now playing " + server.queue[0].title, "Now playing song");
    nowPlaying = server.queue[0];

    // ts is undefined if there is no timestamp
    const ts = checkForTimestamp(server.queue[0].link);

    if (!ts) {
        startingTimestamp = 0;
    } else {
        startingTimestamp = ts;
    }
    timeSpentPaused = 0;

    server.dispatcher = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        }
    });

    playdl.stream(server.queue[0].link).then(stream => {
        let resource
        if (!ts) {
            resource = createAudioResource(stream.stream, { inputType: stream.type })
        } else {
            resource = createAudioResource(fluentFfmpeg({source: stream.stream}).toFormat("mp3").setStartTime(ts));
        }
        server.dispatcher.play(resource);
        connection.subscribe(server.dispatcher);

        bot.user.setActivity({
            name: server.queue[0].title,
            type: 'PLAYING',
            url: server.queue[0].link
        });

        startTimeOfCurrentSong = Date.now();
    });

    server.dispatcher.on("finish", () => {
        console.log("finish");
        if (server.queue.length !== 0) {
            shiftQueue(connection, msg, server, bot, false);
        }
    });

    server.dispatcher.on("skip", () => {
        console.log("skip");
        if (nowPlaying) {
            sendChannelMessageAndLog(msg, "Skipping song", "Song skipped");
            shiftQueue(connection, msg, server, bot, false);
        } else {
            sendChannelMessageAndLog(msg, "There isn't anything playing. :thinking:", "cannot skip if nothing is playing");
        }
    });

    server.dispatcher.on("error", err => {
        console.log("error");
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

    server.dispatcher.on(AudioPlayerStatus.Paused, () => {
        paused = true;
    });

    server.dispatcher.on(AudioPlayerStatus.Playing, () => {
        paused = false;
    });

    server.dispatcher.addListener("stateChange", (oldOne, newOne) => {
        if (newOne.status === "idle") {
            server.dispatcher.emit("finish");
        }
    });
}

function shiftQueue(connection, msg, server, bot, rickRollable) {
    if (checkForEmptyChannel(msg, bot, connection)) {
        sendChannelMessageAndLog(msg, "Now pla- wait, where did everybody go?", "Disconnecting because channel empty");
        stop(msg, bot, server, msg.guildId);
        return;
    }

    if (server.mixIndex !== -1 && server.mixIndex < server.mix.length) {
        addToQueue(bot, msg, server, server.mix[++server.mixIndex].url, false).then(() => {
            server.queue.shift();
            nowPlaying = server.queue[0];
            play(connection, msg, server, bot);
        });
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
            bot.user.setActivity(null);
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
            return "Currently " + (paused ? "paused " : "playing ") + nowPlaying.link + ", length is: " + convertSecondsToMinutes(nowPlaying.length) + " remaining time is: " + convertSecondsToMinutes(getRemainingTime(server) - startingTimestamp);
        } else {
            return "Current livestreaming " + nowPlaying.link;
        }
    }
    sendChannelMessageAndLog(msg, reply(), "nowplaying information sent");
}

function getRemainingTime(server) {
    if (paused) {
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
    if (paused) {
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
    if (!paused) {
        sendChannelMessageAndLog(msg, "I can't resume if the song isn't paused!", "Attempted to resume, but song wasn't paused");
        return;
    }

    server.dispatcher.unpause();

    timeSpentPaused = timeSpentPaused + ((Date.now() - pauseStartTime)/1000);

    sendChannelMessageAndLog(msg, "Playback resumed", "playback resumed");
}

function checkForTimestamp(link) {
    let ts = link.split("&t=")[1];

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
    let [indOne, indTwo, valid] = validIndices(msg, server, indexOne, indexTwo)
    if (!valid){
        return;
    }

    const temp = server.queue[indOne];
    server.queue[indOne] = server.queue[indTwo];
    server.queue[indTwo] = temp;

    sendChannelMessageAndLog(msg, "Swapped " + server.queue[indexTwo].title + " and " + server.queue[indexOne].title);
}

function move(msg, server, indexOne, indexTwo) {
    let [indOne, indTwo, valid] = validIndices(msg, server, indexOne, indexTwo)
    if (!valid){
        return;
    }

    const temp = server.queue[indexOne];
    server.queue.splice(indOne, 1)
    server.queue.splice(indTwo, 0, temp);

    sendChannelMessageAndLog(msg, "Moved " + server.queue[indTwo].title + " into position " + indTwo);
}

function validIndices(msg, server, indexOne, indexTwo) {
    if (!indexOne || !indexTwo) {
        sendChannelMessageAndLog(msg, "I need two indexes to swap songs", "unable to swap, two indexes not provided");
        return [0, 0, false];
    }

    const indOne = parseInt(indexOne);
    const indTwo = parseInt(indexTwo);
    if (indOne <= 0 || isNaN(indOne) || indOne > server.queue.length - 1 || indTwo <= 0 || isNaN(indTwo) || indTwo > server.queue.length) {
        sendChannelMessageAndLog(msg, "Invalid index provided. Learn to count, ya dingus!", "Invalid index indication initiated");
        return [0, 0, false];
    }

    if (indOne === indTwo) {
        sendChannelMessageAndLog(msg, "I can't swap the same index!", "Attempted to swap the same index");
        return [0, 0, false];
    }

    return [indOne, indTwo, true];
}

function stop(msg, bot, server, guildID) {
    if (nowPlaying) {
        sendChannelMessageAndLog(msg, "Stopping playback and purging queue", "Queue purged");
        nowPlaying = null;
        bot.user.setActivity(null);
        server.queue = [];
        server.mix = [];
        server.mixIndex = -1;
        server.dispatcher.stop();
        getVoiceConnection(guildID)?.destroy();
    } else {
        sendChannelMessageAndLog(msg, "There isn't anything playing. :thinking:", "cannot stop if nothing is playing");
    }
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
        queueReply[0] = ":point_right: " + server.queue[0].title + (paused ? " (Paused)" : " (Now playing)");
        if (queueReply.length > 30) {
            for (let i = 0; i < queueReply.length; i += 30) {
                const chunk = queueReply.slice(i, i + 30);
                sendChannelMessageAndLog(msg, chunk.join("\n"), "queue information sent");
            }
        } else {
            sendChannelMessageAndLog(msg, queueReply.join("\n"), "queue information sent");
        }
    }
}

module.exports = { playSong, getNowPlayingInfo, pause, resume, shuffleQueue, bumpSong, swapSongs, move, stop, outputQueue };
