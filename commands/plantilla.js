const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Template = require('../models/Template');
const config = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plantilla')
        .setDescription('Gestiona plantillas de respuesta rápida')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crea una nueva plantilla')
                .addStringOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre de la plantilla (sin espacios)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('titulo')
                        .setDescription('Título que aparecerá en el embed')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('contenido')
                        .setDescription('Contenido de la plantilla')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('categoria')
                        .setDescription('Categoría de la plantilla')
                        .setRequired(false)
                        .addChoices(
                            { name: 'General', value: 'general' },
                            { name: 'Donaciones', value: 'donaciones' },
                            { name: 'Soporte Técnico', value: 'tecnico' },
                            { name: 'Apelaciones', value: 'apelaciones' },
                            { name: 'FAQ', value: 'faq' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('usar')
                .setDescription('Usa una plantilla en el ticket actual')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listar')
                .setDescription('Lista todas las plantillas disponibles')
                .addStringOption(option =>
                    option
                        .setName('categoria')
                        .setDescription('Filtrar por categoría')
                        .setRequired(false)
                        .addChoices(
                            { name: 'General', value: 'general' },
                            { name: 'Donaciones', value: 'donaciones' },
                            { name: 'Soporte Técnico', value: 'tecnico' },
                            { name: 'Apelaciones', value: 'apelaciones' },
                            { name: 'FAQ', value: 'faq' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver detalles de una plantilla')
                .addStringOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre de la plantilla')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('editar')
                .setDescription('Edita una plantilla existente')
                .addStringOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre de la plantilla')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('eliminar')
                .setDescription('Elimina una plantilla')
                .addStringOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre de la plantilla')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Ver estadísticas de uso de plantillas')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'crear':
                await createTemplate(interaction);
                break;
            case 'usar':
                await useTemplate(interaction);
                break;
            case 'listar':
                await listTemplates(interaction);
                break;
            case 'ver':
                await viewTemplate(interaction);
                break;
            case 'editar':
                await editTemplate(interaction);
                break;
            case 'eliminar':
                await deleteTemplate(interaction);
                break;
            case 'stats':
                await showStats(interaction);
                break;
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const templates = await Template.find({
            name: { $regex: focusedValue, $options: 'i' }
        }).limit(25);

        await interaction.respond(
            templates.map(t => ({
                name: `${t.name} - ${t.title}`,
                value: t.name
            }))
        );
    }
};

/**
 * Crea una nueva plantilla
 */
async function createTemplate(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('nombre').toLowerCase().replace(/\s+/g, '-');
    const title = interaction.options.getString('titulo');
    const content = interaction.options.getString('contenido');
    const category = interaction.options.getString('categoria') || 'general';

    // Verificar si ya existe
    const existing = await Template.findOne({ name });
    if (existing) {
        return interaction.editReply({
            content: `❌ Ya existe una plantilla con el nombre: **${name}**`
        });
    }

    // Crear plantilla
    const template = await Template.create({
        name,
        title,
        content,
        category,
        createdBy: {
            userId: interaction.user.id,
            username: interaction.user.tag
        }
    });

    const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ Plantilla Creada')
        .setDescription(`La plantilla **${name}** ha sido creada exitosamente.`)
        .addFields(
            { name: 'Nombre', value: name, inline: true },
            { name: 'Categoría', value: category, inline: true },
            { name: 'Título', value: title, inline: false },
            { name: 'Contenido (preview)', value: content.substring(0, 200) + (content.length > 200 ? '...' : ''), inline: false }
        )
        .setFooter({ text: `Usa /plantilla usar para utilizarla` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Usa una plantilla en el ticket actual
 */
async function useTemplate(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Obtener todas las plantillas
    const templates = await Template.find().sort({ category: 1, usageCount: -1 });

    if (templates.length === 0) {
        return interaction.editReply({
            content: '❌ No hay plantillas disponibles. Crea una con `/plantilla crear`'
        });
    }

    // Agrupar por categoría
    const byCategory = {};
    templates.forEach(t => {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t);
    });

    // Crear select menu
    const options = [];
    for (const [category, temps] of Object.entries(byCategory)) {
        temps.slice(0, 25).forEach(t => {
            options.push({
                label: t.title.substring(0, 100),
                description: `${getCategoryEmoji(category)} ${category} - Usado ${t.usageCount} veces`,
                value: t.name
            });
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('template_select')
        .setPlaceholder('Selecciona una plantilla')
        .addOptions(options.slice(0, 25)); // Límite de Discord

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        content: 'Selecciona la plantilla que deseas usar:',
        components: [row]
    });
}

/**
 * Lista todas las plantillas
 */
async function listTemplates(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const category = interaction.options.getString('categoria');
    const query = category ? { category } : {};
    const templates = await Template.find(query).sort({ category: 1, name: 1 });

    if (templates.length === 0) {
        return interaction.editReply({
            content: category 
                ? `No hay plantillas en la categoría **${category}**`
                : 'No hay plantillas disponibles.'
        });
    }

    // Agrupar por categoría
    const byCategory = {};
    templates.forEach(t => {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t);
    });

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent)
        .setTitle('📋 Plantillas Disponibles')
        .setDescription(`Total: **${templates.length}** plantilla(s)`)
        .setFooter({ text: 'Usa /plantilla usar para utilizar una plantilla' })
        .setTimestamp();

    // Añadir campos por categoría
    for (const [cat, temps] of Object.entries(byCategory)) {
        const list = temps.map(t => 
            `• \`${t.name}\` - ${t.title.substring(0, 40)} (usado ${t.usageCount}x)`
        ).join('\n');

        embed.addFields({
            name: `${getCategoryEmoji(cat)} ${capitalizeFirst(cat)} (${temps.length})`,
            value: list.substring(0, 1024), // Límite de Discord
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Ver detalles de una plantilla
 */
async function viewTemplate(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('nombre');
    const template = await Template.findOne({ name });

    if (!template) {
        return interaction.editReply({
            content: `❌ No se encontró la plantilla: **${name}**`
        });
    }

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.primary)
        .setTitle(`📄 Plantilla: ${template.name}`)
        .addFields(
            { name: 'Título', value: template.title, inline: false },
            { name: 'Categoría', value: `${getCategoryEmoji(template.category)} ${template.category}`, inline: true },
            { name: 'Veces usado', value: template.usageCount.toString(), inline: true },
            { name: 'Creado por', value: `<@${template.createdBy.userId}>`, inline: true },
            { name: 'Contenido', value: template.content, inline: false }
        )
        .setFooter({ text: `Creado: ${template.createdAt.toLocaleDateString()}` })
        .setTimestamp();

    if (template.lastUsedAt) {
        embed.addFields({
            name: 'Último uso',
            value: `<t:${Math.floor(template.lastUsedAt.getTime() / 1000)}:R>`,
            inline: true
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Edita una plantilla
 */
async function editTemplate(interaction) {
    const name = interaction.options.getString('nombre');
    const template = await Template.findOne({ name });

    if (!template) {
        return interaction.reply({
            content: `❌ No se encontró la plantilla: **${name}**`,
            ephemeral: true
        });
    }

    // Crear modal para editar
    const modal = new ModalBuilder()
        .setCustomId(`edit_template_${template._id}`)
        .setTitle(`Editar: ${template.name}`);

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Título')
        .setStyle(TextInputStyle.Short)
        .setValue(template.title)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Contenido')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(template.content)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(contentInput)
    );

    await interaction.showModal(modal);
}

/**
 * Elimina una plantilla
 */
async function deleteTemplate(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('nombre');
    const template = await Template.findOne({ name });

    if (!template) {
        return interaction.editReply({
            content: `❌ No se encontró la plantilla: **${name}**`
        });
    }

    await Template.deleteOne({ name });

    await interaction.editReply({
        content: `✅ La plantilla **${name}** ha sido eliminada.`
    });
}

/**
 * Muestra estadísticas de plantillas
 */
async function showStats(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const templates = await Template.find();
    
    if (templates.length === 0) {
        return interaction.editReply({
            content: 'No hay plantillas en el sistema.'
        });
    }

    // Calcular estadísticas
    const totalUsage = templates.reduce((acc, t) => acc + t.usageCount, 0);
    const topUsed = templates.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
    const byCategory = {};
    
    templates.forEach(t => {
        if (!byCategory[t.category]) {
            byCategory[t.category] = { count: 0, usage: 0 };
        }
        byCategory[t.category].count++;
        byCategory[t.category].usage += t.usageCount;
    });

    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.accent)
        .setTitle('📊 Estadísticas de Plantillas')
        .addFields(
            { name: 'Total de Plantillas', value: templates.length.toString(), inline: true },
            { name: 'Usos Totales', value: totalUsage.toString(), inline: true },
            { name: 'Promedio de Uso', value: (totalUsage / templates.length).toFixed(1), inline: true }
        )
        .setTimestamp();

    // Top plantillas más usadas
    if (topUsed.length > 0) {
        const topList = topUsed.map((t, i) => 
            `${i + 1}. **${t.name}** - ${t.usageCount} usos`
        ).join('\n');

        embed.addFields({
            name: '🏆 Top 5 Más Usadas',
            value: topList,
            inline: false
        });
    }

    // Por categoría
    const catList = Object.entries(byCategory).map(([cat, data]) =>
        `${getCategoryEmoji(cat)} **${capitalizeFirst(cat)}**: ${data.count} plantilla(s) - ${data.usage} usos`
    ).join('\n');

    embed.addFields({
        name: '📁 Por Categoría',
        value: catList,
        inline: false
    });

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Maneja la selección de una plantilla
 */
async function handleTemplateSelect(interaction) {
    await interaction.deferReply();

    const templateName = interaction.values[0];
    const template = await Template.findOne({ name: templateName });

    if (!template) {
        return interaction.editReply({
            content: '❌ Plantilla no encontrada.'
        });
    }

    // Incrementar contador
    template.usageCount++;
    template.lastUsedAt = new Date();
    template.lastUsedBy = {
        userId: interaction.user.id,
        username: interaction.user.tag
    };
    await template.save();

    // Enviar plantilla
    const embed = new EmbedBuilder()
        .setColor(config.branding.colors.primary)
        .setTitle(template.title)
        .setDescription(template.content)
        .setFooter({ 
            text: `Plantilla: ${template.name} | Respondido por ${interaction.user.tag}` 
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Maneja la edición de plantilla desde modal
 */
async function handleTemplateEdit(interaction, templateId) {
    const title = interaction.fields.getTextInputValue('title');
    const content = interaction.fields.getTextInputValue('content');

    const template = await Template.findById(templateId);
    if (!template) {
        return interaction.reply({
            content: '❌ Plantilla no encontrada.',
            ephemeral: true
        });
    }

    template.title = title;
    template.content = content;
    template.updatedAt = new Date();
    await template.save();

    await interaction.reply({
        content: `✅ Plantilla **${template.name}** actualizada exitosamente.`,
        ephemeral: true
    });
}

/**
 * Utilidades
 */
function getCategoryEmoji(category) {
    const emojis = {
        general: '📋',
        donaciones: '💎',
        tecnico: '🔧',
        apelaciones: '⚖️',
        faq: '❓'
    };
    return emojis[category] || '📄';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Exportar handlers para usar en interactionCreate.js
module.exports.handleTemplateSelect = handleTemplateSelect;
module.exports.handleTemplateEdit = handleTemplateEdit;
