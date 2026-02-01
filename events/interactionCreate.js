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
const idiomaCommand = require('../commands/idioma'); // 👈 IMPORTANTE

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // ============================================================
        // SLASH COMMANDS
        // ============================================================
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

        // ============================================================
        // BUTTONS
        // ============================================================
        if (interaction.isButton()) {
            const [action, param] = interaction.customId.split('_');

            try {
                if (action === 'ticket') return handleTicketCreate(interaction, param);
                if (action === 'claim') return handleTicketClaim(interaction, client);
                if (action === 'close') return handleCloseModal(interaction);
                if (action === 'reopen') return handleTicketReopen(interaction);
                if (action === 'delete') return handleTicketDelete(interaction);
                if (action === 'addstaff') return handleAddStaffModal(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: '❌ Error procesando acción.',
                    ephemeral: true
                });
            }
        }

        // ============================================================
        // SELECT MENUS (IDIOMA)
        // ============================================================
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

        // ============================================================
        // MODALS
        // ============================================================
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId === 'close_reason_modal') {
                    return handleCloseWithReason(interaction, client);
                }
                if (interaction.customId === 'add_staff_modal') {
                    return handleAddStaffConfirm(interaction);
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

// ============================================================
// CREAR TICKET
// ============================================================
async function handleTicketCreate(interaction, ticketType) {
    await interaction.deferReply({ ephemeral: true });

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

    const ticketId = `${ticketType}-${Date.now()}`;
    const channelName = `ticket-${ticketType}-${interaction.user.username}`
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
        status: 'open'
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
                { name: '📊 Estado', value: '🟡 Esperando atención', inline: true }
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

    await interaction.editReply({
        content: `✅ Ticket creado correctamente: <#${channel.id}>`
    });
}

// ============================================================
// CLAIM
// ============================================================
async function handleTicketClaim(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket || ticket.status !== 'open') {
        return interaction.editReply({ content: '❌ Ticket inválido.' });
    }

    await ticket.claim(interaction.user.id, interaction.user.tag);

    await interaction.channel.send({
        content: `🛎️ Ticket reclamado por <@${interaction.user.id}>`
    });

    await interaction.editReply({ content: '✅ Ticket reclamado.' });
}

// ============================================================
// CERRAR / REABRIR / BORRAR
// ============================================================
async function handleCloseModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('Cerrar Ticket');

    const input = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Razón del cierre')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleCloseWithReason(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) return;

    await ticket.close(interaction.user.id, interaction.user.tag, reason);
    await interaction.channel.setParent(config.categories.closed);

    await interaction.editReply({ content: '🔒 Ticket cerrado.' });
}

async function handleTicketReopen(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) return;

    ticket.status = 'open';
    await ticket.save();

    await interaction.channel.setParent(config.categories.open);
    await interaction.editReply({ content: '🔓 Ticket reabierto.' });
}

async function handleTicketDelete(interaction) {
    await interaction.reply({ content: '🗑️ Canal eliminado en 5s', ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ============================================================
// STAFF PERMISSIONS
// ============================================================
function getStaffPermissions(ticketType) {
    const roles = config.ticketTypes[ticketType].roles;
    return roles.map(r => ({
        id: config.roles[r],
        allow: [PermissionFlagsBits.ViewChannel]
    }));
}

// ============================================================
// ADD STAFF
// ============================================================
async function handleAddStaffModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_staff_modal')
        .setTitle('Añadir Staff');

    const input = new TextInputBuilder()
        .setCustomId('staff_id')
        .setLabel('ID del staff')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleAddStaffConfirm(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffId = interaction.fields.getTextInputValue('staff_id');
    await interaction.channel.permissionOverwrites.edit(staffId, {
        ViewChannel: true,
        SendMessages: true
    });

    await interaction.editReply({ content: '✅ Staff añadido.' });
}
