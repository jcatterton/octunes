const discord = require('discord.js');
const config = require('./config.json');

const { handleMessage } = require('./pkg/msg-handler');

const bot = new discord.Client();
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
