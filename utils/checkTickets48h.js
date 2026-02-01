const Ticket = require('../models/Ticket');
const applySanction = require('./staffSanctions');
const config = require('../config/config');

module.exports = async (client) => {
    const staffChannel = await client.channels
        .fetch(config.channels.staffChat)
        .catch(() => null);

    if (!staffChannel) return;

    const now = Date.now();
    const H48 = 48 * 60 * 60 * 1000;
    const H72 = 72 * 60 * 60 * 1000;

    const tickets = await Ticket.find({
        status: { $in: ['open', 'claimed'] }
    });

    for (const t of tickets) {

        // 🔴 RECLAMADO Y ABANDONADO
        if (
            t.status === 'claimed' &&
            t.claimedAt &&
            now - t.claimedAt.getTime() >= H48 &&
            !t.lastStaffMessageAt
        ) {
            await staffChannel.send(
                `🚨 **Ticket abandonado por staff**\n` +
                `📌 Canal: <#${t.channelId}>\n` +
                `🛡️ Staff: <@${t.claimedBy.userId}>`
            );

            await applySanction(
                client,
                t.claimedBy.userId,
                t.claimedBy.username,
                'Ticket reclamado y no trabajado en 48h'
            );

            // Reabrir ticket
            t.status = 'open';
            t.claimedBy = null;
            t.claimedAt = null;
            await t.save();

            const ch = await client.channels.fetch(t.channelId).catch(() => null);
            if (ch) {
                ch.send(
                    '🔁 Ticket liberado automáticamente por abandono del staff.\n' +
                    'Otro staff puede atenderlo.'
                ).catch(() => {});
            }
        }

        // 🔒 AUTO-CIERRE FINAL
        if (
            t.status === 'open' &&
            now - t.createdAt.getTime() >= H72
        ) {
            t.status = 'closed';
            t.closedAt = new Date();
            t.closedBy = {
                userId: 'SYSTEM',
                username: 'AutoClose',
                reason: 'Ticket inactivo 72h'
            };
            await t.save();

            const ch = await client.channels.fetch(t.channelId).catch(() => null);
            if (ch) {
                ch.send('🔒 Ticket cerrado automáticamente por inactividad.');
                ch.setParent(config.categories.closed).catch(() => {});
            }
        }
    }
};
