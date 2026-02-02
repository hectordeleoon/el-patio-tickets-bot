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
    
    const threadName = `🎫 ${ticketId} - ${interaction.user.username}`;

    const ticketsChannel = await interaction.guild.channels.fetch(config.channels.ticketsOpen);
    
    if (!ticketsChannel) {
        return interaction.editReply({ 
            content: '❌ Error: No se encontró el canal de tickets abiertos. Contacta a un administrador.' 
        });
    }

    const thread = await ticketsChannel.threads.create({
        name: threadName,
        autoArchiveDuration: 10080,
        type: ChannelType.PrivateThread,
        reason: `Ticket #${ticketId} creado por ${username}`
    });

    await thread.members.add(userId);

    const staffRoles = typeInfo.roles;
    for (const roleKey of staffRoles) {
        const roleId = config.roles[roleKey];
        if (roleId) {
            const role = await interaction.guild.roles.fetch(roleId);
