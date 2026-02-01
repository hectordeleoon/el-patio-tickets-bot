const fs = require('fs').promises;
const path = require('path');

/**
 * Sistema Multi-Idioma (i18n)
 * Soporta múltiples idiomas para el bot de tickets
 */

class LanguageSystem {
    constructor() {
        this.languages = new Map();
        this.defaultLanguage = 'es';
        this.supportedLanguages = ['es', 'en', 'pt'];
        this.userLanguages = new Map(); // userId -> languageCode
        this.guildLanguages = new Map(); // guildId -> languageCode
    }

    /**
     * Inicializa el sistema de idiomas cargando traducciones
     */
    async initialize() {
        const translationsDir = path.join(__dirname, '../translations');
        
        try {
            await fs.mkdir(translationsDir, { recursive: true });
        } catch (error) {
            console.error('Error creating translations directory:', error);
        }

        // Cargar traducciones
        for (const lang of this.supportedLanguages) {
            try {
                const translations = await this.loadTranslations(lang);
                this.languages.set(lang, translations);
                console.log(`✅ Idioma cargado: ${lang}`);
            } catch (error) {
                console.error(`Error cargando idioma ${lang}:`, error);
                // Si falla, usar traducciones por defecto
                this.languages.set(lang, this.getDefaultTranslations(lang));
            }
        }
    }

    /**
     * Carga traducciones desde archivo JSON
     */
    async loadTranslations(langCode) {
        const filePath = path.join(__dirname, '../translations', `${langCode}.json`);
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Si el archivo no existe, crear uno con traducciones por defecto
            const defaultTranslations = this.getDefaultTranslations(langCode);
            await fs.writeFile(filePath, JSON.stringify(defaultTranslations, null, 2), 'utf8');
            return defaultTranslations;
        }
    }

    /**
     * Obtiene traducciones por defecto según el idioma
     */
    getDefaultTranslations(langCode) {
        const translations = {
            es: require('./translations/es'),
            en: require('./translations/en'),
            pt: require('./translations/pt')
        };

        return translations[langCode] || translations.es;
    }

    /**
     * Obtiene una traducción
     */
    get(key, langCode = null, replacements = {}) {
        const lang = langCode || this.defaultLanguage;
        const translations = this.languages.get(lang) || this.languages.get(this.defaultLanguage);

        // Navegar por el objeto de traducciones usando la key
        let value = translations;
        const keys = key.split('.');
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Si no se encuentra la traducción, usar el idioma por defecto
                return this.get(key, this.defaultLanguage, replacements);
            }
        }

        // Reemplazar variables
        if (typeof value === 'string') {
            return this.replaceVariables(value, replacements);
        }

        return value;
    }

    /**
     * Reemplaza variables en una cadena
     */
    replaceVariables(text, replacements) {
        let result = text;
        
        for (const [key, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }

        return result;
    }

    /**
     * Establece el idioma de un usuario
     */
    setUserLanguage(userId, langCode) {
        if (this.supportedLanguages.includes(langCode)) {
            this.userLanguages.set(userId, langCode);
            return true;
        }
        return false;
    }

    /**
     * Obtiene el idioma de un usuario
     */
    getUserLanguage(userId) {
        return this.userLanguages.get(userId) || this.defaultLanguage;
    }

    /**
     * Establece el idioma de un servidor
     */
    setGuildLanguage(guildId, langCode) {
        if (this.supportedLanguages.includes(langCode)) {
            this.guildLanguages.set(guildId, langCode);
            return true;
        }
        return false;
    }

    /**
     * Obtiene el idioma de un servidor
     */
    getGuildLanguage(guildId) {
        return this.guildLanguages.get(guildId) || this.defaultLanguage;
    }

    /**
     * Detecta automáticamente el idioma preferido del usuario
     */
    detectUserLanguage(interaction) {
        // Prioridad: Usuario > Servidor > Locale de Discord > Default
        
        const userId = interaction.user.id;
        if (this.userLanguages.has(userId)) {
            return this.userLanguages.get(userId);
        }

        const guildId = interaction.guild?.id;
        if (guildId && this.guildLanguages.has(guildId)) {
            return this.guildLanguages.get(guildId);
        }

        // Usar locale de Discord
        const discordLocale = interaction.locale || interaction.guild?.preferredLocale;
        if (discordLocale) {
            const langCode = discordLocale.split('-')[0]; // 'es-ES' -> 'es'
            if (this.supportedLanguages.includes(langCode)) {
                return langCode;
            }
        }

        return this.defaultLanguage;
    }

    /**
     * Obtiene todas las traducciones de una clave en todos los idiomas
     */
    getAllTranslations(key) {
        const result = {};
        
        for (const [langCode, translations] of this.languages.entries()) {
            result[langCode] = this.get(key, langCode);
        }

        return result;
    }

    /**
     * Obtiene información sobre idiomas soportados
     */
    getSupportedLanguages() {
        return this.supportedLanguages.map(code => ({
            code,
            name: this.get('language.name', code),
            nativeName: this.get('language.nativeName', code),
            flag: this.get('language.flag', code)
        }));
    }
}

// Singleton
const languageSystem = new LanguageSystem();

// Inicializar al importar
languageSystem.initialize().catch(console.error);

module.exports = languageSystem;
