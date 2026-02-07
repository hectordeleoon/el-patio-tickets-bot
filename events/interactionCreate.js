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

    // ✅ Verificar configuración de la CATEGORÍA de tickets abiertos
    if (!config.channels.ticketsOpen) {
        return interaction.editReply({ 
            content: '❌ ERROR DE CONFIGURACIÓN: La categoría de tickets abiertos no está configurada.\n\n' +
                     'Configura TICKETS_OPEN_CHANNEL_ID en tu .env con el ID de una CATEGORÍA.'
        });
    }

    // ✅ Obtener la CATEGORÍA donde se crearán los canales
    const ticketsCategory = await interaction.guild.channels.fetch(config.channels.ticketsOpen).catch(err => {
        console.error('❌ Error obteniendo categoría:', err);
        return null;
    });

    if (!ticketsCategory) {
        return interaction.editReply({ 
            content: '❌ ERROR: No se encontró la categoría de tickets.\n\n' +
                     'Verifica que TICKETS_OPEN_CHANNEL_ID sea correcto.'
        });
    }

    // ✅ Verificar que es una CATEGORÍA
    if (ticketsCategory.type !== ChannelType.GuildCategory) {
        return interaction.editReply({
            content: '❌ ERROR: TICKETS_OPEN_CHANNEL_ID debe ser una CATEGORÍA, no un canal.\n\n' +
                     'Clic derecho en la categoría "Tickets Abiertos" → Copiar ID del canal → pégalo en tu .env'
        });
    }

    const nextId = await Ticket.generateNextId();
    const ticketId = `${nextId}`;
    const channelName = `ticket-${ticketId}`;

    try {
        console.log('🔧 Creando canal de ticket...');
        console.log('📁 Categoría:', ticketsCategory.name, `(${ticketsCategory.id})`);
        console.log('📝 Nombre canal:', channelName);
        
        // ✅ PREPARAR PERMISOS ANTES DE CREAR EL CANAL
        const permissionOverwrites = [
            {
                // ❌ @everyone no puede ver
                id: interaction.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                // ✅ El usuario puede ver y escribir
                id: userId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            {
                // ✅ El bot puede ver y gestionar
                id: client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages
                ]
            }
        ];

        // ✅ AGREGAR PERMISOS PARA ROLES DE STAFF DESDE EL INICIO
        for (const roleKey of typeInfo.roles) {
            const roleId = config.roles[roleKey];
            if (!roleId) {
                console.warn(`⚠️ Rol ${roleKey} no configurado en config.roles`);
                continue;
            }

            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (!role) {
                console.warn(`⚠️ No se encontró el rol con ID: ${roleId}`);
                continue;
            }

            // Agregar permisos del rol al array ANTES de crear el canal
            permissionOverwrites.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks
                ]
            });

            console.log(`✅ Rol ${role.name} agregado a permisos iniciales`);
        }
        
        // ✅ CREAR CANAL CON TODOS LOS PERMISOS YA INCLUIDOS
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: ticketsCategory.id,
            topic: `Ticket #${ticketId} - ${typeInfo.label} - Usuario: ${username}`,
            permissionOverwrites: permissionOverwrites, // ✅ Todos los permisos desde el inicio
            reason: `Ticket #${ticketId} creado por ${username}`
        });

        if (!ticketChannel || !ticketChannel.id) {
            console.error('❌ Canal creado pero sin ID');
            return interaction.editReply({ 
                content: '❌ Error al crear el ticket. Intenta de nuevo.' 
            });
        }

        console.log(`✅ Canal creado con permisos completos: ${ticketChannel.id}`);

        // Guardar en BD
        await Ticket.create({
            ticketId,
            channelId: ticketChannel.id,
            userId,
            username,
            type: ticketType,
            detail,
            status: 'open',
            lastActivity: new Date()
        });

        console.log(`✅ Ticket guardado en BD`);

        // ✅ Mensaje inicial en el canal
        await ticketChannel.send({
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

        // ✅ Respuesta al usuario
        await interaction.editReply({ 
            content: `✅ **Ticket #${ticketId} creado!**\n\n` +
                     `📂 Ve a tu ticket: <#${ticketChannel.id}>`,
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    label: '📂 Ir al Ticket',
                    style: 5,
                    url: `https://discord.com/channels/${interaction.guildId}/${ticketChannel.id}`
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
            channelId: ticketChannel.id
        });

        // Stats
        try {
            const stats = await Stats.getTodayStats();
            await stats.incrementCreated(ticketType);
        } catch (statsError) {
            console.error('Error actualizando stats:', statsError);
        }

    } catch (error) {
        console.error('❌ Error creando ticket:', error);
        console.error('Stack:', error.stack);
        
        return interaction.editReply({ 
            content: '❌ Error al crear el ticket.\n\n' +
                     '**Posibles causas:**\n' +
                     '• El bot no tiene permisos para crear canales\n' +
                     '• La categoría está llena (máximo 50 canales)\n' +
                     `\n**Error:** \`${error.message}\``
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
   CERRAR TICKETS
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

    // ✅ Si es un canal de ticket, moverlo a categoría cerrados
    if (!interaction.channel.isThread()) {
        try {
            // Obtener categoría de tickets cerrados
            const closedCategory = await interaction.guild.channels.fetch(config.channels.ticketsClosed).catch(() => null);
            
            if (closedCategory && closedCategory.type === ChannelType.GuildCategory) {
                // Mover a categoría cerrados
                await interaction.channel.setParent(closedCategory.id);
            }
            
            // Renombrar el canal
            await interaction.channel.setName(`cerrado-${ticket.ticketId}`);
            
            // Bloquear el canal (solo lectura para el usuario)
            await interaction.channel.permissionOverwrites.edit(ticket.userId, {
                SendMessages: false
            });
            
            // Enviar mensaje de cierre
            await interaction.channel.send({
                embeds: [{
                    color: 0xFF0000,
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
            
        } catch (err) {
            console.error('Error cerrando canal:', err);
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

    // ✅ Si es un canal de ticket, moverlo de vuelta a abiertos
    if (!interaction.channel.isThread()) {
        try {
            // Obtener categoría de tickets abiertos
            const openCategory = await interaction.guild.channels.fetch(config.channels.ticketsOpen).catch(() => null);
            
            if (openCategory && openCategory.type === ChannelType.GuildCategory) {
                // Mover a categoría abiertos
                await interaction.channel.setParent(openCategory.id);
            }
            
            // Renombrar el canal
            await interaction.channel.setName(`ticket-${ticket.ticketId}`);
            
            // Desbloquear el canal
            await interaction.channel.permissionOverwrites.edit(ticket.userId, {
                SendMessages: true
            });
        } catch (err) {
            console.error('Error reabriendo canal:', err);
        }
    }

    await interaction.channel.send({
        embeds: [{
            color: 0x00FF00,
            title: '🔓 Ticket Reabierto',
            description: `Ticket reabierto por <@${interaction.user.id}>`,
            timestamp: new Date()
        }],
        components: [{
            type: 1,
            components: [
                { type: 2, label: '🛎️ Atender', style: 3, custom_id: 'claim_ticket' },
                { type: 2, label: '🔒 Cerrar', style: 4, custom_id: 'close_ticket' }
            ]
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
    await interaction.reply({ content: '🗑️ Este canal será eliminado en 5 segundos...', ephemeral: true });

    if (ticket) {
        await logger.sendTicketLog(client, {
            action: 'deleted',
            ticketId: ticket.ticketId,
            userId: ticket.userId,
            deletedBy: interaction.user.id
        });
        
        // Eliminar de la base de datos
        await Ticket.deleteOne({ channelId: interaction.channel.id });
    }

    setTimeout(() => {
        interaction.channel.delete().catch(console.error);
    }, 5000);
}

/* ===========================
   AÑADIR STAFF
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
        // ✅ Dar permisos al staff en el canal
        await interaction.channel.permissionOverwrites.edit(staffId, { 
            ViewChannel: true, 
            SendMessages: true,
            AttachFiles: true,
            ReadMessageHistory: true
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
        await interaction.editReply({ 
            content: '❌ Error al añadir el staff. Verifica que el ID sea correcto y que el bot tenga permisos.' 
        });
    }
}
