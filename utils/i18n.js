/**
 * Sistema de Internacionalización (i18n)
 * Maneja traducciones en múltiples idiomas
 */

class LanguageSystem {
    constructor() {
        this.translations = {};
        this.userLanguages = new Map();
        this.guildLanguages = new Map();
        this.defaultLanguage = 'es';
        this.supportedLanguages = ['es', 'en', 'pt'];
    }

    async initialize() {
        console.log('🌍 Inicializando sistema de idiomas...');
        await this.loadTranslations();
        console.log('✅ Sistema de idiomas cargado');
    }

    async loadTranslations() {
        // Traducciones embebidas directamente en el código
        this.translations = {
            es: {
                language: {
                    nativeName: 'Español',
                    name: 'Spanish',
                    flag: '🇪🇸'
                },
                commands: {
                    idioma: {
                        select: 'Selecciona tu idioma',
                        current: 'Tu idioma actual es: {language}',
                        changed: 'Idioma cambiado a: {language}',
                        available: 'Idiomas disponibles'
                    }
                },
                errors: {
                    noPermission: '❌ No tienes permisos para hacer esto.'
                },
                success: {
                    settingSaved: '✅ Configuración guardada'
                },
                misc: {
                    loading: 'Cargando...',
                    user: 'Usuario',
                    server: 'Servidor'
                }
            },
            en: {
                language: {
                    nativeName: 'English',
                    name: 'English',
                    flag: '🇺🇸'
                },
                commands: {
                    idioma: {
                        select: 'Select your language',
                        current: 'Your current language is: {language}',
                        changed: 'Language changed to: {language}',
                        available: 'Available languages'
                    }
                },
                errors: {
                    noPermission: '❌ You don\'t have permission to do this.'
                },
                success: {
                    settingSaved: '✅ Setting saved'
                },
                misc: {
                    loading: 'Loading...',
                    user: 'User',
                    server: 'Server'
                }
            },
            pt: {
                language: {
                    nativeName: 'Português',
                    name: 'Portuguese',
                    flag: '🇧🇷'
                },
                commands: {
                    idioma: {
                        select: 'Selecione seu idioma',
                        current: 'Seu idioma atual é: {language}',
                        changed: 'Idioma alterado para: {language}',
                        available: 'Idiomas disponíveis'
                    }
                },
                errors: {
                    noPermission: '❌ Você não tem permissão para fazer isso.'
                },
                success: {
                    settingSaved: '✅ Configuração salva'
                },
                misc: {
                    loading: 'Carregando...',
                    user: 'Usuário',
                    server: 'Servidor'
                }
            }
        };
    }

    /**
     * Obtiene una traducción
     */
    get(key, lang = 'es', params = {}) {
        lang = lang || this.defaultLanguage;
        
        const keys = key.split('.');
        let value = this.translations[lang];
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                // Si no encuentra la clave, usar idioma por defecto
                value = this.translations[this.defaultLanguage];
                for (const k2 of keys) {
                    if (value && typeof value === 'object') {
                        value = value[k2];
                    }
                }
                break;
            }
        }

        if (typeof value === 'string') {
            // Reemplazar parámetros {param}
            return value.replace(/\{(\w+)\}/g, (match, param) => {
                return params[param] || match;
            });
        }

        return key; // Si no encuentra nada, retorna la clave
    }

    /**
     * Detecta el idioma del usuario
     */
    detectUserLanguage(interaction) {
        // 1. Idioma del usuario guardado
        if (this.userLanguages.has(interaction.user.id)) {
            return this.userLanguages.get(interaction.user.id);
        }

        // 2. Idioma del servidor
        if (interaction.guild && this.guildLanguages.has(interaction.guild.id)) {
            return this.guildLanguages.get(interaction.guild.id);
        }

        // 3. Idioma por defecto
        return this.defaultLanguage;
    }

    /**
     * Establece el idioma del usuario
     */
    setUserLanguage(userId, lang) {
        if (this.supportedLanguages.includes(lang)) {
            this.userLanguages.set(userId, lang);
            return true;
        }
        return false;
    }

    /**
     * Establece el idioma del servidor
     */
    setGuildLanguage(guildId, lang) {
        if (this.supportedLanguages.includes(lang)) {
            this.guildLanguages.set(guildId, lang);
            return true;
        }
        return false;
    }

    /**
     * Obtiene el idioma del usuario
     */
    getUserLanguage(userId) {
        return this.userLanguages.get(userId) || this.defaultLanguage;
    }

    /**
     * Obtiene el idioma del servidor
     */
    getGuildLanguage(guildId) {
        return this.guildLanguages.get(guildId) || this.defaultLanguage;
    }

    /**
     * Obtiene lista de idiomas soportados
     */
    getSupportedLanguages() {
        return this.supportedLanguages.map(lang => ({
            code: lang,
            name: this.translations[lang].language.name,
            nativeName: this.translations[lang].language.nativeName,
            flag: this.translations[lang].language.flag
        }));
    }
}

// Singleton
const i18n = new LanguageSystem();

module.exports = i18n;
