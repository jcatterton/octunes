const {joinVoiceChannel} = require("@discordjs/voice");

function runTests(msg, bot) {
    const promises = [
        () => promiseCreator(1, 5000, ping, msg),
        () => promiseCreator(2, 5000, joinVoice, msg),
        () => promiseCreator(3, 5000, addSpotifyPlaylist, msg),
        () => promiseCreator(4, 5000, getQueue, msg),
        () => promiseCreator(5, 5000, pause, msg),
        () => promiseCreator(6, 5000, resume, msg),
        () => promiseCreator(7, 5000, skip, msg),
        () => promiseCreator(8, 15000, joinVoice, msg),
        () => promiseCreator(9, 5000, searchSong, msg, bot),
        () => promiseCreator(10, 5000, searchSong, msg, bot),
        () => promiseCreator(11, 5000, searchSong, msg, bot),
        () => promiseCreator(12, 5000, searchSong, msg, bot),
        () => promiseCreator(13, 5000, getQueue, msg),
        () => promiseCreator(14, 5000, shuffle, msg, bot),
        () => promiseCreator(15, 5000, getQueue, msg),
        () => promiseCreator(16, 5000, move, msg, bot),
        () => promiseCreator(17, 5000, getQueue, msg),
        () => promiseCreator(18, 5000, bump, msg, bot),
        () => promiseCreator(19, 5000, getQueue, msg),
        () => promiseCreator(20, 5000, swap, msg, bot),
        () => promiseCreator(21, 5000, getQueue, msg),
        () => promiseCreator(22, 5000, remove, msg),
        () => promiseCreator(23, 5000, getQueue, msg),
        () => promiseCreator(24, 5000, nowPlaying, msg),
        () => promiseCreator(25, 5000, stop, msg),
        () => promiseCreator(26, 15000, joinVoice, msg),
        () => promiseCreator(27, 5000, addYoutubeLink, msg),
        () => promiseCreator(28, 5000, nowPlaying, msg),
        () => promiseCreator(29, 5000, stop, msg),
        () => promiseCreator(30, 15000, joinVoice, msg),
        () => promiseCreator(31, 5000, addSpotifyLink, msg),
        () => promiseCreator(32, 5000, nowPlaying, msg),
        () => promiseCreator(33, 5000, stop, msg),
        () => promiseCreator(34, 15000, joinVoice, msg),
        () => promiseCreator(35, 5000, mix, msg),
        () => promiseCreator(36, 5000, getQueue, msg),
        () => promiseCreator(37, 5000, stop, msg),
        () => promiseCreator(38, 15000, joinVoice, msg),
        () => promiseCreator(39, 5000, mix, msg, "https://www.youtube.com/watch?v=5abamRO41fE"),
        () => promiseCreator(40, 5000, getQueue, msg),
        () => promiseCreator(41, 5000, stop, msg),
        () => promiseCreator(42, 15000, joinVoice, msg),
        () => promiseCreator(43, 5000, addYoutubePlaylist, msg),
        () => promiseCreator(44, 5000, getQueue, msg),
        () => promiseCreator(45, 5000, stop, msg),
    ]

    executeSequentially(promises).then(() => {
        msg.channel.send("Done")
    });
}

function ping(msg) {
    msg.channel.send("!ping");
}

function joinVoice(msg) {
    joinVoiceChannel({
        channelId: "921486301050585098",
        guildId: msg.guild.id,
        adapterCreator: msg.guild.voiceAdapterCreator
    })
}

function addSpotifyPlaylist(msg) {
    msg.channel.send("!pl https://open.spotify.com/playlist/7jAzH5Asmoc2iEwJodGweG?si=7ff32960bd2b4b7c")
}

function getQueue(msg) {
    msg.channel.send("!q");
}

function skip(msg) {
    msg.channel.send("!sk")
}

function pause(msg) {
    msg.channel.send("!ps")
}

function resume(msg) {
    msg.channel.send("!rs")
}

const promiseCreator = (i, time, callback, msg, bot) => {
    return new Promise(resolve => setTimeout(
        () => resolve(callback(msg, bot)),
        time)
    );
}

function executeSequentially(promiseLikeArray) {
    let result = Promise.resolve();
    promiseLikeArray.forEach(function (promiseLike) {
        result = result.then(promiseLike);
    });
    return result;
}

function searchSong(msg) {
    const r = Math.random();
    if (r < 0.25) {
        msg.channel.send("!pl despacito")
    } else if (r < 0.5) {
        msg.channel.send("!pl slipknot duality")
    } else if (r < 0.75) {
        msg.channel.send("!pl nirvana something in the way")
    } else {
        msg.channel.send("!pl never gonna give you up")
    }
}

function shuffle(msg) {
    msg.channel.send("!sh")
}

function move(msg) {
    msg.channel.send("!mv 3 1")
}

function swap(msg) {
    msg.channel.send("!sw 3 1")
}

function bump(msg) {
    msg.channel.send("!b 3")
}

function remove(msg) {
    msg.channel.send("!rm 2")
}

function nowPlaying(msg) {
    msg.channel.send("!np")
}

function stop(msg) {
    msg.channel.send("!st")
}

function addYoutubeLink(msg) {
    msg.channel.send("!pl https://www.youtube.com/watch?v=5abamRO41fE")
}

function addSpotifyLink(msg) {
    msg.channel.send("!pl https://open.spotify.com/track/3waXln508ZnlKkmIdq0Y83?si=a561958e8b7444e5")
}

function mix(msg, link) {
    if (!link) {
        msg.channel.send("!m slipknot")
    } else {
        msg.channel.send("!m " + link)
    }
}

function addYoutubePlaylist(msg) {
    msg.channel.send("!pl https://youtube.com/playlist?list=PLXS853kF3XAv0YnjsZf538YrlF6OmK594")
}

module.exports = { runTests }
