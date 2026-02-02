const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 🔥 NUEVO SISTEMA UNIFICADO
const checkTickets = require('./utils/checkTickets');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.ThreadMember]
});

client.commands = new Collection();

// ===============================
// CARGAR COMANDOS
// ===============================
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    try {
        const cmd = require(path.join(commandsPath, file));
        if (cmd && cmd.data && cmd.data.name) {
            client.commands.set(cmd.data.name, cmd);
            console.log(`✅ Comando cargado: ${cmd.data.name}`);
        } else {
            console.warn(`⚠️  Archivo "${file}" no tiene cmd.data.name válido`);
        }
    } catch (err) {
        console.error(`❌ Error cargando comando "${file}":`, err.message);
    }
}

// ===============================
// CARGAR EVENTOS
// ===============================
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    try {
        const evt = require(path.join(eventsPath, file));
        if (evt && evt.name && evt.execute) {
            client.on(evt.name, (...args) => evt.execute(...args, client));
            console.log(`✅ Evento cargado: ${evt.name}`);
        } else {
            console.warn(`⚠️  Archivo "${file}" no tiene evt.name o evt.execute válido`);
        }
    } catch (err) {
        console.error(`❌ Error cargando evento "${file}":`, err.message);
    }
}

// ===============================
// REVISIÓN AUTOMÁTICA DE TICKETS
// ===============================
// Cada 10 minutos
setInterval(async () => {
    try {
        if (typeof checkTickets === 'function') {
            await checkTickets(client);
            console.log('⏱️ Revisión de tickets completada');
        } else {
            console.warn('⚠️ checkTickets no es una función válida');
        }
    } catch (err) {
        console.error('❌ Error en checkTickets:', err);
    }
}, 10 * 60 * 1000);

// ===============================
// LOGIN
// ===============================
client.once(Events.ClientReady, () => {
    console.log('══════════════════════════════════════════════');
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log('🎫 Sistema de Tickets: ACTIVO');
    console.log('══════════════════════════════════════════════');
});

client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('🔑 Login exitoso'))
    .catch(err => console.error('❌ Error al iniciar sesión:', err));
