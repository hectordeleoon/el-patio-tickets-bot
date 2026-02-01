const Ticket = require('../models/Ticket');
const applySanction = require('./staffSanctions');
const config = require('../config/config');

module.exports = async (client) => {
    const staffChannel = await client.channels
        .fetch(config.channels.staffChat)
        .catch(() => null);

    const now = Date.now();
    const H48 = 48 * 60 * 60 * 1000;
    const H72 = 72 * 60 * 60 * 1000;

    const tickets = await Ticket.find({
        status: { $in: ['open', 'claimed'] }
    });

    for (const t of tickets) {

        /* =============================
           🚨 ALERTA + SANCIÓN 48H
        ============================= */
        if (
            t.status === 'claimed' &&
            t.claimedAt &&
            now - t.claimedAt.getTime() >= H48 &&
            !t.alert48hSent
        ) {
            if (staffChannel) {
                await staffChannel.send(
                    `🚨 **STAFF INACTIVO (48H)**\n` +
                    `📌 Canal: <#${t.channelId}>\n` +
                    `🛡️ Staff: <@${t.claimedBy.userId}>\n` +
                    `⚠️ Motivo: Ticket reclamado sin atención`
                );
            }

            await applySanction(
                client,
                t.claimedBy.userId,
                t.claimedBy.username,
                'Inactividad 48h en ticket'
            );

            // liberar ticket
            t.status = 'open';
            t.claimedBy = null;
            t.claimedAt = null;
            t.alert48hSent = true;
            await t.save();
        }

        /* =============================
           🔒 AUTO-CIERRE 72H
        ============================= */
        if (
            t.status === 'open' &&
            now - t.createdAt.getTime() >= H72
        ) {
            t.status = 'closed';
            t.closedAt = new Date();
            t.closedBy = {
                userId: 'SYSTEM',
                username: 'AutoClose',
                reason: 'Inactividad 72h'
            };
            await t.save();

            const ch = await client.channels.fetch(t.channelId).catch(() => null);
            if (ch) {
                await ch.send('🔒 Ticket cerrado automáticamente por inactividad (72h).');
                await ch.setParent(config.categories.closed).catch(() => {});
            }
        }
    }
};
