const { Client, Intents } = require('discord.js');
const config = require('./config.json');

const { handleMessage } = require('./pkg/msg-handler');

const bot = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.DIRECT_MESSAGES
]});
const token = config.TOKEN;

let servers = {};
let server;

bot.on('ready', () => {
    console.log("bot is online");
})

bot.on('message', msg => {
    handleMessage(bot, servers, server, msg);
})

bot.login(token).then(() => {
    console.log("bot has logged in");
}, err => {
    console.log("Error logging in: " + err);
});
