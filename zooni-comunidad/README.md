# Zooni — Módulo Comunidad

## Estructura

```
zooni-comunidad/
├── api/          → Node.js + Express (backend)
│   ├── src/
│   │   ├── routes/   (mapa, carteles, amigos, ubicacion, usuarios)
│   │   ├── middleware/auth.js
│   │   ├── db.js
│   │   └── index.js
│   ├── migration.sql  ← EJECUTAR PRIMERO EN SQL SERVER
│   └── .env
└── app/          → React Native + Expo (frontend)
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── hooks/
    │   └── screens/ComunidadScreen.jsx
    └── App.js
```

---

## Setup rápido

### 1. Migración de BD
Abrir SQL Server Management Studio → ejecutar `api/migration.sql` contra la BD `Zooni`.
Crea las tablas: `Servicio`, `Cartel`, `Amistad`, `UbicacionUsuario` + datos de ejemplo.

### 2. Backend (Node.js)
```bash
cd zooni-comunidad/api
npm install
# Editar .env con tu password de BD y el mismo JWT_SECRET que usa la API C#
npm run dev   # → corre en http://localhost:3001
```

### 3. Frontend (Expo)
```bash
cd zooni-comunidad/app
npm install
npx expo start --android
```

> Si corrés en dispositivo físico, cambiar `BASE_URL` en `src/api/config.js`
> de `10.0.2.2` a tu IP local (ej. `192.168.1.50`).

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/v1/comunidad/mapa`        | Datos del mapa (servicios, carteles, amigos) |
| GET  | `/api/v1/comunidad/servicios`   | Servicios filtrados por bbox y tipo |
| POST | `/api/v1/carteles`              | Crear cartel (multipart/form-data) |
| DELETE | `/api/v1/carteles/:id`        | Eliminar cartel (solo el dueño) |
| GET  | `/api/v1/amigos`                | Lista de amigos con distancia y estado |
| GET  | `/api/v1/amigos/solicitudes`    | Solicitudes de amistad pendientes |
| POST | `/api/v1/amigos/solicitud`      | Enviar solicitud de amistad |
| PATCH | `/api/v1/amigos/solicitud/:id` | Aceptar o rechazar solicitud |
| PUT  | `/api/v1/ubicacion`             | Actualizar ubicación del usuario |
| GET  | `/api/v1/usuarios/buscar?q=`    | Buscar usuarios por nombre o mascota |

Todos los endpoints requieren `Authorization: Bearer <JWT>`.
El JWT es el mismo que emite la API C# existente.

---

## Token JWT
El frontend usa el mismo token que la API C# (mismo secreto en `.env`).
Para testear, obtener token con `POST /auth/login` de la API existente y setearlo en `src/api/config.js`:

```js
import { setToken } from './api/config';
setToken('tu-jwt-aqui');
```
