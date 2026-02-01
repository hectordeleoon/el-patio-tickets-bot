const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const checkTickets48h = require('./utils/checkTickets48h');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

/* CARGAR COMANDOS */
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
    const cmd = require(path.join(commandsPath, file));
    client.commands.set(cmd.data.name, cmd);
}

/* CARGAR EVENTOS */
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
    const evt = require(path.join(eventsPath, file));
    client.on(evt.name, (...args) => evt.execute(...args, client));
}

/* REVISIÓN AUTOMÁTICA CADA HORA */
setInterval(() => {
    checkTickets48h(client);
}, 60 * 60 * 1000);

client.login(process.env.DISCORD_TOKEN);
