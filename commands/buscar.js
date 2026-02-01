const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Ticket = require('../models/Ticket');
const config = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Busca tickets en el sistema')
        .addSubcommand(subcommand =>
            subcommand
                .setName('id')
                .setDescription('Busca un ticket por su ID')
                .addStringOption(option =>
                    option
                        .setName('ticket_id')
                        .setDescription('ID del ticket a buscar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('usuario')
                .setDescription('Busca tickets de un usuario')
                .addUserOption(option =>
                    option
                        .setName('usuario')
                        .setDescription('Usuario a buscar')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('estado')
                        .setDescription('Filtrar por estado')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Abierto', value: 'open' },
                            { name: 'En atención', value: 'claimed' },
                            { name: 'Cerrado', value: 'closed' },
                            { name: 'Todos', value: 'all' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tipo')
                .setDescription('Busca tickets por tipo')
                .addStringOption(option =>
                    option
                        .setName('tipo')
                        .setDescription('Tipo de ticket')
                        .setRequired(true)
                        .addChoices(
                            { name: '🟢 Soporte General', value: 'soporte-general' },
                            { name: '🔵 Donaciones', value: 'donaciones' },
                            { name: '⚫ Apelaciones', value: 'apelaciones' },
                            { name: '🔴 Reportar Staff', value: 'reportar-staff' },
                            { name: '🟠 Otros', value: 'otros' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('estado')
                        .setDescription('Filtrar por estado')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Abierto', value: 'open' },
                            { name: 'En atención', value: 'claimed' },
                            { name: 'Cerrado', value: 'closed' },
                            { name: 'Todos', value: 'all' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('Busca tickets atendidos por un staff')
                .addUserOption(option =>
                    option
                        .setName('staff')
                        .setDescription('Staff a buscar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('fecha')
                .setDescription('Busca tickets por fecha')
                .addStringOption(option =>
                    option
                        .setName('desde')
                        .setDescription('Fecha desde (DD/MM/YYYY)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('hasta')
                        .setDescription('Fecha hasta (DD/MM/YYYY)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('contenido')
                .setDescription('Busca tickets por contenido de mensajes')
                .addStringOption(option =>
                    option
                        .setName('texto')
                        .setDescription('Texto a buscar en los mensajes')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sin_calificar')
                .setDescription('Busca tickets cerrados sin calificación')
                .addIntegerOption(option =>
                    option
                        .setName('dias')
                        .setDescription('Días atrás (por defecto: 7)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(90)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'id':
                await searchById(interaction);
                break;
            case 'usuario':
                await searchByUser(interaction);
                break;
            case 'tipo':
                await searchByType(interaction);
                break;
            case 'staff':
                await searchByStaff(interaction);
                break;
            case 'fecha':
                await searchByDate(interaction);
                break;
            case 'contenido':
                await searchByContent(interaction);
                break;
            case 'sin_calificar':
                await searchUnrated(interaction);
                break;
        }
    }
};

/**
 * Busca un ticket por ID
 */
async function searchById(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ticketId = interaction.options.getString('ticket_id');
    const ticket = await Ticket.findOne({ ticketId: ticketId });

    if (!ticket) {
        return interaction.editReply({
            content: `❌ No se encontró ningún ticket con ID: **${ticketId}**`
        });
    }

    const embed = await createTicketEmbed(ticket, interaction.client);
    const row = createTicketButtons(ticket);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

/**
 * Busca tickets de un usuario
 */
async function searchByUser(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const user = interaction.options.getUser('usuario');
    const status = interaction.options.getString('estado') || 'all';

    const query = { userId: user.id };
    if (status !== 'all') {
        query.status = status;
    }

    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `No se encontraron tickets de ${user} ${status !== 'all' ? `con estado **${status}**` : ''}`
        });
    }

    await sendTicketList(interaction, tickets, `Tickets de ${user.tag}`, user.displayAvatarURL());
}

/**
 * Busca tickets por tipo
 */
async function searchByType(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const type = interaction.options.getString('tipo');
    const status = interaction.options.getString('estado') || 'all';

    const query = { type };
    if (status !== 'all') {
        query.status = status;
    }

    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `No se encontraron tickets de tipo **${type}** ${status !== 'all' ? `con estado **${status}**` : ''}`
        });
    }

    const typeInfo = config.ticketTypes[type];
    await sendTicketList(interaction, tickets, `${typeInfo.emoji} ${typeInfo.label}`);
}

/**
 * Busca tickets atendidos por un staff
 */
async function searchByStaff(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const staff = interaction.options.getUser('staff');
    const tickets = await Ticket.find({ 'claimedBy.userId': staff.id }).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `No se encontraron tickets atendidos por ${staff}`
        });
    }

    // Calcular estadísticas
    const closed = tickets.filter(t => t.status === 'closed').length;
    const avgRating = tickets
        .filter(t => t.rating && t.rating.stars)
        .reduce((acc, t) => acc + t.rating.stars, 0) / tickets.filter(t => t.rating).length || 0;

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent)
        .setTitle(`📊 Tickets de ${staff.tag}`)
        .setDescription(
            `**Total encontrado:** ${tickets.length}\n` +
            `**Cerrados:** ${closed}\n` +
            `**Calificación promedio:** ${avgRating > 0 ? `${'⭐'.repeat(Math.round(avgRating))} (${avgRating.toFixed(1)})` : 'N/A'}`
        )
        .setThumbnail(staff.displayAvatarURL())
        .setFooter({ text: `Mostrando últimos ${tickets.length} tickets` })
        .setTimestamp();

    // Añadir lista de tickets
    const ticketList = tickets.slice(0, 15).map(t => {
        const statusEmoji = t.status === 'closed' ? '🔒' : t.status === 'claimed' ? '🔵' : '🟢';
        const rating = t.rating && t.rating.stars ? ` - ${'⭐'.repeat(t.rating.stars)}` : '';
        return `${statusEmoji} \`${t.ticketId}\` - ${t.type}${rating}`;
    }).join('\n');

    embed.addFields({
        name: 'Últimos Tickets',
        value: ticketList,
        inline: false
    });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Busca tickets por fecha
 */
async function searchByDate(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const fromStr = interaction.options.getString('desde');
    const toStr = interaction.options.getString('hasta');

    // Parsear fechas (DD/MM/YYYY)
    const fromParts = fromStr.split('/');
    if (fromParts.length !== 3) {
        return interaction.editReply({
            content: '❌ Formato de fecha inválido. Usa: DD/MM/YYYY'
        });
    }

    const fromDate = new Date(fromParts[2], fromParts[1] - 1, fromParts[0]);
    fromDate.setHours(0, 0, 0, 0);

    let toDate;
    if (toStr) {
        const toParts = toStr.split('/');
        if (toParts.length !== 3) {
            return interaction.editReply({
                content: '❌ Formato de fecha inválido. Usa: DD/MM/YYYY'
            });
        }
        toDate = new Date(toParts[2], toParts[1] - 1, toParts[0]);
        toDate.setHours(23, 59, 59, 999);
    } else {
        toDate = new Date(fromDate);
        toDate.setHours(23, 59, 59, 999);
    }

    const tickets = await Ticket.find({
        createdAt: {
            $gte: fromDate,
            $lte: toDate
        }
    }).sort({ createdAt: -1 }).limit(50);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `No se encontraron tickets entre ${fromStr}${toStr ? ` y ${toStr}` : ''}`
        });
    }

    await sendTicketList(
        interaction, 
        tickets, 
        `Tickets del ${fromStr}${toStr ? ` al ${toStr}` : ''}`
    );
}

/**
 * Busca tickets por contenido
 */
async function searchByContent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const searchText = interaction.options.getString('texto').toLowerCase();
    
    // Buscar en mensajes
    const tickets = await Ticket.find({
        'messages.content': { $regex: searchText, $options: 'i' }
    }).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `❌ No se encontraron tickets con el texto: **${searchText}**`
        });
    }

    await sendTicketList(interaction, tickets, `Búsqueda: "${searchText}"`);
}

/**
 * Busca tickets sin calificar
 */
async function searchUnrated(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const days = interaction.options.getInteger('dias') || 7;
    const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const tickets = await Ticket.find({
        status: 'closed',
        closedAt: { $gte: cutoff },
        'claimedBy.userId': { $exists: true },
        'rating.stars': { $exists: false }
    }).sort({ closedAt: -1 }).limit(30);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `✅ No hay tickets sin calificar en los últimos ${days} días.`
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('⭐ Tickets Sin Calificar')
        .setDescription(
            `Se encontraron **${tickets.length}** tickets cerrados sin calificación en los últimos **${days}** días.\n\n` +
            'Considera enviar recordatorios a estos usuarios.'
        )
        .setFooter({ text: `Total: ${tickets.length} ticket(s)` })
        .setTimestamp();

    const ticketList = tickets.slice(0, 20).map(t => {
        const staff = t.claimedBy ? `<@${t.claimedBy.userId}>` : 'Sin asignar';
        return `\`${t.ticketId}\` - Usuario: <@${t.userId}> - Staff: ${staff}`;
    }).join('\n');

    embed.addFields({
        name: 'Tickets',
        value: ticketList,
        inline: false
    });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Crea un embed detallado de un ticket
 */
async function createTicketEmbed(ticket, client) {
    const embed = new EmbedBuilder()
        .setColor(getStatusColor(ticket.status))
        .setTitle(`🎫 Ticket: ${ticket.ticketId}`)
        .addFields(
            { name: 'ID', value: ticket.ticketId, inline: true },
            { name: 'Estado', value: getStatusName(ticket.status), inline: true },
            { name: 'Tipo', value: ticket.type, inline: true },
            { name: 'Usuario', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Creado', value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

    if (ticket.claimedBy) {
        embed.addFields({
            name: 'Atendido por',
            value: `<@${ticket.claimedBy.userId}>`,
            inline: true
        });
    }

    if (ticket.rating && ticket.rating.stars) {
        embed.addFields({
            name: 'Calificación',
            value: '⭐'.repeat(ticket.rating.stars) + ` (${ticket.rating.stars}/5)`,
            inline: true
        });
    }

    if (ticket.priority) {
        const { getPriorityEmoji } = require('./prioridad');
        embed.addFields({
            name: 'Prioridad',
            value: `${getPriorityEmoji(ticket.priority)} ${ticket.priority}`,
            inline: true
        });
    }

    if (ticket.channelId) {
        try {
            const channel = await client.channels.fetch(ticket.channelId);
            if (channel) {
                embed.addFields({
                    name: 'Canal',
                    value: `<#${ticket.channelId}>`,
                    inline: true
                });
            }
        } catch (error) {
            // Canal no existe
        }
    }

    if (ticket.closedAt) {
        embed.addFields({
            name: 'Cerrado',
            value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>`,
            inline: true
        });

        if (ticket.closedBy && ticket.closedBy.reason) {
            embed.addFields({
                name: 'Razón de cierre',
                value: ticket.closedBy.reason,
                inline: false
            });
        }
    }

    return embed;
}

/**
 * Crea botones de acción para un ticket
 */
function createTicketButtons(ticket) {
    const row = new ActionRowBuilder();

    if (ticket.channelId) {
        row.addComponents(
            new ButtonBuilder()
                .setLabel('Ir al Canal')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${ticket.guildId || '@me'}/${ticket.channelId}`)
                .setEmoji('🔗')
        );
    }

    return row;
}

/**
 * Envía una lista de tickets
 */
async function sendTicketList(interaction, tickets, title, iconUrl = null) {
    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent)
        .setTitle(title)
        .setDescription(`Se encontraron **${tickets.length}** ticket(s)`)
        .setFooter({ text: `Mostrando ${Math.min(tickets.length, 15)} resultados` })
        .setTimestamp();

    if (iconUrl) {
        embed.setThumbnail(iconUrl);
    }

    const ticketList = tickets.slice(0, 15).map(t => {
        const statusEmoji = getStatusEmoji(t.status);
        const priorityEmoji = t.priority ? require('./prioridad').getPriorityEmoji(t.priority) : '';
        return `${statusEmoji} ${priorityEmoji} \`${t.ticketId}\` - <@${t.userId}> - ${t.type}`;
    }).join('\n');

    embed.addFields({
        name: 'Resultados',
        value: ticketList || 'Ninguno',
        inline: false
    });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Utilidades
 */
function getStatusColor(status) {
    const colors = {
        open: '#27ae60',
        claimed: '#3498db',
        closed: '#e74c3c'
    };
    return colors[status] || '#95a5a6';
}

function getStatusName(status) {
    const names = {
        open: '🟢 Abierto',
        claimed: '🔵 En Atención',
        closed: '🔒 Cerrado'
    };
    return names[status] || status;
}

function getStatusEmoji(status) {
    const emojis = {
        open: '🟢',
        claimed: '🔵',
        closed: '🔒'
    };
    return emojis[status] || '⚪';
}
