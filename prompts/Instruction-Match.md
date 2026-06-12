# Zooni — Instrucciones Detalladas: Pantalla Match

 Este documento extiende `Instruction-Home.md` (documento base de diseño). Todo lo definido allí aplica aquí también. Este archivo agrega las especificaciones propias de la pantalla **Match**.

---

## Descripción General

La pantalla **Match** permite a los usuarios descubrir otras mascotas cercanas y conectar con sus dueños. La mecánica es similar a apps de swipe (estilo Tinder), pero centrada en mascotas. El objetivo es que dos usuarios que se quieran conocer gente nueva a partir de su mascota puedan iniciar una conversación.

La pantalla tiene tres vistas principales:
1. **Vista de exploración** — tarjeta central con foto real de mascota + info del dueño.
2. **Vista de Match** — overlay/modal de celebración cuando hay match mutuo.
3. **Pantalla de Filtros** — pantalla separada para configurar qué perfiles se muestran.

---

## Flujo de Usuario

```
Usuario entra a Match
    → Se carga el stack de perfiles filtrados
    → Ve la tarjeta del primer perfil

Acciones sobre la tarjeta:
    → Toca ❤️ (corazón verde)    → Like. Si hay match mutuo → Vista de Match
    → Toca ✖️ (cruz roja)         → Skip. Pasa al siguiente perfil
    → Arrastra tarjeta → derecha → Like (mismo efecto que ❤️)
    → Arrastra tarjeta → izquierda → Skip (mismo efecto que ✖️)
    → Toca ↩️ (flecha atrás)      → Vuelve al perfil anterior (si existe)
    → Toca ⭐ (estrella)          → Sin funcionalidad por ahora (botón visible pero inactivo)
    → Toca "Filtros"              → Navega a pantalla Filtros

Vista de Match (overlay):
    → Toca "Enviar mensaje"       → Navega al chat con ese usuario
    → Toca "Seguir explorando"    → Cierra el overlay, continúa con el siguiente perfil

Pantalla Filtros:
    → Configura filtros
    → Toca "Ver resultados"       → Vuelve a Match con el stack recargado
    → Toca "Resetear"             → Limpia todos los filtros a valores default
    → Toca ↩️ (flecha atrás)      → Vuelve a Match sin aplicar cambios
```

---

## DISEÑO FRONTEND

### Vista General — Pantalla de Exploración

```
┌─────────────────────────────┐
│  [☰]               [Filtros]│  ← Header
├─────────────────────────────┤
│                             │
│   ┌─────────────────────┐   │
│   │ [foto dueño] [avatar]│   │
│   │                     │   │
│   │   FOTO REAL         │   │  ← Tarjeta central
│   │   MASCOTA           │   │
│   │                     │   │
│   │ Sofía, 26           │   │
│   │ 📍 Palermo, Bs. As. │   │
│   │ [tag] [tag] [tag]   │   │
│   └─────────────────────┘   │
│                             │
│   [↩️]  [✖️]  [❤️]  [⭐]     │  ← Botones de acción
└─────────────────────────────┘
```

---

### Zona 1 — Header

- **Izquierda**: ícoícono hamburguesa ☰, color #2C2C2C, 24px. Abre el drawer lateral (igual que en todas las pantallas).
- **Centro**: vacío. No se muestra ningún título ni logo.
- **Derecha**: botón pill Filtros con fondo amarillo dorado #F5C842, texto bold 14px #2C2C2C, border-radius 20px, padding 8px 16px, ícono de filtro (embudo) a la izquierda. Al tocarlo navega a la pantalla Filtros.
- **Fondo del header**: transparente (se ve el fondo de la pantalla, igual que en Home).
- **Altura**: ~56px. Separador inferior sutil `1px rgba(0,0,0,0.06)`.
- **Padding horizontal**: 20px.

---

### Zona 2 — Tarjeta Central (Card de Perfil)

La tarjeta es el elemento principal de la pantalla. Ocupa ~75% de la altura total de la pantalla.

#### Contenedor de la Tarjeta

| Propiedad | Valor |
|---|---|
| Fondo | Blanco `#FFFFFF` |
| Border radius | `24px` |
| Sombra | `0px 8px 24px rgba(0, 0, 0, 0.14)` |
| Margin horizontal | `20px` a cada lado |
| Overflow | `hidden` (para que la imagen respete el radius) |

#### Foto de la Mascota

- Ocupa el **100% del ancho** de la tarjeta y aproximadamente el **70% de su altura**.
- Es una **foto real** de la mascota (no ilustración IA). Subida por el dueño desde su perfil.
- `object-fit: cover`, sin distorsión.
- **No tiene borde ni marco.**

#### Foto de Perfil del Dueño

- Posición: **esquina superior izquierda** de la tarjeta, con un pequeño offset de 12px desde los bordes.
- Tamaño: **48px × 48px**, circular (`border-radius: 50%`).
- Borde: **3px sólido blanco** `#FFFFFF` para separarse de la foto de fondo.
- Es la foto de perfil real del dueño.

#### Avatar de la Mascota (IA)

- Posición: **esquina inferior derecha de la foto del dueño** (superpuesto, offset -12px x e -12px y respecto al círculo del dueño).
- Tamaño: **32px × 32px**, circular.
- Borde: **2px sólido blanco**.
- Es el avatar ilustrado/IA generado por el equipo para esa mascota.
- Funciona como indicador visual de qué mascota pertenece al dueño.

#### Sección de Información (parte inferior de la tarjeta)

Ocupa el **30% inferior** de la tarjeta. Tiene un gradiente de fondo oscuro semitransparente para legibilidad del texto sobre la foto:

```
background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)
```

Contenido de arriba a abajo dentro de esta zona:

1. **Nombre y edad del dueño**
   - Texto: `Sofía, 26`
   - Tipografía: `Nunito ExtraBold`, 22px, blanco `#FFFFFF`.

2. **Barrio y ciudad**
   - Texto: `📍 Palermo, Buenos Aires`
   - Tipografía: Regular, 13px, blanco con opacidad `rgba(255,255,255,0.85)`.
   - Ícono de pin 📍 a la izquierda.

3. **Tags de intereses / características**
   - Chips/pills con fondo semitransparente oscuro `rgba(0,0,0,0.45)` o blanco con opacidad `rgba(255,255,255,0.2)`.
   - Texto blanco, 12px, bold.
   - Border radius: `20px`, padding `4px 12px`.
   - El primero muestra la **raza de la mascota** (ej: `🐕 Golden Retriever`).
   - Los siguientes muestran **intereses** del dueño/mascota: `Paseos`, `Parques`, `Adopción`, etc. (provienen del perfil del usuario).
   - Máximo 4 tags visibles. Si hay más, mostrar `+N`.
   - Los tags se ubican en una fila con `flexWrap: wrap` y `gap: 6px`.

#### Gestos de Swipe

- **Arrastrar a la derecha**: aparece overlay verde con ícono ❤️ grande en la tarjeta (feedback visual). Al soltar con suficiente velocidad o distancia (umbral: >30% del ancho) → acción Like.
- **Arrastrar a la izquierda**: aparece overlay rojo con ícono ✖️ grande. Al soltar → acción Skip.
- **Animación de salida**: la tarjeta sale volando con rotación leve (±15°) en la dirección del swipe (300ms ease-out).
- **Tarjeta siguiente**: se ve ligeramente detrás de la tarjeta actual, escalada al 95%, para dar sensación de stack.
- Si no hay más perfiles: mostrar estado vacío (ver Edge Cases).

---

### Zona 3 — Botones de Acción

4 botones circulares alineados horizontalmente en la parte inferior de la pantalla.

| Botón | Ícono | Tamaño | Fondo | Color ícono | Función |
|---|---|---|---|---|---|
| Volver | ↩️ flecha | 44px | Blanco con sombra | Gris `#AAAAAA` | Vuelve al perfil anterior |
| Skip | ✖️ | 56px | Blanco con sombra | Rojo `#E63946` | Saltea el perfil actual |
| Like | ❤️ | 68px | Verde teal `#2DBD72` | Blanco | Da like al perfil |
| Estrella | ⭐ | 44px | Blanco con sombra | Amarillo `#F5C842` | Sin funcionalidad (inactivo) |

- Sombra general de botones: `0px 4px 12px rgba(0,0,0,0.12)`.
- El botón ❤️ es el más grande (CTA principal), centrado.
- El botón ⭐ se renderiza pero con `opacity: 0.5` para indicar que está inactivo. No dispara ninguna acción al tocarlo.
- El botón ↩️ solo está habilitado si hay un perfil anterior en el historial de la sesión. Si no hay anterior, se muestra con `opacity: 0.3` y no es tappable.
- Todos los botones tienen `border-radius: 50%`.
- Espaciado entre botones: distribuidos con `justify-content: center`, `gap: 16px`.

---

### Vista de Match — Overlay

Cuando dos usuarios se dieron like mutuamente, se muestra este overlay **sobre la pantalla de exploración**.

#### Fondo

- La tarjeta anterior se ve desenfocada detrás (`blur: 4px`).
- Overlay oscuro semitransparente: `rgba(0,0,0,0.6)`.

#### Contenido del Overlay (centrado verticalmente)

1. **Título**: `¡Es un Match! 🎉`
   - Tipografía: `Nunito ExtraBold`, 30px, blanco `#FFFFFF`.
   - Animación de entrada: scale 0 → 1, bounce (spring), 500ms.

2. **Subtítulo**: `A vos y a [Nombre] les gustaron sus mascotas`
   - Tipografía: Regular, 16px, blanco con opacidad `rgba(255,255,255,0.85)`.
   - El nombre es dinámico (nombre del otro usuario).

3. **Avatares de los dos usuarios**
   - Dos fotos de perfil circulares (64px), una del usuario actual y otra del match.
   - Entre ellas, un ícono de corazón verde `#2DBD72` (32px).
   - Animación: los dos avatares entran desde los costados (slide-in) y convergen al centro, 400ms.

4. **Botón "Enviar mensaje"**
   - Fondo verde teal `#2DBD72`, texto blanco bold, ícono de chat 💬 a la izquierda.
   - Pill, alto 52px, width ~240px.
   - Acción: navega al chat con ese usuario.

5. **Botón "Seguir explorando"**
   - Fondo oscuro semitransparente `rgba(255,255,255,0.15)`, borde blanco `1px`, texto blanco bold.
   - Pill, alto 52px, width ~240px.
   - Acción: cierra el overlay, siguiente perfil.

---

### Pantalla de Filtros

Pantalla separada (no modal) que se abre al tocar el botón "Filtros" del header.

#### Header de Filtros

- **Izquierda**: flecha ← para volver sin aplicar cambios.
- **Centro**: ícono 🐾 + título `Filtros`, bold, 18px.
- **Derecha**: botón texto `Resetear` en rojo `#E63946`, 14px. Limpia todos los filtros a valores default.
- Fondo blanco, separador inferior.

#### Secciones de Filtros

El fondo general de la pantalla es blanco `#FFFFFF`. Cada sección tiene un título en mayúsculas, pequeño, gris medio `#6B6B6B`, con un ícono a la izquierda. Las secciones están separadas por cards con fondo blanco, border radius `16px` y sombra suave.

---

##### Sección 1 — 📍 UBICACIÓN

**Distancia máxima**
- Slider horizontal, valor mínimo `1 km`, máximo `100 km`.
- Color del track activo: verde teal `#2DBD72`.
- El valor actual se muestra en texto verde teal a la derecha del label: `10 km`.
- Thumb del slider: círculo blanco con borde verde teal.

**Solo usuarios cercanos**
- Toggle switch. Activado: verde teal. Desactivado: gris.
- Cuando está activo, prioriza perfiles muy cercanos (< 5 km) independientemente del slider.

---

##### Sección 2 — 🐾 TIPO DE MASCOTA

Selector de chips múltiple. El usuario puede elegir uno o varios tipos:

| Chip | Ícono |
|---|---|
| Perro | 🐶 |
| Gato | 🐱 |
| Conejo | 🐰 |
| Ave | 🐦 |
| Pez | 🐠 |
| Reptil | 🦎 |
| Cualquiera | — (sin ícono, opción default) |

- **Chip seleccionado**: fondo verde teal `#2DBD72`, texto blanco, border none.
- **Chip no seleccionado**: fondo blanco, borde `1.5px` gris `#DDDDDD`, texto `#2C2C2C`.
- Border radius: `20px`. Padding: `8px 14px`. Gap entre chips: `8px`. Wrap en múltiples filas.
- Si se selecciona "Cualquiera", se deseleccionan los demás automáticamente y viceversa.

---

##### Sección 3 — 🎂 EDAD DE LA MASCOTA

**Rango de edad** (slider de dos extremos — range slider)
- Valor mínimo: `Cachorro` (0 meses).
- Valor máximo: `20+ años`.
- El rango seleccionado se muestra en texto verde teal a la derecha del label: ej. `0 – 5 años`.
- Track del rango activo en verde teal.

---

##### Sección 4 — ⭐ INTERESES EN COMÚN

Selector de chips múltiple, igual estilo que Tipo de Mascota. Opciones:

`Paseos` · `Parques` · `Adopción` · `Juegos` · `Entrenamiento` · `Exposiciones` · `Natación` · `Socialización` · `Cuidado` · `Otros`

El usuario selecciona sus intereses y el algoritmo prioriza perfiles que compartan al menos uno.

---

##### Sección 5 — 👤 PERFIL DEL DUEÑO *(sección adicional recomendada)*

**Rango de edad del dueño** (range slider)
- Mínimo: 18 años. Máximo: 65+.
- Default: `18 – 65+`.

**Género** (chips opcionales): `Todos` · `Femenino` · `Masculino` · `No binario`

---

#### Botón "Ver resultados"

- Fijo al fondo de la pantalla (`position: sticky bottom`).
- Fondo verde teal `#2DBD72`, texto blanco bold, 16px.
- Muestra el número de perfiles que coinciden con los filtros actuales: `Ver resultados  6`.
- El número se actualiza en tiempo real mientras el usuario ajusta los filtros (debounce de 500ms antes de reconsultar).
- Alto: 56px. Border radius: `30px`. Margin horizontal: `20px`. Sombra verde.

---

### Animaciones y Feedback Visual

| Acción | Animación |
|---|---|
| Swipe derecha | Overlay verde con ❤️, rotación +15°, salida hacia derecha |
| Swipe izquierda | Overlay rojo con ✖️, rotación -15°, salida hacia izquierda |
| Tap ❤️ | Pulso (scale 1 → 1.2 → 1) en el botón, luego animación de salida de tarjeta |
| Tap ✖️ | Vibración leve (haptic), salida de tarjeta hacia izquierda |
| Match detectado | Confetti + overlay con animación de entrada bounce |
| Cargar siguiente perfil | Nueva tarjeta entra desde el centro (scale 0.95 → 1) |

---

### Estados de Carga y Edge Cases

| Situación | Comportamiento |
|---|---|
| Cargando perfiles | Skeleton loader con la forma de la tarjeta (gris animado) |
| Sin más perfiles disponibles | Ilustración + texto "No hay más perfiles por ahora. Volvé más tarde 🐾" + botón "Ajustar filtros" |
| Sin conexión | Banner "Sin conexión" + mostrar últimos perfiles cacheados si existen |
| El otro usuario eliminó su cuenta | Ese perfil no aparece en el stack (filtrado en backend) |
| El usuario ya vio ese perfil | No vuelve a aparecer (ver lógica de historial en backend) |
| Foto de mascota no carga | Placeholder gris con silueta de mascota genérica |

---

## DISEÑO BACKEND

### Modelo de Datos

#### Entidad `PerfilMatch`
Extiende la entidad `User` + `Mascota` con los datos necesarios para mostrar en la tarjeta.

```json
{
  "usuario_id": "uuid",
  "nombre": "string",
  "edad": "number",
  "foto_perfil_url": "string",
  "barrio": "string",
  "ciudad": "string",
  "mascota": {
    "id": "uuid",
    "nombre": "string",
    "especie": "string",
    "raza": "string",
    "edad_anios": "number",
    "foto_real_url": "string",
    "avatar_url": "string"
  },
  "intereses": ["string"],
  "distancia_km": "number"
}
```

- `foto_real_url`: foto real de la mascota subida por el dueño.
- `avatar_url`: avatar ilustrado/IA de la mascota.
- `intereses`: lista de strings (ej: `["Paseos", "Parques"]`).
- `distancia_km`: calculado dinámicamente en el backend según la ubicación del usuario autenticado.

#### Entidad `Like`
```json
{
  "id": "uuid",
  "usuario_origen_id": "uuid",
  "usuario_destino_id": "uuid",
  "created_at": "timestamp"
}
```

#### Entidad `Match`
```json
{
  "id": "uuid",
  "usuario_a_id": "uuid",
  "usuario_b_id": "uuid",
  "created_at": "timestamp",
  "chat_id": "uuid"
}
```
Al crearse un Match, se crea automáticamente un `Chat` vacío entre los dos usuarios.

#### Entidad `Skip`
```json
{
  "id": "uuid",
  "usuario_origen_id": "uuid",
  "usuario_destino_id": "uuid",
  "created_at": "timestamp"
}
```
Se registra para no volver a mostrar ese perfil.

#### Entidad `FiltrosMatch` (por usuario)
```json
{
  "user_id": "uuid",
  "distancia_max_km": 10,
  "solo_cercanos": true,
  "tipos_mascota": ["perro", "gato"],
  "edad_mascota_min_meses": 0,
  "edad_mascota_max_meses": 60,
  "intereses": ["Paseos", "Parques"],
  "edad_dueno_min": 18,
  "edad_dueno_max": 65,
  "genero_dueno": ["todos"]
}
```

---

### Endpoints

#### `GET /api/v1/match/perfiles`

Devuelve el stack de perfiles para mostrar al usuario, ya filtrados y ordenados.

**Headers**: `Authorization: Bearer <token>`

**Lógica del backend:**
1. Obtener la ubicación actual del usuario (enviada como query param o almacenada en su perfil).
2. Excluir perfiles que el usuario ya vio (registros en `likes` y `skips`).
3. Excluir perfiles con los que ya tiene un `Match`.
4. Filtrar según los `FiltrosMatch` del usuario.
5. Calcular la distancia con la fórmula **Haversine** entre coordenadas.
6. Ordenar: primero los que tengan intereses en común, luego por distancia.
7. Devolver un batch de **10 perfiles** (paginación por cursor).

**Query params:**
- `lat` y `lng`: coordenadas actuales del usuario (requeridos).
- `cursor`: ID del último perfil visto (para paginación).

**Response (200):**
```json
{
  "perfiles": [
    {
      "usuario_id": "u001",
      "nombre": "Sofía",
      "edad": 26,
      "foto_perfil_url": "https://cdn.zooni.com/users/sofia.jpg",
      "barrio": "Palermo",
      "ciudad": "Buenos Aires",
      "distancia_km": 2.4,
      "mascota": {
        "id": "m001",
        "nombre": "Luna",
        "especie": "perro",
        "raza": "Golden Retriever",
        "edad_anios": 3,
        "foto_real_url": "https://cdn.zooni.com/mascotas/luna_real.jpg",
        "avatar_url": "https://cdn.zooni.com/mascotas/luna_avatar.png"
      },
      "intereses": ["Paseos", "Parques"]
    }
  ],
  "cursor_siguiente": "u005",
  "hay_mas": true
}
```

---

#### `POST /api/v1/match/like`

Registra un like del usuario autenticado hacia otro usuario.

```json
// Body
{ "usuario_destino_id": "u001" }

// Response 200 — sin match todavía
{ "match": false }

// Response 200 — hay match mutuo
{
  "match": true,
  "match_id": "mx001",
  "chat_id": "ch001",
  "usuario_match": {
    "nombre": "Sofía",
    "foto_perfil_url": "https://cdn.zooni.com/users/sofia.jpg"
  }
}
```

**Lógica de detección de match:**
```
Al recibir el like de usuario A hacia usuario B:
    → Verificar si existe un Like de B hacia A en la tabla `likes`
    → SI existe:
        → Crear registro en tabla `matches` (usuario_a: A, usuario_b: B)
        → Crear Chat vacío asociado al match
        → Enviar push notification a ambos usuarios: "¡Tienen un Match! 🎉"
        → Retornar { match: true, ... }
    → NO existe:
        → Solo guardar el like
        → Retornar { match: false }
```

---

#### `POST /api/v1/match/skip`

Registra que el usuario saltó un perfil (para no volver a mostrarlo).

```json
// Body
{ "usuario_destino_id": "u002" }

// Response 200
{ "mensaje": "Perfil omitido" }
```

---

#### `GET /api/v1/match/filtros`

Obtiene los filtros guardados del usuario.

```json
// Response 200
{
  "distancia_max_km": 10,
  "solo_cercanos": true,
  "tipos_mascota": ["perro"],
  "edad_mascota_min_meses": 0,
  "edad_mascota_max_meses": 60,
  "intereses": ["Paseos"],
  "edad_dueno_min": 18,
  "edad_dueno_max": 65
}
```

---

#### `PUT /api/v1/match/filtros`

Guarda o actualiza los filtros del usuario.

```json
// Body — ejemplo de nuevos filtros
{
  "distancia_max_km": 20,
  "solo_cercanos": false,
  "tipos_mascota": ["perro", "gato"],
  "edad_mascota_min_meses": 0,
  "edad_mascota_max_meses": 120,
  "intereses": ["Parques", "Adopción"],
  "edad_dueno_min": 20,
  "edad_dueno_max": 40
}

// Response 200
{ "mensaje": "Filtros actualizados correctamente" }
```

---

#### `GET /api/v1/match/filtros/preview`

Devuelve la **cantidad de perfiles** que coinciden con un set de filtros dado, sin guardarlos. Se llama con debounce de 500ms mientras el usuario ajusta los sliders en la pantalla Filtros.

```json
// Body — misma estructura que PUT /filtros
{ "distancia_max_km": 15, "tipos_mascota": ["perro"], ... }

// Response 200
{ "cantidad": 6 }
```

---

### Ubicación del Usuario

- El frontend solicita permiso de geolocalización al entrar a Match por primera vez.
- La ubicación se envía como `lat` y `lng` en cada request a `/match/perfiles`.
- **No se almacena en tiempo real** en el backend por privacidad: se usa solo para el cálculo de distancia en el momento del request.
- Si el usuario niega el permiso, se usa la última ciudad registrada en su perfil como referencia aproximada.

---

### Push Notifications de Match

Cuando se detecta un match mutuo:

```json
// Notificación push a usuario A
{
  "titulo": "¡Nuevo Match! 🎉",
  "cuerpo": "A vos y a Sofía les gustaron sus mascotas",
  "redirige_a": "chat/ch001"
}

// Notificación push a usuario B (el que ya había dado like antes)
{
  "titulo": "¡Nuevo Match! 🎉",
  "cuerpo": "A vos y a [nombre de A] les gustaron sus mascotas",
  "redirige_a": "chat/ch001"
}
```

---

### Consideraciones de Performance

- El stack de 10 perfiles se **pre-cachea localmente** al cargar Match, para que el swipe sea instantáneo.
- Cuando quedan 3 perfiles en el stack local, se hace un fetch en segundo plano del siguiente batch.
- Las fotos reales de mascotas deben estar en **CDN** con caché largo y servirse en formato WebP.
- La detección de match se hace **server-side** para evitar manipulación: el cliente nunca puede declarar un match sin que el servidor lo verifique.
- Índices de base de datos recomendados: `likes(usuario_origen_id, usuario_destino_id)` y `matches(usuario_a_id, usuario_b_id)`.

---

## Consideraciones Adicionales

### Privacidad
- La ubicación exacta del usuario **nunca se muestra** en la tarjeta: solo el barrio y ciudad (datos del perfil).
- La distancia en km que se muestra es aproximada (redondeada al entero más cercano).
- Un usuario puede **bloquear** a otro desde su perfil, lo que elimina mutuamente los likes y evita que se vuelvan a ver.

### Accesibilidad
- Los botones de acción deben tener `accessibilityLabel`: `"Dar like"`, `"Saltear perfil"`, `"Volver al anterior"`.
- La tarjeta debe tener un `accessibilityLabel` con el nombre y mascota: `"Perfil de Sofía con su Golden Retriever"`.
- Los chips de filtros deben indicar su estado: `"Perro, seleccionado"` / `"Gato, no seleccionado"`.

### Edge Cases Adicionales

| Situación | Comportamiento |
|---|---|
| Usuario sin ubicación | Pedir permiso, si niega usar ciudad del perfil |
| Filtros sin resultados | Mostrar "0 resultados" en botón + sugerencia de ampliar filtros |
| El usuario retoca la tarjeta mientras anima | Ignorar inputs hasta que la animación termine (debounce) |
| Match con alguien que ya tiene chat previo | No crear nuevo chat, redirigir al chat existente |
| Conexión lenta al cargar fotos | Mostrar placeholder blur mientras carga (técnica blurhash) |

---

*Este documento debe leerse junto a `Instruccion.md`. Ante cualquier duda de estilo, color o tipografía, el documento base tiene prioridad.*