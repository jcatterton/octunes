const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const config = require('./config.json');

const { handleMessage } = require('./pkg/msg-handler');
const commands = require('./pkg/commands');

const bot = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
]});

const token = config.TOKEN;
const clientID = config.CLIENT_ID;
const guildID = config.GUILD_ID;
const allowedTextChannels = config.ALLOWED_TEXT_CHANNELS.split(",");

let servers = {};
let server;

if (!servers[guildID]) {
    servers[guildID] = {
        queue: [],
        mix: [],
        mixIndex: -1,
        guildID: guildID
    }
}
server = servers[guildID]

bot.on('ready', () => {
    console.log("bot is online");
})

bot.on('messageCreate', (msg) => {
    handleMessage(bot, servers, server, msg);
})

const jsonCommands = [];
bot.commands = new Collection();
for (const c of commands) {
    bot.commands.set(c.data.name, c);

    jsonCommands.push(c.data.toJSON());
}

const rest = new REST().setToken(token);
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientID, guildID),
			{ body: jsonCommands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();

bot.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

	if (interaction.guildId !== guildID) return;

	if (!allowedTextChannels.some(c => c === interaction.channelId)) {
		interaction.reply({ content: "Sorry, commands don't work in this channel.", ephemeral: true });
		return;
	}
    
    const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(bot, servers, server, interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

bot.login(token).then(() => {
    console.log("bot has logged in");
}, err => {
    console.log("Error logging in: " + err);
});