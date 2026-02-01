const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');
const Stats = require('../models/Stats');
const Ticket = require('../models/Ticket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra estadísticas del sistema de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });
        
        try {
            // Obtener estadísticas de hoy
            const todayStats = await Stats.getTodayStats();
            
            // Obtener tickets activos
            const activeTickets = await Ticket.countDocuments({
                status: { $in: ['open', 'claimed'] }
            });
            
            // Obtener total de tickets
            const totalTickets = await Ticket.countDocuments();
            
            // Calcular tiempo promedio de respuesta (placeholder)
            const avgResponseTime = '15 min'; // Esto se puede calcular con lógica adicional
            
            // Embed de estadísticas
            const embed = {
                color: parseInt(config.branding.colors.accent.replace('#', ''), 16),
                title: '📊 Estadísticas del Sistema de Tickets',
                description: `Sistema de tickets de **${config.branding.serverName}**`,
                fields: [
                    {
                        name: '📈 Hoy',
                        value: `**Creados:** ${todayStats.ticketsCreated}\n**Cerrados:** ${todayStats.ticketsClosed}\n**Activos:** ${activeTickets}`,
                        inline: true
                    },
                    {
                        name: '📊 Totales',
                        value: `**Total histórico:** ${totalTickets}\n**En progreso:** ${activeTickets}`,
                        inline: true
                    },
                    {
                        name: '⏱️ Tiempos',
                        value: `**Respuesta promedio:** ${avgResponseTime}\n**Resolución promedio:** N/A`,
                        inline: true
                    },
                    {
                        name: '📋 Por Tipo (Hoy)',
                        value: Object.entries(todayStats.ticketsByType)
                            .map(([type, count]) => {
                                const emoji = config.ticketTypes[type]?.emoji || '📋';
                                const name = config.ticketTypes[type]?.label || type;
                                return `${emoji} ${name}: **${count}**`;
                            })
                            .join('\n'),
                        inline: false
                    }
                ],
                footer: { 
                    text: `${config.branding.serverName} • Sistema de Tickets`,
                    icon_url: interaction.guild.iconURL()
                },
                timestamp: new Date()
            };
            
            // Agregar actividad de staff si hay datos
            if (todayStats.staffActivity && todayStats.staffActivity.length > 0) {
                const topStaff = todayStats.staffActivity
                    .sort((a, b) => b.ticketsClosed - a.ticketsClosed)
                    .slice(0, 5)
                    .map((staff, index) => {
                        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
                        return `${medal} <@${staff.userId}>: **${staff.ticketsClosed}** cerrados`;
                    })
                    .join('\n');
                
                if (topStaff) {
                    embed.fields.push({
                        name: '🏆 Top Staff (Hoy)',
                        value: topStaff,
                        inline: false
                    });
                }
            }
            
            await interaction.editReply({
                embeds: [embed]
            });
            
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al obtener las estadísticas.'
            });
        }
    }
};
