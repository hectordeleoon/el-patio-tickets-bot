module.exports = {
    // Language information
    language: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸'
    },

    // General commands
    commands: {
        panel: {
            description: 'Create the main ticket panel',
            created: 'Ticket panel created successfully.',
            error: 'There was an error creating the panel.'
        },
        close: {
            description: 'Close the current ticket',
            reason: 'Closing reason',
            success: 'Ticket closed successfully.',
            onlyTickets: 'This command can only be used in ticket channels.'
        },
        stats: {
            description: 'Show ticket system statistics',
            title: '📊 Ticket System Statistics',
            today: 'Today',
            totals: 'Totals',
            times: 'Times',
            byType: 'By Type (Today)',
            topStaff: 'Top Staff (Today)'
        },
        prioridad: {
            description: 'Manage ticket priorities',
            set: 'set',
            view: 'view',
            updated: 'Priority updated',
            levels: {
                urgent: '🔴 Urgent',
                high: '🟠 High',
                normal: '🟡 Normal',
                low: '🟢 Low'
            }
        },
        buscar: {
            description: 'Search tickets in the system',
            notFound: 'No results found.',
            results: 'Search results'
        },
        plantilla: {
            description: 'Manage quick response templates',
            created: 'Template created successfully.',
            deleted: 'Template deleted.',
            notFound: 'Template not found.',
            select: 'Select a template'
        },
        idioma: {
            description: 'Change bot language',
            changed: 'Language changed to **{language}**',
            current: 'Current language is: **{language}**',
            available: 'Available languages'
        }
    },

    // Ticket panel
    panel: {
        title: '🎫 SUPPORT CENTER',
        description: 'Welcome to the Official Ticket System.\n\nSelect a category to start your request.\nOur team will assist you shortly.\n\n⚠️ System abuse will be sanctioned.',
        footer: 'Official Support'
    },

    // Ticket types
    ticketTypes: {
        'soporte-general': {
            label: 'General Support',
            description: 'General help with the server',
            emoji: '🟢'
        },
        'donaciones': {
            label: 'Donations',
            description: 'Questions about donations and VIP',
            emoji: '🔵'
        },
        'apelaciones': {
            label: 'Appeals',
            description: 'Appeal sanctions or bans',
            emoji: '⚫'
        },
        'reportar-staff': {
            label: 'Report Staff',
            description: '⚠️ Report staff conduct (requires proof)',
            emoji: '🔴'
        },
        'otros': {
            label: 'Other',
            description: 'Other questions or requests',
            emoji: '🟠'
        }
    },

    // Ticket messages
    ticket: {
        created: {
            title: '👋 Greetings!',
            description: 'Describe your situation in as much detail as possible.',
            footer: 'Ticket created'
        },
        createdProof: {
            title: '⚠️ PROOF REQUIRED',
            description: 'This type of ticket requires proof.\nAttach images, videos or links.',
            footer: 'Proof required'
        },
        proofsDetected: {
            title: '✅ Proof Received',
            description: 'The proof has been registered correctly.',
            footer: 'Proof System'
        },
        claimed: {
            title: '🛎️ Ticket Claimed',
            description: 'This ticket has been claimed by {staff}',
            footer: 'Ticket in attention'
        },
        closed: {
            title: '🔒 Ticket Closed',
            description: 'Thank you for contacting our support.',
            reason: 'Reason',
            closedBy: 'Closed by',
            transcript: 'Transcript',
            footer: 'Official Support'
        },
        reopened: {
            title: '🔓 Ticket Reopened',
            description: 'This ticket has been reopened.',
            footer: 'Ticket System'
        },
        inactivity: {
            warning: {
                title: '⏰ Inactivity Warning',
                description: 'This ticket will be automatically closed in **{hours}** hours if there is no activity.',
                footer: 'Reply to keep the ticket open'
            },
            closed: {
                title: '🔒 Closed Due to Inactivity',
                description: 'This ticket has been automatically closed due to lack of activity.',
                footer: 'Automatic System'
            }
        }
    },

    // Limits and restrictions
    limits: {
        maxTickets: {
            title: '⚠️ Ticket Limit Reached',
            description: 'You already have the maximum number of open tickets allowed ({max}).',
            footer: 'Close a ticket before creating a new one'
        },
        cooldown: {
            title: '🚫 Temporarily Blocked Access',
            description: 'You have created too many tickets recently.\n\nYou will be able to create a new ticket in **{time}**.',
            footer: 'Anti-Spam System'
        },
        antiSpam: {
            title: '🚫 Limit Exceeded',
            description: 'You have created **{count}** tickets in the last 24 hours.\n\nFor anti-spam protection, your access has been temporarily blocked for **{hours}** hours.',
            footer: 'Anti-Spam System'
        }
    },

    // Rating system
    rating: {
        request: {
            title: '⭐ Rate Our Service',
            description: 'Your opinion matters!\n\nPlease rate the service you received in this ticket.\nThis helps us improve our service.',
            footer: 'Rating is anonymous for staff'
        },
        thanks: {
            title: '✅ Thank You for Your Rating!',
            description: 'You have rated this service: {stars} ({rating}/5)',
            footer: 'Your opinion helps us improve'
        },
        feedback: {
            title: '💬 Could you tell us more?',
            description: 'We are sorry your experience was not the best.\n\nIf you wish, you can write a message explaining what we could improve.\nYour feedback will be sent to the administration team.',
            footer: 'Reply in the next 5 minutes'
        },
        alreadyRated: '⚠️ You have already rated this ticket.',
        onlyCreator: '❌ Only the ticket creator can rate the service.'
    },

    // Auto-responses
    autoResponse: {
        helpful: {
            yes: {
                title: '✅ Glad we could help!',
                description: 'Your ticket will automatically close in 5 minutes.\n\nIf you need anything else, just write in the ticket.',
                footer: 'Auto-Response System'
            },
            no: {
                title: '👤 Staff will assist you soon',
                description: 'We have notified the support team.\nPlease describe your situation in more detail so we can help you better.',
                footer: 'Auto-Response System'
            }
        }
    },

    // Priorities
    priority: {
        urgent: 'Urgent',
        high: 'High',
        normal: 'Normal',
        low: 'Low',
        updated: 'Priority updated from {old} to {new}',
        notification: {
            title: '🚨 URGENT TICKET',
            description: 'A ticket has been marked as urgent and requires immediate attention.'
        }
    },

    // Status
    status: {
        open: 'Open',
        claimed: 'In Progress',
        closed: 'Closed'
    },

    // Buttons
    buttons: {
        claim: '🛎️ Claim Ticket',
        close: '🔒 Close',
        reopen: '🔓 Reopen',
        delete: '🗑️ Delete Channel',
        transcript: '📄 Transcript',
        addStaff: '➕ Add Staff',
        rate: '⭐ Rate Service',
        helpful: {
            yes: '✅ This solved my question',
            no: '❌ I need more help'
        }
    },

    // Errors
    errors: {
        generic: '❌ An error has occurred. Please try again.',
        ticketNotFound: '❌ Ticket information not found.',
        alreadyClosed: '❌ This ticket is already closed.',
        onlyTicketChannel: '❌ This command can only be used in ticket channels.',
        noPermission: '❌ You do not have permission to use this command.',
        invalidInput: '❌ Invalid input. Please verify the entered data.'
    },

    // Success messages
    success: {
        generic: '✅ Operation completed successfully.',
        ticketClaimed: '✅ Ticket claimed.',
        ticketClosed: '✅ Ticket closed.',
        ticketReopened: '✅ Ticket reopened.',
        settingSaved: '✅ Setting saved.',
        cooldownRemoved: '✅ Cooldown removed for {user}'
    },

    // Time
    time: {
        seconds: 'second(s)',
        minutes: 'minute(s)',
        hours: 'hour(s)',
        days: 'day(s)',
        weeks: 'week(s)',
        months: 'month(s)',
        years: 'year(s)',
        ago: 'ago',
        in: 'in'
    },

    // Miscellaneous
    misc: {
        loading: '⏳ Loading...',
        processing: '⏳ Processing...',
        yes: 'Yes',
        no: 'No',
        none: 'None',
        unknown: 'Unknown',
        total: 'Total',
        user: 'User',
        staff: 'Staff',
        reason: 'Reason',
        date: 'Date',
        time: 'Time',
        channel: 'Channel',
        category: 'Category',
        type: 'Type',
        id: 'ID',
        created: 'Created',
        closed: 'Closed',
        by: 'by'
    }
};
