const {
    Events, PermissionFlagsBits, ChannelType,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const config              = require('../config/config');
const Ticket              = require('../models/Ticket');
const Stats               = require('../models/Stats');
const logger              = require('../utils/logger');
const transcriptGenerator = require('../utils/transcriptGenerator');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // ── SLASH COMMANDS ────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction, client);
            } catch (err) {
                console.error(`❌ Error en comando /${interaction.commandName}:`, err);
                const msg = { content: '❌ Error ejecutando comando.', ephemeral: true };
                interaction.replied || interaction.deferred
                    ? await interaction.editReply(msg).catch(() => {})
                    : await interaction.reply(msg).catch(() => {});
            }
            return;
        }

        // ── BUTTONS ───────────────────────────────────────────────────
        if (interaction.isButton()) {
            const parts  = interaction.customId.split('_');
            const action = parts[0];
            const param  = parts.slice(1).join('_');

            try {
                if (action === 'ticket')   return handleTicketCreateModal(interaction, param);
                if (action === 'claim')    return handleTicketClaim(interaction, client);
                if (action === 'close')    return handleCloseModal(interaction);
                if (action === 'reopen')   return handleTicketReopen(interaction, client);
                if (action === 'delete')   return handleTicketDelete(interaction, client);
                if (action === 'addstaff') return handleAddStaffModal(interaction);
                if (action === 'rate')     return handleRateModal(interaction, param);
            } catch (err) {
                console.error('❌ Error en botón:', err);
                await interaction.reply({ content: '❌ Error procesando acción.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // ── SELECT MENUS ──────────────────────────────────────────────
        if (interaction.isStringSelectMenu()) {
            try {
                const idiomaCommand = client.commands.get('idioma');
                if (interaction.customId === 'language_select_user' && idiomaCommand?.handleUserLanguageSelect) {
                    await idiomaCommand.handleUserLanguageSelect(interaction);
                }
            } catch (err) {
                console.error('❌ Error en select menu:', err);
                await interaction.reply({ content: '❌ Error al procesar selección.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // ── MODALS ────────────────────────────────────────────────────
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId.startsWith('ticket_create_modal_')) return await handleTicketCreate(interaction, client);
                if (interaction.customId === 'close_reason_modal')           return await handleCloseWithReason(interaction, client);
                if (interaction.customId === 'add_staff_modal')              return await handleAddStaffConfirm(interaction, client);
                if (interaction.customId.startsWith('rate_modal_'))          return await handleRateSubmit(interaction, client);
            } catch (err) {
                console.error('❌ Error en modal:', err);
                if (err.code === 10062) return; // Interacción ya expirada, ignorar
                await interaction.reply({ content: '❌ Error procesando formulario.', ephemeral: true }).catch(() => {});
            }
        }
    }
};

/* ═══════════════════════════════════════════════
   CREAR TICKET — modal inicial
═══════════════════════════════════════════════ */

async function handleTicketCreateModal(interaction, ticketType) {
    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) return interaction.reply({ content: '❌ Tipo de ticket inválido.', ephemeral: true });

    const modal = new ModalBuilder()
        .setCustomId(`ticket_create_modal_${ticketType}`)
        .setTitle(`${typeInfo.emoji} ${typeInfo.label}`);

    const detailInput = new TextInputBuilder()
        .setCustomId('ticket_detail')
        .setLabel('Describe tu problema o consulta')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explica detalladamente tu situación...')
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(detailInput));
    await interaction.showModal(modal);
}

/* ═══════════════════════════════════════════════
   CREAR TICKET — procesar modal
═══════════════════════════════════════════════ */

async function handleTicketCreate(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticketType = interaction.customId.replace('ticket_create_modal_', '');
    const detail     = interaction.fields.getTextInputValue('ticket_detail');
    const userId     = interaction.user.id;
    const username   = interaction.user.tag;
    const typeInfo   = config.ticketTypes[ticketType];

    if (!typeInfo) return interaction.editReply({ content: '❌ Tipo de ticket inválido.' });

    // ── 1. LÍMITE DE TICKETS POR USUARIO ────────────────────────────
    const openTickets = await Ticket.getUserOpenTickets(userId);
    const maxTickets  = config.system.maxTicketsPerUser || 3;
    if (openTickets.length >= maxTickets) {
        return interaction.editReply({
            content: `⚠️ Ya tienes **${openTickets.length}** ticket(s) abierto(s). Máximo permitido: **${maxTickets}**.\n\n` +
                     `Cierra uno de tus tickets actuales antes de abrir otro.`
        });
    }

    // ── 2. OBTENER CATEGORÍA ─────────────────────────────────────────
    if (!config.channels.ticketsOpen) {
        return interaction.editReply({ content: '❌ La categoría de tickets no está configurada.' });
    }

    const ticketsCategory = await interaction.guild.channels.fetch(config.channels.ticketsOpen).catch(() => null);
    if (!ticketsCategory || ticketsCategory.type !== ChannelType.GuildCategory) {
        return interaction.editReply({ content: '❌ La categoría de tickets no es válida. Revisa tu configuración.' });
    }

    // ── 3. LÍMITE DE CANALES EN CATEGORÍA ───────────────────────────
    if (ticketsCategory.children?.cache.size >= 49) {
        return interaction.editReply({
            content: '⚠️ La categoría de tickets está llena. Espera a que el staff cierre algunos tickets.'
        });
    }

    // ── 4. GENERAR ID ANTES DE CREAR EL CANAL ───────────────────────
    let ticketId;
    try {
        ticketId = await Ticket.generateNextId();
    } catch (err) {
        console.error('❌ Error generando ticketId:', err);
        return interaction.editReply({ content: '❌ No se pudo generar un ID para el ticket. Intenta de nuevo.' });
    }

    // ── 5. CREAR CANAL ───────────────────────────────────────────────
    let ticketChannel;
    try {
        ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${ticketId}`,
            type: ChannelType.GuildText,
            parent: ticketsCategory.id,
            topic: `Ticket #${ticketId} · ${typeInfo.label} · ${username}`,
            reason: `Ticket #${ticketId} creado por ${username}`
        });

        // ✅ FIX: El usuario puede VER el canal pero NO puede escribir hasta que el staff lo reclame
        await ticketChannel.permissionOverwrites.create(userId, {
            ViewChannel:        true,
            SendMessages:       false,   // ← bloqueado hasta que el staff reclame
            AttachFiles:        false,
            ReadMessageHistory: true,
            EmbedLinks:         false
        });

    } catch (err) {
        console.error('❌ Error creando canal:', err);
        return interaction.editReply({
            content: `❌ No se pudo crear el canal.\n\n• ¿El bot tiene permisos de Gestionar Canales?\n• Error: \`${err.message}\``
        });
    }

    // ── 6. GUARDAR EN BD ─────────────────────────────────────────────
    // ✅ FIX: Manejo de error E11000 (duplicate key) — no crashea el bot
    try {
        await Ticket.create({
            ticketId, channelId: ticketChannel.id,
            userId, username, type: ticketType, detail,
            status: 'open', lastActivity: new Date(),
            priority: ticketType === 'reportar-staff' ? 'urgente' : 'normal'
        });
    } catch (err) {
        if (err.code === 11000) {
            // El ticket ya existía en BD (bot reiniciado). Eliminar el canal recién creado y avisar.
            await ticketChannel.delete('Duplicate ticketId, abortando creación').catch(() => {});
            return interaction.editReply({
                content: `❌ Ocurrió un conflicto con el ID del ticket. Por favor intenta de nuevo.`
            });
        }
        console.error('❌ Error guardando ticket en BD:', err);
        await ticketChannel.delete('Error en BD, abortando creación').catch(() => {});
        return interaction.editReply({ content: `❌ Error guardando el ticket: \`${err.message}\`` });
    }

    // ── 7. MENSAJE EN EL CANAL ───────────────────────────────────────
    const color = parseInt(typeInfo.color.replace('#', ''), 16);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${typeInfo.emoji} ${typeInfo.label}`)
        .setDescription(
            (typeInfo.requiresProof ? config.messages.ticketCreatedProof : config.messages.ticketCreated) +
            '\n\n⏳ **Esperando que un miembro del staff atienda este ticket...**'
        )
        .addFields(
            { name: '📋 ID',          value: `#${ticketId}`,          inline: true },
            { name: '👤 Usuario',     value: `<@${userId}>`,           inline: true },
            { name: '📊 Estado',      value: '🟡 Esperando atención',  inline: true },
            { name: '📝 Descripción', value: detail,                   inline: false }
        )
        .setFooter({ text: config.branding.serverName })
        .setTimestamp();

    // ✅ Botón de reclamar ticket (igual que antes)
    const claimRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('🛎️ Atender Ticket')
            .setStyle(ButtonStyle.Success)
    );

    await ticketChannel.send({ content: `<@${userId}>`, embeds: [embed], components: [claimRow] });

    // ── 8. RESPUESTA AL USUARIO ──────────────────────────────────────
    await interaction.editReply({
        content: `✅ **Ticket #${ticketId} creado correctamente.**\n📂 <#${ticketChannel.id}>\n\n⏳ Un miembro del staff te atenderá pronto. Podrás escribir cuando sea reclamado.`,
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('📂 Ir al Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guildId}/${ticketChannel.id}`)
        )]
    });

    // ── 9. NOTIFICACIÓN DM ───────────────────────────────────────────
    if (config.system.dmNotifications) {
        await interaction.user.send({
            embeds: [new EmbedBuilder()
                .setColor(color)
                .setTitle('🎫 Ticket Creado')
                .setDescription(`Tu ticket **#${ticketId}** ha sido creado.\nUn miembro del staff te atenderá pronto.`)
                .addFields({ name: '📂 Canal', value: `<#${ticketChannel.id}>`, inline: true })
                .setTimestamp()
            ]
        }).catch(() => {});
    }

    // ── 10. LOGS + STATS ─────────────────────────────────────────────
    await logger.sendTicketLog(client, {
        action: 'created', ticketId, userId,
        type: ticketType, detail, channelId: ticketChannel.id
    });

    try {
        const stats = await Stats.getTodayStats();
        await stats.incrementCreated(ticketType);
    } catch (e) { console.error('Stats error:', e); }
}

/* ═══════════════════════════════════════════════
   RECLAMAR TICKET
═══════════════════════════════════════════════ */

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) return interaction.editReply({ content: '❌ Ticket no encontrado en la base de datos.' });
    if (ticket.status !== 'open') return interaction.editReply({ content: '❌ Este ticket ya está siendo atendido.' });

    // ── VALIDAR ROL DE STAFF ─────────────────────────────────────────
    const typeInfo     = config.ticketTypes[ticket.type];
    const allowedRoles = (typeInfo?.roles || []).map(r => config.roles[r]).filter(Boolean);

    const hasPermission =
        allowedRoles.length === 0 ||
        interaction.member.roles.cache.some(r => allowedRoles.includes(r.id)) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
        return interaction.editReply({
            content: `❌ No tienes el rol necesario para atender tickets de **${typeInfo?.label || ticket.type}**.`
        });
    }

    await ticket.claim(interaction.user.id, interaction.user.tag);

    // ✅ FIX: Ahora que el staff reclamó, dar permisos de escritura al usuario
    await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel:        true,
        SendMessages:       true,
        AttachFiles:        true,
        ReadMessageHistory: true,
        EmbedLinks:         true
    }).catch(err => console.error('Error dando permisos al usuario:', err));

    // Actualizar mensaje original con nuevo embed y botones
    const messages = await interaction.channel.messages.fetch({ limit: 20 });
    const original  = messages.find(m =>
        m.author.id === client.user.id &&
        m.embeds.length > 0 &&
        m.embeds[0].fields?.some(f => f.name === '📋 ID' && f.value === `#${ticket.ticketId}`)
    );

    const color = parseInt((typeInfo?.color || '#3498db').replace('#', ''), 16);

    if (original) {
        const updatedEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${typeInfo?.emoji || '🎫'} ${typeInfo?.label || ticket.type}`)
            .setDescription(typeInfo?.requiresProof ? config.messages.ticketCreatedProof : config.messages.ticketCreated)
            .addFields(
                { name: '📋 ID',          value: `#${ticket.ticketId}`,                   inline: true },
                { name: '👤 Usuario',     value: `<@${ticket.userId}>`,                    inline: true },
                { name: '🟢 Estado',      value: `Atendido por <@${interaction.user.id}>`, inline: true },
                { name: '📝 Descripción', value: ticket.detail,                            inline: false }
            )
            .setFooter({ text: config.branding.serverName })
            .setTimestamp();

        // ✅ FIX RESTAURADO: botón "Solicitar Ayuda" (addstaff) + "Cerrar Ticket"
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('addstaff_ticket')
                .setLabel('👥 Solicitar Ayuda')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Cerrar Ticket')
                .setStyle(ButtonStyle.Danger)
        );

        await original.edit({ embeds: [updatedEmbed], components: [actionRow] });
    }

    await interaction.channel.send({
        embeds: [new EmbedBuilder()
            .setColor(0x27ae60)
            .setDescription(`🛎️ <@${interaction.user.id}> está atendiendo este ticket.\n<@${ticket.userId}> ahora puedes escribir aquí.`)
            .setTimestamp()
        ]
    });

    // DM al usuario
    if (config.system.dmNotifications) {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (user) {
            await user.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x27ae60)
                    .setTitle('🛎️ Tu ticket está siendo atendido')
                    .setDescription(`**${interaction.user.tag}** está atendiendo tu ticket **#${ticket.ticketId}**.`)
                    .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    await logger.sendTicketLog(client, {
        action: 'claimed', ticketId: ticket.ticketId,
        userId: ticket.userId, claimedBy: interaction.user.id,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket reclamado correctamente.' });
}

/* ═══════════════════════════════════════════════
   CERRAR TICKET — modal razón
═══════════════════════════════════════════════ */

async function handleCloseModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('🔒 Cerrar Ticket');

    const input = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Razón del cierre')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('¿Por qué se cierra este ticket?')
        .setMinLength(5)
        .setMaxLength(200)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

/* ═══════════════════════════════════════════════
   CERRAR TICKET — procesar
═══════════════════════════════════════════════ */

async function handleCloseWithReason(interaction, client) {
    // Responder lo antes posible para no expirar los 3 segundos de Discord
    try {
        await interaction.deferReply({ ephemeral: true });
    } catch (err) {
        if (err.code === 10062) {
            console.warn('⚠️ Interacción de cierre expirada antes de poder responder, abortando.');
            return;
        }
        throw err;
    }

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket) return interaction.editReply({ content: '❌ Ticket no encontrado.' });
    if (ticket.status === 'closed') return interaction.editReply({ content: '❌ Este ticket ya está cerrado.' });

    await ticket.close(interaction.user.id, interaction.user.tag, reason);

    // ── GENERAR TRANSCRIPT ───────────────────────────────────────────
    let transcriptPaths = null;
    try {
        transcriptPaths = await transcriptGenerator.generate(ticket);
    } catch (e) {
        console.error('Error generando transcript:', e);
    }

    // ── ENVIAR TRANSCRIPT AL CANAL DE LOGS ───────────────────────────
    if (transcriptPaths && config.channels.logs) {
        const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
        if (logChannel) {
            const files = [transcriptPaths.html, transcriptPaths.txt].filter(Boolean);
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle(`📄 Transcript — Ticket #${ticket.ticketId}`)
                    .addFields(
                        { name: '👤 Usuario',   value: `<@${ticket.userId}>`,        inline: true },
                        { name: '👨‍💼 Staff',    value: ticket.claimedBy?.username || 'Sin reclamar', inline: true },
                        { name: '📋 Tipo',      value: ticket.type,                  inline: true },
                        { name: '🔒 Razón',     value: reason,                       inline: false },
                        { name: '⏱️ Duración', value: calcDuration(ticket.createdAt, ticket.closedAt), inline: true },
                        { name: '💬 Mensajes',  value: `${ticket.messages?.length || 0}`, inline: true }
                    )
                    .setTimestamp()
                ],
                files
            }).catch(e => console.error('Error enviando transcript:', e));
        }
    }

    // ── DM AL USUARIO con solicitud de rating ─────────────────────────
    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (user) {
        const ratingRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rate_modal_${ticket.ticketId}_5`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rate_modal_${ticket.ticketId}_4`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`rate_modal_${ticket.ticketId}_3`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_modal_${ticket.ticketId}_2`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_modal_${ticket.ticketId}_1`).setLabel('⭐').setStyle(ButtonStyle.Danger)
        );

        await user.send({
            embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Tu Ticket ha sido Cerrado')
                .setDescription(`Tu ticket **#${ticket.ticketId}** fue cerrado.\n\n**Razón:** ${reason}`)
                .addFields(
                    { name: '👨‍💼 Atendido por', value: ticket.claimedBy?.username || 'Sin reclamar', inline: true },
                    { name: '⏱️ Duración',     value: calcDuration(ticket.createdAt, ticket.closedAt), inline: true }
                )
                .setFooter({ text: '¿Cómo fue tu experiencia? ⬇️' })
                .setTimestamp()
            ],
            components: [ratingRow]
        }).catch(() => {});
    }

    await logger.sendTicketLog(client, {
        action: 'closed', ticketId: ticket.ticketId,
        userId: ticket.userId, closedBy: interaction.user.id,
        reason, channelId: ticket.channelId,
        duration: calcDuration(ticket.createdAt, ticket.closedAt)
    });

    try {
        const stats = await Stats.getTodayStats();
        if (stats?.incrementClosed) await stats.incrementClosed();
    } catch (e) {}

    // ── MOVER A CATEGORÍA DE CERRADOS ────────────────────────────────
    const closedCategoryId = config.categories.closed || config.channels.ticketsClosed;

    if (closedCategoryId) {
        // Quitar permisos de escritura al usuario en el canal cerrado
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
            ViewChannel:        true,
            SendMessages:       false,
            AttachFiles:        false,
            ReadMessageHistory: true,
            EmbedLinks:         false
        }).catch(() => {});

        await interaction.channel.send({
            embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Ticket Cerrado')
                .setDescription('Este canal será movido a **Tickets Cerrados** y eliminado automáticamente en **72 horas**.')
                .addFields(
                    { name: '🔒 Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📋 Razón',       value: reason,                      inline: true }
                )
                .setFooter({ text: transcriptPaths ? '📄 Transcript enviado al canal de logs' : '' })
                .setTimestamp()
            ]
        });

        // Renombrar canal para indicar que está cerrado
        await interaction.channel.setName(`closed-${ticket.ticketId}`).catch(() => {});

        // Mover a categoría de cerrados
        await interaction.channel.setParent(closedCategoryId, { lockPermissions: false })
            .catch(e => console.error(`❌ No se pudo mover canal a cerrados:`, e.message));

        // Guardar la fecha de cierre para que checkTickets lo borre a las 72h
        ticket.scheduledDeleteAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        await ticket.save();

        await interaction.editReply({ content: '✅ Ticket cerrado y movido a **Tickets Cerrados**. Se eliminará automáticamente en 72 horas.' });

    } else {
        // Si no hay categoría de cerrados configurada, eliminar en 10 segundos (comportamiento anterior)
        await interaction.channel.send({
            embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Ticket Cerrado')
                .setDescription('Este canal será eliminado en **10 segundos**.')
                .addFields(
                    { name: '🔒 Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📋 Razón',       value: reason,                      inline: true }
                )
                .setTimestamp()
            ]
        });

        await interaction.editReply({ content: '✅ Ticket cerrado. El canal se eliminará en 10 segundos.' });

        setTimeout(async () => {
            await interaction.channel.delete(`Ticket #${ticket.ticketId} cerrado`).catch(e => {
                console.error(`❌ No se pudo eliminar canal del ticket #${ticket.ticketId}:`, e.message);
            });
        }, 10_000);
    }
}

/* ═══════════════════════════════════════════════
   REABRIR TICKET
═══════════════════════════════════════════════ */

async function handleTicketReopen(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) return interaction.editReply({ content: '❌ Ticket no encontrado.' });

    ticket.status = 'open';
    ticket.lastActivity = new Date();
    ticket.inactivityWarned = false;
    await ticket.save();

    const openCategory = config.channels.ticketsOpen
        ? await interaction.guild.channels.fetch(config.channels.ticketsOpen).catch(() => null)
        : null;

    if (openCategory?.type === ChannelType.GuildCategory) {
        await interaction.channel.setParent(openCategory.id).catch(() => {});
    }

    await interaction.channel.setName(`ticket-${ticket.ticketId}`).catch(() => {});

    // Al reabrir, quitar permisos de escritura al usuario nuevamente hasta que el staff lo vuelva a reclamar
    await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel:        true,
        SendMessages:       false,
        AttachFiles:        false,
        ReadMessageHistory: true,
        EmbedLinks:         false
    }).catch(() => {});

    const claimRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('🛎️ Atender').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar').setStyle(ButtonStyle.Danger)
    );

    await interaction.channel.send({
        embeds: [new EmbedBuilder()
            .setColor(0x27ae60)
            .setTitle('🔓 Ticket Reabierto')
            .setDescription(`Reabierto por <@${interaction.user.id}>`)
            .setTimestamp()
        ],
        components: [claimRow]
    });

    await logger.sendTicketLog(client, {
        action: 'reopened', ticketId: ticket.ticketId,
        userId: ticket.userId, reopenedBy: interaction.user.id,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket reabierto.' });
}

/* ═══════════════════════════════════════════════
   ELIMINAR TICKET MANUALMENTE
═══════════════════════════════════════════════ */

async function handleTicketDelete(interaction, client) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = interaction.member.roles.cache.some(r =>
        Object.values(config.roles).includes(r.id)
    );

    if (!isAdmin && !isStaff) {
        return interaction.reply({ content: '❌ Sin permisos para eliminar.', ephemeral: true });
    }

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    await interaction.reply({ content: '🗑️ Canal eliminado en 5 segundos...', ephemeral: true });

    if (ticket) {
        await logger.sendTicketLog(client, {
            action: 'deleted', ticketId: ticket.ticketId,
            userId: ticket.userId, deletedBy: interaction.user.id
        });
        await Ticket.deleteOne({ channelId: interaction.channel.id });
    }

    setTimeout(() => interaction.channel.delete().catch(console.error), 5_000);
}

/* ═══════════════════════════════════════════════
   AÑADIR STAFF / SOLICITAR AYUDA
═══════════════════════════════════════════════ */

async function handleAddStaffModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_staff_modal')
        .setTitle('👥 Solicitar Ayuda de Staff');

    const input = new TextInputBuilder()
        .setCustomId('staff_id')
        .setLabel('ID del staff (solo numeros, sin @)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Clic derecho al usuario > Copiar ID > pegar aqui')
        .setMinLength(17)
        .setMaxLength(20)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleAddStaffConfirm(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const rawInput = interaction.fields.getTextInputValue('staff_id').trim();
    const staffId  = rawInput.replace(/[<@!>]/g, '');
    const ticket   = await Ticket.findOne({ channelId: interaction.channel.id });

    const staffMember = await interaction.guild.members.fetch(staffId).catch(() => null);
    if (!staffMember) {
        return interaction.editReply({ content: '❌ No se encontró ese miembro en el servidor. Verifica el ID.' });
    }

    const isStaff = Object.values(config.roles).some(roleId =>
        staffMember.roles.cache.has(roleId)
    );
    if (!isStaff && !staffMember.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: `❌ **${staffMember.user.tag}** no tiene rol de staff.` });
    }

    try {
        await interaction.channel.permissionOverwrites.create(staffId, {
            ViewChannel: true, SendMessages: true,
            AttachFiles: true, ReadMessageHistory: true
        });

        if (ticket) {
            ticket.additionalStaff = ticket.additionalStaff || [];
            ticket.additionalStaff.push({
                userId: staffId, username: staffMember.user.tag,
                addedBy: interaction.user.id, timestamp: new Date()
            });
            await ticket.save();
        }

        // ✅ Mencionar al staff en el canal del ticket
        await interaction.channel.send({
            content: `<@${staffId}>`,
            embeds: [new EmbedBuilder()
                .setColor(0x3498db)
                .setDescription(`👥 <@${interaction.user.id}> solicita la ayuda de <@${staffId}> en este ticket.`)
                .setTimestamp()
            ]
        });

        if (ticket) {
            await logger.sendTicketLog(client, {
                action: 'staff_added', ticketId: ticket.ticketId,
                staffId, addedBy: interaction.user.id, channelId: ticket.channelId
            });
        }

        await interaction.editReply({ content: `✅ **${staffMember.user.tag}** ha sido mencionado y añadido al ticket.` });
    } catch (err) {
        console.error('Error añadiendo staff:', err);
        await interaction.editReply({ content: `❌ Error al añadir staff: \`${err.message}\`` });
    }
}

/* ═══════════════════════════════════════════════
   SISTEMA DE RATING
═══════════════════════════════════════════════ */

async function handleRateModal(interaction, param) {
    // param viene de: parts.slice(1).join('_') donde customId = "rate_modal_XXXX_N"
    // param = "modal_XXXX_N", necesitamos extraer XXXX y N
    const withoutModal = param.startsWith('modal_') ? param.replace('modal_', '') : param;
    const lastUnderscore = withoutModal.lastIndexOf('_');
    const ticketId = withoutModal.substring(0, lastUnderscore);
    const stars    = parseInt(withoutModal.substring(lastUnderscore + 1));

    const modal = new ModalBuilder()
        .setCustomId(`rate_modal_${ticketId}_${stars}`)
        .setTitle(`${'⭐'.repeat(stars)} Calificar Soporte`);

    const input = new TextInputBuilder()
        .setCustomId('rate_comment')
        .setLabel('Comentario (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('¿Algo que quieras añadir sobre tu experiencia?')
        .setMaxLength(300)
        .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleRateSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    // customId formato: "rate_modal_XXXX_N" donde XXXX = ticketId y N = estrellas
    const withoutPrefix = interaction.customId.replace('rate_modal_', '');
    const lastUnderscore = withoutPrefix.lastIndexOf('_');
    const ticketId = withoutPrefix.substring(0, lastUnderscore);
    const stars    = parseInt(withoutPrefix.substring(lastUnderscore + 1));
    const comment  = interaction.fields.getTextInputValue('rate_comment') || '';

    console.log(`⭐ Rating submit — customId: ${interaction.customId} → ticketId: ${ticketId}, stars: ${stars}`);

    // Buscar por ticketId directo primero, si no por userId + cerrado recientemente
    let ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
        // Fallback: buscar el ticket cerrado más reciente de este usuario con ese ID
        // (puede pasar si el ticketId tiene padding diferente)
        const ticketIdInt = parseInt(ticketId, 10);
        if (!isNaN(ticketIdInt)) {
            ticket = await Ticket.findOne({
                userId: interaction.user.id,
                status: 'closed',
                $or: [
                    { ticketId: ticketId },
                    { ticketId: ticketIdInt.toString() },
                    { ticketId: ticketIdInt.toString().padStart(4, '0') }
                ]
            }).sort({ closedAt: -1 });
        }
    }

    if (!ticket) {
        console.error(`❌ Ticket no encontrado para rating — ticketId buscado: "${ticketId}", userId: ${interaction.user.id}`);
        // Listar tickets cerrados del usuario para debug
        const userTickets = await Ticket.find({ userId: interaction.user.id, status: 'closed' }, { ticketId: 1 }).lean();
        console.error(`   Tickets cerrados del usuario: ${userTickets.map(t => t.ticketId).join(', ') || 'ninguno'}`);
        return interaction.editReply({ content: '❌ No se pudo encontrar tu ticket. Es posible que ya haya sido eliminado de la base de datos.' });
    }
    if (ticket.rating?.stars) return interaction.editReply({ content: '❌ Ya calificaste este ticket.' });
    if (ticket.userId !== interaction.user.id) return interaction.editReply({ content: '❌ Solo el creador puede calificar.' });

    await ticket.setRating(stars, comment, interaction.user.id);

    // Publicar en canal de reseñas (o logs como fallback)
    const reviewChannelId = config.channels.reviews || config.channels.logs;
    if (reviewChannelId) {
        const reviewChannel = await client.channels.fetch(reviewChannelId).catch(() => null);
        if (reviewChannel) {
            await reviewChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor(stars >= 4 ? 0x27ae60 : stars === 3 ? 0xf39c12 : 0xe74c3c)
                    .setTitle(`⭐ Nueva Valoración — Ticket #${ticketId}`)
                    .addFields(
                        { name: '⭐ Estrellas',  value: `${'⭐'.repeat(stars)} (${stars}/5)`, inline: true },
                        { name: '👤 Usuario',    value: `<@${interaction.user.id}>`,           inline: true },
                        { name: '👨‍💼 Staff',     value: ticket.claimedBy ? `<@${ticket.claimedBy.userId}>` : 'N/A', inline: true },
                        { name: '💬 Comentario', value: comment || '*(sin comentario)*',       inline: false }
                    )
                    .setFooter({ text: `Ticket #${ticketId}` })
                    .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    try {
        await interaction.message.edit({ components: [] });
    } catch (_) {}

    await interaction.editReply({
        content: `✅ ¡Gracias por tu valoración de **${'⭐'.repeat(stars)}**! Tu opinión ayuda a mejorar el servicio.`
    });
}

/* ═══════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════ */

function calcDuration(start, end) {
    if (!start || !end) return 'N/A';
    const diff    = end - start;
    const hours   = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
