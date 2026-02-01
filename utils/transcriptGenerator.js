const fs = require('fs').promises;
const path = require('path');
const moment = require('moment-timezone');
const config = require('../config/config');

class TranscriptGenerator {
    constructor() {
        this.transcriptDir = path.join(__dirname, '../transcripts');
        this.ensureDirectory();
    }

    async ensureDirectory() {
        try {
            await fs.mkdir(this.transcriptDir, { recursive: true });
        } catch (error) {
            console.error('Error creating transcript directory:', error);
        }
    }

    /**
     * Genera transcripción en formato TXT
     */
    async generateTXT(ticket) {
        const lines = [];
        
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push(`${config.branding.serverName} - TRANSCRIPCIÓN DE TICKET`);
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');
        lines.push(`ID Ticket: ${ticket.ticketId}`);
        lines.push(`Tipo: ${this.getTicketTypeName(ticket.type)}`);
        lines.push(`Usuario: ${ticket.username} (${ticket.userId})`);
        lines.push(`Creado: ${this.formatDate(ticket.createdAt)}`);
        
        if (ticket.claimedBy) {
            lines.push(`Atendido por: ${ticket.claimedBy.username}`);
            lines.push(`Fecha atención: ${this.formatDate(ticket.claimedBy.timestamp)}`);
        }
        
        if (ticket.closedBy) {
            lines.push(`Cerrado por: ${ticket.closedBy.username}`);
            lines.push(`Fecha cierre: ${this.formatDate(ticket.closedAt)}`);
            lines.push(`Razón: ${ticket.closedBy.reason}`);
        }
        
        if (ticket.proofsProvided && ticket.proofsUrls.length > 0) {
            lines.push('');
            lines.push('--- PRUEBAS ADJUNTADAS ---');
            ticket.proofsUrls.forEach((url, index) => {
                lines.push(`${index + 1}. ${url}`);
            });
        }
        
        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('CONVERSACIÓN');
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');
        
        for (const msg of ticket.messages) {
            lines.push(`[${this.formatDate(msg.timestamp)}] ${msg.authorName}:`);
            lines.push(msg.content || '(Sin contenido de texto)');
            
            if (msg.attachments && msg.attachments.length > 0) {
                lines.push('Archivos adjuntos:');
                msg.attachments.forEach((att, index) => {
                    lines.push(`  ${index + 1}. ${att}`);
                });
            }
            
            lines.push('');
        }
        
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push(`Transcripción generada: ${this.formatDate(new Date())}`);
        lines.push('═══════════════════════════════════════════════════════════');
        
        return lines.join('\n');
    }

    /**
     * Genera transcripción en formato HTML
     */
    async generateHTML(ticket) {
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket ${ticket.ticketId} - ${config.branding.serverName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #1b1e26 0%, #2d3748 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header .ticket-id {
            color: ${config.branding.colors.accent};
            font-size: 18px;
            font-weight: bold;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f7fafc;
        }
        
        .info-box {
            background: white;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid ${config.branding.colors.accent};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .info-box label {
            font-size: 12px;
            text-transform: uppercase;
            color: #718096;
            font-weight: 600;
            display: block;
            margin-bottom: 8px;
        }
        
        .info-box value {
            font-size: 16px;
            color: #2d3748;
            font-weight: 500;
        }
        
        .proofs-section {
            padding: 30px;
            background: #fff5e6;
            border-top: 2px solid ${config.branding.colors.warning};
        }
        
        .proofs-section h2 {
            color: ${config.branding.colors.warning};
            margin-bottom: 15px;
        }
        
        .proof-link {
            display: block;
            padding: 10px;
            margin: 5px 0;
            background: white;
            border-radius: 5px;
            text-decoration: none;
            color: #3182ce;
            transition: all 0.3s;
        }
        
        .proof-link:hover {
            background: #e6f3ff;
            transform: translateX(5px);
        }
        
        .messages {
            padding: 30px;
        }
        
        .messages h2 {
            margin-bottom: 25px;
            color: #2d3748;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .message {
            margin-bottom: 20px;
            padding: 20px;
            background: #f7fafc;
            border-radius: 10px;
            border-left: 4px solid #cbd5e0;
        }
        
        .message.staff {
            background: #e6fffa;
            border-left-color: ${config.branding.colors.success};
        }
        
        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            align-items: center;
        }
        
        .message-author {
            font-weight: 600;
            color: #2d3748;
            font-size: 16px;
        }
        
        .message-author.staff {
            color: ${config.branding.colors.success};
        }
        
        .message-time {
            font-size: 12px;
            color: #718096;
        }
        
        .message-content {
            color: #4a5568;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .attachments {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
        }
        
        .attachment {
            display: inline-block;
            margin: 5px 10px 5px 0;
            padding: 8px 15px;
            background: white;
            border-radius: 5px;
            text-decoration: none;
            color: #3182ce;
            font-size: 14px;
            border: 1px solid #e2e8f0;
            transition: all 0.3s;
        }
        
        .attachment:hover {
            background: #e6f3ff;
            border-color: #3182ce;
        }
        
        .footer {
            background: #2d3748;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .badge.open { background: #c6f6d5; color: #22543d; }
        .badge.claimed { background: #bee3f8; color: #2c5282; }
        .badge.closed { background: #fed7d7; color: #742a2a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.branding.serverName}</h1>
            <div class="ticket-id">Ticket #${ticket.ticketId}</div>
            <div style="margin-top: 10px;">
                <span class="badge ${ticket.status}">${this.getStatusName(ticket.status)}</span>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-box">
                <label>Tipo de Ticket</label>
                <value>${this.getTicketTypeName(ticket.type)}</value>
            </div>
            
            <div class="info-box">
                <label>Usuario</label>
                <value>${ticket.username}</value>
            </div>
            
            <div class="info-box">
                <label>Fecha de Creación</label>
                <value>${this.formatDate(ticket.createdAt)}</value>
            </div>
            
            ${ticket.claimedBy ? `
            <div class="info-box">
                <label>Atendido por</label>
                <value>${ticket.claimedBy.username}</value>
            </div>
            ` : ''}
            
            ${ticket.closedBy ? `
            <div class="info-box">
                <label>Cerrado por</label>
                <value>${ticket.closedBy.username}</value>
            </div>
            
            <div class="info-box">
                <label>Fecha de Cierre</label>
                <value>${this.formatDate(ticket.closedAt)}</value>
            </div>
            ` : ''}
        </div>
        
        ${ticket.proofsProvided && ticket.proofsUrls.length > 0 ? `
        <div class="proofs-section">
            <h2>⚠️ Pruebas Adjuntadas</h2>
            ${ticket.proofsUrls.map((url, index) => `
                <a href="${url}" target="_blank" class="proof-link">
                    📎 Prueba ${index + 1}: ${url}
                </a>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="messages">
            <h2>💬 Conversación</h2>
            ${ticket.messages.map(msg => {
                const isStaff = msg.authorId !== ticket.userId;
                return `
                <div class="message ${isStaff ? 'staff' : ''}">
                    <div class="message-header">
                        <span class="message-author ${isStaff ? 'staff' : ''}">${msg.authorName}</span>
                        <span class="message-time">${this.formatDate(msg.timestamp)}</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(msg.content || '(Sin contenido de texto)')}</div>
                    ${msg.attachments && msg.attachments.length > 0 ? `
                    <div class="attachments">
                        ${msg.attachments.map((att, index) => `
                            <a href="${att}" target="_blank" class="attachment">
                                📎 Archivo ${index + 1}
                            </a>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                `;
            }).join('')}
        </div>
        
        <div class="footer">
            Transcripción generada el ${this.formatDate(new Date())}<br>
            ${config.branding.serverName} • Sistema de Tickets Premium
        </div>
    </div>
</body>
</html>`;
        
        return html;
    }

    /**
     * Guarda la transcripción en disco
     */
    async save(ticket) {
        const results = { txt: null, html: null };
        const format = config.system.transcriptFormat;
        
        try {
            if (format === 'txt' || format === 'both') {
                const txtContent = await this.generateTXT(ticket);
                const txtPath = path.join(this.transcriptDir, `${ticket.ticketId}.txt`);
                await fs.writeFile(txtPath, txtContent, 'utf8');
                results.txt = txtPath;
            }
            
            if (format === 'html' || format === 'both') {
                const htmlContent = await this.generateHTML(ticket);
                const htmlPath = path.join(this.transcriptDir, `${ticket.ticketId}.html`);
                await fs.writeFile(htmlPath, htmlContent, 'utf8');
                results.html = htmlPath;
            }
            
            return results;
        } catch (error) {
            console.error('Error saving transcript:', error);
            throw error;
        }
    }

    // Métodos auxiliares
    formatDate(date) {
        return moment(date).tz('America/Santo_Domingo').format('DD/MM/YYYY HH:mm:ss');
    }

    getTicketTypeName(type) {
        const types = {
            'soporte-general': '🟢 Soporte General',
            'donaciones': '🔵 Donaciones',
            'apelaciones': '⚫ Apelaciones',
            'reportar-staff': '🔴 Reportar Staff',
            'otros': '🟠 Otros'
        };
        return types[type] || type;
    }

    getStatusName(status) {
        const statuses = {
            'open': 'Abierto',
            'claimed': 'En Atención',
            'closed': 'Cerrado'
        };
        return statuses[status] || status;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

module.exports = new TranscriptGenerator();
