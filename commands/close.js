const { SlashCommandBuilder } = require('discord.js');
const Ticket = require('../models/Ticket');
const transcriptGenerator = require('../utils/transcriptGenerator');
const config = require('../config/config');
const Stats = require('../models/Stats');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Cierra el ticket actual')
        .addStringOption(option =>
            option
                .setName('razon')
                .setDescription('Razón del cierre')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        // Verificar que estamos en un canal de ticket
        if (!interaction.channel.name || !interaction.channel.name.startsWith('ticket-')) {
            return interaction.editReply({
                content: '❌ Este comando solo puede usarse en canales de tickets.'
            });
        }
        
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        
        if (!ticket) {
            return interaction.editReply({
                content: '❌ No se encontró información de este ticket en la base de datos.'
            });
        }
        
        if (ticket.status === 'closed') {
            return interaction.editReply({
                content: '❌ Este ticket ya está cerrado.'
            });
        }
        
        try {
            const reason = interaction.options.getString('razon');
            
            // Generar transcripción
            let transcriptPaths = null;
            if (config.system.autoTranscripts) {
                await interaction.editReply({
                    content: '⏳ Generando transcripción...'
                });
                transcriptPaths = await transcriptGenerator.save(ticket);
            }
            
            // Cerrar ticket
            await ticket.close(interaction.user.id, interaction.user.tag, reason);
            
            // Mensaje de cierre
            const closeEmbed = {
                color: parseInt(config.branding.colors.error.replace('#', ''), 16),
                title: '🔒 Ticket Cerrado',
                description: config.messages.ticketClosed,
                fields: [
                    {
                        name: '👤 Creado por',
                        value: `<@${ticket.userId}>`,
                        inline: true
                    },
                    {
                        name: '🛡️ Cerrado por',
                        value: `<@${interaction.user.id}> (${interaction.user.username})`,
                        inline: true
                    },
                    {
                        name: '📝 Razón del cierre',
                        value: reason,
                        inline: false
                    },
                    {
                        name: '📄 Transcripción',
                        value: transcriptPaths ? '✅ Generada' : '❌ Desactivada',
                        inline: true
                    }
                ],
                footer: { text: `${config.branding.serverName} • Soporte Oficial` },
                timestamp: new Date()
            };
            
            const components = [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: '🔓 Reabrir',
                        style: 1,
                        custom_id: 'reopen_ticket'
                    },
                    {
                        type: 2,
                        label: '🗑️ Eliminar Canal',
                        style: 4,
                        custom_id: 'delete_ticket'
                    }
                ]
            }];
            
            await interaction.channel.send({
                embeds: [closeEmbed],
                components
            });
            
            // Mover a categoría cerrados
            if (config.categories.closed) {
                await interaction.channel.setParent(config.categories.closed);
            }
            
            // Bloquear canal para el usuario
            await interaction.channel.permissionOverwrites.edit(ticket.userId, {
                SendMessages: false
            });
            
            // Log
            await logTicketClose(client, ticket, interaction.user, reason, transcriptPaths);
            
            // Stats
            const stats = await Stats.getTodayStats();
            await stats.incrementClosed();
            if (ticket.claimedBy) {
                await stats.updateStaffActivity(ticket.claimedBy.userId, ticket.claimedBy.username, 'close');
            }
            
            await interaction.editReply({
                content: '✅ Ticket cerrado exitosamente.'
            });
            
        } catch (error) {
            console.error('Error cerrando ticket:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al cerrar el ticket.'
            });
        }
    }
};

async function logTicketClose(client, ticket, user, reason, transcriptPaths) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    const files = [];
    if (transcriptPaths) {
        if (transcriptPaths.txt) files.push(transcriptPaths.txt);
        if (transcriptPaths.html) files.push(transcriptPaths.html);
    }
    
    await logChannel.send({
        embeds: [{
            color: parseInt(config.branding.colors.error.replace('#', ''), 16),
            title: '🔒 Ticket Cerrado',
            fields: [
                { name: 'ID', value: ticket.ticketId, inline: true },
                { name: 'Tipo', value: ticket.type, inline: true },
                { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
                { name: 'Cerrado por', value: `<@${user.id}> (${user.username})`, inline: true },
                { name: 'Razón', value: reason, inline: false },
                { name: 'Transcripción', value: transcriptPaths ? '✅' : '❌', inline: true }
            ],
            timestamp: new Date()
        }],
        files
    });
}
