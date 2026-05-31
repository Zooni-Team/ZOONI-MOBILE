# Zooni — Mobile App

Proyecto escolar — Colegio ORT Argentina, 5to año Informática.

## Estructura del Proyecto

```
ZOONI-MOBILE/
├── zooni-app/          ← Frontend React Native (Expo)
│   ├── App.tsx         ← Entry point + navegación
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx        ← Pantalla principal (completa)
│   │   │   └── PlaceholderScreen.tsx ← Stub para pantallas pendientes
│   │   ├── components/
│   │   │   ├── HamburgerDrawer.tsx   ← Menú lateral
│   │   │   ├── NotificationsPanel.tsx← Panel de notificaciones
│   │   │   ├── AddButtonModal.tsx    ← Modal FAB "agregar sección"
│   │   │   ├── NavButton.tsx         ← Botón de navegación reutilizable
│   │   │   └── SkeletonLoader.tsx    ← Skeleton animado
│   │   ├── services/
│   │   │   ├── api.ts                ← Todas las llamadas al backend
│   │   │   └── secciones.ts          ← Metadata de secciones (drawer + FABs)
│   │   └── types/
│   │       └── index.ts              ← Tipos TypeScript compartidos
│   └── assets/
│       └── home_background.png       ← Reemplazar con imagen real del equipo
│
└── zooni-api-temp/     ← Backend .NET 9 Web API
    ├── Controllers/
    │   ├── HomeController.cs         ← GET /home, GET+PUT /home/config, PATCH /mascotas/:id/activar
    │   ├── NotificacionesController.cs← GET/PATCH notificaciones
    │   └── AuthController.cs         ← POST /auth/login
    ├── Services/
    │   ├── HomeService.cs
    │   ├── NotificacionService.cs
    │   └── AuthService.cs
    ├── DTOs/HomeDto.cs
    ├── Models/HomeConfig.cs
    ├── appsettings.json              ← Configurar connection string y JWT key
    └── SQL_MIGRATION_HomeConfig.sql  ← Ejecutar en la BD para agregar tabla HomeConfig
```

## Setup

### Backend

1. Editar `zooni-api-temp/appsettings.json`:
   - `ConnectionStrings:DefaultConnection` → tu SQL Server local
   - `Jwt:Key` → clave secreta larga (mínimo 32 chars)

2. Ejecutar la migración SQL:
   ```sql
   -- En SQL Server Management Studio, abrir y ejecutar:
   zooni-api-temp/SQL_MIGRATION_HomeConfig.sql
   ```

3. Correr el backend:
   ```
   cd zooni-api-temp
   dotnet run
   ```
   Corre en `http://localhost:5000`

### Frontend

1. Instalar dependencias:
   ```
   cd zooni-app
   npm install
   ```

2. Reemplazar `assets/home_background.png` con la imagen real del equipo.

3. Ajustar `BASE_URL` en `src/services/api.ts`:
   - Emulador Android: `http://10.0.2.2:5000/api/v1`
   - Dispositivo físico: `http://<IP-de-tu-PC>:5000/api/v1`

4. Correr la app:
   ```
   npx expo start
   ```

## Endpoints Implementados

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login, devuelve JWT |
| GET | `/api/v1/home` | Datos completos de la Home |
| GET | `/api/v1/home/config` | Config de botones del usuario |
| PUT | `/api/v1/home/config` | Guardar config de botones |
| PATCH | `/api/v1/mascotas/:id/activar` | Cambiar mascota activa |
| GET | `/api/v1/notificaciones` | Listar notificaciones |
| PATCH | `/api/v1/notificaciones/:id/leer` | Marcar una como leída |
| PATCH | `/api/v1/notificaciones/leer-todas` | Marcar todas como leídas |

## Pantallas Pendientes

Las siguientes pantallas tienen un placeholder y deben implementarse:
- Login / Onboarding
- Comunidad
- Ficha Médica
- Mis Mascotas
- Match
- Planificador, Calendario, Eventos, ChatBot, Closet, Perfil, Configuración
