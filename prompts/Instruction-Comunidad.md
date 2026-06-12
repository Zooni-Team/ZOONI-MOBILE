# Zooni — Instrucciones Detalladas: Pantalla Comunidad

> Este documento extiende `Instruccion.md` (documento base de diseño). Todo lo definido allí aplica aquí también. Este archivo agrega las especificaciones propias de la pantalla **Comunidad**.

---

## Descripción General

La pantalla **Comunidad** es la más completa de la app. Combina un **mapa interactivo en tiempo real** con un **panel inferior deslizable** de múltiples funcionalidades sociales. Desde aquí el usuario puede:

- Ver su ubicación en tiempo real.
- Ver en el mapa: amigos, veterinarias, paseadores, pet shops, peluquerías, y carteles comunitarios.
- Crear y eliminar carteles de mascotas perdidas u otros avisos.
- Agregar amigos mediante solicitudes.
- Gestionar solicitudes de amistad y chats.
- Buscar perfiles de otros usuarios.
- Ver información detallada de cada servicio o cartel al tocarlo.

---

## Flujo de Usuario

```
Usuario entra a Comunidad
    → Se carga el mapa centrado en su ubicación actual
    → Se cargan los markers del mapa (amigos, servicios, carteles)

Acciones en el mapa:
    → Toca "Mi Ubicación"         → Centra el mapa en su posición actual
    → Toca "Agregar Amigo"        → Abre modal de búsqueda + envío de solicitud
    → Toca "Crear Cartel"         → Activa modo de colocación de cartel
        → Doble click en el mapa  → Abre formulario de creación de cartel
        → Completa el formulario  → Toast "Cartel creado exitosamente"
    → Toca un marker de servicio  → Abre popup con info del lugar + botón Google Maps
    → Toca un marker de cartel    → Abre popup con info del cartel
        → Si es su cartel         → Muestra botón "Eliminar Cartel"
    → Toca + / −                  → Ajusta el zoom del mapa
    → Arrastra el mapa            → Navega libremente

Acciones en el panel inferior:
    → Tab "Amigos"     → Lista de amigos con sus ubicaciones en el mapa
    → Tab "Servicios"  → Lista de servicios del área visible del mapa
    → Tab "Solicitudes"→ Solicitudes de amistad recibidas + chats activos
    → Tab "Buscar"     → Buscador de perfiles de usuarios
    → Tab "S..." (más) → Tabs adicionales si las hay
    → Arrastra el panel hacia arriba → Expande el panel (half / full screen)
    → Arrastra hacia abajo          → Colapsa el panel
```

---

## DISEÑO FRONTEND

### Vista General

```
┌─────────────────────────────────┐
│ [☰]                             │  ← Header (solo hamburger)
│              MAPA               │
│         INTERACTIVO             │
│  [Mi Ubicación  ]               │
│  [+ Agregar Amigo]              │  ← Botones flotantes (derecha)
│  [🚨 Crear Cartel]              │
│                        [+]      │
│                        [−]      │
│                                 │
├─────────────────────────────────┤
│ ▲ (handle)                      │
│ [Amigos][Servicios][Solicitudes]│  ← Panel inferior deslizable
│ [Buscar][...]                   │
│                                 │
│  Contenido del tab activo       │
└─────────────────────────────────┘
```

---

### Header

- **Izquierda**: ícono hamburguesa ☰, color `#2C2C2C`, 24px. Mismo comportamiento que todas las pantallas.
- **Centro y derecha**: vacíos. El header es mínimo para no tapar el mapa.
- **Fondo**: transparente, sin barra visible. El mapa empieza desde arriba de la pantalla (full-screen map).
- **El hamburger flota sobre el mapa** con una sombra suave para legibilidad: fondo circular blanco de 40px detrás del ícono, `box-shadow: 0px 2px 8px rgba(0,0,0,0.2)`.

---

### Mapa Interactivo

#### Librería recomendada
- **React Native**: `react-native-maps` (Google Maps en Android, Apple Maps/Google Maps en iOS).
- **Web** (si aplica): Leaflet.js con tiles de OpenStreetMap, o Google Maps JavaScript API.
- El mapa mostrado en las imágenes usa **OpenStreetMap** (tiles estilo estándar). Se puede usar Leaflet + OSM como solución gratuita.

#### Configuración inicial
- Al entrar, el mapa se centra en la **ubicación actual del usuario** con zoom nivel **15** (nivel de calle).
- Si no hay permiso de ubicación: centrar en Buenos Aires, CABA como fallback.
- El mapa es de pantalla completa: ocupa el 100% del ancho y alto disponible, por debajo del header transparente y por encima del panel inferior.

#### Marker del usuario (Mi Ubicación)
- Marker especial: círculo azul pulsante (animación de pulso radial continuo) en la posición del usuario.
- Diferenciado del resto de markers para identificación inmediata.

#### Tipos de Markers en el mapa

| Tipo | Ícono | Color |
|---|---|---|
| Usuario actual | Círculo azul pulsante | `#2196F3` |
| Amigo | Avatar circular del amigo (32px) con borde verde `#2DBD72` | — |
| Veterinaria | 🏥 o ícono de cruz médica | Rojo `#E63946` |
| Paseador | 🦮 ícono de persona con perro | Naranja `#F5A623` |
| Pet Shop | 🛍️ ícono de tienda | Amarillo `#F5C842` |
| Peluquería canina | ✂️ ícono de tijera | Púrpura `#9B59B6` |
| Cartel — Mascota Perdida | 🔴 círculo rojo con ícono de huella | Rojo `#E63946` |
| Cartel — Otros | 📌 pin genérico | Gris `#6B6B6B` |

- Todos los markers deben ser **tappables**.
- Al tocar un marker se abre un **popup/callout** sobre el marker correspondiente (ver detalle más abajo).
- Los markers se **clusterean** automáticamente cuando hay muchos en el mismo área (para no saturar el mapa).

---

### Botones Flotantes (sobre el mapa, lado derecho)

Tres botones pill apilados verticalmente en la esquina superior derecha, con `margin-top` suficiente para no solapar el header.

| Botón | Ícono | Fondo | Texto |
|---|---|---|---|
| Mi Ubicación | 📍 pin rosado/rojo | Blanco `#FFFFFF` | `Mi Ubicación` |
| Agregar Amigo | ➕ | Blanco `#FFFFFF` | `Agregar Amigo` |
| Crear Cartel | 🚨 | Rojo `#E63946` | `Crear Cartel` |

**Estilo de los tres botones:**
- Fondo según tabla, texto color `#2C2C2C` (o blanco para el rojo).
- Border radius: `20px` (pill).
- Padding: `8px 14px`.
- Sombra: `0px 3px 10px rgba(0,0,0,0.18)`.
- Texto bold, 13px.
- Ícono a la izquierda del texto, 16px.
- Separación vertical entre botones: `8px`.

---

### Controles de Zoom

Dos botones cuadrados con esquinas redondeadas (`border-radius: 8px`), apilados verticalmente en el lado derecho del mapa, debajo de los botones flotantes.

| Botón | Símbolo | Acción |
|---|---|---|
| Zoom in | `+` | Aumenta el nivel de zoom en 1 |
| Zoom out | `−` | Disminuye el nivel de zoom en 1 |

- Fondo blanco, texto `#2C2C2C`, bold, 20px.
- Sombra suave: `0px 2px 6px rgba(0,0,0,0.15)`.
- Tamaño: `36px × 36px`.
- Separación entre ellos: `2px`.

---

### Popup — Marker de Servicio (Veterinaria, Pet Shop, etc.)

Al tocar un marker de servicio, aparece un card popup sobre el marker.

```
┌──────────────────────────────┐
│  Clínica Neurológica    [✕]  │
│  Veterinaria                 │
│  📍 Av. Pueyrredón 3456, CABA│
│  📞 +54 11 4789-4567         │
│  🔬 Neurología y Neurocirugía│
│  ┌──────────────────────┐    │
│  │  Ver en Google Maps  │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

**Estilo del popup:**
- Fondo blanco `#FFFFFF`, border radius `16px`, sombra `0px 6px 20px rgba(0,0,0,0.15)`.
- Ancho: ~80% del ancho de pantalla, centrado horizontalmente.
- Botón de cierre [✕] en esquina superior derecha, gris, 20px.
- **Nombre del lugar**: bold, 16px, `#2C2C2C`.
- **Dirección, teléfono, descripción**: regular, 13px, `#6B6B6B`, con ícono a la izquierda.
- **Botón "Ver en Google Maps"**: fondo verde teal `#2DBD72`, texto blanco bold, pill, ancho completo dentro del card. Al tocarlo abre la URL `https://www.google.com/maps/search/?api=1&query=LAT,LNG` en el navegador o en la app de Google Maps si está instalada.

---

### Popup — Marker de Cartel Comunitario

Al tocar un marker de cartel:

```
┌──────────────────────────────┐
│  🔴 Mascota Perdida     [✕]  │
│  🐾 Titán                    │
│  Perro - Labrador Retriever  │
│  Es de color dorado y tiene  │
│  un lunar en el ojo derecho. │
│  📞 Contacto: +54 9 12345678 │
│  Publicado por: usuario      │
│  16/03/2026 08:52            │
│  ┌──────────────────────┐    │
│  │   🗑️ Eliminar Cartel  │    │  ← Solo si es el dueño del cartel
│  └──────────────────────┘    │
└──────────────────────────────┘
```

**Estilo del popup**: igual al de servicios.
- El tipo de cartel (`Mascota Perdida`) aparece en bold con el círculo de color de su tipo.
- El nombre de la mascota en bold, la raza en regular debajo.
- La descripción en texto corrido, máximo 3 líneas (con "Ver más" si es más larga).
- Fecha y publicador en gris pequeño al fondo.
- **Botón "Eliminar Cartel"**: fondo rojo `#E63946`, texto blanco, solo visible si `cartel.usuario_id === usuario_autenticado.id`. Al tocarlo muestra un diálogo de confirmación antes de eliminar.

---

### Flujo Completo — Crear Cartel

#### Paso 1: Activar modo colocación
- El usuario toca el botón "🚨 Crear Cartel".
- Aparece un **tooltip/banner verde** sobre el mapa:
  - Texto: `"Hacé doble clic en el mapa donde querés crear el cartel"`
  - Fondo verde teal `#2DBD72`, texto blanco, border radius `12px`, padding `12px 16px`.
  - Se muestra en la parte superior del mapa, debajo de los botones flotantes.
  - Tiene una leve animación de entrada (fade + slide down).

#### Paso 2: Seleccionar ubicación
- El usuario hace **doble tap/click** en cualquier punto del mapa.
- Se coloca un marker temporal (pin animado pulsante) en esa posición.
- Se abre automáticamente el **formulario de creación** (modal bottom sheet o modal centrado).

#### Paso 3: Formulario de creación

```
┌─────────────────────────────────┐
│  🚨 Crear Cartel de Mascota     │
│                                 │
│  Tipo: [Mascota Perdida    ▼]   │
│                                 │
│  Mascota (opcional):            │
│  [Ninguna (mascota genérica) ▼] │
│                                 │
│  Descripción:                   │
│  [ Descripción de la mascota,  ]│
│  [ características, última vez ]│
│  [ vista...                    ]│
│                                 │
│  Teléfono de Contacto: *        │
│  [ Ej. +54 11 1234-5678        ]│
│                                 │
│  Foto de la Mascota (opcional): │
│  [Seleccionar archivo] [nombre] │
│  Formatos: JPG, PNG, GIF        │
│                                 │
│  [  Crear Cartel  ] [Cancelar]  │
└─────────────────────────────────┘
```

**Campos del formulario:**

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| Tipo | Dropdown | ✅ | `Mascota Perdida`, `Mascota Encontrada`, `En Adopción`, `Aviso General` |
| Mascota | Dropdown | ❌ | Lista de mascotas del usuario. Default: `Ninguna (mascota genérica)` |
| Descripción | Textarea | ❌ | Máx. 300 caracteres. Placeholder descriptivo |
| Teléfono de Contacto | Input tel | ✅ | Validación de formato. Placeholder `Ej. +54 11 1234-5678` |
| Foto | File picker | ❌ | JPG, PNG, GIF. Máx 5MB |

**Estilo del formulario:**
- Fondo blanco, border radius `20px` arriba, sombra superior.
- Título bold 18px con ícono 🚨.
- Inputs con borde `1.5px #DDDDDD`, border radius `10px`, padding `12px`.
- Dropdowns con flecha ▼ a la derecha.
- **Botón "Crear Cartel"**: fondo verde teal `#2DBD72`, texto blanco bold, pill.
- **Botón "Cancelar"**: fondo gris oscuro `#4A4A4A`, texto blanco bold, pill.
- Ambos botones en la misma fila, 50% de ancho cada uno.

#### Paso 4: Confirmación
- Al crear exitosamente, el formulario se cierra y aparece un **toast banner** en la parte superior del mapa:
  - Texto: `"Cartel creado exitosamente"` con ícono ✅.
  - Fondo verde teal `#2DBD72`, texto blanco.
  - Se muestra 3 segundos y desaparece con fade-out.
  - El nuevo marker aparece en el mapa en la posición seleccionada.

#### Paso 5: Eliminar cartel
- Al tocar el popup de un cartel propio y presionar "Eliminar Cartel":
  - Diálogo de confirmación: `"¿Eliminar este cartel? Esta acción no se puede deshacer."` con botones `[Cancelar]` y `[Eliminar]`.
  - Si confirma: el marker desaparece del mapa y se muestra toast `"Cartel eliminado"`.

---

### Panel Inferior Deslizable (Bottom Sheet)

El panel inferior es un **bottom sheet** persistente con 3 estados:

| Estado | Altura visible | Descripción |
|---|---|---|
| Colapsado | ~80px | Solo se ve el handle y los tabs |
| Medio | ~45% de la pantalla | Vista por defecto al entrar |
| Expandido | ~90% de la pantalla | Cubre casi todo el mapa |

- **Handle**: barra gris redondeada (`40px × 4px`, `#CCCCCC`) centrada en la parte superior del panel.
- **Fondo del panel**: blanco `#FFFFFF`.
- **Border radius superior**: `20px` en las esquinas top-left y top-right.
- **Sombra superior**: `0px -4px 20px rgba(0,0,0,0.1)`.
- El panel se puede arrastrar hacia arriba/abajo para cambiar de estado.

#### Tabs del Panel

5 tabs en una fila horizontal con scroll horizontal si no entran:

| Tab | Ícono | Contenido |
|---|---|---|
| **Amigos** | 👥 | Lista de amigos y sus ubicaciones en el mapa |
| **Servicios** | 🏪 | Lista de servicios visibles en el área actual del mapa |
| **Solicitudes** | 🔔 | Solicitudes de amistad recibidas + chats activos |
| **Buscar** | 🔍 | Buscador de perfiles de usuarios |

**Estilo de los tabs:**
- Tab activo: fondo verde teal `#2DBD72`, texto blanco bold, border radius `20px`, padding `8px 16px`.
- Tab inactivo: sin fondo, texto gris `#6B6B6B`, regular.
- Separador inferior de los tabs: `1px #EEEEEE`.

---

#### Tab: Amigos

- Título de sección: `👥 Mis Amigos` bold, a la izquierda.
- Dropdown/selector a la derecha: `Solo para amigos ▼` — filtra si se ven solo amigos o todos los usuarios en el mapa.
- **Lista de amigos**: cada ítem tiene:
  - Avatar circular (40px) con borde de color según si está online (verde) u offline (gris).
  - Nombre del amigo, bold, 14px.
  - Nombre de su mascota + distancia aproximada: `Luna · 1.2 km`.
  - Botón pequeño "Ver en mapa" que centra el mapa en su ubicación.
- Si no hay amigos: texto `"No tenés amigos agregados aún"` centrado, gris, con ícono de personas.
- Al tocar un amigo de la lista: el mapa se centra en su ubicación y resalta su marker.

---

#### Tab: Servicios

- Muestra los servicios (veterinarias, paseadores, pet shops, peluquerías) presentes en el **área visible actual del mapa**.
- Si el usuario mueve el mapa, la lista se actualiza automáticamente (debounce 800ms).
- Cada ítem de la lista tiene:
  - Ícono del tipo de servicio a la izquierda (color según tabla de markers).
  - Nombre del servicio, bold, 14px.
  - Dirección, gris, 12px.
  - Distancia aproximada desde el usuario, verde teal, 12px, a la derecha.
- Al tocar un ítem: centra el mapa en ese servicio y abre su popup.
- Filtro por tipo de servicio: chips horizontales al tope de la lista (`Todos` · `Veterinaria` · `Paseador` · `Pet Shop` · `Peluquería`).

---

#### Tab: Solicitudes

Dividido en dos subsecciones con scroll vertical:

**Solicitudes de Amistad (recibidas)**
- Cada solicitud muestra: avatar + nombre del solicitante + botones `[Aceptar ✓]` (verde) y `[Rechazar ✕]` (rojo outline).
- Al aceptar: se agrega como amigo, su marker aparece en el mapa, toast de confirmación.
- Al rechazar: desaparece de la lista.

**Chats Activos**
- Lista de conversaciones de match o solicitud. Cada ítem: avatar + nombre + último mensaje truncado + timestamp.
- Al tocar un chat: navega a la pantalla de chat correspondiente.
- Badge con número de mensajes no leídos en rojo sobre el avatar.

---

#### Tab: Buscar

- Input de búsqueda al tope: `🔍 Buscar usuarios...`, fondo gris claro `#F5F5F5`, border radius `20px`.
- La búsqueda se realiza por nombre de usuario o nombre de mascota.
- Resultados: lista de cards con avatar, nombre, nombre de mascota, barrio. Botón `[+ Agregar]` a la derecha si aún no son amigos, o `[✓ Amigos]` si ya lo son (deshabilitado).
- Debounce de 400ms antes de hacer el request al backend.
- Estado vacío: `"Buscá amigos por nombre o mascota"` con ícono de lupa.

---

### Flujo — Agregar Amigo (botón flotante)

- Al tocar "Agregar Amigo" en el mapa, se abre el **mismo buscador** del Tab Buscar, pero como modal overlay.
- El usuario busca por nombre, selecciona un perfil y envía la solicitud.
- Toast de confirmación: `"Solicitud enviada a [Nombre]"`.

---

## DISEÑO BACKEND

### Modelos de Datos

#### Entidad `Cartel`
```json
{
  "id": "uuid",
  "usuario_id": "uuid",
  "mascota_id": "uuid | null",
  "tipo": "perdida | encontrada | adopcion | aviso_general",
  "descripcion": "string | null",
  "telefono_contacto": "string",
  "foto_url": "string | null",
  "lat": "float",
  "lng": "float",
  "activo": "boolean",
  "created_at": "timestamp"
}
```

#### Entidad `Servicio`
```json
{
  "id": "uuid",
  "tipo": "veterinaria | paseador | petshop | peluqueria",
  "nombre": "string",
  "direccion": "string",
  "telefono": "string",
  "descripcion": "string",
  "lat": "float",
  "lng": "float",
  "google_maps_url": "string | null",
  "verified": "boolean"
}
```

#### Entidad `Amistad`
```json
{
  "id": "uuid",
  "usuario_a_id": "uuid",
  "usuario_b_id": "uuid",
  "estado": "pendiente | aceptada | rechazada",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### Entidad `UbicacionUsuario`
```json
{
  "usuario_id": "uuid",
  "lat": "float",
  "lng": "float",
  "updated_at": "timestamp",
  "compartir_ubicacion": "boolean"
}
```
- Solo se almacena la ubicación si `compartir_ubicacion: true` (el usuario da permiso explícito).
- Se actualiza periódicamente desde el cliente (cada 30 segundos si la app está activa).

---

### Endpoints

#### `GET /api/v1/comunidad/mapa`

Devuelve todos los elementos del mapa dentro de un bounding box dado. Se llama al cargar la pantalla y cuando el usuario mueve el mapa significativamente (debounce 800ms).

**Query params:**
- `lat_min`, `lat_max`, `lng_min`, `lng_max`: coordenadas del área visible del mapa.
- `tipos`: comma-separated, ej. `veterinaria,paseador,cartel,amigos`.

**Response (200):**
```json
{
  "servicios": [
    {
      "id": "s001",
      "tipo": "veterinaria",
      "nombre": "Clínica Neurológica Veterinaria",
      "direccion": "Av. Pueyrredón 3456, CABA",
      "telefono": "+54 11 4789-4567",
      "descripcion": "Neurología y Neurocirugía",
      "lat": -34.5983,
      "lng": -58.4071,
      "google_maps_url": "https://maps.google.com/?q=-34.5983,-58.4071"
    }
  ],
  "carteles": [
    {
      "id": "c001",
      "usuario_id": "u001",
      "tipo": "perdida",
      "mascota_nombre": "Titán",
      "mascota_especie": "perro",
      "mascota_raza": "Labrador Retriever",
      "descripcion": "Es de color dorado y tiene un lunar en el ojo derecho.",
      "telefono_contacto": "+54 9 12345678",
      "publicado_por": "usuario usuario",
      "foto_url": null,
      "lat": -34.6037,
      "lng": -58.3816,
      "created_at": "2026-03-16T08:52:00Z"
    }
  ],
  "amigos": [
    {
      "usuario_id": "u002",
      "nombre": "Sofía",
      "foto_perfil_url": "https://cdn.zooni.com/users/sofia.jpg",
      "lat": -34.6010,
      "lng": -58.3890,
      "mascota_nombre": "Luna"
    }
  ]
}
```

---

#### `POST /api/v1/carteles`

Crea un nuevo cartel en el mapa.

**Body (multipart/form-data):**
```
tipo: "perdida"
mascota_id: "m001" (opcional)
descripcion: "Es de color dorado..."
telefono_contacto: "+54 9 12345678"
lat: -34.6037
lng: -58.3816
foto: [archivo binario] (opcional)
```

**Response (201):**
```json
{
  "mensaje": "Cartel creado exitosamente",
  "cartel": { "id": "c002", "lat": -34.6037, "lng": -58.3816, ... }
}
```

---

#### `DELETE /api/v1/carteles/:id`

Elimina un cartel. Solo puede hacerlo el dueño del cartel.

**Lógica backend:** verificar que `cartel.usuario_id === usuario_autenticado.id`. Si no coincide, devolver `403 Forbidden`.

```json
// Response 200
{ "mensaje": "Cartel eliminado correctamente" }

// Response 403
{ "error": "No tenés permiso para eliminar este cartel" }
```

---

#### `PUT /api/v1/ubicacion`

Actualiza la ubicación en tiempo real del usuario. Llamado desde el cliente cada 30 segundos si la app está activa y el usuario tiene `compartir_ubicacion: true`.

```json
// Body
{ "lat": -34.6037, "lng": -58.3816 }

// Response 200
{ "mensaje": "Ubicación actualizada" }
```

---

#### `GET /api/v1/amigos`

Devuelve la lista de amigos del usuario con sus datos básicos.

```json
// Response 200
{
  "amigos": [
    {
      "usuario_id": "u002",
      "nombre": "Sofía",
      "foto_perfil_url": "https://cdn.zooni.com/users/sofia.jpg",
      "mascota_nombre": "Luna",
      "distancia_km": 1.2,
      "online": true
    }
  ]
}
```

---

#### `POST /api/v1/amigos/solicitud`

Envía una solicitud de amistad.

```json
// Body
{ "usuario_destino_id": "u003" }

// Response 201
{ "mensaje": "Solicitud enviada correctamente" }

// Response 409 — ya existe solicitud o ya son amigos
{ "error": "Ya existe una solicitud o ya son amigos" }
```

---

#### `PATCH /api/v1/amigos/solicitud/:id`

Acepta o rechaza una solicitud de amistad.

```json
// Body
{ "accion": "aceptar" }  // o "rechazar"

// Response 200 — aceptar
{ "mensaje": "Solicitud aceptada. ¡Ahora son amigos!", "amistad_id": "a001" }

// Response 200 — rechazar
{ "mensaje": "Solicitud rechazada" }
```

---

#### `GET /api/v1/usuarios/buscar`

Busca usuarios por nombre o nombre de mascota.

**Query params:**
- `q`: string de búsqueda (mínimo 2 caracteres).

```json
// Response 200
{
  "resultados": [
    {
      "usuario_id": "u005",
      "nombre": "Lucas",
      "foto_perfil_url": "https://cdn.zooni.com/users/lucas.jpg",
      "mascota_nombre": "Rocky",
      "barrio": "Belgrano",
      "es_amigo": false
    }
  ]
}
```

---

#### `GET /api/v1/comunidad/servicios`

Devuelve los servicios del área visible. Alternativa al endpoint general de mapa, para el tab Servicios del panel.

**Query params:** mismos bounding box + `tipo` opcional.

---

### Ubicación en Tiempo Real — Arquitectura

Para ver la ubicación de amigos en tiempo real se recomienda una de estas dos soluciones:

**Opción A — Polling (más simple, recomendada para el MVP)**
- El cliente llama a `GET /api/v1/comunidad/mapa` cada **30 segundos** para refrescar posiciones.
- Pros: simple de implementar. Contras: no es instantáneo.

**Opción B — WebSockets (más avanzado)**
- El servidor mantiene una conexión WebSocket con cada cliente activo.
- Cuando un usuario actualiza su ubicación (`PUT /api/v1/ubicacion`), el servidor notifica via WebSocket a todos sus amigos que tienen la pantalla Comunidad abierta.
- Pros: tiempo real verdadero. Contras: mayor complejidad de infraestructura.
- Librería recomendada: **Socket.io** (Node.js) o equivalente.

---

### Datos de Servicios (Veterinarias, Pet Shops, etc.)

Los servicios pueden poblarse de dos maneras:

**Opción A — Base de datos propia (recomendada)**
- El equipo carga manualmente los servicios verificados en la tabla `servicios`.
- Los usuarios pueden sugerir nuevos lugares (flujo de sugerencia a implementar en el futuro).
- Ventaja: control total sobre la calidad de los datos.

**Opción B — Google Places API**
- Usar `Nearby Search` de Google Places API para buscar servicios dinámicamente en el bounding box.
- Endpoint: `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=LAT,LNG&radius=2000&type=veterinary_care&key=API_KEY`
- Ventaja: datos siempre actualizados sin carga manual. Desventaja: costo por request y posibles inexactitudes en categorías.
- **Recomendación para el proyecto**: usar la Opción A como MVP y evaluar la integración con Places API en una segunda iteración.

---

### Consideraciones de Performance

- El endpoint `/comunidad/mapa` no debe devolver más de **50 markers** por request para no saturar el frontend. Si hay más, priorizar los más cercanos al centro del bounding box.
- Las imágenes de carteles deben servirse desde CDN con caché.
- La tabla `carteles` debe tener índice geoespacial (`POINT` con `SPATIAL INDEX` en MySQL, o `GEOGRAPHY` con índice GiST en PostgreSQL) para queries por bounding box eficientes.
- La tabla `ubicaciones_usuarios` debe actualizarse de forma asíncrona (queue/worker) para no bloquear el hilo principal.

---

## Consideraciones Adicionales

### Privacidad de Ubicación
- La ubicación exacta de los usuarios solo es visible para sus **amigos confirmados**, nunca para el público general.
- El usuario puede desactivar el compartir ubicación desde Configuración, en cuyo caso su marker no aparece en el mapa de ningún amigo.
- En el mapa general (servicios y carteles), no se muestran ubicaciones de usuarios no amigos.

### Permisos Mobile
- Al entrar a Comunidad por primera vez, solicitar permiso de geolocalización con un mensaje explicativo: `"Zooni necesita tu ubicación para mostrarte servicios y amigos cercanos"`.
- Si el permiso es denegado: mostrar banner informativo y usar la ciudad del perfil como fallback.

### Accesibilidad
- Los markers del mapa deben tener `accessibilityLabel`: `"Veterinaria: Clínica Neurológica, 2.1 km"`.
- Los botones flotantes deben tener labels descriptivos.
- El panel inferior debe ser navegable con lectores de pantalla.

### Edge Cases

| Situación | Comportamiento |
|---|---|
| Sin permiso de ubicación | Mapa centrado en Buenos Aires + banner explicativo |
| Sin conexión | Mostrar último estado cacheado del mapa + banner "Sin conexión" |
| Cartel con foto que no carga | Mostrar placeholder gris con ícono de imagen |
| Formulario de cartel enviado sin teléfono | Validación inline: `"El teléfono de contacto es requerido"` |
| Usuario intenta eliminar cartel ajeno | Botón no visible + error 403 del backend si se intenta via API |
| Muchos markers en la misma zona | Clustering automático con número de markers agrupados |
| Mapa movido fuera del área con datos | Refresh automático del endpoint con el nuevo bounding box |

---

*Este documento debe leerse junto a `Instruccion.md`. Ante cualquier duda de estilo, color o tipografía, el documento base tiene prioridad.*