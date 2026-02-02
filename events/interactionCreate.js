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
const logger = require('../utils/logger');
const idiomaCommand = require('../commands/idioma');

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
                await interaction.reply({ content: '❌ Error ejecutando comando.', ephemeral: true });
            }
        }

        // BUTTONS
        if (interaction.isButton()) {
            const [action, param] = interaction.customId.split('_');
            try {
                if (action === 'ticket') return handleTicketCreateModal(interaction, param);
                if (action === 'claim') return handleTicketClaim(interaction, client);
                if (action === 'close') return handleCloseWithReason(interaction, client); // <-- movido aquí
                if (action === 'reopen') return handleTicketReopen(interaction, client);
                if (action === 'delete') return handleTicketDelete(interaction, client);
                if (action === 'addstaff') return handleAddStaffModal(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Error procesando acción.', ephemeral: true });
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
                await interaction.reply({ content: '❌ Error al cambiar el idioma.', ephemeral: true });
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
                await interaction.reply({ content: '❌ Error procesando formulario.', ephemeral: true });
            }
        }
    }
};

/* ===============================
   FUNCIONES DE TICKET
================================= */

async function handleCloseWithReason(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket) return interaction.editReply({ content: '❌ No se encontró el ticket.' });

    await ticket.close(interaction.user.id, interaction.user.tag, reason);

    if (!interaction.channel.isThread()) return;

    // Bloquear y archivar el hilo original
    await interaction.channel.setLocked(true).catch(console.error);
    await interaction.channel.setArchived(true).catch(console.error);

    // Mover al canal de tickets cerrados
    const closedChannel = await interaction.guild.channels.fetch(config.channels.ticketsClosed);
    if (!closedChannel) return interaction.editReply({
        content: '❌ No se encontró el canal de tickets cerrados. Contacta a un administrador.'
    });

    // Crear hilo en tickets cerrados
    const closedThread = await closedChannel.threads.create({
        name: `🔒 ${ticket.ticketId} - ${interaction.user.username}`,
        autoArchiveDuration: 10080,
        type: ChannelType.PrivateThread,
        reason: `Ticket #${ticket.ticketId} cerrado por ${interaction.user.tag}`
    });

    // Agregar usuario y staff
    await closedThread.members.add(ticket.userId).catch(console.error);
    const typeInfo = config.ticketTypes[ticket.type];
    for (const roleKey of typeInfo.roles) {
        const roleId = config.roles[roleKey];
        if (!roleId) continue;
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) continue;
        for (const [memberId] of role.members) {
            await closedThread.members.add(memberId).catch(console.error);
        }
    }

    // Copiar últimos 100 mensajes
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

    // Mensaje final
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
