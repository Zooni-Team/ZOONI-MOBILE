# Zooni API - Backend Node.js

Backend REST API para la aplicación Zooni, migrado desde .NET a Node.js + Express.

## Requisitos

- Node.js v18 o superior
- SQL Server (la misma base de datos que usaba el backend .NET)

## Inicio Rápido (Windows)

### Opción 1: Doble clic
1. Hacer doble clic en `start.cmd`
2. Si es la primera vez, editará automáticamente el archivo `.env` con tus credenciales

### Opción 2: Línea de comandos
```bash
# Instalar dependencias (solo primera vez)
npm install

# Iniciar el servidor
npm start
```

### Modo desarrollo (con hot-reload)
```bash
# Doble clic en start-dev.cmd
# O desde la terminal:
npm run dev
```

El servidor arrancará en `http://localhost:5165`

## Configuración

Edita el archivo `.env` con tu configuración de SQL Server:

### Windows Authentication (recomendado)
```env
DB_SERVER=localhost
DB_DATABASE=Zooni
DB_USER=
DB_PASSWORD=
DB_TRUST_CERTIFICATE=true
```

### SQL Authentication
```env
DB_SERVER=localhost
DB_DATABASE=Zooni
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_TRUST_CERTIFICATE=true
```

⚠️ **Importante:** Cambia `JWT_SECRET` por una clave segura aleatoria de al menos 32 caracteres.

## Endpoints

### Autenticación
- `POST /api/v1/auth/login` - Login de usuario

### Home
- `GET /api/v1/home` - Datos de home (usuario, mascota activa, badge notificaciones)
- `GET /api/v1/home/config` - Configuración de botones
- `PUT /api/v1/home/config` - Guardar configuración de botones

### Mascotas
- `PATCH /api/v1/mascotas/:id/activar` - Activar una mascota

### Notificaciones
- `GET /api/v1/notificaciones` - Listar notificaciones (paginado)
- `PATCH /api/v1/notificaciones/:id/leer` - Marcar notificación como leída
- `PATCH /api/v1/notificaciones/leer-todas` - Marcar todas como leídas

## Estructura del proyecto

```
zooni-api/
├── src/
│   ├── config/
│   │   └── database.js      # Configuración SQL Server
│   ├── middleware/
│   │   └── auth.js          # Middleware JWT
│   ├── routes/
│   │   ├── auth.js          # Rutas de autenticación
│   │   ├── home.js          # Rutas de home
│   │   ├── mascotas.js      # Rutas de mascotas
│   │   └── notificaciones.js # Rutas de notificaciones
│   ├── services/
│   │   ├── authService.js
│   │   ├── homeService.js
│   │   └── notificacionService.js
│   └── server.js            # Punto de entrada
├── .env                      # Variables de entorno (no commitear)
├── .env.example              # Plantilla de variables
├── package.json
└── README.md
```

## Migración desde .NET

Este backend es equivalente al backend .NET original (`zooni-api-temp`). Todos los endpoints mantienen:
- Misma estructura de URLs
- Mismos códigos de estado HTTP
- Mismo formato de respuestas JSON
- Misma lógica de negocio
- Misma base de datos SQL Server

La app móvil ya está configurada para usar este backend sin cambios adicionales.

## Notas técnicas

- Pool de conexiones SQL Server configurado (max 10 conexiones)
- JWT con mismo formato que la versión .NET
- CORS habilitado para desarrollo
- Timeout de conexión: 30 segundos
- Logger de requests en consola
