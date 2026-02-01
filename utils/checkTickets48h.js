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

    for (const t of tickets) {

        /* TICKETS ABIERTOS */
        if (t.status === 'open') {
            const age = now - t.createdAt.getTime();

            if (age >= H24 && !t.alert24hSent) {
                staffChannel.send(`🕐 Ticket sin reclamar 24h → <#${t.channelId}>`);
                t.alert24hSent = true;
                await t.save();
            }

            if (age >= H48 && !t.alert48hSent) {
                staffChannel.send(`⚠️ Ticket sin reclamar 48h → <#${t.channelId}>`);
                t.alert48hSent = true;
                await t.save();
            }

            if (age >= H72) {
                staffChannel.send(`🔒 Ticket auto-cerrado 72h → <#${t.channelId}>`);
                t.status = 'closed';
                t.closedAt = new Date();
                t.closedBy = { userId: 'SYSTEM', username: 'AutoClose', reason: '72h sin reclamar' };
                await t.save();

                const ch = await client.channels.fetch(t.channelId).catch(() => null);
                if (ch) await ch.setParent(config.categories.closed).catch(() => {});
            }
        }

        /* TICKETS RECLAMADOS */
        if (t.status === 'claimed') {
            const age = now - t.claimedAt.getTime();

            if (age >= H24 && !t.alert24hSent) {
                staffChannel.send(`🕐 Ticket reclamado sin trabajo 24h → <#${t.channelId}>`);
                t.alert24hSent = true;
                await t.save();
            }

            if (age >= H48 && !t.alert48hSent) {
                staffChannel.send(`🔁 Ticket reasignado 48h → <#${t.channelId}>`);
                t.status = 'open';
                t.claimedBy = null;
                t.claimedAt = null;
                t.alert48hSent = true;
                await t.save();
            }

            if (age >= H72) {
                staffChannel.send(`🔒 Ticket cerrado por abandono → <#${t.channelId}>`);
                t.status = 'closed';
                t.closedAt = new Date();
                t.closedBy = { userId: 'SYSTEM', username: 'AutoClose', reason: 'Abandono 72h' };
                await t.save();

                const ch = await client.channels.fetch(t.channelId).catch(() => null);
                if (ch) await ch.setParent(config.categories.closed).catch(() => {});
            }
        }
    }
};
