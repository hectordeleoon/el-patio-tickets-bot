const { Events, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config/config');
const Ticket = require('../models/Ticket');
const Stats = require('../models/Stats');
const proofDetector = require('../utils/proofDetector');
const transcriptGenerator = require('../utils/transcriptGenerator');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Manejar comandos slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`Comando ${interaction.commandName} no encontrado`);
                return;
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Error ejecutando comando ${interaction.commandName}:`, error);
                await interaction.reply({
                    content: '❌ Hubo un error al ejecutar este comando.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
        
        // Manejar botones
        if (interaction.isButton()) {
            const [action, ...params] = interaction.customId.split('_');
            
            try {
                switch (action) {
                    case 'ticket':
                        await handleTicketCreate(interaction, params[0]);
                        break;
                    
                    case 'claim':
                        await handleTicketClaim(interaction, client);
                        break;
                    
                    case 'close':
                        // Abre el modal para pedir razón
                        await handleCloseModal(interaction);
                        break;
                    
                    case 'confirmclose':
                        // Se ejecuta cuando el staff confirma el cierre desde el modal
                        await handleTicketClose(interaction, client);
                        break;
                    
                    case 'reopen':
                        await handleTicketReopen(interaction, client);
                        break;
                    
                    case 'delete':
                        await handleTicketDelete(interaction);
                        break;

                    case 'addstaff':
                        await handleAddStaffModal(interaction);
                        break;
                    
                    default:
                        await interaction.reply({
                            content: '❌ Acción no reconocida.',
                            ephemeral: true
                        });
                }
            } catch (error) {
                console.error(`Error manejando botón ${action}:`, error);
                await interaction.reply({
                    content: '❌ Hubo un error procesando esta acción.',
                    ephemeral: true
                }).catch(() => {});
            }
        }

        // Manejar modales
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId === 'close_reason_modal') {
                    await handleCloseWithReason(interaction, client);
                }
                if (interaction.customId === 'add_staff_modal') {
                    await handleAddStaffConfirm(interaction);
                }
            } catch (error) {
                console.error(`Error manejando modal ${interaction.customId}:`, error);
                await interaction.reply({
                    content: '❌ Hubo un error procesando esta acción.',
                    ephemeral: true
                }).catch(() => {});
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
    
    // Verificar anti-spam
    if (config.system.antiSpamEnabled) {
        const recentCount = await Ticket.countRecentByUser(userId, 24);
        if (recentCount >= config.system.ticketLimit24h) {
            return interaction.editReply({
                content: config.messages.antiSpamWarning.replace('{count}', config.system.ticketLimit24h)
            });
        }
    }
    
    // Verificar máximo de tickets abiertos
    const activeCount = await Ticket.countActiveByUser(userId);
    if (activeCount >= config.system.maxTicketsPerUser) {
        return interaction.editReply({
            content: config.messages.maxTicketsReached.replace('{count}', activeCount)
        });
    }
    
    // Obtener tipo de ticket
    const typeInfo = config.ticketTypes[ticketType];
    if (!typeInfo) {
        return interaction.editReply({
            content: '❌ Tipo de ticket no válido.'
        });
    }
    
    // Generar ID único
    const ticketId = `${ticketType}-${Date.now()}`;
    const channelName = `ticket-${ticketType}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    try {
        // Crear canal
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.categories.open,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: userId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                },
                ...getStaffPermissions(interaction.guild, ticketType, false)
            ]
        });
        
        // Crear ticket en BD
        const ticket = await Ticket.create({
            ticketId,
            channelId: channel.id,
            userId,
            username,
            type: ticketType,
            status: 'open'
        });
        
        // Mensaje inicial con nombre del usuario que creó el ticket
        const initialEmbed = {
            color: parseInt(typeInfo.color.replace('#', ''), 16),
            title: `${typeInfo.emoji} ${typeInfo.label}`,
            description: typeInfo.requiresProof ? config.messages.ticketCreatedProof : config.messages.ticketCreated,
            fields: [
                {
                    name: '📋 ID del Ticket',
                    value: `\`${ticketId}\``,
                    inline: true
                },
                {
                    name: '👤 Creado por',
                    value: `<@${userId}> (${interaction.user.username})`,
                    inline: true
                },
                {
                    name: '📅 Fecha',
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: '📊 Estado',
                    value: '🟡 Esperando atención',
                    inline: true
                }
            ],
            footer: { text: `${config.branding.serverName} • Soporte Oficial` },
            timestamp: new Date()
        };
        
        const components = [];
        
        // Si NO requiere pruebas, mostrar botón de atender inmediatamente
        if (!typeInfo.requiresProof) {
            components.push({
                type: 1,
                components: [{
                    type: 2,
                    label: '🛎️ Atender Ticket',
                    style: 3,
                    custom_id: 'claim_ticket'
                }]
            });
        }
        
        await channel.send({
            content: `<@${userId}>`,
            embeds: [initialEmbed],
            components
        });
        
        // Notificar staff por DM
        if (config.system.dmNotifications) {
            await notifyStaff(interaction.guild, ticketType, ticket, channel);
        }
        
        // Log
        await logTicketCreate(interaction.client, ticket, channel);
        
        // Stats
        const stats = await Stats.getTodayStats();
        await stats.incrementCreated(ticketType);
        
        // Responder al usuario
        await interaction.editReply({
            content: `✅ Tu ticket ha sido creado: <#${channel.id}>`
        });
        
    } catch (error) {
        console.error('Error creando ticket:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al crear el ticket. Contacta a un administrador.'
        });
    }
}

// ============================================================
// CLAIM TICKET (con nombre del staff que lo reclama)
// ============================================================
async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket) {
        return interaction.editReply({
            content: '❌ Este canal no es un ticket válido.'
        });
    }
    
    if (ticket.status === 'closed') {
        return interaction.editReply({
            content: '❌ Este ticket ya está cerrado.'
        });
    }
    
    if (ticket.status === 'claimed') {
        return interaction.editReply({
            content: `❌ Este ticket ya está siendo atendido por <@${ticket.claimedBy.userId}>.`
        });
    }
    
    // Verificar permisos
    const typeInfo = config.ticketTypes[ticket.type];
    const hasPermission = typeInfo.roles.some(role => {
        const roleId = config.roles[role];
        return interaction.member.roles.cache.has(roleId);
    });
    
    if (!hasPermission) {
        return interaction.editReply({
            content: '❌ No tienes permisos para atender este tipo de ticket.'
        });
    }
    
    try {
        // Reclamar ticket
        await ticket.claim(interaction.user.id, interaction.user.tag);
        
        // Actualizar permisos del canal
        await updateChannelPermissions(interaction.channel, ticket, interaction.guild, interaction.user.id);
        
        // Renombrar canal
        const newName = `${interaction.channel.name} | ${interaction.user.username}`.slice(0, 100);
        await interaction.channel.setName(newName);
        
        // Mensaje de confirmación con nombre del staff + botones de cerrar y añadir staff
        await interaction.channel.send({
            embeds: [{
                color: parseInt(config.branding.colors.success.replace('#', ''), 16),
                title: '🛎️ Ticket Asignado',
                description: `Este ticket ahora está siendo atendido por <@${interaction.user.id}> (${interaction.user.username}).\n\nOtros miembros del staff pueden ver la conversación pero solo <@${interaction.user.id}> puede responder.`,
                fields: [
                    {
                        name: '👤 Creado por',
                        value: `<@${ticket.userId}>`,
                        inline: true
                    },
                    {
                        name: '🛡️ Atendido por',
                        value: `<@${interaction.user.id}> (${interaction.user.username})`,
                        inline: true
                    }
                ],
                footer: { text: `${config.branding.serverName} • Soporte Oficial` },
                timestamp: new Date()
            }],
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: '👥 Añadir Staff',
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
        
        // Log
        await logTicketClaim(client, ticket, interaction.user);
        
        // Stats
        const stats = await Stats.getTodayStats();
        await stats.updateStaffActivity(interaction.user.id, interaction.user.tag, 'claim');
        
        await interaction.editReply({
            content: '✅ Has reclamado este ticket exitosamente.'
        });
        
    } catch (error) {
        console.error('Error reclamando ticket:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al reclamar el ticket.'
        });
    }
}

// ============================================================
// MODAL CERRAR TICKET (pide razón al staff)
// ============================================================
async function handleCloseModal(interaction) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket || ticket.status === 'closed') {
        return interaction.reply({
            content: '❌ Este ticket no puede cerrarse.',
            ephemeral: true
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('🔒 Cerrar Ticket');

    const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('¿Por qué estás cerrando este ticket?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: El problema fue resuelto / El usuario no respondió / Duplicado...')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

    await interaction.showModal(modal);
}

// ============================================================
// CONFIRMAR CIERRE CON RAZÓN (cuando el staff envía el modal)
// ============================================================
async function handleCloseWithReason(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket || ticket.status === 'closed') {
        return interaction.editReply({
            content: '❌ Este ticket no puede cerrarse.'
        });
    }

    try {
        // Generar transcripción
        let transcriptPaths = null;
        if (config.system.autoTranscripts) {
            transcriptPaths = await transcriptGenerator.save(ticket);
        }

        // Cerrar ticket con la razón que escribió
        await ticket.close(interaction.user.id, interaction.user.tag, reason);

        // Mensaje de cierre con la razón
        const closeEmbed = {
            color: parseInt(config.branding.colors.error.replace('#', ''), 16),
            title: '🔒 Ticket Cerrado',
            description: config.messages.ticketClosed,
            fields: [
                {
                    name: '👤 Creado por',
                    value: `<@${ticket.userId}>`,
                    inline: true
                },
                {
                    name: '🛡️ Cerrado por',
                    value: `<@${interaction.user.id}> (${interaction.user.username})`,
                    inline: true
                },
                {
                    name: '📝 Razón del cierre',
                    value: reason,
                    inline: false
                },
                {
                    name: '📄 Transcripción',
                    value: transcriptPaths ? '✅ Generada' : '❌ Desactivada',
                    inline: true
                }
            ],
            footer: { text: `${config.branding.serverName} • Soporte Oficial` },
            timestamp: new Date()
        };

        await interaction.channel.send({
            embeds: [closeEmbed],
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: '🔓 Reabrir',
                        style: 1,
                        custom_id: 'reopen_ticket'
                    },
                    {
                        type: 2,
                        label: '🗑️ Eliminar Canal',
                        style: 4,
                        custom_id: 'delete_ticket'
                    }
                ]
            }]
        });

        // Mover a categoría cerrados
        if (config.categories.closed) {
            await interaction.channel.setParent(config.categories.closed);
        }

        // Bloquear canal para el usuario
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
            SendMessages: false
        });

        // Log
        await logTicketClose(client, ticket, interaction.user, reason, transcriptPaths);

        // Stats
        const stats = await Stats.getTodayStats();
        await stats.incrementClosed();
        if (ticket.claimedBy) {
            await stats.updateStaffActivity(ticket.claimedBy.userId, ticket.claimedBy.username, 'close');
        }

        await interaction.editReply({
            content: '✅ Ticket cerrado exitosamente.'
        });

    } catch (error) {
        console.error('Error cerrando ticket:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al cerrar el ticket.'
        });
    }
}

// ============================================================
// AÑADIR STAFF (modal para mencionar al staff)
// ============================================================
async function handleAddStaffModal(interaction) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket || ticket.status === 'closed') {
        return interaction.reply({
            content: '❌ No se puede añadir staff a este ticket.',
            ephemeral: true
        });
    }

    // Solo el staff que reclamo puede añadir otro
    if (ticket.claimedBy && ticket.claimedBy.userId !== interaction.user.id) {
        // Permitir a admins también
        const isAdmin = interaction.member.roles.cache.has(config.roles.admin) || 
                        interaction.member.roles.cache.has(config.roles.seniorAdmin);
        if (!isAdmin) {
            return interaction.reply({
                content: `❌ Solo <@${ticket.claimedBy.userId}> o un admin puede añadir staff a este ticket.`,
                ephemeral: true
            });
        }
    }

    const modal = new ModalBuilder()
        .setCustomId('add_staff_modal')
        .setTitle('👥 Añadir Staff al Ticket');

    const staffInput = new TextInputBuilder()
        .setCustomId('staff_id')
        .setLabel('ID del staff que quieres añadir')
        .setStyle(TextInputStyle.Short)
.setPlaceholder('Ej: 123456789012345678 (activa Modo Desarrollador y copia el ID del usuario)')
        .setRequired(true)
        .setMinLength(15)
        .setMaxLength(25);

    modal.addComponents(new ActionRowBuilder().addComponents(staffInput));

    await interaction.showModal(modal);
}

// ============================================================
// CONFIRMAR AÑADIR STAFF
// ============================================================
async function handleAddStaffConfirm(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffId = interaction.fields.getTextInputValue('staff_id').trim();
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket || ticket.status === 'closed') {
        return interaction.editReply({
            content: '❌ No se puede añadir staff a este ticket.'
        });
    }

    try {
        // Buscar al miembro en el servidor
        const member = await interaction.guild.members.fetch(staffId).catch(() => null);

        if (!member) {
            return interaction.editReply({
                content: '❌ No se encontró ese usuario en el servidor. Verifica el ID.'
            });
        }

        // Verificar que no sea el mismo usuario que creó el ticket
        if (member.id === ticket.userId) {
            return interaction.editReply({
                content: '❌ No puedes añadir al usuario que creó el ticket como staff.'
            });
        }

        // Verificar que sea staff (tiene alguno de los roles de staff)
        const isStaff = Object.values(config.roles).some(roleId => member.roles.cache.has(roleId));
        if (!isStaff) {
            return interaction.editReply({
                content: '❌ Ese usuario no tiene rol de staff.'
            });
        }

        // Dar permisos de escritura al staff añadido
        await interaction.channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true
        });

        // Guardar en el ticket (añadir a lista de staff adicionales)
        if (!ticket.additionalStaff) {
            ticket.additionalStaff = [];
        }
        ticket.additionalStaff.push({
            userId: member.id,
            username: member.user.tag,
            addedBy: interaction.user.id,
            timestamp: new Date()
        });
        await ticket.save();

        // Mensaje en el canal
        await interaction.channel.send({
            embeds: [{
                color: parseInt(config.branding.colors.border.replace('#', ''), 16),
                title: '👥 Staff Añadido',
                description: `<@${member.id}> (${member.user.username}) ha sido añadido al ticket y puede escribir.`,
                fields: [
                    {
                        name: 'Añadido por',
                        value: `<@${interaction.user.id}> (${interaction.user.username})`,
                        inline: true
                    }
                ],
                footer: { text: `${config.branding.serverName} • Soporte Oficial` },
                timestamp: new Date()
            }]
        });

        await interaction.editReply({
            content: `✅ <@${member.id}> ha sido añadido al ticket exitosamente.`
        });

    } catch (error) {
        console.error('Error añadiendo staff:', error);
        await interaction.editReply({
            content: '❌ Hubo un error al añadir staff.'
        });
    }
}

// ============================================================
// REABRIR TICKET
// ============================================================
async function handleTicketReopen(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket) {
        return interaction.editReply({ content: '❌ Ticket no encontrado.' });
    }
    
    if (ticket.status !== 'closed') {
        return interaction.editReply({ content: '❌ Este ticket no está cerrado.' });
    }
    
    try {
        ticket.status = 'open';
        ticket.closedAt = null;
        ticket.closedBy = null;
        await ticket.save();
        
        await interaction.channel.setParent(config.categories.open);
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
            SendMessages: true
        });
        
        await interaction.channel.send({
            embeds: [{
                color: parseInt(config.branding.colors.success.replace('#', ''), 16),
                title: '🔓 Ticket Reabierto',
                description: `Ticket reabierto por <@${interaction.user.id}> (${interaction.user.username}).`,
                fields: [
                    {
                        name: '👤 Creado por',
                        value: `<@${ticket.userId}>`,
                        inline: true
                    }
                ],
                footer: { text: `${config.branding.serverName} • Soporte Oficial` },
                timestamp: new Date()
            }],
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: '👥 Añadir Staff',
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
        
        await interaction.editReply({ content: '✅ Ticket reabierto.' });
    } catch (error) {
        console.error('Error reabriendo ticket:', error);
        await interaction.editReply({ content: '❌ Error al reabrir el ticket.' });
    }
}

// ============================================================
// ELIMINAR TICKET
// ============================================================
async function handleTicketDelete(interaction) {
    await interaction.reply({
        content: '⚠️ Este canal será eliminado en 5 segundos...',
        ephemeral: true
    });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            console.error('Error eliminando canal:', error);
        }
    }, 5000);
}

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function getStaffPermissions(guild, ticketType, canWrite = false) {
    const typeInfo = config.ticketTypes[ticketType];
    const permissions = [];
    
    for (const role of typeInfo.roles) {
        const roleId = config.roles[role];
        if (roleId) {
            permissions.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    ...(canWrite ? [PermissionFlagsBits.SendMessages] : [])
                ]
            });
        }
    }
    
    return permissions;
}

async function updateChannelPermissions(channel, ticket, guild, claimerId) {
    const typeInfo = config.ticketTypes[ticket.type];
    
    // Usuario original puede escribir
    await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true
    });
    
    // Staff que reclamó puede escribir
    await channel.permissionOverwrites.edit(claimerId, {
        ViewChannel: true,
        SendMessages: true
    });
    
    // Otros staff solo ven
    for (const role of typeInfo.roles) {
        const roleId = config.roles[role];
        if (roleId) {
            await channel.permissionOverwrites.edit(roleId, {
                ViewChannel: true,
                SendMessages: false
            });
        }
    }
}

async function notifyStaff(guild, ticketType, ticket, channel) {
    const typeInfo = config.ticketTypes[ticketType];
    
    for (const role of typeInfo.roles) {
        const roleId = config.roles[role];
        if (!roleId) continue;
        
        const members = guild.members.cache.filter(m => m.roles.cache.has(roleId));
        
        for (const [, member] of members) {
            try {
                await member.send({
                    embeds: [{
                        color: parseInt(typeInfo.color.replace('#', ''), 16),
                        title: '🔔 Nuevo Ticket',
                        description: `Hay un nuevo ticket de tipo **${typeInfo.label}**`,
                        fields: [
                            { name: 'ID', value: ticket.ticketId, inline: true },
                            { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
                            { name: 'Canal', value: `<#${channel.id}>`, inline: true }
                        ]
                    }]
                });
            } catch (error) {
                // Usuario tiene DMs cerrados
            }
        }
    }
}

// ============================================================
// LOGS
// ============================================================

async function logTicketCreate(client, ticket, channel) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    await logChannel.send({
        embeds: [{
            color: parseInt(config.branding.colors.success.replace('#', ''), 16),
            title: '🎫 Nuevo Ticket Creado',
            fields: [
                { name: 'ID', value: ticket.ticketId, inline: true },
                { name: 'Tipo', value: ticket.type, inline: true },
                { name: 'Usuario', value: `<@${ticket.userId}> (${ticket.username})`, inline: true },
                { name: 'Canal', value: `<#${channel.id}>`, inline: true }
            ],
            timestamp: new Date()
        }]
    });
}

async function logTicketClaim(client, ticket, user) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    await logChannel.send({
        embeds: [{
            color: parseInt(config.branding.colors.border.replace('#', ''), 16),
            title: '🛎️ Ticket Reclamado',
            fields: [
                { name: 'ID', value: ticket.ticketId, inline: true },
                { name: 'Staff', value: `<@${user.id}> (${user.username})`, inline: true },
                { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true }
            ],
            timestamp: new Date()
        }]
    });
}

async function logTicketClose(client, ticket, user, reason, transcriptPaths) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    const files = [];
    if (transcriptPaths) {
        if (transcriptPaths.txt) files.push(transcriptPaths.txt);
        if (transcriptPaths.html) files.push(transcriptPaths.html);
    }
    
    await logChannel.send({
        embeds: [{
            color: parseInt(config.branding.colors.error.replace('#', ''), 16),
            title: '🔒 Ticket Cerrado',
            fields: [
                { name: 'ID', value: ticket.ticketId, inline: true },
                { name: 'Cerrado por', value: `<@${user.id}> (${user.username})`, inline: true },
                { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
                { name: 'Razón', value: reason, inline: false }
            ],
            timestamp: new Date()
        }],
        files
    });
}
