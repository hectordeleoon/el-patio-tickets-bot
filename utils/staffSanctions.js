const StaffStats = require('../models/StaffStats');
const config = require('../config/config');

module.exports = async (client, staffId, username, reason) => {
    let stats = await StaffStats.findOne({ userId: staffId });

    if (!stats) {
        stats = await StaffStats.create({ userId: staffId, username });
    }

    stats.abandonedTickets += 1;

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;

    const member = await guild.members.fetch(staffId).catch(() => null);
    if (!member) return;

    /* ========= ADVERTENCIA ========= */
    if (stats.abandonedTickets === 1) {
        member.send(
            `⚠️ **Advertencia de Staff**\n\n` +
            `Motivo: ${reason}\n` +
            `A la próxima se aplicará sanción automática.`
        ).catch(() => {});
    }

    /* ========= TIMEOUT ========= */
    if (stats.abandonedTickets === 2) {
        stats.sanctions += 1;
        stats.lastSanctionAt = new Date();

        await member.timeout(
            60 * 60 * 1000,
            'Sanción automática: abandono de tickets'
        ).catch(() => {});
    }

    /* ========= QUITAR ROL ========= */
    if (
        stats.abandonedTickets >= config.staffSanctions.removeRoleAfter &&
        !stats.roleRemoved
    ) {
        const staffRoleId = config.roles.staff;
        if (staffRoleId && member.roles.cache.has(staffRoleId)) {
            await member.roles.remove(staffRoleId).catch(() => {});
            stats.roleRemoved = true;

            member.send(
                `⛔ **Rol de staff removido automáticamente**\n\n` +
                `Has superado el límite de sanciones.\n` +
                `Contacta a un administrador si crees que es un error.`
            ).catch(() => {});
        }
    }

    await stats.save();
};
