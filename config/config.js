require('dotenv').config();

module.exports = {
    // Configuración de Discord
    discord: {
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.GUILD_ID,
        clientId: process.env.CLIENT_ID
    },

    // Canales
    channels: {
        panel: process.env.PANEL_CHANNEL_ID,
        logs: process.env.LOG_CHANNEL_ID,
        test: process.env.TEST_CHANNEL_ID || null
    },

    // Categorías
    categories: {
        open: process.env.OPEN_CATEGORY_ID,
        closed: process.env.CLOSED_CATEGORY_ID
    },

    // Roles de Staff
    roles: {
        support: process.env.SUPPORT_ROLE_ID,
        finance: process.env.FINANCE_ROLE_ID,
        moderator: process.env.MODERATOR_ROLE_ID,
        admin: process.env.ADMIN_ROLE_ID,
        seniorAdmin: process.env.SENIOR_ADMIN_ROLE_ID
    },

    // Base de datos
    database: {
        mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/elpatio_tickets'
    },

    // Configuración del sistema
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

    // Personalización visual
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

    // Tipos de tickets
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

    // Mensajes del sistema
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
        
        ticketCreated: '👋 **Saludos!**\n\nGracias por contactarnos. Por favor, detállanos tu situación lo más claro posible.\n\nUn miembro del staff atenderá tu ticket a la brevedad.',
        
        ticketCreatedProof: '⚠️ **REPORTE DE STAFF - PRUEBAS OBLIGATORIAS**\n\nPara proceder con tu reporte, es **OBLIGATORIO** adjuntar pruebas válidas:\n\n✅ **Pruebas aceptadas:**\n🔗 Links (clips de Twitch, videos de YouTube, etc.)\n🖼️ Imágenes (capturas de pantalla)\n🎥 Videos (.mp4, .mov, etc.)\n\n❌ **Reportes sin pruebas pueden ser cerrados sin revisión.**\n\nPor favor, adjunta tus pruebas en el siguiente mensaje.',
        
        proofsDetected: '✅ **Pruebas recibidas y verificadas**\n\nTu reporte ha sido registrado correctamente. Un administrador superior revisará el caso.',
        
        ticketClaimed: '✅ **Ticket asignado**\n\nEste ticket ahora está siendo atendido por {staff}.\nOtros miembros del staff pueden ver la conversación pero solo {staff} puede responder.',
        
        inactivityWarning: '⚠️ **Aviso de Inactividad**\n\nEste ticket se cerrará automáticamente en **2 horas** por falta de actividad.\n\nSi aún necesitas ayuda, envía un mensaje para mantener el ticket abierto.',
        
        ticketClosed: '🔒 **Ticket Cerrado**\n\nEste ticket ha sido cerrado. Se ha generado una transcripción completa para nuestros registros.\n\nSi necesitas ayuda adicional, puedes abrir un nuevo ticket en el panel principal.',
        
        maxTicketsReached: '⚠️ **Límite de Tickets Alcanzado**\n\nYa tienes {count} tickets abiertos. Por favor, espera a que se cierren antes de abrir uno nuevo.\n\nEsto ayuda a mantener un servicio de calidad para todos.',
        
        antiSpamWarning: '⚠️ **Sistema Anti-Spam**\n\nHas alcanzado el límite de {count} tickets en 24 horas.\nPor favor, espera antes de abrir nuevos tickets.\n\nSi es urgente, contacta a un administrador directamente.'
    },

    // Modo desarrollo
    dev: {
        enabled: process.env.DEV_MODE === 'true',
        logLevel: 'debug'
    }
};
