const { Events } = require('discord.js');
const Ticket = require('../models/Ticket');
const config = require('../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        if (!message.channel.name?.startsWith('ticket-')) return;

        const ticket = await Ticket.findOne({ channelId: message.channel.id });
        if (!ticket) return;

        await ticket.addMessage(
            message.author.id,
            message.author.tag,
            message.content,
            message.attachments.map(a => a.url)
        );

        const typeInfo = config.ticketTypes[ticket.type];

        const isStaff = typeInfo.roles.some(roleKey => {
            const roleId = config.roles[roleKey];
            return roleId && message.member.roles.cache.has(roleId);
        });

        if (isStaff && ticket.status === 'claimed') {
            await ticket.markStaffActivity();
        }
    }
};
