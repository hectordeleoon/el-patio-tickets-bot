const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Cargar comandos
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Comando cargado: ${command.data.name}`);
    } else {
        console.log(`⚠️ Advertencia: ${file} no tiene "data" o "execute"`);
    }
}

// Construir REST y desplegar comandos
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📤 Desplegando ${commands.length} comando(s) slash...`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

        // Desplegar comandos
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log(`✅ ${data.length} comando(s) desplegado(s) exitosamente!`);
        console.log('');
        console.log('Comandos registrados:');
        data.forEach((cmd, index) => {
            console.log(`  ${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ Proceso completado');
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ Error al desplegar comandos:');
        console.error('═══════════════════════════════════════════════════════════');
        console.error(error);
    }
})();
