const {
    Events,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

const config = require('../config/config');
const Ticket = require('../models/Ticket');
const Stats = require('../models/Stats');
const proofDetector = require('../utils/proofDetector');
const transcriptGenerator = require('../utils/transcriptGenerator');
const idiomaCommand = require('../commands/idioma');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // SLASH COMMANDS
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: '❌ Error ejecutando comando.',
                    ephemeral: true
                });
            }
        }

        // BUTTONS
        if (interaction.isButton()) {
            const [action, param] = interaction.customId.split('_');

            try {
                if (action === 'ticket') return handleTicketCreateModal(interaction, param);
                if (action === 'claim') return handleTicketClaim(interaction, client);
                if (action === 'close') return handleCloseModal(interaction);
                if (action === 'reopen') return handleTicketReopen(interaction, client);
                if (action === 'delete') return handleTicketDelete(interaction, client);
                if (action === 'addstaff') return handleAddStaffModal(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: '❌ Error procesando acción.',
                    ephemeral: true
                });
            }
        }

        // SELECT MENUS
        if (interaction.isStringSelectMenu()) {
            try {
                if (interaction.customId === 'language_select_user') {
                    await idiomaCommand.handleUserLanguageSelect(interaction);
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: '❌ Error al cambiar el idioma.',
                    ephemeral: true
                });
            }
        }

        // MODALS
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId.startsWith('ticket_create_modal_')) {
                    return handleTicketCreate(interaction, client);
                }
                if (interaction.customId === 'close_reason_modal') {
                    return handleCloseWithReason(interaction, client);
                }
                if (interaction.customId === 'add_staff_modal') {
                    return handleAddStaffConfirm(interaction, client);
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: '❌ Error procesando formulario.',
                    ephemeral: true
                });
            }
        }
    }
};

async function handleTicketCreateModal(interaction, ticketType) {
    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) {
        return interaction.reply({
            content: '❌ Tipo de ticket inválido.',
            ephemeral: true
        });
    }

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

    const row = new ActionRowBuilder().addComponents(detailInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleTicketCreate(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticketType = interaction.customId.replace('ticket_create_modal_', '');
    const detail = interaction.fields.getTextInputValue('ticket_detail');

    const userId = interaction.user.id;
    const username = interaction.user.tag;

    if (config.system.antiSpamEnabled) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentCount = await Ticket.countDocuments({
            userId,
            createdAt: { $gte: cutoff }
        });

        if (recentCount >= config.system.ticketLimit24h) {
            return interaction.editReply({
                content: config.messages.antiSpamWarning.replace(
                    '{count}',
                    config.system.ticketLimit24h
                )
            });
        }
    }

    const activeCount = await Ticket.countDocuments({
        userId,
        status: { $in: ['open', 'claimed'] }
    });

    if (activeCount >= config.system.maxTicketsPerUser) {
        return interaction.editReply({
            content: config.messages.maxTicketsReached.replace('{count}', activeCount)
        });
    }

    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) {
        return interaction.editReply({ content: '❌ Tipo de ticket inválido.' });
    }

    const nextId = await Ticket.generateNextId();
    const ticketId = `${nextId}`;
    
    const channelName = `ticket-${nextId}-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

    const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.categories.open,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: userId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            ...getStaffPermissions(ticketType)
        ]
    });

    await Ticket.create({
        ticketId,
        channelId: channel.id,
        userId,
        username,
        type: ticketType,
        detail: detail,
        status: 'open',
        lastActivity: new Date()
    });

    await channel.send({
        content: `<@${userId}>`,
        embeds: [{
            title: `${typeInfo.emoji} ${typeInfo.label}`,
            description: typeInfo.requiresProof
                ? config.messages.ticketCreatedProof
                : config.messages.ticketCreated,
            fields: [
                { name: '📋 ID', value: ticketId, inline: true },
                { name: '👤 Usuario', value: `<@${userId}>`, inline: true },
                { name: '📊 Estado', value: '🟡 Esperando atención', inline: true },
                { name: '📝 Descripción', value: detail, inline: false }
            ],
            footer: { text: config.branding.serverName },
            timestamp: new Date(),
            color: parseInt(typeInfo.color.replace('#', ''), 16)
        }],
        components: [{
            type: 1,
            components: [{
                type: 2,
                label: '🛎️ Atender Ticket',
                style: 3,
                custom_id: 'claim_ticket'
            }]
        }]
    });

    await logger.sendTicketLog(client, {
        action: 'created',
        ticketId,
        userId,
        type: typeInfo.label,
        detail,
        channelId: channel.id
    });

    try {
        const stats = await Stats.getTodayStats();
        if (stats && stats.incrementCreated) {
            await stats.incrementCreated();
        }
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
    }

    await interaction.editReply({
        content: `✅ Ticket #${ticketId} creado correctamente: <#${channel.id}>`
    });
}

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket || ticket.status !== 'open') {
        return interaction.editReply({ content: '❌ Ticket inválido o ya reclamado.' });
    }

    await ticket.claim(interaction.user.id, interaction.user.tag);

    const typeInfo = config.ticketTypes[ticket.type];

    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const originalMessage = messages.find(m => 
        m.author.id === client.user.id && 
        m.embeds.length > 0 &&
        m.embeds[0].fields?.some(f => f.name === '📋 ID' && f.value === ticket.ticketId)
    );

    if (originalMessage) {
        await originalMessage.edit({
            embeds: [{
                title: `${typeInfo.emoji} ${typeInfo.label}`,
                description: typeInfo.requiresProof
                    ? config.messages.ticketCreatedProof
                    : config.messages.ticketCreated,
                fields: [
                    { name: '📋 ID', value: ticket.ticketId, inline: true },
                    { name: '👤 Usuario', value: `<@${ticket.userId}>`, inline: true },
                    { name: '🟢 Estado', value: `Atendido por <@${interaction.user.id}>`, inline: true },
                    { name: '📝 Descripción', value: ticket.detail, inline: false }
                ],
                footer: { text: config.branding.serverName },
                timestamp: new Date(),
                color: parseInt(typeInfo.color.replace('#', ''), 16)
            }],
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: '👥 Solicitar Ayuda',
                        style: 1,
                        custom_id: 'addstaff_ticket'
                    },
                    {
                        type: 2,
                        label: '🔒 Cerrar Ticket',
                        style: 4,
                        custom_id: 'close_ticket'
                    }
                ]
            }]
        });
    }

    await interaction.channel.send({
        content: `🛎️ Ticket reclamado por <@${interaction.user.id}>`
    });

    await logger.sendTicketLog(client, {
        action: 'claimed',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        claimedBy: interaction.user.id,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket reclamado correctamente.' });
}

async function handleCloseModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('Cerrar Ticket');

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

async function handleCloseWithReason(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket) {
        return interaction.editReply({ content: '❌ No se encontró el ticket.' });
    }

    await ticket.close(interaction.user.id, interaction.user.tag, reason);
    
    if (config.categories.closed) {
        await interaction.channel.setParent(config.categories.closed).catch(console.error);
    }

    await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false
    }).catch(console.error);

    await interaction.channel.send({
        embeds: [{
            color: parseInt(config.branding.colors.error.replace('#', ''), 16),
            title: '🔒 Ticket Cerrado',
            fields: [
                { name: 'Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Razón', value: reason, inline: true }
            ],
            footer: { text: config.branding.serverName },
            timestamp: new Date()
        }],
        components: [{
            type: 1,
            components: [
                {
                    type: 2,
                    label: '🔓 Reabrir',
                    style: 3,
                    custom_id: 'reopen_ticket'
                },
                {
                    type: 2,
                    label: '🗑️ Eliminar',
                    style: 4,
                    custom_id: 'delete_ticket'
                }
            ]
        }]
    });

    await logger.sendTicketLog(client, {
        action: 'closed',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        closedBy: interaction.user.id,
        reason,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket cerrado correctamente.' });
}

async function handleTicketReopen(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.editReply({ content: '❌ No se encontró el ticket.' });
    }

    ticket.status = 'open';
    ticket.lastActivity = new Date();
    ticket.inactivityWarned = false;
    await ticket.save();

    if (config.categories.open) {
        await interaction.channel.setParent(config.categories.open).catch(console.error);
    }

    await interaction.channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: true
    }).catch(console.error);

    await interaction.channel.send({
        embeds: [{
            color: parseInt(config.branding.colors.success.replace('#', ''), 16),
            title: '🔓 Ticket Reabierto',
            description: `Ticket reabierto por <@${interaction.user.id}>`,
            timestamp: new Date()
        }]
    });

    await logger.sendTicketLog(client, {
        action: 'reopened',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        reopenedBy: interaction.user.id,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket reabierto correctamente.' });
}

async function handleTicketDelete(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    await interaction.reply({ 
        content: '🗑️ Este canal será eliminado en 5 segundos...', 
        ephemeral: true 
    });

    if (ticket) {
        await logger.sendTicketLog(client, {
            action: 'deleted',
            ticketId: ticket.ticketId,
            userId: ticket.userId,
            deletedBy: interaction.user.id
        });
    }
    
    setTimeout(() => {
        interaction.channel.delete().catch(err => {
            console.error('Error eliminando canal:', err);
        });
    }, 5000);
}

function getStaffPermissions(ticketType) {
    const roles = config.ticketTypes[ticketType].roles;
    return roles.map(r => ({
        id: config.roles[r],
        allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages
        ]
    }));
}

async function handleAddStaffModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_staff_modal')
        .setTitle('Añadir Staff al Ticket');

    const input = new TextInputBuilder()
        .setCustomId('staff_id')
        .setLabel('ID del miembro del staff')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456789012345678')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleAddStaffConfirm(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const staffId = interaction.fields.getTextInputValue('staff_id');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    try {
        await interaction.channel.permissionOverwrites.edit(staffId, {
            ViewChannel: true,
            SendMessages: true
        });

        await interaction.channel.send({
            content: `✅ <@${staffId}> ha sido añadido al ticket por <@${interaction.user.id}>`
        });

        if (ticket) {
            await logger.sendTicketLog(client, {
                action: 'staff_added',
                ticketId: ticket.ticketId,
                staffId,
                addedBy: interaction.user.id,
                channelId: ticket.channelId
            });
        }

        await interaction.editReply({ content: '✅ Staff añadido correctamente.' });
    } catch (error) {
        console.error('Error añadiendo staff:', error);
        await interaction.editReply({ content: '❌ Error al añadir el staff. Verifica que el ID sea correcto.' });
    }
}
