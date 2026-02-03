const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['soporte-general', 'donaciones', 'apelaciones', 'reportar-staff', 'otros']
    },
    detail: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['open', 'claimed', 'closed'],
        default: 'open'
    },
    claimedBy: {
        userId: String,
        username: String
    },
    claimedAt: Date,
    lastActivity: { type: Date, default: Date.now },
    lastStaffMessageAt: Date,
    alert48hSent: { type: Boolean, default: false },
    inactivityWarned: { type: Boolean, default: false },
    additionalStaff: [{
        userId: String,
        username: String,
        addedBy: String,
        timestamp: Date
    }],
    messages: [{
        authorId: String,
        authorName: String,
        content: String,
        attachments: [String],
        timestamp: Date
    }],
    createdAt: { type: Date, default: Date.now },
    closedAt: Date,
    closedBy: {
        userId: String,
        username: String,
        reason: String
    }
});

/* ===============================
   MÉTODOS DE INSTANCIA
================================ */

/**
 * Agrega un mensaje al ticket y actualiza la actividad
 */
ticketSchema.methods.addMessage = function (
    authorId,
    authorName,
    content,
    attachments = [],
    isStaff = false
) {
    this.messages.push({
        authorId,
        authorName,
        content,
        attachments,
        timestamp: new Date()
    });
    
    // Actualizar última actividad
    this.lastActivity = new Date();
    this.inactivityWarned = false; // Resetear advertencia si hay nueva actividad
    
    if (isStaff) {
        this.lastStaffMessageAt = new Date();
        this.alert48hSent = false;
    }
    
    return this.save();
};

/**
 * Reclama el ticket para un staff
 */
ticketSchema.methods.claim = function (userId, username) {
    this.status = 'claimed';
    this.claimedBy = { userId, username };
    this.claimedAt = new Date();
    this.lastStaffMessageAt = new Date();
    this.lastActivity = new Date();
    this.alert48hSent = false;
    this.inactivityWarned = false;
    return this.save();
};

/**
 * Cierra el ticket
 */
ticketSchema.methods.close = function (userId, username, reason) {
    this.status = 'closed';
    this.closedAt = new Date();
    this.closedBy = { userId, username, reason };
    return this.save();
};

/**
 * Actualiza la última actividad del ticket
 */
ticketSchema.methods.updateActivity = function () {
    this.lastActivity = new Date();
    this.inactivityWarned = false;
    return this.save();
};

/* ===============================
   MÉTODOS ESTÁTICOS
================================ */

/**
 * Obtiene tickets inactivos por más de X horas
 * @param {number} hours - Horas de inactividad
 * @returns {Promise<Array>} Array de tickets inactivos
 */
ticketSchema.statics.getInactiveTickets = async function (hours) {
    const inactiveDate = new Date();
    inactiveDate.setHours(inactiveDate.getHours() - hours);
    
    return this.find({
        status: { $in: ['open', 'claimed'] },
        lastActivity: { $lt: inactiveDate }
    });
};

/**
 * Obtiene tickets que necesitan advertencia de 48h
 * @returns {Promise<Array>}
 */
ticketSchema.statics.getTicketsNeeding48hAlert = async function () {
    const alertDate = new Date();
    alertDate.setHours(alertDate.getHours() - 48);
    
    return this.find({
        status: 'claimed',
        alert48hSent: false,
        lastStaffMessageAt: { $lt: alertDate }
    });
};

/**
 * Obtiene tickets abiertos de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>}
 */
ticketSchema.statics.getUserOpenTickets = async function (userId) {
    return this.find({
        userId: userId,
        status: { $in: ['open', 'claimed'] }
    });
};

/**
 * Obtiene un ticket por su ID personalizado
 * @param {string} ticketId - ID del ticket (ej: "0001")
 * @returns {Promise<Object|null>}
 */
ticketSchema.statics.getByTicketId = async function (ticketId) {
    return this.findOne({ ticketId: ticketId });
};

/**
 * Obtiene un ticket por el ID del canal
 * @param {string} channelId - ID del canal
 * @returns {Promise<Object|null>}
 */
ticketSchema.statics.getByChannelId = async function (channelId) {
    return this.findOne({ channelId: channelId });
};

/**
 * Genera el siguiente ID de ticket disponible
 * @returns {Promise<string>}
 */
ticketSchema.statics.generateNextId = async function () {
    const lastTicket = await this.findOne()
        .sort({ createdAt: -1 })
        .select('ticketId');
    
    if (!lastTicket) {
        return '0001';
    }
    
    const lastNumber = parseInt(lastTicket.ticketId);
    const nextNumber = lastNumber + 1;
    return nextNumber.toString().padStart(4, '0');
};

/**
 * Obtiene estadísticas de tickets
 * @returns {Promise<Object>}
 */
ticketSchema.statics.getStats = async function () {
    const total = await this.countDocuments();
    const open = await this.countDocuments({ status: 'open' });
    const claimed = await this.countDocuments({ status: 'claimed' });
    const closed = await this.countDocuments({ status: 'closed' });
    
    return { total, open, claimed, closed };
};

/* ===============================
   ÍNDICES PARA OPTIMIZACIÓN
================================ */
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ status: 1, lastActivity: 1 });
ticketSchema.index({ status: 1, lastStaffMessageAt: 1 });
ticketSchema.index({ channelId: 1 });
ticketSchema.index({ ticketId: 1 });

// ✅ EXPORTAR EL MODELO CON PROTECCIÓN CONTRA SOBRESCRITURA
module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
