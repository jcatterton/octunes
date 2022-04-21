const fetch = require('node-fetch');
const snoowrap = require('snoowrap');

const fs = require('fs');
require.extensions['.txt'] = function (module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};
const username = require('../text-files/username');
const password = require('../text-files/password');

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
        queueReply[0] = ":point_right: " + server.queue[0].title + (server.dispatcher?.paused ? " (Paused)" : " (Now playing)");

        if (queueReply.length > 30) {
            for (let i = 0; i < queueReply.length; i += 30) {
                const chunk = queueReply.slice(i, i + 30);
                sendChannelMessageAndLog(msg, chunk, "queue information sent");
            }
        } else {
            sendChannelMessageAndLog(msg, queueReply, "queue information sent");
        }
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

async function getRandomFrog(msg) {
    let num = Math.floor(Math.random() * 54);
    if (num.toString().length === 1) {
        num = "000" + num;
    } else {
        num = "00" + num;
    }

    msg.channel.send({files: ["http://www.allaboutfrogs.org/funstuff/random/" + num + ".jpg"]});
}

async function getRandomFarmAnimal(msg) {
    const animals = [
        { animal: "pigs", sound: "Oink!" },
        { animal: "horses", sound: "Neigh!" },
        { animal: "chickens", sound: "Cluck!" },
        { animal: "cow", sound: "Moo!" },
        { animal: "sheep", sound: "Baa!" },
        { animal: "goats", sound: "Bleat!" },
        { animal: "duck", sound: "Quack!" },
        { animal: "turkeys", sound: "Gobble!" },
        { animal: "donkeys", sound: "Hee Haw!" }
    ]

    const r = Math.floor(Math.random() * animals.length);
    let animal = animals[r].animal;
    let sound = animals[r].sound;

    const reddit = new snoowrap({
        userAgent: 'put your user-agent string here',
        clientId: '9UKLWr3gXXfCIxcWv26Zlg',
        clientSecret: 'oU2xj_RoVSg8Aa8oASUteLIqiKGksQ',
        username: username.replace("\n", ""),
        password: password.replace("\n", "")
    });

    reddit.getSubreddit(animal).getTop({time: 'all'}).then(
        response => {
            const validLinks = response.filter(function(d) {
                return (d.url.endsWith(".jpg") || d.url.endsWith(".png"))
            });

            const index = Math.floor(Math.random() * validLinks.length);

            msg.channel.send(
                sound,
                {
                    files: [
                        validLinks[index].url
                    ]
                }
            )
        }
    )
}

async function getRandomOctopus(msg) {
    const reddit = new snoowrap({
        userAgent: 'put your user-agent string here',
        clientId: '9UKLWr3gXXfCIxcWv26Zlg',
        clientSecret: 'oU2xj_RoVSg8Aa8oASUteLIqiKGksQ',
        username: username.replace("\n", ""),
        password: password.replace("\n", "")
    });

    reddit.getSubreddit("octopus").getTop({time: 'all'}).then(
        response => {
            const validLinks = response.filter(function(d) {
                return (d.url.endsWith(".jpg") || d.url.endsWith(".png"))
            });

            const index = Math.floor(Math.random() * validLinks.length);

            msg.channel.send(
                {
                    files: [
                        validLinks[index].url
                    ]
                }
            )
        }
    )
}

function horza(msg) {
    const horzas = [
        "https://render.worldofwarcraft.com/us/character/bleeding-hollow/37/182304549-inset.jpg",
        "https://render.worldofwarcraft.com/us/character/bleeding-hollow/128/191035008-inset.jpg",
        "https://render.worldofwarcraft.com/us/character/bleeding-hollow/119/215029111-inset.jpg"
    ];

    const horzaSounds = [
        "Eh?",
        "Was that a healer fuck up?",
        "3... 2... wait... 3... no... 321!"
    ];

    msg.channel.send(
        horzaSounds[Math.floor(Math.random() * 3)],
        {
            files: [horzas[Math.floor(Math.random() * 3)]]
        }
    );
}

async function getSpotifyToken(refreshToken, authorization) {
    return fetch('https://accounts.spotify.com/api/token?grant_type=refresh_token&refresh_token=' + refreshToken, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + authorization
        }
    }).then(
        response => response.json()
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
    getRandomDog,
    getRandomFrog,
    getRandomFarmAnimal,
    getRandomOctopus,
    horza,
    getSpotifyToken
}
