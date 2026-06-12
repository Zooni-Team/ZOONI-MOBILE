# Zooni — Instrucciones Detalladas: Pantalla Home
 
> Este documento extiende `Instruccion.md` (documento base de diseño). Todo lo definido allí aplica aquí también. Este archivo agrega las especificaciones propias de la pantalla **Home**.
 
---
 
## Descripción General
 
La pantalla **Home** es la pantalla principal de la aplicación. Es lo primero que ve el usuario al iniciar sesión. Su función es:
 
- Darle la bienvenida personalizando la experiencia con el **nombre de su mascota activa**.
- Mostrar la **imagen de la mascota activa** generada con IA.
- Proveer acceso rápido a las secciones principales de la app mediante **botones de navegación**.
- Ofrecer un botón de **emergencia veterinaria** siempre visible.
---
 
## Flujo de Usuario
 
```
Usuario abre la app
    → Está autenticado? 
        → SÍ → Se carga la Home con los datos de su mascota activa
        → NO → Redirigir a pantalla de Login / Onboarding
 
En Home:
    → Toca "Comunidad"       → Navega a la pantalla Comunidad
    → Toca "Ficha Médica"    → Navega a la Ficha Médica de la mascota activa
    → Toca "Mis Mascotas"    → Navega al listado de sus mascotas
    → Toca "S.O.S Veterinario" → Abre flujo de emergencia veterinaria
    → Toca icono "🔄"       → Abre flujo de modificar/eliminar orden de los botones
    → Toca ícono "➕"         → Abre flujo para agregar un nuevo boton si es posible
    → Toca campana 🔔        → Abre panel de notificaciones
    → Toca hamburguesa ☰    → Abre menú lateral (drawer)
```
 
---
 
## DISEÑO FRONTEND
 
### Vista General
 
La pantalla se divide en 4 zonas verticales:
 
```
┌─────────────────────────────┐
│  [☰]     Header       [🔔]  │  ← Zona 1: Header
├─────────────────────────────┤
│                             │
│        "Titán" (nombre)     │  ← Zona 2: Hero con mascota
│    [ilustración mascota]    │
│                             │
├─────────────────────────────┤
│   [ 👥 Comunidad         ]  │
│   [ 🔬 Ficha Médica      ]  │  ← Zona 3: Botones de navegación
│   [ 🐾 Mis Mascotas      ]  │
│   [ 🚨 S.O.S Veterinario ]  │
├─────────────────────────────┤
│              [ 🔄 ] [ ➕ ]   │  ← Zona 4: FABs (Floating Action Buttons)
└─────────────────────────────┘
```
 
---
 
### Zona 1 — Header
 
- **Fondo**: transparente (se ve el fondo de la pantalla).
- **Izquierda**: ícono de menú hamburguesa (☰), color gris oscuro `#2C2C2C`, tamaño ~24px.
- **Derecha**: ícono de campana (🔔), color **amarillo/naranja** `#F5A623`. Si hay notificaciones sin leer, mostrar un **badge rojo** circular pequeño en la esquina superior derecha del ícono con el número de notificaciones (máx. "9+").
- **Centro**: vacío (no lleva título en el header, el nombre va en la zona hero).
- **Altura**: ~56px.
- **Padding horizontal**: 20px.
---
 
### Zona 2 — Hero (Mascota Activa)
 
Esta zona ocupa aproximadamente el **45% de la altura** de la pantalla.
 
#### Fondo
- Es una **imagen de fondo** (asset estático provisto por el equipo).
- Estilo: paisaje verde con pasto en la parte inferior, cielo verde menta suave arriba.
- La imagen debe ocupar el **100% del ancho** y adaptarse sin distorsionarse (`cover`).
- No hay que generarla: ya existe como asset `assets/images/home_background.png` (o el nombre que el equipo defina).
#### Nombre de la Mascota
- Texto dinámico: muestra el nombre de la **mascota activa** del usuario.
- Si el usuario tiene varias mascotas, muestra la que esté seleccionada como principal.
- **Tipografía**: `Nunito ExtraBold` o `Fredoka One`, tamaño **28–32px**.
- **Color**: verde oscuro teal `#27AE60` o un tono que contraste bien con el fondo verde claro.
- **Posición**: centrado horizontalmente, en la parte superior de la zona hero (debajo del header).
- **Animación sugerida**: fade-in suave al cargar (300ms, ease-in-out).
#### Imagen de la Mascota
- Es una imagen generada con IA por el equipo para cada mascota. **No debe generarse dinámicamente en el frontend.**
- Se almacena como asset o URL en la base de datos asociada al perfil de cada mascota.
- **Tamaño de display**: ~180–200px de alto, centrada horizontalmente.
- **Estilo**: sin borde, sin sombra, sobre el fondo de pasto.
- **Posición**: centrada en la zona hero, ligeramente hacia abajo para que "se apoye" sobre el pasto ilustrado del fondo.
- Si la imagen de la mascota no cargó o es nula, mostrar un **placeholder** con silueta de perro/gato genérica en gris claro.
- **Animación sugerida**: entrada con leve escala (scale 0.9 → 1.0) en 400ms al cargar.
---
 
### Zona 3 — Botones de Navegación
 
4 botones apilados verticalmente, con separación de **12px** entre cada uno.
Padding horizontal de la zona: **24px** a cada lado.
 
#### Estilo General de Botones (los 3 primeros)
 
| Propiedad | Valor |
|---|---|
| Fondo | Amarillo dorado `#F5C842` |
| Border radius | `30px` (pill) |
| Altura | `54px` |
| Sombra | `0px 4px 10px rgba(0, 0, 0, 0.15)` |
| Texto | Bold, `16–18px`, color `#2C2C2C` |
| Alineación texto | Centrado, con ícono a la izquierda |
| Ícono | A ~16px del borde izquierdo, tamaño 20px |
| Estado presionado | Leve oscurecimiento del fondo (10%), scale 0.97 |
 
#### Botón 1 — Comunidad
- **Ícono**: 👥 (dos personas) o ícono equivalente de comunidad.
- **Texto**: `Comunidad`
- **Acción**: navegar a pantalla `Comunidad`.
#### Botón 2 — Ficha Médica
- **Ícono**: 🔬 o ícono de estetoscopio/historial médico.
- **Texto**: `Ficha Médica`
- **Acción**: navegar a `FichaMedica` con el ID de la mascota activa como parámetro.
#### Botón 3 — Mis Mascotas
- **Ícono**: 🐾 o ícono de pata de animal.
- **Texto**: `Mis Mascotas`
- **Acción**: navegar a la pantalla `MisMascotas`.
#### Botón 4 — S.O.S Veterinario (Botón de Emergencia)
 
| Propiedad | Valor |
|---|---|
| Fondo | Rojo vibrante `#E63946` |
| Border radius | `30px` (pill) |
| Altura | `54px` |
| Sombra | `0px 4px 14px rgba(230, 57, 70, 0.45)` (sombra roja) |
| Texto | Bold, `16–18px`, color `#FFFFFF` |
| Ícono | 🚨 o sirena de emergencia |
| Estado presionado | Oscurecimiento leve + vibración háptica (si disponible) |
 
- Este botón **nunca debe ocultarse** aunque el usuario haga scroll.
- Si se implementa scroll en la zona de botones, este botón debe quedar **sticky** al fondo de la zona.
---
 
### Zona 4 — FABs (Floating Action Buttons)
 
Dos botones circulares en la esquina inferior derecha. Su función es permitirle al usuario **personalizar la pantalla Home**: cambiar el orden de los botones de navegación o modificar cuáles botones aparecen visibles.
 
> ⚠️ **Aclaración importante**: estos botones NO son para agregar mascotas ni para la cámara. Son exclusivamente para la **personalización del layout de botones** de la Home. El flujo de agregar mascota vive en "Mis Mascotas". El flujo de cambiar foto vive en el perfil de cada mascota.
 
| Propiedad | Valor |
|---|---|
| Tamaño | 48px × 48px |
| Border radius | `50%` (círculo perfecto) |
| Fondo | Verde teal `#2DBD72` |
| Color ícono | Blanco `#FFFFFF` |
| Sombra | `0px 4px 12px rgba(0,0,0,0.2)` |
| Separación entre ellos | 10px horizontal |
| Posición | Bottom-right, margin 16px desde bordes |
 
- **FAB izquierdo** — ícono de grilla/reordenar (🔄): activa el **modo de reorden** de los botones. En este modo, los botones de navegación muestran un ícono de "arrastrar" (⠿) a la izquierda y otro de eliminar (✖️) a la derecha, permitiendo al usuario cambiar su posición arrastrando o quitarlos de la vista.
- **FAB derecho** — ícono de "➕" : abre un **modal/bottom sheet** que lista todas las secciones disponibles de la app que aún no están en la Home, para que el usuario pueda agregarlas como botón visible.
#### Modo Edición de Botones (detalle)
 
Cuando el usuario activa el modo edición (FAB izquierdo):
- Cada botón de navegación muestra en su extremo izquierdo un **ícono de drag** (⠿) y en su extremo derecho un **ícono de eliminar** (✖️ rojo pequeño).
- El usuario puede **arrastrar y soltar** los botones para reordenarlos.
- Al tocar ✖️, el botón desaparece de la Home (pero la sección sigue accesible desde el menú hamburguesa).
- El botón **S.O.S Veterinario es fijo y no puede eliminarse ni reordenarse**: siempre queda Primero y siempre visible.
- Un botón "**Guardar**" (amarillo, pill) aparece al fondo de la zona de botones para confirmar los cambios.
- Los cambios se persisten en el backend asociados al usuario (ver sección Backend).
#### Secciones disponibles para agregar (modal FAB derecho)
 
Las secciones que el usuario puede agregar como botón en la Home son todas las del menú lateral:
`Comunidad`, `Match`, `Planificador de Servicios`, `Ficha Médica`, `Calendario`, `Eventos`, `ChatBot`, `Closet`, `Perfil`, `Configuracion` .

Para orientarte podes revisar la carpeta "Imagenes-Figma"  → "Home"  → (Aca encontras distintas imagenes de la home para que tomes como referencia)

El modal muestra cada sección con su ícono y nombre. Las que ya están en la Home aparecen deshabilitadas (gris, con tilde ✓).
 
---
 
### Estados de Carga
 
- Mientras se obtienen los datos del usuario y la mascota activa desde el backend, mostrar:
  - Un **skeleton loader** en el área del nombre (rect redondeado gris claro animado).
  - Un **skeleton loader** circular en el área de la imagen de mascota.
  - Los botones pueden aparecer inmediatamente (son estáticos).
- Duración esperada de carga: < 1 segundo si hay caché local.
---
 
### Responsividad
 
- Diseñada para pantallas de **390px de ancho** (iPhone 14 base).
- En pantallas más grandes (tablets o Android grandes), las zonas hero y botones deben crecer proporcionalmente con `maxWidth: 480px` centrado.
- Usar unidades relativas (`%`, `vh`, `rem`) donde sea posible.
---
 
## DISEÑO BACKEND
 
### Modelo de Datos Relevante
 
#### Entidad `User`
```json
{
  "id": "uuid",
  "nombre": "string",
  "email": "string",
  "foto_perfil_url": "string | null",
  "mascota_activa_id": "uuid | null",
  "created_at": "timestamp"
}
```
 
#### Entidad `Mascota`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "nombre": "string",
  "especie": "perro | gato | otro",
  "raza": "string",
  "fecha_nacimiento": "date",
  "foto_url": "string | null",
  "activa": "boolean",
  "created_at": "timestamp"
}
```
 
> **Nota**: el campo `foto_url` apunta a la imagen generada con IA y subida manualmente por el equipo (o por el usuario). No se genera en tiempo real.
 
---
 
### Endpoint Principal de la Home
 
#### `GET /api/v1/home`
 
Retorna toda la información necesaria para renderizar la pantalla Home de una sola llamada (evitar múltiples requests al cargar).
 
**Headers requeridos:**
```
Authorization: Bearer <token_jwt>
```
 
**Response exitosa (200):**
```json
{
  "usuario": {
    "id": "a1b2c3",
    "nombre": "Sofía"
  },
  "mascota_activa": {
    "id": "d4e5f6",
    "nombre": "Titán",
    "especie": "perro",
    "raza": "Labrador Retriever",
    "foto_url": "https://cdn.Zooni.com/mascotas/titan.png",
    "edad_anios": 4,
    "edad_meses": 4
  },
  "notificaciones_no_leidas": 3
}
```
 
**Response sin mascota activa (200):**
```json
{
  "usuario": { "id": "a1b2c3", "nombre": "Sofía" },
  "mascota_activa": null,
  "notificaciones_no_leidas": 0
}
```
> En este caso, el frontend debe mostrar un **estado vacío** invitando al usuario a agregar su primera mascota (ilustración + mensaje + botón CTA).
 
**Response errores:**
```json
// 401 — Token inválido o expirado
{ "error": "No autorizado" }
 
// 500 — Error interno
{ "error": "Error del servidor" }
```
 
---
 
### Lógica de Mascota Activa
 
- Un usuario puede tener **múltiples mascotas** pero solo **una activa** a la vez.
- La mascota activa es la que se muestra en la Home.
- Se determina por el campo `activa: true` en la tabla `mascotas` (solo puede haber una activa por usuario).
- Si el usuario cambia de mascota activa (desde "Mis Mascotas"), se hace un `PATCH` al backend actualizando el flag.
**`PATCH /api/v1/mascotas/:id/activar`**
```json
// Response 200
{ "mensaje": "Mascota activa actualizada", "mascota_id": "d4e5f6" }
```
 
---
 
### Endpoint de Notificaciones (badge)
 
El número del badge en la campana se obtiene del campo `notificaciones_no_leidas` del endpoint `/home` (incluido en la misma llamada, no un request separado).
 
Si se quiere actualizar en tiempo real, se puede implementar un **WebSocket** o polling cada 30 segundos.
 
---
 
### Autenticación
 
- La app usa **JWT (JSON Web Tokens)**.
- Al abrir la app, se verifica si hay un token guardado localmente (AsyncStorage / SecureStore).
- Si el token expiró → redirigir a Login.
- Si el token es válido → llamar a `GET /api/v1/home`.
---
 
### Foto de la Mascota
 
- Las imágenes generadas con IA son subidas manualmente por el equipo (o el usuario desde el flujo del FAB de cámara) a un servicio de almacenamiento (ej: **AWS S3**, **Cloudinary**, o **Firebase Storage**).
- El backend guarda solo la **URL pública** de la imagen en el campo `foto_url`.
- El frontend carga la imagen con esa URL usando el componente de imagen de la plataforma (`Image` en React Native, etc.).
- Se recomienda usar una librería de caché de imágenes (ej: `react-native-fast-image`) para evitar recargas innecesarias.
**Flujo de actualización de foto (FAB cámara):**
```
Usuario toca FAB cámara
    → Abrir selector de imagen (cámara o galería)
    → Usuario elige imagen
    → Frontend sube imagen a Storage (multipart/form-data)
    → Storage devuelve URL pública
    → Frontend hace PATCH /api/v1/mascotas/:id con { foto_url: "nueva_url" }
    → Frontend actualiza imagen en pantalla sin recargar
```
 
**`PATCH /api/v1/mascotas/:id`**
```json
// Body
{ "foto_url": "https://cdn.Zooni.com/mascotas/nueva_foto.png" }
 
// Response 200
{ "mensaje": "Mascota actualizada", "foto_url": "https://..." }
```
 
---
 
### Consideraciones de Performance
 
- El endpoint `/home` debe estar optimizado con una query que haga **JOIN entre `users` y `mascotas`** en una sola consulta, sin N+1 queries.
- Las imágenes de mascotas deben servirse desde una **CDN** con caché largo (mínimo 7 días).
- Implementar **caché local** en el cliente: si los datos del home no cambiaron, mostrar los datos cacheados inmediatamente mientras se actualiza en segundo plano (estrategia stale-while-revalidate).
---
 
## Menú Lateral — Hamburger Drawer
 
### Descripción
 
El menú lateral (drawer) se abre al tocar el ícono ☰ del header. Se desliza desde la **izquierda** y cubre aproximadamente el **75–80% del ancho** de la pantalla. El resto de la pantalla queda oscurecido con un overlay semi-transparente (`rgba(0,0,0,0.4)`). Tocar el overlay cierra el menú.
 
### Estilo Visual
 
| Propiedad | Valor |
|---|---|
| Fondo del drawer | Blanco `#FFFFFF` |
| Ancho | 80% del ancho de pantalla (máx. 320px) |
| Border radius derecho | `20px` en las esquinas top-right y bottom-right |
| Sombra | `4px 0px 20px rgba(0,0,0,0.15)` |
| Animación apertura | Slide-in desde la izquierda, 250ms ease-out |
| Animación cierre | Slide-out hacia la izquierda, 200ms ease-in |
 
### Encabezado del Drawer
 
En la parte superior del drawer, mostrar:
- **Avatar** del usuario: foto de perfil circular (48px), borde verde teal `#2DBD72` de 2px. Si no tiene foto, mostrar iniciales sobre fondo verde menta.
- **Nombre del usuario** a la derecha del avatar, bold, 16px, `#2C2C2C`.
- **Nombre y raza de la mascota activa** debajo del nombre, regular, 13px, `#6B6B6B`.
- Separador horizontal (`1px`, `#E0E0E0`) debajo del encabezado.
### Ítems del Menú
 
Los ítems del menú se extraen de la imagen provista. Cada ítem tiene un ícono a la izquierda y el nombre de la sección. Orden y contenido:
 
| # | Ícono | Sección | Destino |
|---|---|---|---|
| 1 | 🏠 | Inicio | Navega a Home (cierra el drawer) |
| 2 | 👥 | Comunidad | Navega a pantalla Comunidad |
| 3 | 🐾 | Match | Navega a pantalla Match |
| 4 | 🗓️ | Planificador de Servicios | Navega a Planificador |
| 5 | 🔬 | Ficha médica | Navega a Ficha Médica de mascota activa |
| 6 | 📅 | Calendario | Navega a Calendario |
| 7 | 🎉 | Eventos | Navega a Eventos |
| 8 | 💬 | ChatBot | Navega a pantalla ChatBot (Zooni AI) |
| 9 | 👗 | Closet | Navega a pantalla Closet |
| 10 | 👤 | Perfil | Navega a Perfil del usuario |
| 11 | ⚙️ | Configuración | Navega a Configuración |
| — | — | *(separador)* | — |
| 12 | 🚪 | **Cerrar sesión** | Cierra sesión y redirige a Login |
 
### Estilo de los Ítems
 
- **Alto por ítem**: ~52px.
- **Padding horizontal**: 20px.
- **Ícono**: 22px, alineado a la izquierda.
- **Texto**: `Nunito Medium` o `Poppins Medium`, 15px, `#2C2C2C`.
- **Ítem activo** (sección actual): fondo verde menta muy suave `rgba(45, 189, 114, 0.12)`, texto en bold y color teal `#2DBD72`.
- **"Cerrar sesión"**: texto en **rojo** `#E63946`, ícono de puerta/salida en rojo. Separado del resto por un divider.
- Al tocar un ítem: feedback visual (ripple o leve cambio de fondo) + cierre suave del drawer + navegación.
### Lógica de "Cerrar sesión"
 
```
Usuario toca "Cerrar sesión"
    → Mostrar diálogo de confirmación:
        Título: "¿Cerrar sesión?"
        Mensaje: "¿Seguro que querés salir de tu cuenta?"
        Botones: [Cancelar] [Sí, salir]
    → Si confirma:
        → Eliminar token JWT del almacenamiento local
        → Limpiar caché de datos del usuario
        → Redirigir a pantalla de Login
```
 
---
 
## Panel de Notificaciones
 
### Descripción
 
Al tocar el ícono 🔔 del header, se abre un **panel de notificaciones** que se despliega desde arriba (o como pantalla/modal full-screen en mobile). Muestra todas las notificaciones del usuario ordenadas por fecha, de más reciente a más antigua.
 
### Tipos de Notificaciones
 
| Tipo | Descripción | Ejemplo |
|---|---|---|
| `follow` | Alguien empezó a seguir al usuario | "🐶 Luna siguió tu perfil" |
| `post_from_following` | Un usuario seguido publicó algo nuevo | "🐾 Milo publicó una nueva foto" |
| `friend_request` | Alguien envió una solicitud de amistad | "👤 Sofía te envió una solicitud" |
| `friend_accepted` | Alguien aceptó una solicitud de amistad | "✅ Tomás aceptó tu solicitud" |
| `match` | Hay un nuevo match entre mascotas | "💛 ¡Titán y Rocky hacen match!" |
| `reminder_care` | Recordatorio de cuidado de mascota | "💊 Es hora de la vacuna de Titán" |
| `reminder_appointment` | Recordatorio de turno veterinario | "📅 Turno mañana a las 10:00 hs" |
| `event` | Nuevo evento en la comunidad | "🎉 Hay un nuevo evento cerca tuyo" |
 
### Modelo de Datos — Entidad `Notificacion`
 
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "tipo": "follow | post_from_following | friend_request | friend_accepted | match | reminder_care | reminder_appointment | event",
  "titulo": "string",
  "cuerpo": "string",
  "leida": "boolean",
  "foto_url": "string | null",
  "redirige_a": "string | null",
  "created_at": "timestamp"
}
```
 
- `redirige_a`: ruta interna de la app a la que lleva la notificación al tocarla (ej: `"perfil/sofia"`, `"match"`, `"fichamedica/titan"`).
- `foto_url`: avatar del usuario o imagen de la mascota relacionada a la notificación.
### Endpoint de Notificaciones
 
#### `GET /api/v1/notificaciones`
 
**Headers**: `Authorization: Bearer <token>`
 
**Query params opcionales**:
- `?leidas=false` → solo no leídas
- `?page=1&limit=20` → paginación
**Response (200):**
```json
{
  "notificaciones": [
    {
      "id": "n001",
      "tipo": "follow",
      "titulo": "Nueva seguidora",
      "cuerpo": "Luna empezó a seguirte",
      "leida": false,
      "foto_url": "https://cdn.Zooni.com/usuarios/luna.png",
      "redirige_a": "perfil/luna",
      "created_at": "2025-10-04T14:32:00Z"
    }
  ],
  "total_no_leidas": 3
}
```
 
#### `PATCH /api/v1/notificaciones/:id/leer`
Marca una notificación individual como leída.
```json
// Response 200
{ "mensaje": "Notificación marcada como leída" }
```
 
#### `PATCH /api/v1/notificaciones/leer-todas`
Marca todas las notificaciones del usuario como leídas. Se llama al abrir el panel.
```json
// Response 200
{ "mensaje": "Todas las notificaciones marcadas como leídas", "actualizadas": 3 }
```
 
### Diseño Visual del Panel
 
- **Header del panel**: título "Notificaciones" centrado, bold. Botón "Marcar todas como leídas" en texto pequeño verde teal a la derecha.
- **Lista de notificaciones**: cada ítem tiene:
  - **Avatar** circular (40px) a la izquierda: foto del usuario o mascota relacionada.
  - **Texto**: título en bold (14px) + cuerpo en regular (13px, `#6B6B6B`).
  - **Tiempo relativo** a la derecha: "hace 5 min", "ayer", etc.
  - **Indicador de no leída**: punto verde teal `#2DBD72` de 8px a la derecha del ítem.
  - **Fondo de no leída**: `rgba(45, 189, 114, 0.08)` (verde muy suave).
  - Al tocar una notificación: se marca como leída + navega a `redirige_a`.
- **Estado vacío**: si no hay notificaciones, mostrar ícono de campana con tachado y texto "No tenés notificaciones por ahora".
### Notificaciones Push
 
- Las notificaciones también deben enviarse como **push notifications** al dispositivo cuando la app está en segundo plano o cerrada.
- Usar **Firebase Cloud Messaging (FCM)** para Android y **APNs** para iOS.
- El backend guarda el `device_token` del usuario al iniciar sesión y lo usa para enviar pushes.
- El `device_token` se actualiza en cada login o cuando la app lo refresca.
```json
// Entidad device_token en User (agregar al modelo)
{
  "device_token": "string | null"
}
```
 
---
 
## Backend — Personalización de Botones (FABs)
 
### Modelo de Datos — Entidad `HomeConfig`
 
Guarda la configuración personalizada de botones de la Home para cada usuario.
 
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "botones": [
    { "seccion": "comunidad", "orden": 1, "visible": true },
    { "seccion": "ficha_medica", "orden": 2, "visible": true },
    { "seccion": "mis_mascotas", "orden": 3, "visible": true },
    { "seccion": "match", "orden": 4, "visible": false },
    { "seccion": "calendario", "orden": 5, "visible": false }
  ],
  "updated_at": "timestamp"
}
```
 
- `sos_veterinario` **no se guarda en esta config**: siempre está presente y al final.
- Si un usuario no tiene `HomeConfig` guardada, el backend devuelve la configuración default (los 3 botones amarillos originales).
### Endpoints de Personalización
 
#### `GET /api/v1/home/config`
Devuelve la configuración actual de botones del usuario.
```json
// Response 200
{
  "botones": [
    { "seccion": "comunidad", "orden": 1, "visible": true },
    { "seccion": "ficha_medica", "orden": 2, "visible": true },
    { "seccion": "mis_mascotas", "orden": 3, "visible": true }
  ]
}
```
 
#### `PUT /api/v1/home/config`
Guarda la nueva configuración tras editar desde los FABs.
```json
// Body
{
  "botones": [
    { "seccion": "match", "orden": 1, "visible": true },
    { "seccion": "comunidad", "orden": 2, "visible": true },
    { "seccion": "calendario", "orden": 3, "visible": true }
  ]
}
// Response 200
{ "mensaje": "Configuración guardada correctamente" }
```
 
---
 
## Consideraciones Adicionales
 
### Accesibilidad
- Todos los botones deben tener `accessibilityLabel` descriptivo (ej: `"Ir a Comunidad"`, `"Emergencia veterinaria"`).
- El contraste de texto sobre botones amarillos debe cumplir WCAG AA (ratio mínimo 4.5:1 → usar `#2C2C2C` sobre `#F5C842` ✅).
- Las imágenes de mascotas deben tener `alt` o `accessibilityLabel` con el nombre de la mascota.
### Edge Cases a Manejar
| Situación | Comportamiento esperado |
|---|---|
| Usuario sin mascotas | Mostrar estado vacío con CTA para agregar mascota |
| Foto de mascota no carga | Mostrar placeholder con silueta genérica |
| Sin conexión a internet | Mostrar datos cacheados + banner "Sin conexión" |
| Token expirado | Redirigir a Login automáticamente |
| Nombre de mascota muy largo | Truncar con `...` después de 20 caracteres |
 
---
 
*Este documento debe leerse junto a `Instruccion-Contexto.md`. Ante cualquier duda de estilo, color o tipografía, el documento base tiene prioridad.*
 