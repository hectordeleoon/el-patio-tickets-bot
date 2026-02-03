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

/* ===========================
   FUNCIONES DE TICKETS
=========================== */

async function handleTicketCreateModal(interaction, ticketType) {
    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) {
        return interaction.reply({ content: '❌ Tipo de ticket inválido.', ephemeral: true });
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

    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) return interaction.editReply({ content: '❌ Tipo de ticket inválido.' });

    const nextId = await Ticket.generateNextId();
    const ticketId = `${nextId}`;
    const threadName = `🎫 ${ticketId} - ${interaction.user.username}`;

    const ticketsChannel = await interaction.guild.channels.fetch(config.channels.ticketsOpen);
    if (!ticketsChannel) return interaction.editReply({ content: '❌ No se encontró el canal de tickets abiertos.' });

    try {
        console.log('🔧 Intentando crear thread...');
        console.log('📁 Canal de tickets:', ticketsChannel.id);
        console.log('📝 Nombre del thread:', threadName);
        
        const thread = await ticketsChannel.threads.create({
            name: threadName,
            autoArchiveDuration: 10080,
            type: ChannelType.PublicThread,
            reason: `Ticket #${ticketId} creado por ${username}`
        });

        console.log('✅ Thread creado exitosamente');
        console.log('🆔 Thread completo:', JSON.stringify({
            id: thread.id,
            name: thread.name,
            parentId: thread.parentId,
            guildId: thread.guildId,
            type: thread.type
        }, null, 2));
        
        if (!thread || !thread.id) {
            console.error('❌ ERROR: Thread creado pero sin ID válido');
            console.error('Thread object:', thread);
            return interaction.editReply({ 
                content: '❌ Error: El thread se creó pero no tiene un ID válido. Contacta a un administrador.' 
            });
        }

        console.log(`✅ Thread ID confirmado: ${thread.id}`);
        console.log(`📋 Ticket ID: ${ticketId}`);

        // CORRECCIÓN: Manejo de errores al agregar usuario
        try {
            await thread.members.add(userId);
        } catch (addUserError) {
            if (addUserError.code === 50001) {
                console.log(`⚠️ No se pudo agregar al usuario ${userId} al thread (permisos), pero el thread fue creado.`);
            } else {
                console.error('Error agregando usuario al thread:', addUserError);
            }
        }

        // CORRECCIÓN: Manejo de errores al agregar staff
        for (const roleKey of typeInfo.roles) {
            const roleId = config.roles[roleKey];
            if (roleId) {
                try {
                    const role = await interaction.guild.roles.fetch(roleId);
                    if (role) {
                        for (const [memberId] of role.members) {
                            try {
                                await thread.members.add(memberId);
                            } catch (addMemberError) {
                                if (addMemberError.code !== 50001) {
                                    console.error(`Error agregando miembro ${memberId}:`, addMemberError.message);
                                }
                            }
                        }
                    }
                } catch (roleError) {
                    console.error(`Error obteniendo rol ${roleKey}:`, roleError.message);
                }
            }
        }

        console.log(`💾 Guardando en BD con Channel ID: ${thread.id}`);
        
        await Ticket.create({
            ticketId,
            channelId: thread.id,
            userId,
            username,
            type: ticketType,
            detail,
            status: 'open',
            lastActivity: new Date()
        });

        console.log(`✅ Ticket guardado en BD - Channel ID: ${thread.id}`);

        console.log(`📨 Enviando mensaje inicial al thread ${thread.id}...`);
        
        await thread.send({
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

        console.log(`✅ Mensaje enviado al thread correctamente`);
        console.log(`📢 Enviando notificación al canal principal...`);
        console.log(`🔗 Link del thread: <#${thread.id}>`);

        // 🆕 Enviar notificación en el canal principal
        await ticketsChannel.send({
            content: `🎫 **Nuevo ticket creado:** <@${userId}> - ${typeInfo.label}`,
            embeds: [{
                description: `📋 ID: **${ticketId}**\n🧵 Hilo: ${thread}`,
                color: parseInt(typeInfo.color.replace('#', ''), 16)
            }]
        });

        console.log(`📨 Enviando respuesta con link: <#${thread.id}>`);
        console.log(`📨 Thread ID raw: ${thread.id}`);
        console.log(`📨 Thread Name: ${thread.name}`);
        
        await interaction.editReply({ 
            content: `✅ Ticket #${ticketId} creado correctamente.\n🔗 Canal: <#${thread.id}>\n🆔 ID: \`${thread.id}\``,
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    label: '📂 Ir al Ticket',
                    style: 5,
                    url: `https://discord.com/channels/${interaction.guildId}/${thread.id}`
                }]
            }]
        });

    } catch (threadError) {
        console.error('Error crítico creando ticket:', threadError);
        return interaction.editReply({ 
            content: '❌ Error al crear el ticket. Por favor, verifica que el bot tenga permisos para crear hilos privados.' 
        });
    }
}

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket || ticket.status !== 'open') return interaction.editReply({ content: '❌ Ticket inválido o ya reclamado.' });

    await ticket.claim(interaction.user.id, interaction.user.tag);
    const typeInfo = config.ticketTypes[ticket.type];

    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const originalMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].fields?.some(f => f.name === '📋 ID' && f.value === ticket.ticketId));
    if (originalMessage) {
        await originalMessage.edit({
            embeds: [{
                title: `${typeInfo.emoji} ${typeInfo.label}`,
                description: typeInfo.requiresProof ? config.messages.ticketCreatedProof : config.messages.ticketCreated,
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
                    { type: 2, label: '👥 Solicitar Ayuda', style: 1, custom_id: 'addstaff_ticket' },
                    { type: 2, label: '🔒 Cerrar Ticket', style: 4, custom_id: 'close_ticket' }
                ]
            }]
        });
    }

    await interaction.channel.send({ content: `🛎️ Ticket reclamado por <@${interaction.user.id}>` });
    await interaction.editReply({ content: '✅ Ticket reclamado correctamente.' });
}

/* ===========================
   CERRAR TICKETS Y MOVERLOS
=========================== */
async function handleCloseModal(interaction) {
    const modal = new ModalBuilder().setCustomId('close_reason_modal').setTitle('Cerrar Ticket');
    const input = new TextInputBuilder().setCustomId('close_reason').setLabel('Razón del cierre')
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
    if (!ticket) return interaction.editReply({ content: '❌ No se encontró el ticket.' });

    await ticket.close(interaction.user.id, interaction.user.tag, reason);

    if (interaction.channel.isThread()) {
        // Bloquea y archiva el hilo original
        await interaction.channel.setLocked(true).catch(console.error);
        await interaction.channel.setArchived(true).catch(console.error);

        // Canal de tickets cerrados
        const closedChannel = await interaction.guild.channels.fetch(config.channels.ticketsClosed);
        if (!closedChannel) return interaction.editReply({ content: '❌ No se encontró el canal de tickets cerrados.' });

        // Crea hilo cerrado
        const closedThread = await closedChannel.threads.create({
            name: `🔒 ${ticket.ticketId} - ${interaction.user.username}`,
            autoArchiveDuration: 10080,
            type: ChannelType.PublicThread,
            reason: `Ticket #${ticket.ticketId} cerrado por ${interaction.user.tag}`
        });

        // CORRECCIÓN: Agregar usuario con manejo de errores
        try {
            await closedThread.members.add(ticket.userId);
        } catch (err) {
            console.log('⚠️ No se pudo agregar al usuario al thread cerrado:', err.code);
        }

        // CORRECCIÓN: Agregar staff con manejo de errores
        const typeInfo = config.ticketTypes[ticket.type];
        for (const roleKey of typeInfo.roles) {
            const roleId = config.roles[roleKey];
            if (roleId) {
                try {
                    const role = await interaction.guild.roles.fetch(roleId);
                    if (role) {
                        for (const [memberId] of role.members) {
                            try {
                                await closedThread.members.add(memberId);
                            } catch (err) {
                                if (err.code !== 50001) {
                                    console.error(`Error agregando staff ${memberId}:`, err.message);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error con rol ${roleKey}:`, err.message);
                }
            }
        }

        // Copiar últimos 100 mensajes
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        for (const msg of sortedMessages) {
            if (msg.content || msg.embeds.length > 0 || msg.attachments.size > 0) {
                try {
                    await closedThread.send({
                        content: msg.content || undefined,
                        embeds: msg.embeds.length > 0 ? msg.embeds : undefined,
                        files: msg.attachments.size > 0 ? Array.from(msg.attachments.values()).map(a => a.url) : undefined,
                        allowedMentions: { parse: [] }
                    });
                } catch (msgError) {
                    console.error('Error copiando mensaje:', msgError.message);
                }
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
    }

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

/* ===========================
   REABRIR TICKET
=========================== */
async function handleTicketReopen(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket) return interaction.editReply({ content: '❌ No se encontró el ticket.' });

    ticket.status = 'open';
    ticket.lastActivity = new Date();
    ticket.inactivityWarned = false;
    await ticket.save();

    if (interaction.channel.isThread()) {
        await interaction.channel.setArchived(false).catch(console.error);
        await interaction.channel.setLocked(false).catch(console.error);
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        const displayName = user ? user.username : 'Usuario';
        await interaction.channel.setName(`🎫 ${ticket.ticketId} - ${displayName}`).catch(console.error);
    }

    await interaction.channel.send({
        embeds: [{
            color: parseInt(config.branding.colors.success.replace('#', ''), 16),
            title: '🔓 Ticket Reabierto',
            description: `Ticket reabierto por <@${interaction.user.id}>`,
            timestamp: new Date()
        }],
        components: [{
            type: 1,
            components: [{ type: 2, label: '🔒 Cerrar Ticket', style: 4, custom_id: 'close_ticket' }]
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

/* ===========================
   ELIMINAR TICKET
=========================== */
async function handleTicketDelete(interaction, client) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    await interaction.reply({ content: '🗑️ Este hilo será eliminado en 5 segundos...', ephemeral: true });

    if (ticket) {
        await logger.sendTicketLog(client, {
            action: 'deleted',
            ticketId: ticket.ticketId,
            userId: ticket.userId,
            deletedBy: interaction.user.id
        });
    }

    setTimeout(() => {
        interaction.channel.delete().catch(console.error);
    }, 5000);
}

/* ===========================
   STAFF ADD
=========================== */
async function handleAddStaffModal(interaction) {
    const modal = new ModalBuilder().setCustomId('add_staff_modal').setTitle('Añadir Staff al Ticket');
    const input = new TextInputBuilder().setCustomId('staff_id').setLabel('ID del miembro del staff')
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
        if (interaction.channel.isThread()) {
            await interaction.channel.members.add(staffId);
        } else {
            await interaction.channel.permissionOverwrites.edit(staffId, { 
                ViewChannel: true, 
                SendMessages: true 
            });
        }

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
        await interaction.editReply({ 
            content: '❌ Error al añadir el staff. Verifica que el ID sea correcto y que el bot tenga permisos.' 
        });
    }
}
