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
    lastStaffMessageAt: Date,

    alert24hSent: { type: Boolean, default: false },
    alert48hSent: { type: Boolean, default: false },

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
   MÉTODOS
================================ */

ticketSchema.methods.addMessage = function (authorId, authorName, content, attachments = []) {
    this.messages.push({
        authorId,
        authorName,
        content,
        attachments,
        timestamp: new Date()
    });
    return this.save();
};

ticketSchema.methods.claim = function (userId, username) {
    this.status = 'claimed';
    this.claimedBy = { userId, username };
    this.claimedAt = new Date();
    this.alert24hSent = false;
    this.alert48hSent = false;
    return this.save();
};

ticketSchema.methods.markStaffActivity = function () {
    this.lastStaffMessageAt = new Date();
    this.alert24hSent = false;
    this.alert48hSent = false;
    return this.save();
};

ticketSchema.methods.close = function (userId, username, reason) {
    this.status = 'closed';
    this.closedAt = new Date();
    this.closedBy = { userId, username, reason };
    return this.save();
};

module.exports = mongoose.model('Ticket', ticketSchema);
