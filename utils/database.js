const mongoose = require('mongoose');

class Database {
    constructor() {
        this.connected = false;
    }

    /**
     * Conecta a MongoDB
     */
    async connect() {
        try {
            const uri = process.env.MONGODB_URI;
            
            if (!uri) {
                throw new Error('MONGODB_URI no está definido en las variables de entorno');
            }

            // Conectar sin las opciones deprecadas
            await mongoose.connect(uri);
            
            this.connected = true;
            console.log('✅ Conectado a MongoDB correctamente');

            // Manejar eventos de conexión
            mongoose.connection.on('error', (err) => {
                console.error('❌ Error de MongoDB:', err);
                this.connected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB desconectado');
                this.connected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconectado');
                this.connected = true;
            });

        } catch (error) {
            console.error('❌ Error conectando a MongoDB:', error);
            this.connected = false;
            throw error;
        }
    }

    /**
     * Desconecta de MongoDB
     */
    async disconnect() {
        try {
            await mongoose.disconnect();
            this.connected = false;
            console.log('✅ Desconectado de MongoDB');
        } catch (error) {
            console.error('❌ Error desconectando de MongoDB:', error);
            throw error;
        }
    }

    /**
     * Verifica si está conectado
     */
    isConnected() {
        return this.connected && mongoose.connection.readyState === 1;
    }

    /**
     * Obtiene el estado de la conexión
     */
    getConnectionState() {
        const states = {
            0: 'Desconectado',
            1: 'Conectado',
            2: 'Conectando',
            3: 'Desconectando'
        };
        return states[mongoose.connection.readyState] || 'Desconocido';
    }
}

module.exports = new Database();
