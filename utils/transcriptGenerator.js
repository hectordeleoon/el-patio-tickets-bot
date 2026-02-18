const fs = require('fs');
const path = require('path');

const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');

// Asegurar que existe el directorio
if (!fs.existsSync(TRANSCRIPTS_DIR)) fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

/**
 * Genera transcript en HTML bonito + TXT plano
 */
async function generate(ticket) {
    const txtPath  = path.join(TRANSCRIPTS_DIR, `ticket-${ticket.ticketId}.txt`);
    const htmlPath = path.join(TRANSCRIPTS_DIR, `ticket-${ticket.ticketId}.html`);

    const typeLabels = {
        'soporte-general': '🟢 Soporte General',
        'donaciones':      '🔵 Donaciones',
        'apelaciones':     '⚫ Apelaciones',
        'reportar-staff':  '🔴 Reportar Staff',
        'otros':           '🟠 Otros'
    };

    // === TXT ===
    const txtLines = [
        `╔══════════════════════════════════════════════════╗`,
        `║          TRANSCRIPT - EL PATIO RP               ║`,
        `╚══════════════════════════════════════════════════╝`,
        ``,
        `Ticket:    #${ticket.ticketId}`,
        `Tipo:      ${typeLabels[ticket.type] || ticket.type}`,
        `Usuario:   ${ticket.username} (${ticket.userId})`,
        `Staff:     ${ticket.claimedBy?.username || 'Sin reclamar'} (${ticket.claimedBy?.userId || '-'})`,
        `Estado:    ${ticket.status}`,
        `Creado:    ${ticket.createdAt?.toLocaleString('es-ES') || '-'}`,
        `Cerrado:   ${ticket.closedAt?.toLocaleString('es-ES') || '-'}`,
        `Razón:     ${ticket.closedBy?.reason || '-'}`,
        ``,
        `Descripción inicial:`,
        `${ticket.detail}`,
        ``,
        `══════════════════ MENSAJES ══════════════════`,
        ``
    ];

    for (const msg of (ticket.messages || [])) {
        const time = new Date(msg.timestamp).toLocaleString('es-ES');
        const role = msg.isStaff ? '[STAFF]' : '[USER] ';
        txtLines.push(`[${time}] ${role} ${msg.authorName}: ${msg.content}`);
        if (msg.attachments?.length) {
            for (const att of msg.attachments) txtLines.push(`  📎 ${att}`);
        }
    }

    if (ticket.rating?.stars) {
        txtLines.push(``, `══════════════════ VALORACIÓN ══════════════════`);
        txtLines.push(`Estrellas: ${'⭐'.repeat(ticket.rating.stars)} (${ticket.rating.stars}/5)`);
        if (ticket.rating.comment) txtLines.push(`Comentario: ${ticket.rating.comment}`);
    }

    fs.writeFileSync(txtPath, txtLines.join('\n'), 'utf8');

    // === HTML ===
    const msgRows = (ticket.messages || []).map(msg => {
        const time = new Date(msg.timestamp).toLocaleString('es-ES');
        const isStaff = msg.isStaff;
        const attachHtml = (msg.attachments || [])
            .map(a => `<a href="${a}" target="_blank" class="attachment">📎 Adjunto</a>`)
            .join('');
        return `
        <div class="message ${isStaff ? 'staff' : 'user'}">
            <div class="msg-header">
                <span class="author">${escapeHtml(msg.authorName)}</span>
                <span class="badge ${isStaff ? 'badge-staff' : 'badge-user'}">${isStaff ? 'STAFF' : 'USUARIO'}</span>
                <span class="time">${time}</span>
            </div>
            <div class="msg-body">${escapeHtml(msg.content)}</div>
            ${attachHtml ? `<div class="attachments">${attachHtml}</div>` : ''}
        </div>`;
    }).join('');

    const ratingHtml = ticket.rating?.stars ? `
        <div class="rating-box">
            <h3>⭐ Valoración del Usuario</h3>
            <div class="stars">${'⭐'.repeat(ticket.rating.stars)} <span>(${ticket.rating.stars}/5)</span></div>
            ${ticket.rating.comment ? `<p class="comment">"${escapeHtml(ticket.rating.comment)}"</p>` : ''}
        </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript Ticket #${ticket.ticketId} - El Patio RP</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; }
  .header { background: linear-gradient(135deg, #16213e, #0f3460); padding: 30px; text-align: center; border-bottom: 3px solid #f39c12; }
  .header h1 { font-size: 2rem; color: #f39c12; margin-bottom: 10px; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 20px 30px; background: #16213e; }
  .meta-card { background: #0f3460; border-radius: 8px; padding: 15px; border-left: 4px solid #f39c12; }
  .meta-card .label { font-size: 0.75rem; color: #aaa; text-transform: uppercase; margin-bottom: 5px; }
  .meta-card .value { font-size: 1rem; font-weight: bold; color: #fff; }
  .detail-box { margin: 20px 30px; background: #0f3460; border-radius: 8px; padding: 20px; border-left: 4px solid #3498db; }
  .detail-box h3 { color: #3498db; margin-bottom: 10px; }
  .messages { padding: 20px 30px; }
  .messages h2 { color: #f39c12; margin-bottom: 20px; font-size: 1.3rem; }
  .message { margin-bottom: 15px; padding: 15px; border-radius: 8px; }
  .message.staff { background: #0f3460; border-left: 4px solid #27ae60; }
  .message.user  { background: #1a1a2e; border: 1px solid #333; border-left: 4px solid #3498db; }
  .msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .author { font-weight: bold; color: #fff; }
  .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: bold; }
  .badge-staff { background: #27ae60; color: #fff; }
  .badge-user  { background: #3498db; color: #fff; }
  .time { font-size: 0.75rem; color: #888; margin-left: auto; }
  .msg-body { color: #ddd; line-height: 1.5; white-space: pre-wrap; }
  .attachment { display: inline-block; margin-top: 5px; margin-right: 8px; color: #f39c12; text-decoration: none; font-size: 0.85rem; }
  .rating-box { margin: 20px 30px 30px; background: #0f3460; border-radius: 8px; padding: 20px; text-align: center; border: 2px solid #f39c12; }
  .rating-box h3 { color: #f39c12; margin-bottom: 10px; }
  .stars { font-size: 1.8rem; margin: 10px 0; }
  .stars span { font-size: 1rem; color: #aaa; }
  .comment { color: #ccc; font-style: italic; margin-top: 10px; }
  .footer { text-align: center; padding: 20px; color: #555; font-size: 0.8rem; border-top: 1px solid #333; }
</style>
</head>
<body>
<div class="header">
  <h1>🎫 El Patio RP — Transcript</h1>
  <p>Ticket #${ticket.ticketId} · ${typeLabels[ticket.type] || ticket.type}</p>
</div>
<div class="meta-grid">
  <div class="meta-card"><div class="label">Ticket ID</div><div class="value">#${ticket.ticketId}</div></div>
  <div class="meta-card"><div class="label">Usuario</div><div class="value">${escapeHtml(ticket.username)}</div></div>
  <div class="meta-card"><div class="label">Staff</div><div class="value">${escapeHtml(ticket.claimedBy?.username || 'Sin reclamar')}</div></div>
  <div class="meta-card"><div class="label">Estado</div><div class="value">${ticket.status}</div></div>
  <div class="meta-card"><div class="label">Creado</div><div class="value">${ticket.createdAt?.toLocaleString('es-ES') || '-'}</div></div>
  <div class="meta-card"><div class="label">Cerrado</div><div class="value">${ticket.closedAt?.toLocaleString('es-ES') || '-'}</div></div>
  <div class="meta-card"><div class="label">Razón de cierre</div><div class="value">${escapeHtml(ticket.closedBy?.reason || '-')}</div></div>
  <div class="meta-card"><div class="label">Mensajes</div><div class="value">${ticket.messages?.length || 0}</div></div>
</div>
<div class="detail-box">
  <h3>📝 Descripción inicial</h3>
  <p>${escapeHtml(ticket.detail)}</p>
</div>
<div class="messages">
  <h2>💬 Mensajes (${ticket.messages?.length || 0})</h2>
  ${msgRows || '<p style="color:#666">Sin mensajes registrados.</p>'}
</div>
${ratingHtml}
<div class="footer">El Patio RP · Sistema de Tickets · Generado ${new Date().toLocaleString('es-ES')}</div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, html, 'utf8');

    return { txt: txtPath, html: htmlPath };
}

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = { generate };
