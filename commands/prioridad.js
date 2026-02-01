const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Ticket = require('../models/Ticket');
const config = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prioridad')
        .setDescription('Gestiona la prioridad de tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('establecer')
                .setDescription('Establece la prioridad de un ticket')
                .addStringOption(option =>
                    option
                        .setName('nivel')
                        .setDescription('Nivel de prioridad')
                        .setRequired(true)
                        .addChoices(
                            { name: '🔴 Urgente', value: 'urgente' },
                            { name: '🟠 Alta', value: 'alta' },
                            { name: '🟡 Normal', value: 'normal' },
                            { name: '🟢 Baja', value: 'baja' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver tickets por prioridad')
                .addStringOption(option =>
                    option
                        .setName('nivel')
                        .setDescription('Nivel de prioridad a filtrar')
                        .setRequired(false)
                        .addChoices(
                            { name: '🔴 Urgente', value: 'urgente' },
                            { name: '🟠 Alta', value: 'alta' },
                            { name: '🟡 Normal', value: 'normal' },
                            { name: '🟢 Baja', value: 'baja' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto')
                .setDescription('Configura prioridad automática por tipo de ticket')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'establecer') {
            await handleSetPriority(interaction);
        } else if (subcommand === 'ver') {
            await handleViewPriority(interaction);
        } else if (subcommand === 'auto') {
            await handleAutoConfig(interaction);
        }
    }
};

/**
 * Establece la prioridad de un ticket
 */
async function handleSetPriority(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const priority = interaction.options.getString('nivel');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket) {
        return interaction.editReply({
            content: '❌ Este comando solo puede usarse en canales de tickets.'
        });
    }

    const oldPriority = ticket.priority;
    ticket.priority = priority;
    await ticket.save();

    // Actualizar nombre del canal con emoji de prioridad
    await updateChannelPriority(interaction.channel, priority);

    // Mensaje en el ticket
    const embed = new EmbedBuilder()
        .setColor(getPriorityColor(priority))
        .setTitle('🎯 Prioridad Actualizada')
        .setDescription(`La prioridad de este ticket ha sido cambiada.`)
        .addFields(
            { name: 'Anterior', value: getPriorityEmoji(oldPriority) + ' ' + capitalizeFirst(oldPriority), inline: true },
            { name: 'Nueva', value: getPriorityEmoji(priority) + ' ' + capitalizeFirst(priority), inline: true },
            { name: 'Cambiado por', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    await interaction.editReply({
        content: `✅ Prioridad establecida a **${getPriorityEmoji(priority)} ${capitalizeFirst(priority)}**`
    });

    // Si es urgente, notificar a admins
    if (priority === 'urgente') {
        await notifyUrgentTicket(interaction.client, ticket);
    }
}

/**
 * Muestra tickets filtrados por prioridad
 */
async function handleViewPriority(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const priority = interaction.options.getString('nivel');
    
    let tickets;
    if (priority) {
        tickets = await Ticket.find({
            status: { $in: ['open', 'claimed'] },
            priority: priority
        }).sort({ createdAt: 1 });
    } else {
        tickets = await Ticket.find({
            status: { $in: ['open', 'claimed'] }
        }).sort({ priority: 1, createdAt: 1 });
    }

    if (tickets.length === 0) {
        return interaction.editReply({
            content: priority 
                ? `No hay tickets con prioridad **${capitalizeFirst(priority)}**` 
                : 'No hay tickets abiertos actualmente.'
        });
    }

    // Agrupar por prioridad
    const byPriority = {
        urgente: [],
        alta: [],
        normal: [],
        baja: []
    };

    tickets.forEach(ticket => {
        byPriority[ticket.priority].push(ticket);
    });

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.primary)
        .setTitle('🎯 Tickets por Prioridad')
        .setDescription(priority ? `Filtrando: **${getPriorityEmoji(priority)} ${capitalizeFirst(priority)}**` : 'Todos los tickets abiertos')
        .setFooter({ text: `Total: ${tickets.length} ticket(s)` })
        .setTimestamp();

    // Añadir campos por prioridad
    for (const [level, levelTickets] of Object.entries(byPriority)) {
        if (levelTickets.length === 0 && !priority) continue;
        if (priority && level !== priority) continue;

        const ticketList = levelTickets
            .slice(0, 10) // Máximo 10 por prioridad
            .map(t => {
                const status = t.status === 'claimed' ? '🔵' : '🟢';
                return `${status} <#${t.channelId}> - ${t.ticketId}`;
            })
            .join('\n');

        if (ticketList) {
            embed.addFields({
                name: `${getPriorityEmoji(level)} ${capitalizeFirst(level)} (${levelTickets.length})`,
                value: ticketList || 'Ninguno',
                inline: false
            });
        }
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Configura prioridades automáticas
 */
async function handleAutoConfig(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent)
        .setTitle('⚙️ Configuración Automática de Prioridades')
        .setDescription(
            'Configura qué prioridad se asigna automáticamente según el tipo de ticket.\n\n' +
            '**Configuración actual:**'
        )
        .addFields(
            { name: '🔴 Urgente', value: 'Reportar Staff', inline: true },
            { name: '🟠 Alta', value: 'Apelaciones', inline: true },
            { name: '🟡 Normal', value: 'Soporte General, Otros', inline: true },
            { name: '🟢 Baja', value: 'Donaciones', inline: true }
        )
        .setFooter({ text: 'Esta configuración se puede personalizar en config.js' });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Actualiza el nombre del canal con emoji de prioridad
 */
async function updateChannelPriority(channel, priority) {
    try {
        const emoji = getPriorityEmoji(priority);
        let name = channel.name;
        
        // Remover emojis de prioridad anteriores
        name = name.replace(/^[🔴🟠🟡🟢]\s*/, '');
        
        // Añadir nuevo emoji
        await channel.setName(`${emoji} ${name}`);
    } catch (error) {
        console.error('Error actualizando nombre del canal:', error);
    }
}

/**
 * Notifica a admins cuando hay ticket urgente
 */
async function notifyUrgentTicket(client, ticket) {
    if (!config.channels.staffChat) return;

    const staffChannel = await client.channels.fetch(config.channels.staffChat).catch(() => null);
    if (!staffChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🚨 TICKET URGENTE')
        .setDescription(`Se ha marcado un ticket como urgente y requiere atención inmediata.`)
        .addFields(
            { name: 'Canal', value: `<#${ticket.channelId}>`, inline: true },
            { name: 'ID', value: ticket.ticketId, inline: true },
            { name: 'Tipo', value: ticket.type, inline: true },
            { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true }
        )
        .setTimestamp();

    const adminRole = config.roles.admin;
    await staffChannel.send({
        content: adminRole ? `<@&${adminRole}>` : '@here',
        embeds: [embed]
    });
}

/**
 * Utilidades
 */
function getPriorityEmoji(priority) {
    const emojis = {
        urgente: '🔴',
        alta: '🟠',
        normal: '🟡',
        baja: '🟢'
    };
    return emojis[priority] || '⚪';
}

function getPriorityColor(priority) {
    const colors = {
        urgente: '#e74c3c',
        alta: '#f39c12',
        normal: '#3498db',
        baja: '#27ae60'
    };
    return colors[priority] || '#95a5a6';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Asigna prioridad automática según tipo de ticket
 */
function getAutoPriority(ticketType) {
    const autoPriority = {
        'reportar-staff': 'urgente',
        'apelaciones': 'alta',
        'soporte-general': 'normal',
        'otros': 'normal',
        'donaciones': 'baja'
    };
    return autoPriority[ticketType] || 'normal';
}

module.exports.getAutoPriority = getAutoPriority;
module.exports.getPriorityEmoji = getPriorityEmoji;
