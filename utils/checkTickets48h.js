const Ticket = require('../models/Ticket');
const config = require('../config/config');

module.exports = async (client) => {
    const staffChannel = await client.channels
        .fetch(config.channels.staffChat)
        .catch(() => null);

    if (!staffChannel) return;

    const now = Date.now();

    const H24 = 24 * 60 * 60 * 1000;
    const H48 = 48 * 60 * 60 * 1000;
    const H72 = 72 * 60 * 60 * 1000;

    const tickets = await Ticket.find({
        status: { $in: ['open', 'claimed'] }
    });

    for (const ticket of tickets) {

        /* ===============================
           ⏰ TICKET SIN RECLAMAR
        =============================== */

        if (ticket.status === 'open') {
            const age = now - ticket.createdAt.getTime();

            // 24h
            if (age >= H24 && !ticket.alert24hSent) {
                await staffChannel.send(
                    `🕐 **Ticket sin reclamar (24h)**\n` +
                    `📌 Canal: <#${ticket.channelId}>\n` +
                    `👤 Usuario: <@${ticket.userId}>`
                );
                ticket.alert24hSent = true;
                await ticket.save();
            }

            // 48h
            if (age >= H48 && !ticket.alert48hSent) {
                await staffChannel.send(
                    `⚠️ **Ticket sin reclamar (48h)**\n` +
                    `📌 Canal: <#${ticket.channelId}>\n` +
                    `👤 Usuario: <@${ticket.userId}>`
                );
                ticket.alert48hSent = true;
                await ticket.save();
            }

            // 72h → auto-cerrar
            if (age >= H72) {
                await staffChannel.send(
                    `🔒 **Ticket auto-cerrado (72h sin atención)**\n` +
                    `📌 Canal: <#${ticket.channelId}>`
                );

                ticket.status = 'closed';
                ticket.closedAt = new Date();
                ticket.closedBy = {
                    userId: 'SYSTEM',
                    username: 'AutoClose',
                    reason: 'Inactivo 72h sin reclamar'
                };
                await ticket.save();

                const channel = await client.channels
                    .fetch(ticket.channelId)
                    .catch(() => null);

                if (channel) {
                    await channel.send('🔒 Ticket cerrado automáticamente por inactividad.');
                    await channel.setParent(config.categories.closed).catch(() => {});
                }
            }
        }

        /* ===============================
           ⏰ TICKET RECLAMADO PERO ABANDONADO
        =============================== */

        if (ticket.status === 'claimed') {
            const sinceClaim = now - ticket.claimedAt.getTime();

            // 24h
            if (sinceClaim >= H24 && !ticket.alert24hSent) {
                await staffChannel.send(
                    `🕐 **Ticket reclamado sin respuesta (24h)**\n` +
                    `📌 Canal: <#${ticket.channelId}>\n` +
                    `🛡️ Staff: <@${ticket.claimedBy.userId}>`
                );
                ticket.alert24hSent = true;
                await ticket.save();
            }

            // 48h → reasignar
            if (sinceClaim >= H48 && !ticket.alert48hSent) {
                await staffChannel.send(
                    `🔁 **Ticket reasignado (48h sin trabajo)**\n` +
                    `📌 Canal: <#${ticket.channelId}>\n` +
                    `🛡️ Staff anterior: <@${ticket.claimedBy.userId}>`
                );

                ticket.status = 'open';
                ticket.claimedBy = null;
                ticket.claimedAt = null;
                ticket.alert48hSent = true;
                await ticket.save();

                const channel = await client.channels
                    .fetch(ticket.channelId)
                    .catch(() => null);

                if (channel) {
                    await channel.send(
                        '🔁 Ticket liberado automáticamente por inactividad del staff.\n' +
                        'Cualquier staff disponible puede atenderlo.'
                    );
                }
            }

            // 72h → auto-cerrar
            if (sinceClaim >= H72) {
                await staffChannel.send(
                    `🔒 **Ticket auto-cerrado (72h sin trabajo)**\n` +
                    `📌 Canal: <#${ticket.channelId}>`
                );

                ticket.status = 'closed';
                ticket.closedAt = new Date();
                ticket.closedBy = {
                    userId: 'SYSTEM',
                    username: 'AutoClose',
                    reason: 'Reclamado pero abandonado 72h'
                };
                await ticket.save();

                const channel = await client.channels
                    .fetch(ticket.channelId)
                    .catch(() => null);

                if (channel) {
                    await channel.send('🔒 Ticket cerrado automáticamente por abandono.');
                    await channel.setParent(config.categories.closed).catch(() => {});
                }
            }
        }
    }
};
