const { playSong, getNowPlayingInfo, pause, resume, shuffleQueue, bumpSong, swapSongs, move, stop, outputQueue } = require("./player");
const { log, sendChannelReplyAndLog, sendChannelMessageAndLog, getRandomCat, getRandomDog, getRandomFrog, getRandomFarmAnimal, getRandomOctopus, getRandomDinosaur, getRandomCapybara } = require("./utilities");
const { SlashCommandBuilder } = require('discord.js');

const version = require('../version');
const info = require('../text-files/info');
const help = require('../text-files/help');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with Pong!'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Pong!');
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('play')
            .setDescription('Plays a direct youtube link or youtube search query.')
            .addStringOption(option => 
                option.setName('input').setDescription('Direct youtube link or youtube search query.')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...');
            playSong(bot, interaction, interaction.options.getString('input'), server, false);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('mix')
            .setDescription('Generates a mix based on a provided link or search query.')
            .addStringOption(option =>
                option.setName('input').setDescription('Direct youtube link or youtube search query.')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...');
            playSong(bot, interaction, interaction.options.getString('input'), server, true);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Skips the currently playing song.'),
        async execute(bot, servers, server, interaction) {
            if (!server.dispatcher) {
                await interaction.reply("There isn't anything playing. :thinking:");
                return
            }
            await interaction.reply("Processing request...")
            server.dispatcher.emit("skip", interaction);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stops playback.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            stop(interaction, bot, server, server.guildID);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Outputs current queue.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            outputQueue(interaction, server);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('now-playing')
            .setDescription('Outputs information on currently playing song.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            getNowPlayingInfo(interaction, server)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Removes a song from queue.')
            .addIntegerOption(
                option => option.setName('index').setDescription('Index of song in queue')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            const index = interaction.options.getInteger('index')
            if (index <= 0 || isNaN(index)) {
                interaction.editReply('Invalid index provided. Learn to count, ya dingus!');
                return;
            }

            try {
                interaction.editReply(server.queue.splice(index, 1)[0].title + " removed from queue.");
            } catch {
                interaction.editReply('Invalid index provided. Learn to count, ya dingus!');
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pauses playback.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            pause(interaction, server)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('resume')
            .setDescription('Resumes playback.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            resume(interaction, server)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ding')
            .setDescription('Responds dong'),
        async execute(bot, servers, server, interaction) {
            if (interaction.user.id === "230081914776715264") {
                await interaction.reply("Fuck you, Moss");
            } else {
                await interaction.reply("dong!");
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('yo')
            .setDescription('Yo!'),
        async execute(bot, servers, server, interaction) {
            const r = Math.random();
            if (r <= 0.2) {
                interaction.reply("Yo!")
            } else if (r <= 0.4) {
                interaction.reply("Yooooo")
            } else if (r <= 0.6) {
                interaction.reply("YOOOO!")
            } else if (r <= 0.8) {
                interaction.reply("yooo...")
            } else {
                interaction.reply("YOOOOoooooooo")
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('shuffle')
            .setDescription('Shuffles the queue.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            shuffleQueue(server, interaction)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('bump')
            .setDescription('Bumps a specific song to the top of the queue.')
            .addIntegerOption(
                option => option.setName('index').setDescription('Index of song in queue')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            bumpSong(interaction, server, interaction.options.getInteger('index'))
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('swap')
            .setDescription('Swaps two songs in the queue.')
            .addIntegerOption(
                option => option.setName('first-song').setDescription('Index of first song in queue to be swapped')
            )
            .addIntegerOption(
                option => option.setName('second-song').setDescription('Index of second song queue in to be swapped')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            swapSongs(interaction, server, interaction.options.getInteger('first-song'), interaction.options.getInteger('second-song'))
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('move')
            .setDescription('Moves a song to a different place in the queue')
            .addIntegerOption(
                option => option.setName('song-index').setDescription('Index of the song in queue to be moved')
            )
            .addIntegerOption(
                option => option.setName('new-index').setDescription('Index where the song should be moved to')
            ),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            move(interaction, server, interaction.options.getInteger('song-index'), interaction.options.getInteger('new-index'))
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('pspsps')
            .setDescription('Meow'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            getRandomCat(interaction)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('woof')
            .setDescription('Woof'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            getRandomDog(interaction)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ribbit')
            .setDescription('Ribbit'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply('Processing request...')
            getRandomFrog(interaction)
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('info')
            .setDescription('Get bot info'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply({ content: info.replace("<<version>>", version.replace("\n", "")), ephemeral: true })
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('Sends the user a list of all slash commands.'),
        async execute(bot, servers, server, interaction) {
            await interaction.reply({ content: help, ephemeral: true })
        }
    }
]

/*
    case "octo":
        getRandomOctopus(msg);
        break;
    case "rawr":
        getRandomDinosaur(msg);
        break;
    case "capybara":
        getRandomCapybara(msg);
        break;
        */