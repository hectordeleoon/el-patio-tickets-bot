const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

/**
 * Sistema de Auto-Respuestas Inteligentes
 * Utiliza la API de Anthropic Claude para responder preguntas frecuentes automáticamente
 */

class AutoResponseSystem {
    constructor() {
        this.enabled = process.env.AI_AUTO_RESPONSES === 'true';
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        this.model = 'claude-sonnet-4-20250514';
        
        // Base de conocimiento del servidor
        this.knowledgeBase = {
            serverName: config.branding.serverName,
            serverInfo: `${config.branding.serverName} es un servidor de FiveM/GTA RP`,
            
            // FAQ común
            commonQuestions: [
                {
                    keywords: ['donar', 'donación', 'vip', 'premium', 'pagar'],
                    category: 'donaciones',
                    confidence: 0.8
                },
                {
                    keywords: ['whitelist', 'lista blanca', 'como entrar', 'acceso'],
                    category: 'acceso',
                    confidence: 0.9
                },
                {
                    keywords: ['ban', 'baneado', 'sanción', 'suspendido'],
                    category: 'sanciones',
                    confidence: 0.9
                },
                {
                    keywords: ['lag', 'fps', 'crashea', 'problema técnico', 'error'],
                    category: 'soporte-tecnico',
                    confidence: 0.7
                },
                {
                    keywords: ['reportar', 'staff', 'admin', 'moderador', 'queja'],
                    category: 'reportar-staff',
                    confidence: 0.85
                }
            ],

            // Respuestas predefinidas
            predefinedAnswers: {
                donaciones: {
                    title: '💎 Información sobre Donaciones',
                    content: `Para realizar una donación y obtener beneficios VIP:

1. Visita nuestra tienda oficial
2. Selecciona el paquete que desees
3. Completa el pago
4. Recibirás tus beneficios automáticamente

**¿Necesitas ayuda?** El staff de finanzas te atenderá en breve.`,
                    autoResolve: false
                },
                
                acceso: {
                    title: '🔐 Acceso al Servidor',
                    content: `Para acceder a ${config.branding.serverName}:

1. Únete a nuestro Discord oficial
2. Lee las reglas en #📋-reglas
3. Completa el formulario de whitelist
4. Espera aprobación (24-48h generalmente)

**¿Ya completaste estos pasos?** Describe tu situación y el staff te ayudará.`,
                    autoResolve: false
                },
                
                sanciones: {
                    title: '⚖️ Sobre Sanciones',
                    content: `Si has sido sancionado:

• **Revisa** el motivo de tu sanción en el mensaje que recibiste
• **Si crees que fue injusto**, puedes crear un ticket de apelación
• **Proporciona pruebas** de tu inocencia si las tienes

El equipo de moderación revisará tu caso.`,
                    autoResolve: false
                },

                'soporte-tecnico': {
                    title: '🔧 Soporte Técnico',
                    content: `Problemas técnicos comunes:

**FPS Bajo / Lag:**
• Verifica tus drivers gráficos
• Cierra programas en segundo plano
• Reduce configuración gráfica

**Crashes:**
• Verifica integridad de archivos de GTA V
• Actualiza FiveM a la última versión
• Verifica que no tengas mods conflictivos

¿El problema persiste? Describe detalladamente el error.`,
                    autoResolve: false
                }
            }
        };
    }

    /**
     * Analiza un mensaje y determina si puede responder automáticamente
     */
    async analyzeMessage(message, ticketType) {
        if (!this.enabled || !this.apiKey) {
            return { shouldRespond: false };
        }

        const content = message.content.toLowerCase();
        
        // 1. Verificar coincidencias simples primero (rápido)
        const simpleMatch = this.findSimpleMatch(content);
        if (simpleMatch && simpleMatch.confidence >= 0.9) {
            return {
                shouldRespond: true,
                confidence: simpleMatch.confidence,
                response: this.knowledgeBase.predefinedAnswers[simpleMatch.category],
                method: 'simple'
            };
        }

        // 2. Si no hay coincidencia simple, usar IA (más lento pero preciso)
        try {
            const aiResponse = await this.getAIResponse(content, ticketType);
            return aiResponse;
        } catch (error) {
            console.error('Error en auto-respuesta IA:', error);
            return { shouldRespond: false };
        }
    }

    /**
     * Encuentra coincidencias simples basadas en keywords
     */
    findSimpleMatch(content) {
        let bestMatch = null;
        let highestScore = 0;

        for (const question of this.knowledgeBase.commonQuestions) {
            let score = 0;
            let matchedKeywords = 0;

            for (const keyword of question.keywords) {
                if (content.includes(keyword)) {
                    matchedKeywords++;
                    score += 1;
                }
            }

            const confidence = (matchedKeywords / question.keywords.length) * question.confidence;

            if (confidence > highestScore && confidence >= 0.5) {
                highestScore = confidence;
                bestMatch = {
                    category: question.category,
                    confidence: confidence
                };
            }
        }

        return bestMatch;
    }

    /**
     * Obtiene respuesta de la IA de Claude
     */
    async getAIResponse(content, ticketType) {
        const systemPrompt = `Eres un asistente de soporte para ${this.knowledgeBase.serverName}, un servidor de GTA RP/FiveM.

Tu trabajo es analizar preguntas de usuarios y determinar si puedes responderlas automáticamente.

CATEGORÍAS QUE PUEDES MANEJAR:
- Donaciones/VIP
- Acceso al servidor/Whitelist
- Sanciones/Bans
- Problemas técnicos básicos
- Preguntas generales sobre el servidor

IMPORTANTE:
- Si la pregunta es simple y está en estas categorías: responde "YES" con confianza alta
- Si requiere información específica del usuario o decisión de staff: responde "NO"
- Si no estás seguro: responde "NO"

Responde SOLO en este formato JSON:
{
  "can_answer": true/false,
  "confidence": 0.0-1.0,
  "category": "categoria",
  "suggested_response": "respuesta breve si can_answer es true"
}`;

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 500,
                    messages: [{
                        role: 'user',
                        content: `Tipo de ticket: ${ticketType}\n\nPregunta del usuario: "${content}"\n\nAnaliza si puedes responder automáticamente.`
                    }],
                    system: systemPrompt
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.content[0].text;
            
            // Parsear respuesta JSON
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { shouldRespond: false };
            }

            const analysis = JSON.parse(jsonMatch[0]);

            if (analysis.can_answer && analysis.confidence >= 0.7) {
                return {
                    shouldRespond: true,
                    confidence: analysis.confidence,
                    response: {
                        title: `🤖 Respuesta Automática - ${analysis.category}`,
                        content: analysis.suggested_response,
                        autoResolve: false
                    },
                    method: 'ai'
                };
            }

            return { shouldRespond: false };

        } catch (error) {
            console.error('Error calling Claude API:', error);
            return { shouldRespond: false };
        }
    }

    /**
     * Envía una respuesta automática al ticket
     */
    async sendAutoResponse(channel, userId, responseData) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(responseData.response.title)
            .setDescription(responseData.response.content)
            .setFooter({ 
                text: `Respuesta automática • Confianza: ${Math.round(responseData.confidence * 100)}% • Método: ${responseData.method === 'ai' ? 'IA' : 'Base de conocimiento'}` 
            })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('auto_helpful_yes')
                    .setLabel('✅ Esto resolvió mi duda')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('auto_helpful_no')
                    .setLabel('❌ Necesito más ayuda')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({
            content: `<@${userId}>`,
            embeds: [embed],
            components: [row]
        });
    }

    /**
     * Maneja la respuesta del usuario a la auto-respuesta
     */
    async handleUserFeedback(interaction, helpful) {
        if (helpful) {
            const embed = new EmbedBuilder()
                .setColor('#27ae60')
                .setTitle('✅ ¡Nos alegra haber ayudado!')
                .setDescription(
                    'Tu ticket se cerrará automáticamente en 5 minutos.\n\n' +
                    'Si necesitas algo más, simplemente escribe en el ticket.'
                )
                .setFooter({ text: 'Sistema de Auto-Respuestas' });

            await interaction.reply({ embeds: [embed] });

            // Aquí podrías implementar cierre automático después de 5 minutos
            // con un setTimeout o similar

        } else {
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('👤 Un staff te atenderá pronto')
                .setDescription(
                    'Hemos notificado al equipo de soporte.\n' +
                    'Por favor, describe con más detalle tu situación para que podamos ayudarte mejor.'
                )
                .setFooter({ text: 'Sistema de Auto-Respuestas' });

            await interaction.reply({ embeds: [embed] });

            // Notificar a staff que se necesita atención humana
            await this.notifyStaffNeeded(interaction.channel);
        }

        // Desactivar botones
        await interaction.message.edit({ components: [] });
    }

    /**
     * Notifica a staff que se necesita atención
     */
    async notifyStaffNeeded(channel) {
        if (!config.channels.staffChat) return;

        try {
            const staffChannel = await channel.client.channels.fetch(config.channels.staffChat);
            
            await staffChannel.send({
                embeds: [{
                    color: 0xf39c12,
                    title: '⚠️ Auto-respuesta no fue suficiente',
                    description: `El usuario en <#${channel.id}> necesita atención de staff.`,
                    footer: { text: 'Sistema de Auto-Respuestas' },
                    timestamp: new Date()
                }]
            });
        } catch (error) {
            console.error('Error notificando a staff:', error);
        }
    }

    /**
     * Obtiene estadísticas del sistema de auto-respuestas
     */
    async getStats() {
        // Aquí podrías implementar tracking de estadísticas
        // Por ahora retorna un objeto vacío
        return {
            totalAutoResponses: 0,
            successfulResponses: 0,
            failedResponses: 0,
            averageConfidence: 0
        };
    }
}

// Singleton
const autoResponseSystem = new AutoResponseSystem();

module.exports = autoResponseSystem;
