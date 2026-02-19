const Ticket              = require('../models/Ticket');
const Stats               = require('../models/Stats');
const transcriptGenerator = require('./transcriptGenerator');
const config              = require('../config/config');
const { EmbedBuilder, ChannelType } = require('discord.js');

/**
 * Se ejecuta cada 10 minutos desde index.js
 * Gestiona: advertencias de inactividad, cierre automático, alertas 48h,
 *           y limpieza de canales cerrados acumulados
 */
module.exports = async function checkTickets(client) {
    const warningHours = config.system.inactivityWarning || 42;
    const closeHours   = config.system.inactivityClose   || 44;

    // ── 1. ADVERTENCIAS DE INACTIVIDAD ──────────────────────────────
    const ticketsToWarn = await Ticket.getInactiveTickets(warningHours);

    for (const ticket of ticketsToWarn) {
        if (ticket.inactivityWarned) continue;

        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) continue;

        try {
            await channel.send({
                embeds: [new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle('⏰ Aviso de Inactividad')
                    .setDescription(
                        `Este ticket lleva más de **${warningHours}h** sin actividad.\n` +
                        `Se cerrará automáticamente en **${closeHours - warningHours} hora(s)** si no hay respuesta.`
                    )
                    .setFooter({ text: 'Responde para mantener el ticket abierto' })
                    .setTimestamp()
                ]
            });

            ticket.inactivityWarned = true;
            await ticket.save();

            console.log(`⏰ Advertencia de inactividad enviada al ticket #${ticket.ticketId}`);
        } catch (e) {
            console.error(`Error enviando advertencia inactividad #${ticket.ticketId}:`, e.message);
        }
    }

    // ── 2. CIERRE AUTOMÁTICO ─────────────────────────────────────────
    const ticketsToClose = await Ticket.getInactiveTickets(closeHours);

    for (const ticket of ticketsToClose) {
        if (!ticket.inactivityWarned) continue;

        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);

        try {
            let transcriptPaths = null;
            try { transcriptPaths = await transcriptGenerator.generate(ticket); } catch (_) {}

            await ticket.close('Sistema', 'Bot', `Inactividad (${closeHours}h sin actividad)`);

            if (transcriptPaths && config.channels.logs) {
                const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
                if (logChannel) {
                    const files = [transcriptPaths.html, transcriptPaths.txt].filter(Boolean);
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle(`📄 Cierre Automático — Ticket #${ticket.ticketId}`)
                            .addFields(
                                { name: '👤 Usuario', value: `<@${ticket.userId}>`, inline: true },
                                { name: '📋 Tipo',    value: ticket.type,            inline: true },
                                { name: '🔒 Razón',   value: `Inactividad (${closeHours}h)`, inline: true }
                            )
                            .setTimestamp()
                        ],
                        files
                    }).catch(() => {});
                }
            }

            if (channel) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('🔒 Ticket Cerrado por Inactividad')
                        .setDescription(`Este ticket fue cerrado automáticamente por **${closeHours}h** de inactividad.\nEl canal se eliminará en 30 segundos.`)
                        .setTimestamp()
                    ]
                }).catch(() => {});

                try {
                    const user = await client.users.fetch(ticket.userId);
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('🔒 Tu Ticket fue Cerrado por Inactividad')
                            .setDescription(`Tu ticket **#${ticket.ticketId}** fue cerrado automáticamente por inactividad.`)
                            .setTimestamp()
                        ]
                    });
                } catch (_) {}

                setTimeout(() => {
                    channel.delete(`Ticket #${ticket.ticketId} cerrado por inactividad`).catch(() => {});
                }, 30_000);
            } else {
                console.log(`⚠️ Canal del ticket #${ticket.ticketId} ya no existe, solo se cerró en BD`);
            }

            try {
                const stats = await Stats.getTodayStats();
                if (stats?.incrementClosed) await stats.incrementClosed();
            } catch (_) {}

            console.log(`🔒 Ticket #${ticket.ticketId} cerrado por inactividad`);

        } catch (e) {
            console.error(`Error cerrando ticket #${ticket.ticketId} por inactividad:`, e.message);
        }
    }

    // ── 3. ALERTAS 48H SIN RESPUESTA DE STAFF ───────────────────────
    const ticketsNeedingAlert = await Ticket.getTicketsNeeding48hAlert();

    for (const ticket of ticketsNeedingAlert) {
        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) continue;

        try {
            const staffMentions = Object.values(config.roles)
                .filter(Boolean)
                .map(id => `<@&${id}>`)
                .join(' ');

            await channel.send({
                content: staffMentions,
                embeds: [new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🚨 Alerta: 48h sin respuesta de Staff')
                    .setDescription(
                        `El ticket **#${ticket.ticketId}** lleva más de 48 horas sin respuesta del staff.\n` +
                        `Staff asignado: ${ticket.claimedBy ? `<@${ticket.claimedBy.userId}>` : 'Sin asignar'}`
                    )
                    .setTimestamp()
                ]
            });

            ticket.alert48hSent = true;
            await ticket.save();

            console.log(`🚨 Alerta 48h enviada para ticket #${ticket.ticketId}`);
        } catch (e) {
            console.error(`Error enviando alerta 48h #${ticket.ticketId}:`, e.message);
        }
    }

    // ── 4. LIMPIEZA DE CANALES CERRADOS ACUMULADOS ───────────────────
    // Borra canales de tickets cerrados que llevan más de 1 hora cerrados
    // Esto limpia los canales que checkTickets48h.js mueve a la categoría
    // "cerrados" sin borrarlos, y cualquier otro que se haya acumulado.
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const closedTickets = await Ticket.find({
            status: 'closed',
            closedAt: { $lt: oneHourAgo },
            channelId: { $exists: true, $ne: null }
        }).lean();

        let cleaned = 0;

        for (const ticket of closedTickets) {
            const channel = await client.channels.fetch(ticket.channelId).catch(() => null);

            // Si el canal todavía existe en Discord, borrarlo
            if (channel) {
                await channel.delete(`Limpieza automática — Ticket #${ticket.ticketId} cerrado hace más de 1h`)
                    .catch(e => console.error(`❌ No se pudo borrar canal ticket #${ticket.ticketId}:`, e.message));
                cleaned++;
            }

            // Limpiar el channelId en BD para no volver a procesarlo
            await Ticket.updateOne(
                { _id: ticket._id },
                { $unset: { channelId: '' } }
            ).catch(() => {});
        }

        if (cleaned > 0) {
            console.log(`🧹 Limpieza: ${cleaned} canal(es) de tickets cerrados eliminados`);
        }

    } catch (e) {
        console.error('Error en limpieza de canales cerrados:', e.message);
    }

    console.log(`✅ checkTickets completado: ${ticketsToWarn.length} advertencias, ${ticketsToClose.length} cierres, ${ticketsNeedingAlert.length} alertas 48h`);
};
