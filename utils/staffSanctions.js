const StaffStats = require('../models/StaffStats');
const config = require('../config/config');

module.exports = async (client, staffId, username, reason) => {
    let stats = await StaffStats.findOne({ userId: staffId });

    if (!stats) {
        stats = await StaffStats.create({
            userId: staffId,
            username
        });
    }

    stats.abandonedTickets += 1;

    // 🟡 PRIMERA VEZ → ADVERTENCIA
    if (stats.abandonedTickets === 1 && !stats.warned) {
        stats.warned = true;

        const user = await client.users.fetch(staffId).catch(() => null);
        if (user) {
            user.send(
                `⚠️ **Advertencia de Staff**\n` +
                `Has abandonado un ticket.\n` +
                `Motivo: ${reason}\n\n` +
                `⚠️ A la próxima se aplicará sanción automática.`
            ).catch(() => {});
        }
    }

    // 🔴 SEGUNDA VEZ → SANCIÓN
    if (stats.abandonedTickets >= 2) {
        stats.sanctions += 1;
        stats.lastSanctionAt = new Date();

        const guild = client.guilds.cache.get(config.guildId);
        if (guild) {
            const member = await guild.members.fetch(staffId).catch(() => null);
            if (member) {
                await member.timeout(
                    60 * 60 * 1000, // 1 hora
                    'Sanción automática: abandono de tickets'
                ).catch(() => {});
            }
        }
    }

    await stats.save();
};
