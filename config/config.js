require('dotenv').config();

module.exports = {
    /* =======================
       DISCORD
    ======================= */
    discord: {
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.GUILD_ID,
        clientId: process.env.CLIENT_ID
    },

    /* =======================
       CANALES
    ======================= */
    channels: {
        panel: process.env.PANEL_CHANNEL_ID,
        logs: process.env.LOG_CHANNEL_ID,
        staffChat: process.env.STAFF_CHAT_CHANNEL_ID, // 🔔 ALERTAS STAFF
        test: process.env.TEST_CHANNEL_ID || null
    },

    /* =======================
       CATEGORÍAS
    ======================= */
    categories: {
        open: process.env.OPEN_CATEGORY_ID,
        closed: process.env.CLOSED_CATEGORY_ID
    },

    /* =======================
       ROLES
    ======================= */
    roles: {
        support: process.env.SUPPORT_ROLE_ID,
        finance: process.env.FINANCE_ROLE_ID,
        moderator: process.env.MODERATOR_ROLE_ID,
        admin: process.env.ADMIN_ROLE_ID,
        seniorAdmin: process.env.SENIOR_ADMIN_ROLE_ID,

        // 🔥 ROL PRINCIPAL DE STAFF (para quitarlo automáticamente)
        staff: process.env.STAFF_ROLE_ID
    },

    /* =======================
       SANCIONES STAFF
    ======================= */
    staffSanctions: {
        warnAfter: 1,          // advertencia
        timeoutAfter: 2,       // timeout automático
        removeRoleAfter: 3,    // ❌ quitar rol staff
        timeoutDuration: 60    // minutos (1h)
    },

    /* =======================
       BASE DE DATOS
    ======================= */
    database: {
        mongoUri:
            process.env.MONGODB_URI ||
            'mongodb://localhost:27017/elpatio_tickets'
    },

    /* =======================
       SISTEMA
    ======================= */
    system: {
        inactivityWarning: parseInt(process.env.INACTIVITY_WARNING_TIME) || 42,
        inactivityClose: parseInt(process.env.INACTIVITY_CLOSE_TIME) || 44,
        maxTicketsPerUser: parseInt(process.env.MAX_TICKETS_PER_USER) || 3,
        ticketLimit24h: parseInt(process.env.TICKET_LIMIT_24H) || 3,
        antiSpamEnabled: process.env.ANTI_SPAM_ENABLED === 'true',
        dmNotifications: process.env.DM_NOTIFICATIONS === 'true',
        autoTranscripts: process.env.AUTO_TRANSCRIPTS === 'true',
        transcriptFormat: process.env.TRANSCRIPT_FORMAT || 'both'
    },

    /* =======================
       BRANDING
    ======================= */
    branding: {
        serverName: process.env.SERVER_NAME || 'EL PATIO RP',
        panelGif: process.env.PANEL_GIF_URL || '',
        panelThumbnail: process.env.PANEL_THUMBNAIL_URL || '',
        colors: {
            primary: '#1b1e26',
            accent: '#f39c12',
            border: '#3498db',
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c',
            supportGeneral: '#27ae60',
            donaciones: '#3498db',
            apelaciones: '#95a5a6',
            reportarStaff: '#e74c3c',
            otros: '#f39c12'
        }
    },

    /* =======================
       TIPOS DE TICKETS
    ======================= */
    ticketTypes: {
        'soporte-general': {
            emoji: '🟢',
            label: 'Soporte General',
            description: 'Ayuda general con el servidor',
            color: '#27ae60',
            roles: ['support', 'admin', 'seniorAdmin'],
            requiresProof: false
        },
        'donaciones': {
            emoji: '🔵',
            label: 'Donaciones',
            description: 'Consultas sobre donaciones y VIP',
            color: '#3498db',
            roles: ['finance', 'admin', 'seniorAdmin'],
            requiresProof: false
        },
        'apelaciones': {
            emoji: '⚫',
            label: 'Apelaciones',
            description: 'Apelar sanciones o baneos',
            color: '#95a5a6',
            roles: ['moderator', 'admin', 'seniorAdmin'],
            requiresProof: false
        },
        'reportar-staff': {
            emoji: '🔴',
            label: 'Reportar Staff',
            description: '⚠️ Reportar conducta de staff (requiere pruebas)',
            color: '#e74c3c',
            roles: ['seniorAdmin'],
            requiresProof: true
        },
        'otros': {
            emoji: '🟠',
            label: 'Otros',
            description: 'Otras consultas o solicitudes',
            color: '#f39c12',
            roles: ['support', 'admin', 'seniorAdmin'],
            requiresProof: false
        }
    },

    /* =======================
       MENSAJES
    ======================= */
    messages: {
        panelTitle: '🎫 CENTRO DE ATENCIÓN – EL PATIO RP',
        panelDescription: `Bienvenido al Sistema Oficial de Tickets de EL PATIO RP.

Selecciona una categoría para iniciar tu solicitud.
Nuestro equipo te atenderá a la brevedad.

📌 **¿Cómo funciona?**
1️⃣ Elige una categoría
2️⃣ Describe tu situación
3️⃣ Un staff atenderá tu caso

⚠️ **Importante**
• Reportes sin pruebas pueden no proceder
• El abuso del sistema será sancionado
• Mantén respeto en todo momento`,

        ticketCreated:
            '👋 **Saludos!**\n\nGracias por contactarnos. Por favor, detállanos tu situación lo más claro posible.\n\nUn miembro del staff atenderá tu ticket a la brevedad.',

        ticketCreatedProof:
            '⚠️ **REPORTE DE STAFF - PRUEBAS OBLIGATORIAS**\n\nAdjunta pruebas válidas para continuar.',

        proofsDetected:
            '✅ **Pruebas recibidas y verificadas**\n\nTu reporte ha sido registrado correctamente.',

        ticketClaimed:
            '✅ **Ticket asignado**\n\nEste ticket está siendo atendido por {staff}.',

        inactivityWarning:
            '⚠️ **Aviso de Inactividad**\n\nEste ticket se cerrará automáticamente si no hay respuesta.',

        ticketClosed:
            '🔒 **Ticket Cerrado**\n\nGracias por contactar a EL PATIO RP.',

        maxTicketsReached:
            '⚠️ **Límite de Tickets Alcanzado**',

        antiSpamWarning:
            '⚠️ **Sistema Anti-Spam Activado**'
    },

    /* =======================
       DESARROLLO
    ======================= */
    dev: {
        enabled: process.env.DEV_MODE === 'true',
        logLevel: 'debug'
    }
};
