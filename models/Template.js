const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    
    title: {
        type: String,
        required: true,
        maxlength: 256
    },
    
    content: {
        type: String,
        required: true,
        maxlength: 2000
    },
    
    category: {
        type: String,
        enum: ['general', 'donaciones', 'tecnico', 'apelaciones', 'faq'],
        default: 'general',
        index: true
    },
    
    createdBy: {
        userId: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },
    
    usageCount: {
        type: Number,
        default: 0,
        index: true
    },
    
    lastUsedAt: {
        type: Date
    },
    
    lastUsedBy: {
        userId: String,
        username: String
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices compuestos
templateSchema.index({ category: 1, usageCount: -1 });
templateSchema.index({ name: 'text', title: 'text', content: 'text' });

// Middleware para actualizar updatedAt
templateSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Métodos estáticos
templateSchema.statics.getMostUsed = async function(limit = 10) {
    return this.find()
        .sort({ usageCount: -1 })
        .limit(limit);
};

templateSchema.statics.getByCategory = async function(category) {
    return this.find({ category })
        .sort({ usageCount: -1 });
};

templateSchema.statics.searchTemplates = async function(query) {
    return this.find({
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } }
        ]
    }).limit(25);
};

module.exports = mongoose.model('Template', templateSchema);
