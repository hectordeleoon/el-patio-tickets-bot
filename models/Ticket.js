const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['soporte-general', 'donaciones', 'apelaciones', 'reportar-staff', 'otros']
    },
    status: {
        type: String,
        required: true,
        enum: ['open', 'claimed', 'closed'],
        default: 'open'
    },
    claimedBy: {
        userId: String,
        username: String,
        timestamp: Date
    },
    // Staff adicionales añadidos durante el ticket
    additionalStaff: [{
        userId: String,
        username: String,
        addedBy: String,
        timestamp: Date
    }],
    proofsProvided: {
        type: Boolean,
        default: false
    },
    proofsUrls: [{
        type: String
    }],
    messages: [{
        authorId: String,
        authorName: String,
        content: String,
        attachments: [String],
        timestamp: Date
    }],
    lastActivity: {
        type: Date,
        default: Date.now
    },
    inactivityWarned: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date
    },
    closedBy: {
        userId: String,
        username: String,
        reason: String
    },
    rating: {
        score: {
            type: Number,
            min: 1,
            max: 5
        },
        feedback: String,
        ratedAt: Date
    }
});

// Índices para búsquedas más rápidas
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ type: 1 });
ticketSchema.index({ createdAt: -1 });

// Método para agregar mensaje
ticketSchema.methods.addMessage = function(authorId, authorName, content, attachments = []) {
    this.messages.push({
        authorId,
        authorName,
        content,
        attachments,
        timestamp: new Date()
    });
    this.lastActivity = new Date();
    this.inactivityWarned = false;
    return this.save();
};

// Método para reclamar ticket
ticketSchema.methods.claim = function(userId, username) {
    this.status = 'claimed';
    this.claimedBy = {
        userId,
        username,
        timestamp: new Date()
    };
    return this.save();
};

// Método para cerrar ticket
ticketSchema.methods.close = function(userId, username, reason = 'Manual') {
    this.status = 'closed';
    this.closedAt = new Date();
    this.closedBy = {
        userId,
        username,
        reason
    };
    return this.save();
};

// Método estático para contar tickets activos de un usuario
ticketSchema.statics.countActiveByUser = function(userId) {
    return this.countDocuments({
        userId,
        status: { $in: ['open', 'claimed'] }
    });
};

// Método estático para contar tickets recientes de un usuario
ticketSchema.statics.countRecentByUser = function(userId, hours = 24) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.countDocuments({
        userId,
        createdAt: { $gte: cutoffDate }
    });
};

// Método estático para obtener tickets inactivos
ticketSchema.statics.getInactiveTickets = function(hours) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({
        status: { $in: ['open', 'claimed'] },
        lastActivity: { $lt: cutoffDate }
    });
};

module.exports = mongoose.model('Ticket', ticketSchema);
