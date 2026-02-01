const mongoose = require('mongoose');

const staffStatsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: String,

    abandonedTickets: { type: Number, default: 0 },
    sanctions: { type: Number, default: 0 },

    lastSanctionAt: Date,
    warned: { type: Boolean, default: false }
});

module.exports = mongoose.model('StaffStats', staffStatsSchema);
