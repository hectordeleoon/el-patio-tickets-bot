const config = require('../config/config');

/**
 * Envía un log al canal de logs del servidor
 * @param {Client} client - Cliente de Discord
 * @param {Object} data - Datos del log
 */
async function sendTicketLog(client, data) {
    if (!config.channels.logs) {
        console.warn('⚠️ Canal de logs no configurado');
        return;
    }

    try {
        const logChannel = await client.channels.fetch(config.channels.logs);
        if (!logChannel) {
            console.error('❌ No se encontró el canal de logs');
            return;
        }

        const embed = {
            footer: { text: config.branding.serverName },
            timestamp: new Date()
        };

        switch (data.action) {
            case 'created':
                embed.color = parseInt(config.branding.colors.success.replace('#', ''), 16);
                embed.title = '🎫 Ticket Creado';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '📂 Tipo', value: data.type, inline: true },
                    { name: '📝 Descripción', value: data.detail || 'Sin descripción', inline: false },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'claimed':
                embed.color = parseInt(config.branding.colors.primary.replace('#', ''), 16);
                embed.title = '🛎️ Ticket Reclamado';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '👨‍💼 Reclamado por', value: `<@${data.claimedBy}>`, inline: true },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'staff_added':
                embed.color = parseInt(config.branding.colors.accent.replace('#', ''), 16);
                embed.title = '👥 Staff Añadido';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👨‍💼 Staff añadido', value: `<@${data.staffId}>`, inline: true },
                    { name: '👤 Añadido por', value: `<@${data.addedBy}>`, inline: true },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'closed':
                embed.color = parseInt(config.branding.colors.error.replace('#', ''), 16);
                embed.title = '🔒 Ticket Cerrado';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '👨‍💼 Cerrado por', value: `<@${data.closedBy}>`, inline: true },
                    { name: '📝 Razón', value: data.reason || 'No especificada', inline: false },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'reopened':
                embed.color = parseInt(config.branding.colors.success.replace('#', ''), 16);
                embed.title = '🔓 Ticket Reabierto';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '👨‍💼 Reabierto por', value: `<@${data.reopenedBy}>`, inline: true },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'deleted':
                embed.color = parseInt(config.branding.colors.error.replace('#', ''), 16);
                embed.title = '🗑️ Ticket Eliminado';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '👨‍💼 Eliminado por', value: `<@${data.deletedBy}>`, inline: true }
                ];
                break;

            case 'inactivity_warning':
                embed.color = parseInt(config.branding.colors.warning.replace('#', ''), 16);
                embed.title = '⚠️ Advertencia de Inactividad';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '⏱️ Horas inactivo', value: `${data.hours}h`, inline: true },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            case 'inactivity_closed':
                embed.color = parseInt(config.branding.colors.error.replace('#', ''), 16);
                embed.title = '⏱️ Ticket Cerrado por Inactividad';
                embed.fields = [
                    { name: '📋 ID', value: data.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: '⏱️ Horas inactivo', value: `${data.hours}h`, inline: true },
                    { name: '🔗 Canal', value: `<#${data.channelId}>`, inline: false }
                ];
                break;

            default:
                console.warn(`⚠️ Tipo de log desconocido: ${data.action}`);
                return;
        }

        await logChannel.send({ embeds: [embed] });
        console.log(`✅ Log enviado: ${data.action} - Ticket #${data.ticketId}`);

    } catch (error) {
        console.error('❌ Error enviando log:', error);
    }
}

/**
 * Log simple de texto al canal de logs
 * @param {Client} client - Cliente de Discord
 * @param {string} message - Mensaje a enviar
 */
async function sendSimpleLog(client, message) {
    if (!config.channels.logs) return;

    try {
        const logChannel = await client.channels.fetch(config.channels.logs);
        if (logChannel) {
            await logChannel.send(message);
        }
    } catch (error) {
        console.error('❌ Error enviando log simple:', error);
    }
}

module.exports = {
    sendTicketLog,
    sendSimpleLog
};
