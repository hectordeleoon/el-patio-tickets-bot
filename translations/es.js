module.exports = {
    // Información del idioma
    language: {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸'
    },

    // Comandos generales
    commands: {
        panel: {
            description: 'Crea el panel principal de tickets',
            created: 'Panel de tickets creado exitosamente.',
            error: 'Hubo un error al crear el panel.'
        },
        close: {
            description: 'Cierra el ticket actual',
            reason: 'Razón del cierre',
            success: 'Ticket cerrado exitosamente.',
            onlyTickets: 'Este comando solo puede usarse en canales de tickets.'
        },
        stats: {
            description: 'Muestra estadísticas del sistema de tickets',
            title: '📊 Estadísticas del Sistema de Tickets',
            today: 'Hoy',
            totals: 'Totales',
            times: 'Tiempos',
            byType: 'Por Tipo (Hoy)',
            topStaff: 'Top Staff (Hoy)'
        },
        prioridad: {
            description: 'Gestiona la prioridad de tickets',
            set: 'establecer',
            view: 'ver',
            updated: 'Prioridad actualizada',
            levels: {
                urgent: '🔴 Urgente',
                high: '🟠 Alta',
                normal: '🟡 Normal',
                low: '🟢 Baja'
            }
        },
        buscar: {
            description: 'Busca tickets en el sistema',
            notFound: 'No se encontraron resultados.',
            results: 'Resultados de búsqueda'
        },
        plantilla: {
            description: 'Gestiona plantillas de respuesta rápida',
            created: 'Plantilla creada exitosamente.',
            deleted: 'Plantilla eliminada.',
            notFound: 'Plantilla no encontrada.',
            select: 'Selecciona una plantilla'
        },
        idioma: {
            description: 'Cambia el idioma del bot',
            changed: 'Idioma cambiado a **{language}**',
            current: 'El idioma actual es: **{language}**',
            available: 'Idiomas disponibles'
        }
    },

    // Panel de tickets
    panel: {
        title: '🎫 CENTRO DE ATENCIÓN',
        description: 'Bienvenido al Sistema Oficial de Tickets.\n\nSelecciona una categoría para iniciar tu solicitud.\nNuestro equipo te atenderá a la brevedad.\n\n⚠️ El abuso del sistema será sancionado.',
        footer: 'Soporte Oficial'
    },

    // Tipos de tickets
    ticketTypes: {
        'soporte-general': {
            label: 'Soporte General',
            description: 'Ayuda general con el servidor',
            emoji: '🟢'
        },
        'donaciones': {
            label: 'Donaciones',
            description: 'Consultas sobre donaciones y VIP',
            emoji: '🔵'
        },
        'apelaciones': {
            label: 'Apelaciones',
            description: 'Apelar sanciones o baneos',
            emoji: '⚫'
        },
        'reportar-staff': {
            label: 'Reportar Staff',
            description: '⚠️ Reportar conducta de staff (requiere pruebas)',
            emoji: '🔴'
        },
        'otros': {
            label: 'Otros',
            description: 'Otras consultas o solicitudes',
            emoji: '🟠'
        }
    },

    // Mensajes de tickets
    ticket: {
        created: {
            title: '👋 ¡Saludos!',
            description: 'Describe tu situación con el mayor detalle posible.',
            footer: 'Ticket creado'
        },
        createdProof: {
            title: '⚠️ PRUEBAS OBLIGATORIAS',
            description: 'Este tipo de ticket requiere pruebas.\nAdjunta imágenes, videos o enlaces.',
            footer: 'Pruebas requeridas'
        },
        proofsDetected: {
            title: '✅ Pruebas Recibidas',
            description: 'Las pruebas han sido registradas correctamente.',
            footer: 'Sistema de Pruebas'
        },
        claimed: {
            title: '🛎️ Ticket Reclamado',
            description: 'Este ticket ha sido reclamado por {staff}',
            footer: 'Ticket en atención'
        },
        closed: {
            title: '🔒 Ticket Cerrado',
            description: 'Gracias por contactar con nuestro soporte.',
            reason: 'Razón',
            closedBy: 'Cerrado por',
            transcript: 'Transcripción',
            footer: 'Soporte Oficial'
        },
        reopened: {
            title: '🔓 Ticket Reabierto',
            description: 'Este ticket ha sido reabierto.',
            footer: 'Sistema de Tickets'
        },
        inactivity: {
            warning: {
                title: '⏰ Aviso de Inactividad',
                description: 'Este ticket se cerrará automáticamente en **{hours}** horas si no hay actividad.',
                footer: 'Responde para mantener el ticket abierto'
            },
            closed: {
                title: '🔒 Cerrado por Inactividad',
                description: 'Este ticket ha sido cerrado automáticamente debido a la falta de actividad.',
                footer: 'Sistema Automático'
            }
        }
    },

    // Límites y restricciones
    limits: {
        maxTickets: {
            title: '⚠️ Límite de Tickets Alcanzado',
            description: 'Ya tienes el máximo de tickets abiertos permitidos ({max}).',
            footer: 'Cierra un ticket antes de crear uno nuevo'
        },
        cooldown: {
            title: '🚫 Acceso Temporal Bloqueado',
            description: 'Has creado demasiados tickets recientemente.\n\nPodrás crear un nuevo ticket en **{time}**.',
            footer: 'Sistema Anti-Spam'
        },
        antiSpam: {
            title: '🚫 Límite Excedido',
            description: 'Has creado **{count}** tickets en las últimas 24 horas.\n\nPor protección anti-spam, tu acceso ha sido bloqueado temporalmente por **{hours}** horas.',
            footer: 'Sistema Anti-Spam'
        }
    },

    // Sistema de calificación
    rating: {
        request: {
            title: '⭐ Califica Nuestro Servicio',
            description: '¡Tu opinión es importante!\n\nPor favor califica la atención que recibiste en este ticket.\nEsto nos ayuda a mejorar nuestro servicio.',
            footer: 'La calificación es anónima para el staff'
        },
        thanks: {
            title: '✅ ¡Gracias por tu Calificación!',
            description: 'Has calificado este servicio con: {stars} ({rating}/5)',
            footer: 'Tu opinión nos ayuda a mejorar'
        },
        feedback: {
            title: '💬 ¿Podrías decirnos más?',
            description: 'Lamentamos que tu experiencia no haya sido la mejor.\n\nSi deseas, puedes escribir un mensaje explicando qué podríamos mejorar.\nTu feedback será enviado al equipo de administración.',
            footer: 'Responde en los próximos 5 minutos'
        },
        alreadyRated: '⚠️ Ya has calificado este ticket.',
        onlyCreator: '❌ Solo el creador del ticket puede calificar el servicio.'
    },

    // Auto-respuestas
    autoResponse: {
        helpful: {
            yes: {
                title: '✅ ¡Nos alegra haber ayudado!',
                description: 'Tu ticket se cerrará automáticamente en 5 minutos.\n\nSi necesitas algo más, simplemente escribe en el ticket.',
                footer: 'Sistema de Auto-Respuestas'
            },
            no: {
                title: '👤 Un staff te atenderá pronto',
                description: 'Hemos notificado al equipo de soporte.\nPor favor, describe con más detalle tu situación para que podamos ayudarte mejor.',
                footer: 'Sistema de Auto-Respuestas'
            }
        }
    },

    // Prioridades
    priority: {
        urgent: 'Urgente',
        high: 'Alta',
        normal: 'Normal',
        low: 'Baja',
        updated: 'Prioridad actualizada de {old} a {new}',
        notification: {
            title: '🚨 TICKET URGENTE',
            description: 'Se ha marcado un ticket como urgente y requiere atención inmediata.'
        }
    },

    // Estados
    status: {
        open: 'Abierto',
        claimed: 'En Atención',
        closed: 'Cerrado'
    },

    // Botones
    buttons: {
        claim: '🛎️ Atender Ticket',
        close: '🔒 Cerrar',
        reopen: '🔓 Reabrir',
        delete: '🗑️ Eliminar Canal',
        transcript: '📄 Transcripción',
        addStaff: '➕ Añadir Staff',
        rate: '⭐ Calificar Servicio',
        helpful: {
            yes: '✅ Esto resolvió mi duda',
            no: '❌ Necesito más ayuda'
        }
    },

    // Errores
    errors: {
        generic: '❌ Ha ocurrido un error. Por favor, intenta de nuevo.',
        ticketNotFound: '❌ No se encontró información de este ticket.',
        alreadyClosed: '❌ Este ticket ya está cerrado.',
        onlyTicketChannel: '❌ Este comando solo puede usarse en canales de tickets.',
        noPermission: '❌ No tienes permisos para usar este comando.',
        invalidInput: '❌ Entrada inválida. Por favor, verifica los datos ingresados.'
    },

    // Éxitos
    success: {
        generic: '✅ Operación completada exitosamente.',
        ticketClaimed: '✅ Ticket reclamado.',
        ticketClosed: '✅ Ticket cerrado.',
        ticketReopened: '✅ Ticket reabierto.',
        settingSaved: '✅ Configuración guardada.',
        cooldownRemoved: '✅ Cooldown removido para {user}'
    },

    // Tiempos
    time: {
        seconds: 'segundo(s)',
        minutes: 'minuto(s)',
        hours: 'hora(s)',
        days: 'día(s)',
        weeks: 'semana(s)',
        months: 'mes(es)',
        years: 'año(s)',
        ago: 'hace',
        in: 'en'
    },

    // Varios
    misc: {
        loading: '⏳ Cargando...',
        processing: '⏳ Procesando...',
        yes: 'Sí',
        no: 'No',
        none: 'Ninguno',
        unknown: 'Desconocido',
        total: 'Total',
        user: 'Usuario',
        staff: 'Staff',
        reason: 'Razón',
        date: 'Fecha',
        time: 'Hora',
        channel: 'Canal',
        category: 'Categoría',
        type: 'Tipo',
        id: 'ID',
        created: 'Creado',
        closed: 'Cerrado',
        by: 'por'
    }
};
