const { Events, PermissionFlagsBits, ChannelType } = require('discord.js');
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
                        await handleTicketClose(interaction, client);
                        break;
                    
                    case 'reopen':
                        await handleTicketReopen(interaction, client);
                        break;
                    
                    case 'delete':
                        await handleTicketDelete(interaction);
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
    }
};

/**
 * Crea un nuevo ticket
 */
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
        
        // Mensaje inicial
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
                    name: '👤 Usuario',
                    value: `<@${userId}>`,
                    inline: true
                },
                {
                    name: '📅 Fecha',
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: false
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

/**
 * Reclama un ticket (sistema CLAIM)
 */
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
        
        // Mensaje de confirmación
        await interaction.channel.send({
            embeds: [{
                color: parseInt(config.branding.colors.success.replace('#', ''), 16),
                description: config.messages.ticketClaimed
                    .replace(/{staff}/g, `<@${interaction.user.id}>`)
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

/**
 * Cierra un ticket
 */
async function handleTicketClose(interaction, client) {
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
    
    try {
        // Generar transcripción
        let transcriptPaths = null;
        if (config.system.autoTranscripts) {
            transcriptPaths = await transcriptGenerator.save(ticket);
        }
        
        // Cerrar ticket
        await ticket.close(interaction.user.id, interaction.user.tag, 'Manual');
        
        // Mensaje de cierre
        const closeEmbed = {
            color: parseInt(config.branding.colors.error.replace('#', ''), 16),
            title: '🔒 Ticket Cerrado',
            description: config.messages.ticketClosed,
            fields: [
                {
                    name: 'Cerrado por',
                    value: `<@${interaction.user.id}>`,
                    inline: true
                },
                {
                    name: 'Transcripción',
                    value: transcriptPaths ? '✅ Generada' : '❌ Desactivada',
                    inline: true
                }
            ],
            footer: { text: `${config.branding.serverName} • Soporte Oficial` },
            timestamp: new Date()
        };
        
        const components = [{
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
                    label: '🗑️ Eliminar',
                    style: 4,
                    custom_id: 'delete_ticket'
                }
            ]
        }];
        
        await interaction.channel.send({
            embeds: [closeEmbed],
            components
        });
        
        // Mover a categoría cerrados
        if (config.categories.closed) {
            await interaction.channel.setParent(config.categories.closed);
        }
        
        // Bloquear canal
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
            SendMessages: false
        });
        
        // Log
        await logTicketClose(client, ticket, interaction.user, 'Manual', transcriptPaths);
        
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

/**
 * Reabre un ticket cerrado
 */
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
                description: `✅ Ticket reabierto por <@${interaction.user.id}>`
            }]
        });
        
        await interaction.editReply({ content: '✅ Ticket reabierto.' });
    } catch (error) {
        console.error('Error reabriendo ticket:', error);
        await interaction.editReply({ content: '❌ Error al reabrir el ticket.' });
    }
}

/**
 * Elimina un ticket (canal)
 */
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

// Funciones auxiliares

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
    
    // Usuario original
    await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true
    });
    
    // Staff que reclamó
    await channel.permissionOverwrites.edit(claimerId, {
        ViewChannel: true,
        SendMessages: true
    });
    
    // Otros staff (solo lectura)
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
                { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
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
                { name: 'Staff', value: `<@${user.id}>`, inline: true }
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
                { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                { name: 'Razón', value: reason, inline: true }
            ],
            timestamp: new Date()
        }],
        files
    });
}
