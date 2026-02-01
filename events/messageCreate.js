const { Events } = require('discord.js');
const Ticket = require('../models/Ticket');
const proofDetector = require('../utils/proofDetector');
const config = require('../config/config');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignorar bots
        if (message.author.bot) return;
        
        // Solo procesar mensajes en canales de tickets
        if (!message.channel.name || !message.channel.name.startsWith('ticket-')) return;
        
        try {
            const ticket = await Ticket.findOne({ channelId: message.channel.id });
            if (!ticket) return;
            
            // Guardar mensaje en BD
            await ticket.addMessage(
                message.author.id,
                message.author.tag,
                message.content,
                message.attachments.map(a => a.url)
            );
            
            // Si el ticket requiere pruebas y aún no se han proporcionado
            if (config.ticketTypes[ticket.type].requiresProof && !ticket.proofsProvided) {
                const proofData = proofDetector.detectProofs(
                    message.content,
                    Array.from(message.attachments.values())
                );
                
                if (proofData.hasProof) {
                    // Marcar pruebas como proporcionadas
                    ticket.proofsProvided = true;
                    ticket.proofsUrls.push(...proofData.proofUrls);
                    await ticket.save();
                    
                    // Notificar que se detectaron pruebas
                    await message.channel.send({
                        embeds: [{
                            color: parseInt(config.branding.colors.success.replace('#', ''), 16),
                            title: '✅ Pruebas Detectadas',
                            description: config.messages.proofsDetected,
                            fields: [{
                                name: 'Resumen de Pruebas',
                                value: proofDetector.getProofSummary(proofData)
                            }],
                            footer: { text: `${config.branding.serverName} • Sistema de Tickets` },
                            timestamp: new Date()
                        }],
                        components: [{
                            type: 1,
                            components: [{
                                type: 2,
                                label: '🛎️ Atender Ticket',
                                style: 3,
                                custom_id: 'claim_ticket'
                            }]
                        }]
                    });
                    
                    // Log de pruebas recibidas
                    await logProofsReceived(client, ticket, proofData);
                }
            }
            
        } catch (error) {
            console.error('Error procesando mensaje en ticket:', error);
        }
    }
};

async function logProofsReceived(client, ticket, proofData) {
    if (!config.channels.logs) return;
    
    const logChannel = await client.channels.fetch(config.channels.logs).catch(() => null);
    if (!logChannel) return;
    
    await logChannel.send({
        embeds: [{
            color: parseInt(config.branding.colors.warning.replace('#', ''), 16),
            title: '📎 Pruebas Recibidas',
            description: `Se detectaron pruebas en el ticket **${ticket.ticketId}**`,
            fields: [
                {
                    name: 'Usuario',
                    value: `<@${ticket.userId}>`,
                    inline: true
                },
                {
                    name: 'Tipo de Ticket',
                    value: ticket.type,
                    inline: true
                },
                {
                    name: 'Cantidad de Pruebas',
                    value: `${proofData.proofUrls.length}`,
                    inline: true
                },
                {
                    name: 'Pruebas',
                    value: proofData.proofUrls.slice(0, 5).join('\n') + 
                           (proofData.proofUrls.length > 5 ? '\n...' : '')
                }
            ],
            timestamp: new Date()
        }]
    });
}
