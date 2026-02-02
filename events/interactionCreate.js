async function handleCloseWithReason(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason');
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    
    if (!ticket) {
        return interaction.editReply({ content: '❌ No se encontró el ticket.' });
    }

    await ticket.close(interaction.user.id, interaction.user.tag, reason);

    if (interaction.channel.isThread()) {
        // Bloquea y archiva el hilo original en tickets abiertos
        await interaction.channel.setLocked(true).catch(console.error);
        await interaction.channel.setArchived(true).catch(console.error);

        // Obtén el canal de tickets cerrados
        const closedChannel = await interaction.guild.channels.fetch(config.channels.ticketsClosed);
        if (!closedChannel) {
            return interaction.editReply({
                content: '❌ No se encontró el canal de tickets cerrados. Contacta a un administrador.'
            });
        }

        // Crea un nuevo hilo en tickets cerrados
        const closedThread = await closedChannel.threads.create({
            name: `🔒 ${ticket.ticketId} - ${interaction.user.username}`,
            autoArchiveDuration: 10080,
            type: ChannelType.PrivateThread,
            reason: `Ticket #${ticket.ticketId} cerrado por ${interaction.user.tag}`
        });

        // Agrega al usuario y al staff original al nuevo hilo
        await closedThread.members.add(ticket.userId);

        const typeInfo = config.ticketTypes[ticket.type];
        const staffRoles = typeInfo.roles;
        for (const roleKey of staffRoles) {
            const roleId = config.roles[roleKey];
            if (roleId) {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) {
                    const members = role.members;
                    for (const [memberId, member] of members) {
                        try {
                            await closedThread.members.add(memberId);
                        } catch (err) {
                            console.error(`Error agregando ${member.user.tag} al hilo cerrado:`, err);
                        }
                    }
                }
            }
        }

        // Copiar los últimos 100 mensajes del hilo original al hilo cerrado
        const messages = await interaction.channel.messages.fetch({ limit: 100, oldestFirst: true });
        for (const msg of messages.values()) {
            if (msg.content || msg.embeds.length > 0 || msg.attachments.size > 0) {
                try {
                    await closedThread.send({
                        content: msg.content || undefined,
                        embeds: msg.embeds.length > 0 ? msg.embeds : undefined,
                        files: msg.attachments.size > 0 ? Array.from(msg.attachments.values()).map(a => a.url) : undefined,
                        allowedMentions: { parse: [] }
                    });
                } catch (err) {
                    console.error('Error copiando mensaje al hilo cerrado:', err);
                }
            }
        }

        // Envía mensaje final de cierre
        await closedThread.send({
            embeds: [{
                color: parseInt(config.branding.colors.error.replace('#', ''), 16),
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
                    {
                        type: 2,
                        label: '🔓 Reabrir',
                        style: 3,
                        custom_id: 'reopen_ticket'
                    },
                    {
                        type: 2,
                        label: '🗑️ Eliminar',
                        style: 4,
                        custom_id: 'delete_ticket'
                    }
                ]
            }]
        });
    }

    // Log del cierre
    await logger.sendTicketLog(client, {
        action: 'closed',
        ticketId: ticket.ticketId,
        userId: ticket.userId,
        closedBy: interaction.user.id,
        reason,
        channelId: ticket.channelId
    });

    await interaction.editReply({ content: '✅ Ticket cerrado y movido a tickets cerrados correctamente.' });
}
