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
                }).catch(() => {});
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
                }).catch(() => {});
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
                }).catch(() => {});
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
                }).catch(() => {});
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

    // ✅ FIX 1: Verificar que existe el canal de tickets abiertos
    if (!config.channels.ticketsOpen) {
        return interaction.editReply({ 
            content: '❌ ERROR DE CONFIGURACIÓN: El canal de tickets abiertos no está configurado en .env\n\n' +
                     'Por favor, añade la variable TICKETS_OPEN_CHANNEL_ID en tu archivo .env'
        });
    }

    const ticketsChannel = await interaction.guild.channels.fetch(config.channels.ticketsOpen).catch(err => {
        console.error('❌ Error obteniendo canal de tickets:', err);
        return null;
    });

    if (!ticketsChannel) {
        return interaction.editReply({ 
            content: '❌ ERROR: No se encontró el canal de tickets abiertos.\n\n' +
                     'Verifica que el ID en TICKETS_OPEN_CHANNEL_ID sea correcto y que el bot tenga acceso al canal.'
        });
    }

    // ✅ FIX 2: Verificar que es un canal de texto
    if (ticketsChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
            content: '❌ ERROR: El canal de tickets abiertos debe ser un canal de texto normal, no una categoría ni otro tipo de canal.'
        });
    }

    const nextId = await Ticket.generateNextId();
    const ticketId = `${nextId}`;
    const threadName = `🎫 ${ticketId} - ${interaction.user.username}`;

    try {
        console.log('🔧 Creando thread...');
        console.log('📁 Canal:', ticketsChannel.name, `(${ticketsChannel.id})`);
        console.log('📝 Nombre thread:', threadName);
        
        // ✅ FIX 3: Crear thread PÚBLICO (no privado)
        const thread = await ticketsChannel.threads.create({
            name: threadName,
            autoArchiveDuration: 10080, // 7 días
            type: ChannelType.PublicThread, // PÚBLICO
            reason: `Ticket #${ticketId} creado por ${username}`
        });

        if (!thread || !thread.id) {
            console.error('❌ Thread creado pero sin ID');
            return interaction.editReply({ 
                content: '❌ Error al crear el ticket. Intenta de nuevo o contacta a un administrador.' 
            });
        }

        console.log(`✅ Thread creado: ${thread.id}`);

        // ✅ FIX 4: Agregar usuario al thread con mejor manejo de errores
        try {
            await thread.members.add(userId);
            console.log(`✅ Usuario ${userId} agregado al thread`);
        } catch (addUserError) {
            console.error('⚠️ Error agregando usuario al thread:', addUserError.message);
            // Continuamos aunque falle - el usuario puede acceder igual al thread público
        }

        // ✅ FIX 5: Agregar roles de staff de forma más eficiente
        try {
            for (const roleKey of typeInfo.roles) {
                const roleId = config.roles[roleKey];
                if (!roleId) {
                    console.log(`⚠️ Rol ${roleKey} no configurado`);
                    continue;
                }

                const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    console.log(`⚠️ No se encontró el rol ${roleKey}`);
                    continue;
                }

                // Solo agregar los primeros 5 miembros de cada rol para no sobrecargar
                const members = Array.from(role.members.values()).slice(0, 5);
                for (const member of members) {
                    try {
                        await thread.members.add(member.id);
                    } catch (err) {
                        // Ignorar errores silenciosamente
                    }
                }
            }
        } catch (roleError) {
            console.error('⚠️ Error agregando staff:', roleError.message);
            // Continuamos aunque falle
        }

        // Guardar en BD
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

        console.log(`✅ Ticket guardado en BD`);

        // Enviar mensaje inicial en el thread
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

        // Notificación en el canal principal
        await ticketsChannel.send({
            content: `🎫 **Nuevo ticket creado:** <@${userId}> - ${typeInfo.label}`,
            embeds: [{
                description: `📋 ID: **${ticketId}**\n🧵 Hilo: <#${thread.id}>`,
                color: parseInt(typeInfo.color.replace('#', ''), 16)
            }]
        });

        // ✅ FIX 6: Construir URL correctamente y verificar
        const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
        console.log(`🔗 URL del thread: ${threadUrl}`);

        // ✅ FIX 7: Respuesta mejorada con más opciones
        await interaction.editReply({ 
            content: `✅ **Ticket #${ticketId} creado correctamente!**\n\n` +
                     `🔗 Haz clic en el botón de abajo para ir a tu ticket\n` +
                     `📌 También puedes hacer clic aquí: <#${thread.id}>`,
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    label: '📂 Ir al Ticket',
                    style: 5, // Link button
                    url: threadUrl
                }]
            }]
        });

        // Log
        await logger.sendTicketLog(client, {
            action: 'created',
            ticketId,
            userId,
            type: ticketType,
            detail,
            channelId: thread.id
        });

        // Stats
        try {
            const stats = await Stats.getTodayStats();
            await stats.incrementCreated(ticketType);
        } catch (statsError) {
            console.error('Error actualizando stats:', statsError);
        }

    } catch (threadError) {
        console.error('❌ Error crítico creando ticket:', threadError);
        console.error('Stack:', threadError.stack);
        
        return interaction.editReply({ 
            content: '❌ Error al crear el ticket.\n\n' +
                     '**Posibles causas:**\n' +
                     '• El bot no tiene permisos para crear hilos\n' +
                     '• El canal de tickets no es un canal de texto normal\n' +
                     '• Problemas de conexión con Discord\n\n' +
                     'Contacta a un administrador con este error:\n' +
                     `\`${threadError.message}\``
        });
    }
}

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket) {
        return interaction.editReply({ content: '❌ No se encontró información del ticket.' });
    }
    
    if (ticket.status !== 'open') {
        return interaction.editReply({ content: '❌ Este ticket ya ha sido reclamado.' });
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
    
    await logger.sendTicketLog(client, {
        action: 'claimed',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        claimedBy: interaction.user.id,
        channelId: ticket.channelId
    });
    
    await interaction.editReply({ content: '✅ Ticket reclamado correctamente.' });
}

/* ===========================
   CERRAR TICKETS Y MOVERLOS
=========================== */
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

    if (interaction.channel.isThread()) {
        // Renombrar el hilo para indicar que está cerrado
        await interaction.channel.setName(`🔒 ${ticket.ticketId} - ${interaction.user.username}`).catch(console.error);
        
        // Bloquear y archivar el hilo
        await interaction.channel.setLocked(true).catch(console.error);
        await interaction.channel.setArchived(true).catch(console.error);

        // Si existe canal de tickets cerrados, crear un hilo allí también
        if (config.channels.ticketsClosed) {
            const closedChannel = await interaction.guild.channels.fetch(config.channels.ticketsClosed).catch(() => null);
            
            if (closedChannel && closedChannel.type === ChannelType.GuildText) {
                try {
                    const closedThread = await closedChannel.threads.create({
                        name: `🔒 ${ticket.ticketId} - ${interaction.user.username}`,
                        autoArchiveDuration: 10080,
                        type: ChannelType.PublicThread,
                        reason: `Ticket #${ticket.ticketId} cerrado por ${interaction.user.tag}`
                    });

                    // Agregar participantes
                    try {
                        await closedThread.members.add(ticket.userId);
                    } catch (err) {
                        console.log('⚠️ No se pudo agregar usuario al hilo cerrado');
                    }

                    // Copiar mensajes importantes
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    
                    for (const msg of sortedMessages.slice(0, 50)) { // Solo los primeros 50 mensajes
                        if (msg.content || msg.embeds.length > 0) {
                            try {
                                await closedThread.send({
                                    content: `**[${msg.author.tag}]:** ${msg.content || '(embed)'}`,
                                    allowedMentions: { parse: [] }
                                });
                            } catch (err) {
                                // Ignorar errores al copiar mensajes
                            }
                        }
                    }

                    // Mensaje de cierre
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
                                { type: 2, label: '🔓 Reabrir', style: 3, custom_id: 'reopen_ticket' }
                            ]
                        }]
                    });
                } catch (closedThreadError) {
                    console.error('Error creando hilo cerrado:', closedThreadError);
                }
            }
        }
    }

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

/* ===========================
   REABRIR TICKET
=========================== */
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
