const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        }
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
    
    staffActivity: [{
        userId: String,
        username: String,
        ticketsClaimed: { type: Number, default: 0 },
        ticketsClosed: { type: Number, default: 0 },
        messagesCount: { type: Number, default: 0 }
    }],
    
    averageResponseTime: {
        type: Number,
        default: 0
    },
    
    averageResolutionTime: {
        type: Number,
        default: 0
    }
});

// Índice único por fecha
statsSchema.index({ date: 1 }, { unique: true });

/**
 * Obtiene o crea las estadísticas del día actual
 */
statsSchema.statics.getTodayStats = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let stats = await this.findOne({ date: today });
    
    if (!stats) {
        stats = await this.create({ date: today });
    }
    
    return stats;
};

/**
 * Incrementa el contador de tickets creados
 */
statsSchema.methods.incrementCreated = async function(ticketType) {
    this.ticketsCreated += 1;
    
    if (ticketType && this.ticketsByType[ticketType] !== undefined) {
        this.ticketsByType[ticketType] += 1;
    }
    
    return this.save();
};

/**
 * Incrementa el contador de tickets cerrados
 */
statsSchema.methods.incrementClosed = async function() {
    this.ticketsClosed += 1;
    return this.save();
};

/**
 * Actualiza la actividad de un miembro del staff
 */
statsSchema.methods.updateStaffActivity = async function(userId, username, action) {
    let staffMember = this.staffActivity.find(s => s.userId === userId);
    
    if (!staffMember) {
        staffMember = {
            userId,
            username,
            ticketsClaimed: 0,
            ticketsClosed: 0,
            messagesCount: 0
        };
        this.staffActivity.push(staffMember);
    }
    
    switch (action) {
        case 'claim':
            staffMember.ticketsClaimed += 1;
            break;
        case 'close':
            staffMember.ticketsClosed += 1;
            break;
        case 'message':
            staffMember.messagesCount += 1;
            break;
    }
    
    return this.save();
};

/**
 * Obtiene estadísticas de un rango de fechas
 */
statsSchema.statics.getStatsRange = async function(startDate, endDate) {
    return this.find({
        date: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ date: 1 });
};

/**
 * Obtiene estadísticas de los últimos N días
 */
statsSchema.statics.getLastNDays = async function(days = 7) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    return this.getStatsRange(startDate, endDate);
};

/**
 * Calcula estadísticas agregadas para un período
 */
statsSchema.statics.getAggregatedStats = async function(startDate, endDate) {
    const stats = await this.getStatsRange(startDate, endDate);
    
    const aggregated = {
        totalCreated: 0,
        totalClosed: 0,
        byType: {
            'soporte-general': 0,
            'donaciones': 0,
            'apelaciones': 0,
            'reportar-staff': 0,
            'otros': 0
        },
        topStaff: []
    };
    
    const staffMap = new Map();
    
    for (const dayStat of stats) {
        aggregated.totalCreated += dayStat.ticketsCreated;
        aggregated.totalClosed += dayStat.ticketsClosed;
        
        // Agregar por tipo
        for (const [type, count] of Object.entries(dayStat.ticketsByType)) {
            if (aggregated.byType[type] !== undefined) {
                aggregated.byType[type] += count;
            }
        }
        
        // Agregar actividad de staff
        for (const staff of dayStat.staffActivity) {
            if (!staffMap.has(staff.userId)) {
                staffMap.set(staff.userId, {
                    userId: staff.userId,
                    username: staff.username,
                    ticketsClaimed: 0,
                    ticketsClosed: 0,
                    messagesCount: 0
                });
            }
            
            const staffTotal = staffMap.get(staff.userId);
            staffTotal.ticketsClaimed += staff.ticketsClaimed;
            staffTotal.ticketsClosed += staff.ticketsClosed;
            staffTotal.messagesCount += staff.messagesCount;
        }
    }
    
    // Convertir map a array y ordenar
    aggregated.topStaff = Array.from(staffMap.values())
        .sort((a, b) => b.ticketsClosed - a.ticketsClosed)
        .slice(0, 10);
    
    return aggregated;
};

module.exports = mongoose.model('Stats', statsSchema);
