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

// ============================
// FUNCIONES DE TICKET
// ============================

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

    // Marcar ticket como cerrado y guardar fecha
    await ticket.close(interaction.user.id, interaction.user.tag, reason);
    ticket.closedAt = new Date();
    ticket.archived = false; // Para auto-archivo posterior
    await ticket.save();

    if (interaction.channel.isThread()) {
        // Bloquear hilo original
        await interaction.channel.setLocked(true).catch(console.error);
        await interaction.channel.setArchived(true).catch(console.error);

        // Canal de tickets cerrados
        const closedChannel = await interaction.guild.channels.fetch(config.channels.ticketsClosed);
        if (!closedChannel) {
            return interaction.editReply({
                content: '❌ No se encontró el canal de tickets cerrados. Contacta a un administrador.'
            });
        }

        // Crear nuevo hilo en tickets cerrados
        const closedThread = await closedChannel.threads.create({
            name: `🔒 ${ticket.ticketId} - ${interaction.user.username}`,
            autoArchiveDuration: 10080,
            type: ChannelType.PrivateThread,
            reason: `Ticket #${ticket.ticketId} cerrado por ${interaction.user.tag}`
        });

        // Agregar usuario y staff
        await closedThread.members.add(ticket.userId);
        const typeInfo = config.ticketTypes[ticket.type];
        const staffRoles = typeInfo.roles;
        for (const roleKey of staffRoles) {
            const roleId = config.roles[roleKey];
            if (roleId) {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) {
                    for (const member of role.members.values()) {
                        try {
                            await closedThread.members.add(member.id);
                        } catch (err) {
                            console.error(`Error agregando ${member.user.tag} al hilo cerrado:`, err);
                        }
                    }
                }
            }
        }

        // Copiar últimos 100 mensajes del hilo original
        const messages = await interaction.channel.messages.fetch({ limit: 100, oldestFirst: true });
        for (const msg of messages.values()) {
            try {
                await closedThread.send({
                    content: msg.content || undefined,
                    embeds: msg.embeds.length > 0 ? msg.embeds : undefined,
                    files: msg.attachments.size > 0 ? Array.from(msg.attachments.values()).map(a => a.url) : undefined,
                    allowedMentions: { parse: [] }
                });
            } catch (err) {
                console.error('Error copiando mensaje al hilo cerrado:', err);
            }
        }

        // Mensaje final de cierre
        await closedThread.send({
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
                    { type: 2, label: '🔓 Reabrir', style: 3, custom_id: 'reopen_ticket' },
                    { type: 2, label: '🗑️ Eliminar', style: 4, custom_id: 'delete_ticket' }
                ]
            }]
        });
    }

    // Log del cierre
    await logger.sendTicketLog(client, {
        action: 'closed',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        closedBy: interaction.user.id,
        reason,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket cerrado y movido a tickets cerrados correctamente.' });
}
