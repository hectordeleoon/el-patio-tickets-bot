# 🎫 EL PATIO RP - Sistema de Tickets Premium

Bot profesional de tickets para Discord/FiveM con detección automática de pruebas, sistema CLAIM, cierre automático por inactividad y mucho más.

---

## ✨ Características Principales

✅ **100% Botones** - Sin comandos complicados para usuarios  
✅ **5 Tipos de Tickets** - Soporte, Donaciones, Apelaciones, Reportes, Otros  
✅ **Sistema CLAIM** - Solo 1 staff por ticket  
✅ **Detección Automática de Pruebas** - Reconoce links, imágenes y videos  
✅ **Cierre Automático** - 42h advertencia, 44h cierre automático  
✅ **Transcripciones** - Formatos TXT y HTML  
✅ **Sistema de Logs** - Auditoría completa  
✅ **Estadísticas** - Métricas en tiempo real  
✅ **Anti-Spam** - Límites configurables  

---

## 📋 Requisitos Previos

- **Node.js** v16.9.0 o superior
- **MongoDB** (local o MongoDB Atlas)
- **Cuenta de Discord Developer** con bot creado
- **Servidor de Discord** con permisos de administrador

---

## 🚀 Instalación Rápida

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar con tus datos
nano .env  # o usa tu editor favorito
```

### 3. Configurar el Bot en Discord

#### A) Crear Aplicación y Bot

1. Ve a https://discord.com/developers/applications
2. Clic en "New Application"
3. Dale un nombre: "EL PATIO Tickets"
4. En la sección "Bot":
   - Clic en "Add Bot"
   - Copia el **TOKEN** (guárdalo para el .env)
   - Activa estas opciones:
     - ✅ Presence Intent
     - ✅ Server Members Intent
     - ✅ Message Content Intent

#### B) Obtener IDs Necesarios

**CLIENT_ID:**
- En "General Information" → Application ID

**GUILD_ID:**
- Discord → Click derecho en tu servidor → Copiar ID
- (Debes tener Modo Desarrollador activado en Discord)

#### C) Invitar el Bot

URL de invitación (reemplaza CLIENT_ID):
```
https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

### 4. Configurar MongoDB

#### Opción A: MongoDB Local

```bash
# Instalar MongoDB localmente
# Ubuntu/Debian
sudo apt-get install mongodb

# macOS
brew install mongodb-community

# Iniciar servicio
sudo systemctl start mongodb
```

En `.env`:
```
MONGODB_URI=mongodb://localhost:27017/elpatio_tickets
```

#### Opción B: MongoDB Atlas (Nube - RECOMENDADO)

1. Ve a https://www.mongodb.com/cloud/atlas
2. Crea cuenta gratuita
3. Crea un cluster gratuito (M0)
4. En "Database Access" → Crea un usuario con contraseña
5. En "Network Access" → Añade tu IP (o 0.0.0.0/0 para acceso desde cualquier lugar)
6. En "Clusters" → Connect → "Connect your application"
7. Copia la cadena de conexión

En `.env`:
```
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/elpatio_tickets
```

### 5. Configurar Discord (Roles y Canales)

#### A) Crear Roles (en este orden)

1. **🤖 Ticket Bot** (ROL MÁS ALTO - CRÍTICO)
2. **👑 Admin Superior**
3. **👑 Admin**
4. **🛡️ Moderador**
5. **💰 Finanzas**
6. **🛠️ Soporte**

**Copiar IDs de roles:**
- Click derecho en rol → Copiar ID
- Pegar en `.env`

#### B) Crear Categorías

1. **🎫┃Tickets Abiertos**
2. **🔒┃Tickets Cerrados**

**Permisos en categorías:**
- @everyone: ❌ Ver canal
- Ticket Bot: ✅ Todos los permisos
- Roles de staff: ✅ Ver canal (se ajustará automáticamente)

**Copiar IDs de categorías:**
- Click derecho en categoría → Copiar ID
- Pegar en `.env`

#### C) Crear Canales

1. **🎫┃ticket-panel** (en cualquier categoría)
   - Permisos:
     - @everyone: ✅ Ver canal, ❌ Enviar mensajes
     - Ticket Bot: ✅ Todos los permisos

2. **📑┃logs-tickets** (canal privado)
   - Permisos:
     - @everyone: ❌ Ver canal
     - Admins: ✅ Ver canal
     - Ticket Bot: ✅ Todos los permisos

**Copiar IDs de canales:**
- Click derecho en canal → Copiar ID
- Pegar en `.env`

### 6. Desplegar Comandos Slash

```bash
npm run deploy
```

Deberías ver:
```
✅ 3 comando(s) desplegado(s) exitosamente!
```

### 7. Iniciar el Bot

```bash
npm start
```

Deberías ver:
```
✅ Bot conectado como EL PATIO Tickets#1234
✅ Conectado a MongoDB correctamente
🎫 Sistema de Tickets: ACTIVO
```

---

## 🎮 Uso del Bot

### Para Administradores

1. **Crear Panel de Tickets**
   ```
   /panel
   ```
   Esto creará el panel visual con botones en el canal actual.

2. **Ver Estadísticas**
   ```
   /stats
   ```

3. **Cerrar Ticket Manualmente**
   ```
   /close [razón]
   ```

### Para Usuarios

1. Hacer clic en el botón correspondiente en el panel
2. Se crea un canal privado automáticamente
3. Describir la situación
4. Esperar a que un staff atienda

### Para Staff

1. Ver tickets nuevos en la categoría "🎫┃Tickets Abiertos"
2. Hacer clic en "🛎️ Atender Ticket"
3. Resolver la situación
4. Hacer clic en "🔒 Cerrar Ticket" o usar `/close`

---

## ⚙️ Configuración Avanzada

### Personalizar Colores

Edita `config/config.js`:

```javascript
colors: {
    primary: '#1b1e26',    // Color base
    accent: '#f39c12',     // Dorado
    success: '#27ae60',    // Verde
    // ...
}
```

### Cambiar Tiempos de Inactividad

En `.env`:

```env
INACTIVITY_WARNING_TIME=42  # Horas antes de advertir
INACTIVITY_CLOSE_TIME=44    # Horas antes de cerrar
```

### Agregar GIF Animado al Panel

En `.env`:

```env
PANEL_GIF_URL=https://ejemplo.com/tu-gif.gif
PANEL_THUMBNAIL_URL=https://ejemplo.com/logo.png
```

**Importante:** El GIF debe ser menor a 3MB.

### Configurar Límites Anti-Spam

En `.env`:

```env
MAX_TICKETS_PER_USER=3     # Máximo de tickets abiertos simultáneos
TICKET_LIMIT_24H=3         # Máximo de tickets en 24 horas
ANTI_SPAM_ENABLED=true     # Activar/desactivar
```

---

## 📁 Estructura del Proyecto

```
el-patio-ticket-bot/
├── commands/              # Comandos slash
│   ├── panel.js
│   ├── stats.js
│   └── close.js
├── config/                # Configuración
│   └── config.js
├── events/                # Eventos de Discord
│   ├── ready.js
│   ├── interactionCreate.js
│   └── messageCreate.js
├── models/                # Modelos de MongoDB
│   ├── Ticket.js
│   └── Stats.js
├── utils/                 # Utilidades
│   ├── database.js
│   ├── proofDetector.js
│   └── transcriptGenerator.js
├── transcripts/           # Transcripciones guardadas (auto-generado)
├── .env                   # Variables de entorno (NO SUBIR A GIT)
├── .env.example           # Ejemplo de variables
├── index.js               # Archivo principal
├── deploy-commands.js     # Script para registrar comandos
├── package.json           # Dependencias
└── README.md              # Este archivo
```

---

## 🔧 Comandos NPM Disponibles

```bash
npm start          # Iniciar el bot
npm run dev        # Modo desarrollo con auto-restart (requiere nodemon)
npm run deploy     # Desplegar comandos slash
```

---

## 🐛 Solución de Problemas

### El bot no se conecta

- ✅ Verifica que el TOKEN en `.env` sea correcto
- ✅ Asegúrate de que los Intents estén activados en Discord Developer Portal
- ✅ Verifica que el bot esté en el servidor

### Los comandos no aparecen

- ✅ Ejecuta `npm run deploy`
- ✅ Verifica que `CLIENT_ID` y `GUILD_ID` sean correctos
- ✅ Espera unos minutos (Discord puede tardar en actualizar)

### Error de MongoDB

- ✅ Verifica que MongoDB esté corriendo (`sudo systemctl status mongodb`)
- ✅ Verifica la cadena de conexión en `MONGODB_URI`
- ✅ Si usas Atlas, verifica que tu IP esté en la whitelist

### Los botones no funcionan

- ✅ Verifica que el rol del bot esté ARRIBA de todos los roles de staff
- ✅ Asegúrate de que el bot tenga permisos de "Administrador"
- ✅ Revisa los logs del bot con `npm start`

### Las pruebas no se detectan

- ✅ Verifica que el tipo de ticket sea "reportar-staff"
- ✅ Asegúrate de que el mensaje contenga URLs o archivos adjuntos
- ✅ Revisa los logs para errores

---

## 📊 Transcripciones

Las transcripciones se guardan automáticamente en la carpeta `transcripts/` en dos formatos:

- **TXT**: Formato de texto plano
- **HTML**: Formato visual con estilos

Puedes configurar el formato en `.env`:

```env
TRANSCRIPT_FORMAT=both  # both, txt, o html
AUTO_TRANSCRIPTS=true   # Activar/desactivar
```

---

## 🔐 Seguridad

### ⚠️ IMPORTANTE - NO SUBIR A GIT

El archivo `.env` contiene información sensible. **NUNCA** lo subas a GitHub.

Ya está incluido en `.gitignore`, pero asegúrate de:

1. **Nunca** compartir tu TOKEN de Discord
2. **Nunca** compartir tu cadena de conexión de MongoDB
3. Usa variables de entorno en producción

### Recomendaciones

- 🔒 Cambia el TOKEN si se filtra accidentalmente
- 🔒 Usa contraseñas fuertes para MongoDB
- 🔒 Limita el acceso a la base de datos solo a IPs necesarias
- 🔒 Mantén actualizadas las dependencias: `npm update`

---

## 🚀 Despliegue en Producción

### Opción 1: VPS (Recomendado)

```bash
# Instalar PM2 (gestor de procesos)
npm install -g pm2

# Iniciar bot con PM2
pm2 start index.js --name el-patio-tickets

# Guardar configuración
pm2 save

# Auto-inicio al reiniciar servidor
pm2 startup
```

### Opción 2: Railway.app

1. Sube el proyecto a GitHub (sin .env)
2. Conecta Railway a tu repositorio
3. Añade variables de entorno en Railway
4. Despliega

### Opción 3: Heroku

1. Crea cuenta en Heroku
2. Instala Heroku CLI
3. Sube proyecto
4. Configura variables de entorno en Heroku Dashboard

---

## 📝 Changelog

### v1.0.0 (Enero 2025)
- ✅ Sistema base de tickets
- ✅ 5 tipos de tickets
- ✅ Sistema CLAIM
- ✅ Detección automática de pruebas
- ✅ Cierre automático por inactividad
- ✅ Transcripciones TXT/HTML
- ✅ Sistema de logs
- ✅ Estadísticas básicas
- ✅ Anti-spam

---

## 🤝 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección "Solución de Problemas"
2. Verifica los logs del bot
3. Asegúrate de seguir todos los pasos de instalación
4. Contacta al desarrollador del bot

---

## 📜 Licencia

MIT License - Uso privado para EL PATIO RP

---

## 🎯 Próximas Mejoras

Las siguientes funcionalidades están planeadas para futuras versiones:

- [ ] Dashboard web en tiempo real
- [ ] Integración con base de datos FiveM
- [ ] Sistema de prioridades
- [ ] IA para respuestas sugeridas
- [ ] Multi-idioma automático
- [ ] Gamificación para staff
- [ ] Formularios dinámicos pre-ticket
- [ ] Búsqueda inteligente en historial

---

**Desarrollado con ❤️ para EL PATIO RP**  
**Sistema de Tickets Premium v1.0 | Enero 2025**
