const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const i18n = require('../utils/i18n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('idioma')
        .setDescription('Cambia el idioma del bot / Change bot language')
        .addSubcommand(subcommand =>
            subcommand
                .setName('establecer')
                .setDescription('Establece tu idioma preferido / Set your preferred language')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('servidor')
                .setDescription('Establece el idioma del servidor / Set server language')
                .addStringOption(option =>
                    option
                        .setName('idioma')
                        .setDescription('Idioma / Language')
                        .setRequired(true)
                        .addChoices(
                            { name: '🇪🇸 Español', value: 'es' },
                            { name: '🇺🇸 English', value: 'en' },
                            { name: '🇧🇷 Português', value: 'pt' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Ver información sobre idiomas / View language information')
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'establecer') {
            await handleSetUserLanguage(interaction);
        } else if (subcommand === 'servidor') {
            await handleSetServerLanguage(interaction);
        } else if (subcommand === 'info') {
            await handleLanguageInfo(interaction);
        }
    }
};

/**
 * Establece el idioma del usuario
 */
async function handleSetUserLanguage(interaction) {
    const currentLang = i18n.getUserLanguage(interaction.user.id);

    // Crear select menu con idiomas
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('language_select_user')
        .setPlaceholder(i18n.get('commands.idioma.select', currentLang));

    const languages = i18n.getSupportedLanguages();
    languages.forEach(lang => {
        selectMenu.addOptions({
            label: lang.nativeName,
            description: lang.name,
            value: lang.code,
            emoji: lang.flag,
            default: lang.code === currentLang
        });
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🌍 ' + i18n.get('commands.idioma.select', currentLang))
        .setDescription(
            i18n.get('commands.idioma.current', currentLang, {
                language: i18n.get('language.nativeName', currentLang)
            })
        )
        .setFooter({ text: i18n.get('misc.loading', currentLang) });

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

/**
 * Establece el idioma del servidor
 */
async function handleSetServerLanguage(interaction) {
    // Verificar permisos
    if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({
            content: i18n.get('errors.noPermission', i18n.getUserLanguage(interaction.user.id)),
            ephemeral: true
        });
    }

    const langCode = interaction.options.getString('idioma');
    i18n.setGuildLanguage(interaction.guild.id, langCode);

    const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ ' + i18n.get('success.settingSaved', langCode))
        .setDescription(
            i18n.get('commands.idioma.changed', langCode, {
                language: i18n.get('language.nativeName', langCode)
            })
        )
        .setFooter({ text: i18n.get('language.nativeName', langCode) });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Muestra información sobre idiomas
 */
async function handleLanguageInfo(interaction) {
    const currentLang = i18n.detectUserLanguage(interaction);
    const languages = i18n.getSupportedLanguages();

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🌍 ' + i18n.get('commands.idioma.available', currentLang))
        .setDescription(
            i18n.get('commands.idioma.current', currentLang, {
                language: i18n.get('language.nativeName', currentLang)
            })
        )
        .setTimestamp();

    // Añadir lista de idiomas
    const langList = languages.map(lang => 
        `${lang.flag} **${lang.nativeName}** (${lang.name})`
    ).join('\n');

    embed.addFields({
        name: i18n.get('commands.idioma.available', currentLang),
        value: langList,
        inline: false
    });

    // Información adicional
    embed.addFields(
        {
            name: '👤 ' + i18n.get('misc.user', currentLang),
            value: i18n.get('language.nativeName', i18n.getUserLanguage(interaction.user.id)),
            inline: true
        },
        {
            name: '🏠 ' + i18n.get('misc.server', currentLang),
            value: i18n.get('language.nativeName', i18n.getGuildLanguage(interaction.guild?.id)),
            inline: true
        }
    );

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Maneja la selección de idioma del usuario
 */
async function handleUserLanguageSelect(interaction) {
    const langCode = interaction.values[0];
    i18n.setUserLanguage(interaction.user.id, langCode);

    const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ ' + i18n.get('success.settingSaved', langCode))
        .setDescription(
            i18n.get('commands.idioma.changed', langCode, {
                language: i18n.get('language.nativeName', langCode)
            })
        )
        .setFooter({ text: i18n.get('language.nativeName', langCode) });

    await interaction.update({
        embeds: [embed],
        components: []
    });
}

// Exportar handler para usar en interactionCreate.js
module.exports.handleUserLanguageSelect = handleUserLanguageSelect;
