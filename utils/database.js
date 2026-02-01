const mongoose = require('mongoose');
const config = require('../config/config');

class Database {
    constructor() {
        this.connected = false;
    }

    async connect() {
        try {
            await mongoose.connect(config.database.mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            
            this.connected = true;
            console.log('✅ Conectado a MongoDB correctamente');
            
            mongoose.connection.on('error', (err) => {
                console.error('❌ Error de MongoDB:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ Desconectado de MongoDB');
                this.connected = false;
            });

        } catch (error) {
            console.error('❌ Error al conectar a MongoDB:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.connected) {
            await mongoose.disconnect();
            console.log('🔌 Desconectado de MongoDB');
            this.connected = false;
        }
    }

    isConnected() {
        return this.connected;
    }
}

module.exports = new Database();
