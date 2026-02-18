const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId:  { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    userId:    { type: String, required: true },
    username:  { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['soporte-general', 'donaciones', 'apelaciones', 'reportar-staff', 'otros']
    },
    detail:   { type: String, required: true, minlength: 10, maxlength: 500 },
    priority: { type: String, enum: ['normal', 'alta', 'urgente'], default: 'normal' },
    status:   { type: String, enum: ['open', 'claimed', 'closed'], default: 'open' },

    claimedBy:  { userId: String, username: String },
    claimedAt:  Date,

    lastActivity:      { type: Date, default: Date.now },
    lastStaffMessageAt: Date,
    alert48hSent:      { type: Boolean, default: false },
    inactivityWarned:  { type: Boolean, default: false },

    additionalStaff: [{
        userId: String, username: String, addedBy: String, timestamp: Date
    }],

    // Guardamos mensajes para el transcript
    messages: [{
        authorId: String, authorName: String, content: String,
        attachments: [String], isStaff: Boolean, timestamp: Date
    }],

    // Rating del usuario al cerrar
    rating: {
        stars:     { type: Number, min: 1, max: 5 },
        comment:   String,
        ratedAt:   Date,
        ratedBy:   String
    },

    createdAt: { type: Date, default: Date.now },
    closedAt:  Date,
    closedBy:  { userId: String, username: String, reason: String },

    // Control de auto-eliminación
    scheduledDeleteAt: Date,
    deleteJobId:       String
});

/* ===============================
   MÉTODOS DE INSTANCIA
================================ */

ticketSchema.methods.addMessage = function (authorId, authorName, content, attachments = [], isStaff = false) {
    this.messages.push({ authorId, authorName, content, attachments, isStaff, timestamp: new Date() });
    this.lastActivity = new Date();
    this.inactivityWarned = false;
    if (isStaff) { this.lastStaffMessageAt = new Date(); this.alert48hSent = false; }
    return this.save();
};

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

ticketSchema.methods.close = function (userId, username, reason) {
    this.status = 'closed';
    this.closedAt = new Date();
    this.closedBy = { userId, username, reason };
    return this.save();
};

ticketSchema.methods.updateActivity = function () {
    this.lastActivity = new Date();
    this.inactivityWarned = false;
    return this.save();
};

ticketSchema.methods.setRating = function (stars, comment, ratedBy) {
    this.rating = { stars, comment, ratedAt: new Date(), ratedBy };
    return this.save();
};

/* ===============================
   MÉTODOS ESTÁTICOS
================================ */

ticketSchema.statics.getInactiveTickets = async function (hours) {
    const inactiveDate = new Date();
    inactiveDate.setHours(inactiveDate.getHours() - hours);
    return this.find({ status: { $in: ['open', 'claimed'] }, lastActivity: { $lt: inactiveDate } });
};

ticketSchema.statics.getTicketsNeeding48hAlert = async function () {
    const alertDate = new Date();
    alertDate.setHours(alertDate.getHours() - 48);
    return this.find({ status: 'claimed', alert48hSent: false, lastStaffMessageAt: { $lt: alertDate } });
};

ticketSchema.statics.getUserOpenTickets = async function (userId) {
    return this.find({ userId, status: { $in: ['open', 'claimed'] } });
};

ticketSchema.statics.getByTicketId = async function (ticketId) {
    return this.findOne({ ticketId });
};

ticketSchema.statics.getByChannelId = async function (channelId) {
    return this.findOne({ channelId });
};

// Genera el siguiente ID con mutex para evitar condición de carrera
ticketSchema.statics.generateNextId = async function () {
    // Usamos findOneAndUpdate atómico para evitar duplicados
    const counter = await mongoose.connection.db
        .collection('counters')
        .findOneAndUpdate(
            { _id: 'ticketId' },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
    const seq = counter.value?.seq || counter.seq || 1;
    return seq.toString().padStart(4, '0');
};

ticketSchema.statics.getStats = async function () {
    const [total, open, claimed, closed] = await Promise.all([
        this.countDocuments(),
        this.countDocuments({ status: 'open' }),
        this.countDocuments({ status: 'claimed' }),
        this.countDocuments({ status: 'closed' })
    ]);
    const avgRating = await this.aggregate([
        { $match: { 'rating.stars': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$rating.stars' }, count: { $sum: 1 } } }
    ]);
    return {
        total, open, claimed, closed,
        avgRating: avgRating[0]?.avg?.toFixed(1) || 'N/A',
        ratedCount: avgRating[0]?.count || 0
    };
};

ticketSchema.statics.getStaffStats = async function (staffId) {
    const claimed = await this.countDocuments({ 'claimedBy.userId': staffId });
    const closed  = await this.countDocuments({ 'closedBy.userId': staffId });
    const ratings = await this.aggregate([
        { $match: { 'claimedBy.userId': staffId, 'rating.stars': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$rating.stars' }, count: { $sum: 1 } } }
    ]);
    return {
        claimed, closed,
        avgRating: ratings[0]?.avg?.toFixed(1) || 'N/A',
        ratedCount: ratings[0]?.count || 0
    };
};

/* ===============================
   ÍNDICES
================================ */
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ status: 1, lastActivity: 1 });
ticketSchema.index({ status: 1, lastStaffMessageAt: 1 });
ticketSchema.index({ channelId: 1 });
ticketSchema.index({ ticketId: 1 });

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
