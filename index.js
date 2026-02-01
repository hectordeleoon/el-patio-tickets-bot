const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// 🔥 NUEVO SISTEMA UNIFICADO 48H / 72H
const checkTickets = require('./utils/checkTickets');
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
        
        // ✅ VALIDACIÓN: verificar que el comando tenga la estructura correcta
        if (cmd && cmd.data && cmd.data.name) {
            client.commands.set(cmd.data.name, cmd);
            console.log(`✅ Comando cargado: ${cmd.data.name}`);
        } else {
            console.warn(`⚠️  Archivo "${file}" no tiene la estructura correcta (falta cmd.data.name)`);
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
   cada 10 minutos (recomendado)
================================ */
setInterval(() => {
    checkTickets(client).catch(console.error);
}, 10 * 60 * 1000);
/* ===============================
   LOGIN
================================ */
client.login(process.env.DISCORD_TOKEN);
