=== ZOONI — PANTALLA: CLOSET DE AVATARES ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Closet de Avatares" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde el menú lateral (drawer) pasando el `petId` como parámetro de ruta. A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
DESCRIPCIÓN FUNCIONAL
──────────────────────────────────────

El Closet de Avatares permite al usuario cambiar el avatar ilustrado de su mascota. Los avatares son ilustraciones creadas por el equipo de Zooni y almacenadas en el servidor. El usuario selecciona un avatar del catálogo disponible (filtrado por la especie de su mascota) y lo aplica. Ese avatar pasa a ser el que se muestra en toda la app (Home, FichaMédica, Vacunas, etc.).

Flujo de usuario:
  1. Entra a Closet → Ve su avatar actual en grande.
  2. Toca un thumbnail del catálogo → El preview grande se actualiza.
  3. Si seleccionó uno DIFERENTE al actual → el botón "Aplicar Avatar" se habilita (verde).
  4. Si seleccionó el MISMO que ya tiene → el botón queda deshabilitado (gris).
  5. Toca "Aplicar Avatar" → se guarda en el backend → toast de confirmación.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto (Sequelize o Prisma, mantener consistencia)
- Autenticación: JWT. El token viaja en el header Authorization como Bearer token.
- Avatares: almacenados como assets locales en la app (require('../assets/avatares/...')).
  El backend guarda solo el nombre del asset (ej: "perro_labrador_gorro").
  El frontend resuelve la imagen con un objeto AVATAR_IMAGES similar al PET_IMAGES ya existente.

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:         #C8F0D8  (verde menta suave)
- Fondo card de preview:                  #FFFFFF
- Fondo thumbnail (normal):               #FFFFFF
- Fondo thumbnail (seleccionado):         #FFFFFF  con borde verde
- Borde thumbnail seleccionado:           #2DBD72  (verde teal, 2.5px)
- Borde thumbnail no seleccionado:        #EFEFEF  (gris muy claro, 1px)
- Botón "Aplicar Avatar" HABILITADO:      #2DBD72  (verde teal)
- Botón "Aplicar Avatar" DESHABILITADO:   #C0C0C0  (gris, no tappable)
- Texto botón habilitado:                 #FFFFFF
- Texto botón deshabilitado:              #FFFFFF  (igual pero la opacidad general del botón es 0.6)
- Texto principal:                        #2C2C2C
- Subtítulo:                              #6B6B6B
- Label "Avatar actual":                  #6B6B6B
- Overlay modal (si aplica):              rgba(0, 0, 0, 0.50)
- Badge "Actual" en thumbnail:            #2DBD72  (verde teal)

Tipografía:
- Título "👕 Closet de Avatares":          Bold, 20px, #2C2C2C, centrado
- Subtítulo "Elegí el avatar para [Nombre]": Regular, 14px, #6B6B6B, centrado
- Label "Avatar actual":                   Regular, 14px, #6B6B6B, centrado
- Texto botón "Aplicar Avatar":            Bold, 15px, #FFFFFF, centrado

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

ScrollView vertical con backgroundColor: '#C8F0D8'. NO tiene bottom tab bar.

  ┌──────────────────────────────────────────┐
  │  [☰]                                     │  ← Header mínimo
  │                                          │
  │       👕 Closet de Avatares              │  ← Título
  │    Elegí el avatar para Titán            │  ← Subtítulo
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │                                    │  │
  │  │        [avatar grande 140px]       │  │  ← Card preview (avatar actual / seleccionado)
  │  │                                    │  │
  │  │           Avatar actual            │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  Elegí un avatar:                        │  ← Label de sección
  │                                          │
  │  ┌──────┐  ┌──────┐  ┌──────┐           │
  │  │[ava1]│  │[ava2]│  │[ava3]│           │  ← Grid de thumbnails (3 por fila)
  │  └──────┘  └──────┘  └──────┘           │
  │  ┌──────┐  ┌──────┐                     │
  │  │[ava4]│  │[ava5]│                     │
  │  └──────┘  └──────┘                     │
  │                                          │
  │         [  Aplicar Avatar  ]             │  ← Botón pill (deshabilitado o habilitado)
  └──────────────────────────────────────────┘

──────────────────────────────────────
SECCIÓN 1 — HEADER
──────────────────────────────────────

- backgroundColor: 'transparent'.
- Izquierda: ícono hamburguesa ☰, 26px, color #2C2C2C, padding: 12px.
- Centro y derecha: vacíos.
- Altura: ~56px. paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — TÍTULO Y SUBTÍTULO
──────────────────────────────────────

- Título: "👕 Closet de Avatares"
  · fontFamily: Bold, fontSize: 20px, color: #2C2C2C, textAlign: 'center'.
  · El emoji 👕 va inline antes del texto (es parte del string).
  · marginBottom: 6px.

- Subtítulo: "Elegí el avatar para " + mascota.nombre (ej: "Elegí el avatar para Titán").
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B, textAlign: 'center'.
  · marginBottom: 24px.

──────────────────────────────────────
SECCIÓN 3 — CARD DE PREVIEW (avatar actual o seleccionado)
──────────────────────────────────────

Card grande centrado que muestra el avatar que el usuario tiene actualmente O el que acaba
de seleccionar en la grilla (preview en tiempo real antes de aplicar).

CONTENEDOR DEL CARD:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 20
  · paddingVertical: 28, paddingHorizontal: 24
  · alignItems: 'center'
  · marginHorizontal: 20
  · shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4
  · marginBottom: 28

AVATAR EN EL PREVIEW:
  · Imagen: AVATAR_IMAGES[avatarSeleccionado] con fallback a AVATAR_IMAGES['perro_default'].
  · width: 140, height: 140, resizeMode: 'contain'.
  · Detrás: View circular decorativo: width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#A8E6C0', opacity: 0.35, position: 'absolute'.
  · Animación al cambiar de avatar seleccionado: escala 0.85 → 1.0 en 200ms ease-out
    (se "resetea" suavemente cuando el usuario elige uno nuevo).

LABEL BAJO EL AVATAR EN EL PREVIEW:
  · Si el avatarSeleccionado === mascota.imagen_asset (el actual): texto "Avatar actual".
  · Si es diferente: texto "Vista previa".
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B, textAlign: 'center'.
  · marginTop: 12px.

──────────────────────────────────────
SECCIÓN 4 — GRID DE THUMBNAILS
──────────────────────────────────────

Un label arriba del grid:
  · Texto: "Elegí un avatar:"
  · fontFamily: Bold, fontSize: 15px, color: #2C2C2C.
  · marginHorizontal: 20, marginBottom: 14.

GRID DE THUMBNAILS:
  · Implementar con FlatList o con un View en rows (map + wrap).
  · 3 columnas por fila con espacio igual entre ellas.
  · paddingHorizontal: 20.
  · gap entre thumbnails: 12px horizontal y vertical.

CADA THUMBNAIL:
  Tamaño: calculado para 3 por fila con gap de 12px y padding de 20px a cada lado:
    width = (screenWidth - 40 - 24) / 3  ≈ 102px en pantalla de 390px.
    height = igual al width (cuadrado).
    
  Estilos:
    · backgroundColor: '#FFFFFF'
    · borderRadius: 14
    · borderWidth: según estado (ver abajo)
    · padding: 8  (espacio interno para que el avatar no pegue con el borde)
    · alignItems: 'center', justifyContent: 'center'
    · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2
    · overflow: 'hidden'

  Estados del thumbnail:

  ESTADO NORMAL (no seleccionado, no es el actual):
    · borderWidth: 1, borderColor: '#EFEFEF'.
    · Sin badge.
    · Al presionar: escala 0.94 en 100ms, vuelve en 130ms.

  ESTADO SELECCIONADO (el que el usuario tocó para previsualizar):
    · borderWidth: 2.5, borderColor: '#2DBD72'.
    · shadowColor: '#2DBD72', shadowOpacity: 0.18, shadowRadius: 6.
    · Sin badge adicional (el preview grande ya indica cuál está seleccionado).

  ESTADO ACTUAL (es el imagen_asset actual de la mascota):
    · Tiene un badge pequeño en la esquina superior derecha:
      - View circular: width: 20, height: 20, borderRadius: 10,
        backgroundColor: '#2DBD72', position: 'absolute', top: 5, right: 5.
      - Dentro: Ionicons 'checkmark', 12px, color '#FFFFFF'.
    · Si además está seleccionado: combina el borde verde del seleccionado + el badge.

  IMAGEN DENTRO DEL THUMBNAIL:
    · width: '85%', height: '85%', resizeMode: 'contain'.
    · Imagen: AVATAR_IMAGES[avatar.asset_name] con fallback.

ANIMACIÓN DE ENTRADA DEL GRID:
  · Cada thumbnail aparece con opacity 0 → 1 + scale 0.85 → 1, stagger de 50ms, duración 200ms ease-out.

──────────────────────────────────────
SECCIÓN 5 — BOTÓN "APLICAR AVATAR"
──────────────────────────────────────

BOTÓN:
  · marginHorizontal: 20, marginTop: 28, marginBottom: 40.
  · height: 52, borderRadius: 30.
  · width: '70%', alignSelf: 'center'.
  · Texto "Aplicar Avatar", Bold, 15px.

ESTADO DESHABILITADO (avatarSeleccionado === mascota.imagen_asset):
  · backgroundColor: '#C0C0C0'.
  · opacity: 0.7.
  · color texto: '#FFFFFF'.
  · disabled: true (no tappable).
  · Sin sombra.

ESTADO HABILITADO (avatarSeleccionado !== mascota.imagen_asset):
  · backgroundColor: '#2DBD72'.
  · opacity: 1.0.
  · color texto: '#FFFFFF'.
  · shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4.
  · Al presionar (pressIn): escala 0.97 en 100ms, vuelve en 150ms.
  · Mientras procesa: ActivityIndicator blanco en lugar del texto.

TRANSICIÓN ENTRE ESTADOS:
  · Cuando el usuario selecciona un avatar diferente al actual:
    el botón transiciona de gris a verde con un cambio de backgroundColor animado en 200ms.
  · Cuando vuelve a seleccionar el actual: transiciona de vuelta a gris en 200ms.
  · Implementar con Animated.timing sobre el color del botón o con un simple estado booleano
    que controle el estilo (ambas opciones son válidas).

──────────────────────────────────────
ESTADO VACÍO (sin avatares en el catálogo)
──────────────────────────────────────

Si el backend no devuelve avatares para la especie de la mascota:
  · Dentro del área del grid, mostrar centrado:
    - Emoji 🎨 grande (48px).
    - Texto: "Próximamente habrá avatares para tu " + mascota.especie + " 🐾"
    - fontFamily: Regular, fontSize: 14px, color: #6B6B6B, textAlign: 'center'.
    - paddingHorizontal: 32, marginTop: 16.
  · El botón "Aplicar Avatar" permanece deshabilitado.

──────────────────────────────────────
TOAST / SNACKBAR DE CONFIRMACIÓN
──────────────────────────────────────

Al aplicar el avatar exitosamente:
  · Posición: top: 56px, centrado horizontalmente.
  · backgroundColor: '#2DBD72', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12.
  · Contenido: ícono ✅ (Ionicons 'checkmark-circle', 18px, blanco) + texto "¡Avatar aplicado!",
    Bold, 14px, #FFFFFF.
  · Aparece: opacity 0 → 1 + translateY -12 → 0 en 220ms ease-out.
  · Duración: 2.5 segundos.
  · Desaparece: opacity 1 → 0 + translateY 0 → -12 en 200ms ease-in.
  · Al desaparecer: el label del preview cambia de "Vista previa" a "Avatar actual",
    y el badge ✓ aparece sobre el thumbnail del avatar recién aplicado.

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla: mostrar skeleton loaders:
  · Card preview: View blanco, borderRadius: 20, height: 230, marginHorizontal: 20, shimmer.
  · Grid: 6 thumbnails skeleton (cuadrados grises animados), misma disposición 3x2.

- Botón "Aplicar Avatar" mientras procesa el PUT: ActivityIndicator blanco, tamaño small.

──────────────────────────────────────
LÓGICA FRONTEND (ClosetScreen.jsx)
──────────────────────────────────────

Archivo: screens/ClosetScreen.jsx

Props de navegación: route.params.petId

Constante AVATAR_IMAGES (en constants/avatarImages.js):
  Objeto que mapea nombre de asset a require() de imagen local.
  Similar al PET_IMAGES ya existente en el proyecto.
  
  const AVATAR_IMAGES = {
    'perro_default':             require('../assets/avatares/perro_default.png'),
    'perro_labrador_gorro':      require('../assets/avatares/perro_labrador_gorro.png'),
    'perro_labrador_lentes':     require('../assets/avatares/perro_labrador_lentes.png'),
    'perro_golden_corbata':      require('../assets/avatares/perro_golden_corbata.png'),
    'gato_default':              require('../assets/avatares/gato_default.png'),
    'gato_lentes':               require('../assets/avatares/gato_lentes.png'),
    // etc. — agregar todos los assets que el equipo diseñe
  };

Estado local (useState):
- mascota:             null | objeto mascota (nombre, especie, imagen_asset actual)
- avatares:            array de objetos avatar del catálogo para esa especie
- avatarSeleccionado:  string (asset_name del avatar seleccionado en el grid)
- loading:             boolean
- aplicando:           boolean (loader del botón)

useEffect al montar:
  · Obtener JWT del AsyncStorage.
  · Llamar GET /api/mascotas/:petId/avatares.
  · Guardar en mascota y avatares.
  · avatarSeleccionado = mascota.imagen_asset  (inicializar con el actual).
  · Manejar errores con Alert.

Computed: esAvatarActual = avatarSeleccionado === mascota?.imagen_asset.

Función seleccionarAvatar(assetName):
  · avatarSeleccionado = assetName.
  · El preview grande se actualiza reactivamente.

Función aplicarAvatar():
  · Si esAvatarActual: no hacer nada (el botón igual está deshabilitado).
  · aplicando = true.
  · Llamar PUT /api/mascotas/:petId/avatar con body { imagen_asset: avatarSeleccionado }.
  · Al éxito:
    - Actualizar mascota.imagen_asset = avatarSeleccionado en el estado local.
    - El badge ✓ aparece en el thumbnail del nuevo avatar.
    - El label del preview cambia a "Avatar actual".
    - El botón vuelve a estar deshabilitado (ya que el seleccionado = actual).
    - Mostrar Toast "¡Avatar aplicado!".
  · Al error: Alert.alert('Error', 'No se pudo aplicar el avatar. Intentá de nuevo.').
  · aplicando = false (en finally).

──────────────────────────────────────
BACKEND — MODELO DE DATOS EN POSTGRESQL
──────────────────────────────────────

La tabla de mascotas ya tiene el campo `imagen_asset` (definido en FichaMedicaScreen).
NO hace falta agregar una nueva columna: solo se actualiza ese campo existente.

TABLA: avatares_catalogo
(Catálogo de avatares disponibles por especie. Administrado por el equipo de Zooni.)

CREATE TABLE avatares_catalogo (
  id          SERIAL PRIMARY KEY,
  especie     VARCHAR(50) NOT NULL,       -- 'perro', 'gato', 'conejo', etc.
  asset_name  VARCHAR(100) NOT NULL,      -- nombre del asset local (ej: "perro_labrador_gorro")
  nombre      VARCHAR(100) NOT NULL,      -- nombre descriptivo para el usuario (ej: "Labrador con gorrito")
  activo      BOOLEAN DEFAULT TRUE,
  orden       INTEGER DEFAULT 0,          -- para controlar el orden en el grid
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- Índices:
CREATE INDEX idx_avatares_especie ON avatares_catalogo(especie);

-- Datos de ejemplo (el equipo agrega más a medida que crea los avatares):
INSERT INTO avatares_catalogo (especie, asset_name, nombre, orden) VALUES
  ('perro', 'perro_default',          'Clásico',           1),
  ('perro', 'perro_labrador_gorro',   'Con gorrito',        2),
  ('perro', 'perro_labrador_lentes',  'Con lentes',         3),
  ('perro', 'perro_golden_corbata',   'Elegante',           4),
  ('perro', 'perro_bombero',          'Bombero',            5),
  ('perro', 'perro_astronauta',       'Astronauta',         6),
  ('gato',  'gato_default',           'Clásico',            1),
  ('gato',  'gato_lentes',            'Con lentes',         2),
  ('gato',  'gato_corona',            'Con corona',         3);

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/mascotas/:petId
Todos los endpoints requieren el middleware verifyToken.

──────────────────────
1. GET /api/mascotas/:petId/avatares
──────────────────────
Devuelve los datos de la mascota (incluyendo su imagen_asset actual) y el catálogo de
avatares disponibles para su especie.

Lógica:
a) Verificar que la mascota existe y pertenece al usuario autenticado.
b) Query 1: SELECT id, nombre, especie, imagen_asset FROM mascotas WHERE id = $1 AND usuario_id = $2.
c) Query 2: SELECT id, asset_name, nombre, orden FROM avatares_catalogo
            WHERE especie = $1 AND activo = TRUE ORDER BY orden ASC.
            (donde $1 = mascota.especie)

Response (200):
{
  "mascota": {
    "id": 1,
    "nombre": "Titán",
    "especie": "perro",
    "imagen_asset": "perro_default"
  },
  "avatares": [
    { "id": 1, "asset_name": "perro_default",         "nombre": "Clásico",    "orden": 1 },
    { "id": 2, "asset_name": "perro_labrador_gorro",  "nombre": "Con gorrito", "orden": 2 },
    { "id": 3, "asset_name": "perro_labrador_lentes", "nombre": "Con lentes",  "orden": 3 }
  ]
}

Errores:
- 403: { "error": "No tenés permiso para ver esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────
2. PUT /api/mascotas/:petId/avatar
──────────────────────
Actualiza el avatar (imagen_asset) de la mascota.

Body:
{
  "imagen_asset": "perro_labrador_gorro"
}

Lógica:
a) Verificar que la mascota pertenece al usuario autenticado.
b) Verificar que el asset_name existe en avatares_catalogo para la especie correcta.
   Si no existe: 400 (no se puede aplicar un avatar que no está en el catálogo).
c) UPDATE mascotas SET imagen_asset = $1, actualizado_en = NOW()
   WHERE id = $2 AND usuario_id = $3 RETURNING id, nombre, imagen_asset.

Response (200):
{
  "mensaje": "Avatar actualizado correctamente",
  "mascota": {
    "id": 1,
    "nombre": "Titán",
    "imagen_asset": "perro_labrador_gorro"
  }
}

Errores:
- 400: { "error": "Avatar no válido para esta especie" }
- 403: { "error": "No tenés permiso para modificar esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/ClosetScreen.jsx             ← pantalla principal (este prompt)
- constants/avatarImages.js            ← objeto AVATAR_IMAGES con todos los requires
- (reutilizar) utils/api.js            ← ya existe

Backend:
- routes/avatares.js
- controllers/avatarController.js
- migrations/006_create_avatares.sql   ← CREATE TABLE avatares_catalogo + índices + seeds iniciales

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                      |
|------------------------------------------------|---------------------------------------------------------------------|
| Sin avatares en el catálogo para la especie    | Estado vacío con emoji 🎨 + texto "Próximamente..."                  |
| Un solo avatar disponible (el actual)          | Grid con un solo thumbnail, botón permanentemente deshabilitado     |
| asset_name no existe en AVATAR_IMAGES          | Usar fallback: AVATAR_IMAGES['perro_default'] o 'gato_default'      |
| Red caída al aplicar                           | Alert "Sin conexión. Intentá de nuevo más tarde."                   |
| Error 403                                      | Alert + redirigir a Home o FichaMédica                              |
| Avatar aplicado → usuario vuelve a Home        | Home debe mostrar el nuevo avatar (refrescar datos al volver)       |
| Nombre del avatar muy largo en tooltip/label   | numberOfLines: 1, ellipsizeMode: 'tail' (si se muestra el nombre)  |
| Mascota de especie no registrada en el catálogo| Estado vacío igual que "sin avatares"                               |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- Esta es una pantalla simple de solo dos operaciones: GET (cargar) y PUT (aplicar).
  No hay formularios, no hay modales complejos, no hay lógica de fechas.
- El botón "Aplicar Avatar" debe estar estrictamente deshabilitado cuando el avatar
  seleccionado es igual al actual. Esto previene requests innecesarios al backend.
- El archivo constants/avatarImages.js es crítico: si un asset_name viene del backend
  pero no está en el objeto AVATAR_IMAGES, se debe mostrar el fallback silenciosamente
  (sin crashear la app).
- Al actualizar el avatar con éxito, el cambio debe reflejarse en toda la app. Si existe
  algún contexto global / estado de mascota activa (Redux, Context API, Zustand), actualizar
  ahí también para que Home y FichaMédica vean el cambio sin necesidad de recargar.
- Animaciones: Animated API de React Native. La escala del preview al cambiar de avatar
  (0.85 → 1.0 en 200ms) es el único efecto de animación obligatorio. El resto es opcional.
- NO incluir ningún toast de "Vacuna marcada como aplicada" ni mensajes de otras pantallas.
  El único toast propio de esta pantalla es "¡Avatar aplicado!".
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores de Zooni.
