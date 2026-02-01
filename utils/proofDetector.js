const config = require('../config/config');

class ProofDetector {
    constructor() {
        // Patrones para detectar enlaces
        this.urlPatterns = [
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
            /discord\.gg\/[a-zA-Z0-9]+/gi,
            /twitch\.tv\/[a-zA-Z0-9_]+/gi,
            /youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/gi,
            /youtu\.be\/[a-zA-Z0-9_-]+/gi,
            /streamable\.com\/[a-zA-Z0-9]+/gi,
            /clips\.twitch\.tv\/[a-zA-Z0-9]+/gi
        ];

        // Extensiones de imagen
        this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

        // Extensiones de video
        this.videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
    }

    /**
     * Detecta si un mensaje contiene pruebas
     * @param {string} content - Contenido del mensaje
     * @param {Array} attachments - Archivos adjuntos
     * @returns {Object} - { hasProof, proofUrls, proofTypes }
     */
    detectProofs(content, attachments = []) {
        const proofUrls = [];
        const proofTypes = [];

        // 1. Detectar URLs en el contenido
        const urls = this.extractUrls(content);
        if (urls.length > 0) {
            proofUrls.push(...urls);
            proofTypes.push('link');
        }

        // 2. Detectar archivos adjuntos
        if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
                const url = attachment.url || attachment.proxyURL;
                if (url) {
                    proofUrls.push(url);
                    
                    // Determinar tipo de archivo
                    if (this.isImage(url)) {
                        proofTypes.push('image');
                    } else if (this.isVideo(url)) {
                        proofTypes.push('video');
                    } else {
                        proofTypes.push('file');
                    }
                }
            }
        }

        return {
            hasProof: proofUrls.length > 0,
            proofUrls: [...new Set(proofUrls)], // Eliminar duplicados
            proofTypes: [...new Set(proofTypes)]
        };
    }

    /**
     * Extrae todas las URLs de un texto
     * @param {string} text - Texto a analizar
     * @returns {Array} - Array de URLs encontradas
     */
    extractUrls(text) {
        const urls = [];
        
        for (const pattern of this.urlPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                urls.push(...matches);
            }
        }

        return [...new Set(urls)]; // Eliminar duplicados
    }

    /**
     * Verifica si una URL es una imagen
     * @param {string} url - URL a verificar
     * @returns {boolean}
     */
    isImage(url) {
        const lowerUrl = url.toLowerCase();
        return this.imageExtensions.some(ext => lowerUrl.includes(ext));
    }

    /**
     * Verifica si una URL es un video
     * @param {string} url - URL a verificar
     * @returns {boolean}
     */
    isVideo(url) {
        const lowerUrl = url.toLowerCase();
        return this.videoExtensions.some(ext => lowerUrl.includes(ext)) ||
               lowerUrl.includes('youtube.com') ||
               lowerUrl.includes('youtu.be') ||
               lowerUrl.includes('twitch.tv') ||
               lowerUrl.includes('clips.twitch.tv') ||
               lowerUrl.includes('streamable.com');
    }

    /**
     * Genera un mensaje descriptivo sobre las pruebas detectadas
     * @param {Object} proofData - Datos de las pruebas detectadas
     * @returns {string}
     */
    getProofSummary(proofData) {
        if (!proofData.hasProof) {
            return 'No se detectaron pruebas en este mensaje.';
        }

        const types = proofData.proofTypes;
        const count = proofData.proofUrls.length;
        
        let summary = `✅ **Se detectaron ${count} prueba(s):**\n`;
        
        if (types.includes('link')) {
            const linkCount = proofData.proofUrls.filter(url => 
                !this.isImage(url) && !this.isVideo(url)
            ).length;
            if (linkCount > 0) {
                summary += `🔗 ${linkCount} enlace(s)\n`;
            }
        }
        
        if (types.includes('image')) {
            const imageCount = proofData.proofUrls.filter(url => this.isImage(url)).length;
            if (imageCount > 0) {
                summary += `🖼️ ${imageCount} imagen(es)\n`;
            }
        }
        
        if (types.includes('video')) {
            const videoCount = proofData.proofUrls.filter(url => this.isVideo(url)).length;
            if (videoCount > 0) {
                summary += `🎥 ${videoCount} video(s)\n`;
            }
        }

        return summary;
    }

    /**
     * Valida si las pruebas son suficientes para un reporte
     * @param {Object} proofData - Datos de las pruebas
     * @returns {boolean}
     */
    areProofsSufficient(proofData) {
        // Para reportes de staff, se requiere al menos una prueba
        return proofData.hasProof && proofData.proofUrls.length > 0;
    }
}

module.exports = new ProofDetector();
