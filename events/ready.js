const { Events, ActivityType } = require('discord.js');
const database = require('../utils/database');
const config = require('../config/config');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ Bot conectado como ${client.user.tag}`);
        console.log('═══════════════════════════════════════════════════════════');
        
        // Conectar a la base de datos
        try {
            await database.connect();
        } catch (error) {
            console.error('❌ Error crítico: No se pudo conectar a la base de datos');
            console.error(error);
            process.exit(1);
        }

        // Establecer estado del bot
        client.user.setPresence({
            activities: [{
                name: `${config.branding.serverName} | /panel`,
                type: ActivityType.Watching
            }],
            status: 'online'
        });

        // Iniciar sistema de inactividad
        startInactivityChecker(client);

        console.log('');
        console.log('📊 Estado del Sistema:');
        console.log(`   Servidor: ${client.guilds.cache.first()?.name || 'N/A'}`);
        console.log(`   Usuarios: ${client.guilds.cache.first()?.memberCount || 0}`);
        console.log(`   Base de datos: ${database.isConnected() ? '✅ Conectado' : '❌ Desconectado'}`);
        console.log('');
        console.log('🎫 Sistema de Tickets: ACTIVO');
        console.log('═══════════════════════════════════════════════════════════');
    }
};

/**
 * Sistema de verificación de inactividad en tickets
 */
function startInactivityChecker(client) {
    const Ticket = require('../models/Ticket');
    
    // Verificar cada 15 minutos
    setInterval(async () => {
        try {
            const warningTime = config.system.inactivityWarning;
            const closeTime = config.system.inactivityClose;
            
            // Tickets para advertencia (42 horas sin actividad)
            const ticketsToWarn = await Ticket.getInactiveTickets(warningTime);
            
            for (const ticket of ticketsToWarn) {
                if (!ticket.inactivityWarned) {
                    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
                    if (channel) {
                        await channel.send({
                            content: config.messages.inactivityWarning,
                            embeds: [{
                                color: parseInt(config.branding.colors.warning.replace('#', ''), 16),
                                description: '⏰ Este ticket se cerrará en **2 horas** si no hay actividad.',
                                footer: { text: 'Responde para mantener el ticket abierto' },
                                timestamp: new Date()
                            }]
                        });
                        
                        ticket.inactivityWarned = true;
                        await ticket.save();
                    }
                }
            }
            
            // Tickets para cerrar (44 horas sin actividad)
            const ticketsToClose = await Ticket.getInactiveTickets(closeTime);
            
            for (const ticket of ticketsToClose) {
                if (ticket.inactivityWarned) {
                    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
                    if (channel) {
                        // Cerrar automáticamente
                        await closeTicketAutomatically(client, ticket, channel);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error en verificación de inactividad:', error);
        }
    }, 15 * 60 * 1000); // Cada 15 minutos
}

/**
 * Cierra un ticket automáticamente por inactividad
 */
async function closeTicketAutomatically(client, ticket, channel) {
    const transcriptGenerator = require('../utils/transcriptGenerator');
    const Stats = require('../models/Stats');
    
    try {
        // Generar transcripción
        let transcriptPaths = null;
        if (config.system.autoTranscripts) {
            transcriptPaths = await transcriptGenerator.save(ticket);
        }
        
        // Actualizar ticket en BD
        await ticket.close('Sistema', 'Bot', 'Inactividad');
        
        // Mensaje de cierre
        await channel.send({
            embeds: [{
                color: parseInt(config.branding.colors.error.replace('#', ''), 16),
                title: '🔒 Ticket Cerrado Automáticamente',
                description: config.messages.ticketClosed,
                fields: [
                    {
                        name: 'Razón',
                        value: 'Inactividad (44 horas sin respuesta)',
                        inline: true
                    },
                    {
                        name: 'Transcripción',
                        value: transcriptPaths ? '✅ Generada' : '❌ Desactivada',
                        inline: true
                    }
                ],
                footer: { text: `${config.branding.serverName} • Soporte Oficial` },
                timestamp: new Date()
            }]
        });
        
        // Mover a categoría cerrados
        if (config.categories.closed) {
            await channel.setParent(config.categories.closed);
        }
        
        // Bloquear canal
        await channel.permissionOverwrites.edit(ticket.userId, {
            SendMessages: false
        });
        
        // Log
        await logTicketClose(client, ticket, 'Inactividad', transcriptPaths);
        
        // Actualizar stats
        const stats = await Stats.getTodayStats();
        await stats.incrementClosed();
        
    } catch (error) {
        console.error('Error cerrando ticket automáticamente:', error);
    }
}

/**
 * Envía log de cierre de ticket
 */
async function logTicketClose(client, ticket, reason, transcriptPaths) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    const embed = {
        color: parseInt(config.branding.colors.error.replace('#', ''), 16),
        title: '🔒 Ticket Cerrado',
        fields: [
            { name: 'ID', value: ticket.ticketId, inline: true },
            { name: 'Tipo', value: ticket.type, inline: true },
            { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Razón', value: reason, inline: true },
            { name: 'Duración', value: calculateDuration(ticket.createdAt, ticket.closedAt), inline: true }
        ],
        footer: { text: 'Sistema de Tickets' },
        timestamp: new Date()
    };
    
    const files = [];
    if (transcriptPaths) {
        if (transcriptPaths.txt) files.push(transcriptPaths.txt);
        if (transcriptPaths.html) files.push(transcriptPaths.html);
    }
    
    await logChannel.send({
        embeds: [embed],
        files: files
    });
}

function calculateDuration(start, end) {
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}
