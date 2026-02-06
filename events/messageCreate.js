const { Events } = require('discord.js');
const Ticket = require('../models/Ticket');
const config = require('../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorar mensajes del bot
        if (message.author.bot) return;
        
        // Verificar si es un canal de ticket
        if (!message.channel.name?.startsWith('ticket-')) return;
        
        // Buscar el ticket en la base de datos
        const ticket = await Ticket.findOne({ channelId: message.channel.id });
        if (!ticket) return;

        // Obtener información del tipo de ticket
        const typeInfo = config.ticketTypes[ticket.type];
        
        // Verificar si el autor es staff
        const isStaff = typeInfo.roles.some(roleKey => {
            const roleId = config.roles[roleKey];
            return roleId && message.member.roles.cache.has(roleId);
        }) || message.member.permissions.has('Administrator');

        // ✅ AUTO-MENCIÓN: Si el staff escribe, mencionar al usuario del ticket
        if (isStaff && message.author.id !== ticket.userId) {
            // Solo mencionar si el usuario NO fue mencionado ya en el mensaje
            if (!message.mentions.has(ticket.userId) && !message.content.includes(`<@${ticket.userId}>`)) {
                // Enviar mención después del mensaje del staff
                await message.channel.send({
                    content: `↑ <@${ticket.userId}>`,
                    allowedMentions: { 
                        users: [ticket.userId]
                    }
                }).catch(err => console.error('Error enviando mención:', err));
            }

            // Actualizar última actividad del staff
            ticket.lastStaffMessageAt = new Date();
            ticket.lastActivity = new Date();
            ticket.alert48hSent = false;
            await ticket.save();

            console.log(`📨 Staff ${message.author.tag} escribió en ticket #${ticket.ticketId}`);
        } 
        // ✅ Si el usuario del ticket escribe, actualizar actividad
        else if (message.author.id === ticket.userId) {
            ticket.lastActivity = new Date();
            ticket.inactivityWarned = false;
            await ticket.save();

            console.log(`💬 Usuario ${message.author.tag} respondió en ticket #${ticket.ticketId}`);
        }

        // ✅ Guardar mensaje en el historial del ticket
        try {
            const attachments = message.attachments.map(att => att.url);
            await ticket.addMessage(
                message.author.id,
                message.author.tag,
                message.content,
                attachments,
                isStaff
            );
        } catch (error) {
            console.error('Error guardando mensaje en historial:', error);
        }
    }
};
