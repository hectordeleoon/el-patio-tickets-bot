const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Crea el panel principal de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Crear embed principal
            const embed = {
                color: parseInt(config.branding.colors.primary.replace('#', ''), 16),
                title: config.messages.panelTitle,
                description: config.messages.panelDescription,
                footer: {
                    text: `${config.branding.serverName} • Soporte Oficial`
                },
                timestamp: new Date()
            };
            
            // Agregar GIF si está configurado
            if (config.branding.panelGif) {
                embed.image = { url: config.branding.panelGif };
            }
            
            // Agregar thumbnail si está configurado
            if (config.branding.panelThumbnail) {
                embed.thumbnail = { url: config.branding.panelThumbnail };
            }
            
            // Crear botones
            const components = [];
            
            // Primera fila: Soporte General, Donaciones, Apelaciones
            components.push({
                type: 1,
                components: [
                    {
                        type: 2,
                        label: config.ticketTypes['soporte-general'].label,
                        emoji: config.ticketTypes['soporte-general'].emoji,
                        style: 3, // Verde
                        custom_id: 'ticket_soporte-general'
                    },
                    {
                        type: 2,
                        label: config.ticketTypes['donaciones'].label,
                        emoji: config.ticketTypes['donaciones'].emoji,
                        style: 1, // Azul
                        custom_id: 'ticket_donaciones'
                    },
                    {
                        type: 2,
                        label: config.ticketTypes['apelaciones'].label,
                        emoji: config.ticketTypes['apelaciones'].emoji,
                        style: 2, // Gris
                        custom_id: 'ticket_apelaciones'
                    }
                ]
            });
            
            // Segunda fila: Reportar Staff, Otros
            components.push({
                type: 1,
                components: [
                    {
                        type: 2,
                        label: config.ticketTypes['reportar-staff'].label,
                        emoji: config.ticketTypes['reportar-staff'].emoji,
                        style: 4, // Rojo
                        custom_id: 'ticket_reportar-staff'
                    },
                    {
                        type: 2,
                        label: config.ticketTypes['otros'].label,
                        emoji: config.ticketTypes['otros'].emoji,
                        style: 2, // Gris
                        custom_id: 'ticket_otros'
                    }
                ]
            });
            
            // Enviar panel
            await interaction.channel.send({
                embeds: [embed],
                components: components
            });
            
            await interaction.editReply({
                content: '✅ Panel de tickets creado exitosamente.'
            });
            
        } catch (error) {
            console.error('Error creando panel:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al crear el panel.'
            });
        }
    }
};
