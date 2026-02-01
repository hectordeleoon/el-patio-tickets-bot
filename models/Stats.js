const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    ticketsCreated: {
        type: Number,
        default: 0
    },
    ticketsClosed: {
        type: Number,
        default: 0
    },
    ticketsByType: {
        'soporte-general': { type: Number, default: 0 },
        'donaciones': { type: Number, default: 0 },
        'apelaciones': { type: Number, default: 0 },
        'reportar-staff': { type: Number, default: 0 },
        'otros': { type: Number, default: 0 }
    },
    averageResponseTime: {
        type: Number,
        default: 0
    },
    averageResolutionTime: {
        type: Number,
        default: 0
    },
    staffActivity: [{
        userId: String,
        username: String,
        ticketsClaimed: { type: Number, default: 0 },
        ticketsClosed: { type: Number, default: 0 }
    }]
});

// Método para incrementar contador de tickets creados
statsSchema.methods.incrementCreated = function(type) {
    this.ticketsCreated++;
    if (this.ticketsByType[type] !== undefined) {
        this.ticketsByType[type]++;
    }
    return this.save();
};

// Método para incrementar contador de tickets cerrados
statsSchema.methods.incrementClosed = function() {
    this.ticketsClosed++;
    return this.save();
};

// Método para actualizar actividad de staff
statsSchema.methods.updateStaffActivity = function(userId, username, action) {
    let staffMember = this.staffActivity.find(s => s.userId === userId);
    
    if (!staffMember) {
        staffMember = {
            userId,
            username,
            ticketsClaimed: 0,
            ticketsClosed: 0
        };
        this.staffActivity.push(staffMember);
    }

    if (action === 'claim') {
        staffMember.ticketsClaimed++;
    } else if (action === 'close') {
        staffMember.ticketsClosed++;
    }

    return this.save();
};

// Método estático para obtener o crear estadísticas del día
statsSchema.statics.getTodayStats = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let stats = await this.findOne({ date: today });
    
    if (!stats) {
        stats = await this.create({ date: today });
    }

    return stats;
};

module.exports = mongoose.model('Stats', statsSchema);
