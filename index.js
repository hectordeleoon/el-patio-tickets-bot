const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const checkTickets = require('./utils/checkTickets');
const Ticket = require('./models/Ticket'); // Necesario para auto-archivo
const config = require('./config/config');

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

/* ===============================
   CARGAR COMANDOS
================================ */
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    try {
        const cmd = require(path.join(commandsPath, file));
        if (cmd && cmd.data && cmd.data.name) {
            client.commands.set(cmd.data.name, cmd);
            console.log(`✅ Comando cargado: ${cmd.data.name}`);
        } else {
            console.warn(`⚠️  Archivo "${file}" no tiene la estructura correcta`);
        }
    } catch (error) {
        console.error(`❌ Error cargando comando "${file}":`, error.message);
    }
}

/* ===============================
   CARGAR EVENTOS
================================ */
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const evt = require(path.join(eventsPath, file));
    client.on(evt.name, (...args) => evt.execute(...args, client));
}

/* ===============================
   ⏱️ REVISIÓN AUTOMÁTICA
================================ */
setInterval(() => {
    checkTickets(client).catch(console.error);
}, 10 * 60 * 1000);

/* ===============================
   ⏱️ AUTO-ARCHIVO DE TICKETS CERRADOS
   Cada 12 horas revisa tickets cerrados y archiva los antiguos
================================ */
const AUTO_ARCHIVE_DAYS = 3; // Cambia a los días que quieras

async function autoArchiveClosedTickets(client) {
    try {
        const tickets = await Ticket.find({ status: 'closed', archived: { $ne: true } });

        for (const ticket of tickets) {
            const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
            if (!channel || !channel.isThread()) continue;

            const now = new Date();
            const closedAt = ticket.closedAt || ticket.updatedAt || now;
            const diffDays = (now - closedAt) / (1000 * 60 * 60 * 24);

            if (diffDays >= AUTO_ARCHIVE_DAYS) {
                await channel.setArchived(true).catch(console.error);
                ticket.archived = true;
                await ticket.save();
                console.log(`🗂 Ticket #${ticket.ticketId} archivado automáticamente.`);
            }
        }
    } catch (err) {
        console.error('Error al auto-archivar tickets:', err);
    }
}

// Ejecutar cada 12 horas
setInterval(() => autoArchiveClosedTickets(client), 1000 * 60 * 60 * 12);

/* ===============================
   LOGIN
================================ */
client.login(process.env.DISCORD_TOKEN);
