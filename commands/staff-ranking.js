const { SlashCommandBuilder } = require('discord.js');
const StaffStats = require('../models/StaffStats');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-ranking')
        .setDescription('📉 Ranking negativo de staff'),

    async execute(interaction) {
        const stats = await StaffStats.find()
            .sort({ abandonedTickets: -1 })
            .limit(10);

        if (!stats.length) {
            return interaction.reply({
                content: 'No hay datos de staff aún.',
                ephemeral: true
            });
        }

        const ranking = stats.map((s, i) =>
            `**${i + 1}.** <@${s.userId}> — ❌ ${s.abandonedTickets} abandonos`
        ).join('\n');

        await interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: '📉 Ranking Negativo de Staff',
                description: ranking,
                footer: { text: 'Sistema automático de control de staff' }
            }]
        });
    }
};
