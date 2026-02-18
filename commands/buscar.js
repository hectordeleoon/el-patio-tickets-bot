const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Ticket = require('../models/Ticket');
const config = require('../config/config');

// Helper inline para no depender de ./prioridad (evita crash si no existe)
function getPriorityEmoji(priority) {
    return { urgente: '🔴', alta: '🟠', normal: '🟢' }[priority] || '⚪';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Busca tickets en el sistema')
        .addSubcommand(subcommand =>
            subcommand
                .setName('id')
                .setDescription('Busca un ticket por su ID')
                .addStringOption(option =>
                    option.setName('ticket_id').setDescription('ID del ticket a buscar').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('usuario')
                .setDescription('Busca tickets de un usuario')
                .addUserOption(option =>
                    option.setName('usuario').setDescription('Usuario a buscar').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('estado').setDescription('Filtrar por estado').setRequired(false)
                        .addChoices(
                            { name: 'Abierto',     value: 'open'    },
                            { name: 'En atención', value: 'claimed' },
                            { name: 'Cerrado',     value: 'closed'  },
                            { name: 'Todos',       value: 'all'     }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tipo')
                .setDescription('Busca tickets por tipo')
                .addStringOption(option =>
                    option.setName('tipo').setDescription('Tipo de ticket').setRequired(true)
                        .addChoices(
                            { name: '🟢 Soporte General', value: 'soporte-general' },
                            { name: '🔵 Donaciones',      value: 'donaciones'      },
                            { name: '⚫ Apelaciones',     value: 'apelaciones'     },
                            { name: '🔴 Reportar Staff',  value: 'reportar-staff'  },
                            { name: '🟠 Otros',           value: 'otros'           }
                        )
                )
                .addStringOption(option =>
                    option.setName('estado').setDescription('Filtrar por estado').setRequired(false)
                        .addChoices(
                            { name: 'Abierto',     value: 'open'    },
                            { name: 'En atención', value: 'claimed' },
                            { name: 'Cerrado',     value: 'closed'  },
                            { name: 'Todos',       value: 'all'     }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('Busca tickets atendidos por un staff')
                .addUserOption(option =>
                    option.setName('staff').setDescription('Staff a buscar').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('fecha')
                .setDescription('Busca tickets por fecha')
                .addStringOption(option =>
                    option.setName('desde').setDescription('Fecha desde (DD/MM/YYYY)').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('hasta').setDescription('Fecha hasta (DD/MM/YYYY)').setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('contenido')
                .setDescription('Busca tickets por contenido de mensajes')
                .addStringOption(option =>
                    option.setName('texto').setDescription('Texto a buscar en los mensajes').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sin_calificar')
                .setDescription('Busca tickets cerrados sin calificación')
                .addIntegerOption(option =>
                    option.setName('dias').setDescription('Días atrás (por defecto: 7)')
                        .setRequired(false).setMinValue(1).setMaxValue(90)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'id':            return searchById(interaction);
            case 'usuario':       return searchByUser(interaction);
            case 'tipo':          return searchByType(interaction);
            case 'staff':         return searchByStaff(interaction);
            case 'fecha':         return searchByDate(interaction);
            case 'contenido':     return searchByContent(interaction);
            case 'sin_calificar': return searchUnrated(interaction);
        }
    }
};

/* ─────────────────────────────────────────────
   BUSCAR POR ID
───────────────────────────────────────────── */
async function searchById(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ticketId = interaction.options.getString('ticket_id').padStart(4, '0');
    const ticket   = await Ticket.findOne({ ticketId });

    if (!ticket) {
        return interaction.editReply({ content: `❌ No se encontró ningún ticket con ID: **${ticketId}**` });
    }

    const embed = await createTicketEmbed(ticket, interaction.client);
    const row   = createTicketButtons(ticket, interaction.guildId);

    await interaction.editReply({
        embeds: [embed],
        components: row.components.length ? [row] : []
    });
}

/* ─────────────────────────────────────────────
   BUSCAR POR USUARIO
───────────────────────────────────────────── */
async function searchByUser(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user   = interaction.options.getUser('usuario');
    const status = interaction.options.getString('estado') || 'all';
    const query  = { userId: user.id };
    if (status !== 'all') query.status = status;

    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `🔍 No se encontraron tickets de **${user.tag}**${status !== 'all' ? ` con estado **${status}**` : ''}.`
        });
    }

    await sendTicketList(interaction, tickets, `Tickets de ${user.tag}`, user.displayAvatarURL());
}

/* ─────────────────────────────────────────────
   BUSCAR POR TIPO
───────────────────────────────────────────── */
async function searchByType(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const type     = interaction.options.getString('tipo');
    const status   = interaction.options.getString('estado') || 'all';
    const query    = { type };
    if (status !== 'all') query.status = status;

    const tickets  = await Ticket.find(query).sort({ createdAt: -1 }).limit(20);
    const typeInfo = config.ticketTypes[type];

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `🔍 No se encontraron tickets de tipo **${typeInfo?.label || type}**.`
        });
    }

    await sendTicketList(interaction, tickets, `${typeInfo?.emoji || '🎫'} ${typeInfo?.label || type}`);
}

/* ─────────────────────────────────────────────
   BUSCAR POR STAFF
───────────────────────────────────────────── */
async function searchByStaff(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staff   = interaction.options.getUser('staff');
    const tickets = await Ticket.find({ 'claimedBy.userId': staff.id }).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({ content: `🔍 No se encontraron tickets atendidos por **${staff.tag}**.` });
    }

    const closed    = tickets.filter(t => t.status === 'closed').length;
    const rated     = tickets.filter(t => t.rating?.stars);
    const avgRating = rated.length
        ? (rated.reduce((a, t) => a + t.rating.stars, 0) / rated.length).toFixed(1)
        : null;

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent || '#f39c12')
        .setTitle(`📊 Tickets de ${staff.tag}`)
        .setThumbnail(staff.displayAvatarURL())
        .setDescription(
            `**Total:** ${tickets.length}  ·  **Cerrados:** ${closed}  ·  ` +
            `**Rating:** ${avgRating ? `${'⭐'.repeat(Math.round(avgRating))} (${avgRating})` : 'N/A'}`
        )
        .setFooter({ text: `Mostrando últimos ${tickets.length} tickets` })
        .setTimestamp();

    const ticketList = tickets.slice(0, 15).map(t => {
        const s      = getStatusEmoji(t.status);
        const rating = t.rating?.stars ? ` — ${'⭐'.repeat(t.rating.stars)}` : '';
        return `${s} \`${t.ticketId}\` — ${t.type}${rating}`;
    }).join('\n');

    embed.addFields({ name: 'Últimos Tickets', value: ticketList, inline: false });
    await interaction.editReply({ embeds: [embed] });
}

/* ─────────────────────────────────────────────
   BUSCAR POR FECHA
───────────────────────────────────────────── */
async function searchByDate(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const fromStr = interaction.options.getString('desde');
    const toStr   = interaction.options.getString('hasta');

    const fromDate = parseDate(fromStr);
    if (!fromDate) return interaction.editReply({ content: '❌ Formato de fecha inválido. Usa: DD/MM/YYYY' });

    let toDate = toStr ? parseDate(toStr) : new Date(fromDate);
    if (!toDate) return interaction.editReply({ content: '❌ Fecha "hasta" inválida. Usa: DD/MM/YYYY' });
    toDate.setHours(23, 59, 59, 999);

    const tickets = await Ticket.find({
        createdAt: { $gte: fromDate, $lte: toDate }
    }).sort({ createdAt: -1 }).limit(50);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `🔍 No se encontraron tickets entre **${fromStr}** y **${toStr || fromStr}**.`
        });
    }

    await sendTicketList(interaction, tickets, `📅 Tickets del ${fromStr}${toStr ? ` al ${toStr}` : ''}`);
}

/* ─────────────────────────────────────────────
   BUSCAR POR CONTENIDO
───────────────────────────────────────────── */
async function searchByContent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const searchText = interaction.options.getString('texto');
    const tickets    = await Ticket.find({
        $or: [
            { detail:             { $regex: searchText, $options: 'i' } },
            { 'messages.content': { $regex: searchText, $options: 'i' } }
        ]
    }).sort({ createdAt: -1 }).limit(20);

    if (tickets.length === 0) {
        return interaction.editReply({ content: `🔍 No se encontraron tickets con el texto: **${searchText}**` });
    }

    await sendTicketList(interaction, tickets, `🔍 Búsqueda: "${searchText}"`);
}

/* ─────────────────────────────────────────────
   SIN CALIFICAR
───────────────────────────────────────────── */
async function searchUnrated(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const days   = interaction.options.getInteger('dias') || 7;
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const tickets = await Ticket.find({
        status:             'closed',
        closedAt:           { $gte: cutoff },
        'claimedBy.userId': { $exists: true },
        'rating.stars':     { $exists: false }
    }).sort({ closedAt: -1 }).limit(30);

    if (tickets.length === 0) {
        return interaction.editReply({
            content: `✅ No hay tickets sin calificar en los últimos **${days}** días.`
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('⭐ Tickets Sin Calificar')
        .setDescription(`**${tickets.length}** ticket(s) cerrado(s) sin calificación en los últimos **${days}** días.`)
        .setFooter({ text: `Total: ${tickets.length}` })
        .setTimestamp();

    const list = tickets.slice(0, 20).map(t => {
        const staff = t.claimedBy?.userId ? `<@${t.claimedBy.userId}>` : 'Sin asignar';
        return `\`${t.ticketId}\` — <@${t.userId}> — Staff: ${staff}`;
    }).join('\n');

    embed.addFields({ name: 'Tickets', value: list, inline: false });
    await interaction.editReply({ embeds: [embed] });
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

async function createTicketEmbed(ticket, client) {
    const embed = new EmbedBuilder()
        .setColor(getStatusColor(ticket.status))
        .setTitle(`🎫 Ticket #${ticket.ticketId}`)
        .addFields(
            { name: '📋 ID',      value: ticket.ticketId,                                inline: true },
            { name: '📊 Estado',  value: getStatusName(ticket.status),                  inline: true },
            { name: '📁 Tipo',    value: ticket.type,                                   inline: true },
            { name: '👤 Usuario', value: `<@${ticket.userId}>`,                          inline: true },
            { name: '📅 Creado',  value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

    if (ticket.claimedBy?.userId) {
        embed.addFields({ name: '👨‍💼 Atendido por', value: `<@${ticket.claimedBy.userId}>`, inline: true });
    }
    if (ticket.priority) {
        embed.addFields({ name: '⚡ Prioridad', value: `${getPriorityEmoji(ticket.priority)} ${ticket.priority}`, inline: true });
    }
    if (ticket.rating?.stars) {
        embed.addFields({ name: '⭐ Calificación', value: `${'⭐'.repeat(ticket.rating.stars)} (${ticket.rating.stars}/5)`, inline: true });
    }
    if (ticket.channelId) {
        try {
            await client.channels.fetch(ticket.channelId);
            embed.addFields({ name: '📂 Canal', value: `<#${ticket.channelId}>`, inline: true });
        } catch (_) {
            embed.addFields({ name: '📂 Canal', value: '*(eliminado)*', inline: true });
        }
    }
    if (ticket.closedAt) {
        embed.addFields({ name: '🔒 Cerrado', value: `<t:${Math.floor(ticket.closedAt / 1000)}:R>`, inline: true });
        if (ticket.closedBy?.reason) {
            embed.addFields({ name: '📝 Razón', value: ticket.closedBy.reason, inline: false });
        }
    }
    if (ticket.detail) {
        embed.addFields({ name: '📋 Descripción', value: ticket.detail.slice(0, 300), inline: false });
    }

    return embed;
}

function createTicketButtons(ticket, guildId) {
    const row = new ActionRowBuilder();
    if (ticket.channelId) {
        row.addComponents(
            new ButtonBuilder()
                .setLabel('Ir al Canal')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guildId || '@me'}/${ticket.channelId}`)
                .setEmoji('🔗')
        );
    }
    return row;
}

async function sendTicketList(interaction, tickets, title, iconUrl = null) {
    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent || '#f39c12')
        .setTitle(title)
        .setDescription(`Se encontraron **${tickets.length}** ticket(s)`)
        .setFooter({ text: `Mostrando ${Math.min(tickets.length, 15)} resultados` })
        .setTimestamp();

    if (iconUrl) embed.setThumbnail(iconUrl);

    const list = tickets.slice(0, 15).map(t => {
        const s = getStatusEmoji(t.status);
        const p = t.priority ? getPriorityEmoji(t.priority) : '';
        return `${s}${p} \`${t.ticketId}\` — <@${t.userId}> — ${t.type}`;
    }).join('\n');

    embed.addFields({ name: 'Resultados', value: list || 'Ninguno', inline: false });
    await interaction.editReply({ embeds: [embed] });
}

function parseDate(str) {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
}

function getStatusColor(status) {
    return { open: '#27ae60', claimed: '#3498db', closed: '#e74c3c' }[status] || '#95a5a6';
}
function getStatusName(status) {
    return { open: '🟢 Abierto', claimed: '🔵 En Atención', closed: '🔒 Cerrado' }[status] || status;
}
function getStatusEmoji(status) {
    return { open: '🟢', claimed: '🔵', closed: '🔒' }[status] || '⚪';
}
