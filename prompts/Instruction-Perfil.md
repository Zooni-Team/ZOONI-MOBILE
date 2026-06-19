=== ZOONI — PANTALLA: PERFIL ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Perfil" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde el menú lateral (drawer) o desde otras pantallas de la app. A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
DESCRIPCIÓN FUNCIONAL
──────────────────────────────────────

El Perfil es la identidad pública del usuario dentro de Zooni. Desde acá puede:
- Ver su foto de perfil, nombre de usuario y datos personales.
- Ver sus estadísticas: publicaciones, seguidores y siguiendo.
- Editar sus datos personales (nombre, bio, ubicación) mediante un modal desplegable.
- Cambiar su foto de perfil tocando el botón "+" sobre el avatar.
- Crear una nueva publicación mediante un modal desplegable.
- Navegar a Configuración.
- Ver sus publicaciones en modo Grid (3 columnas) o Lista (tarjetas verticales).

NOTA SOBRE CONFIGURACIÓN: El botón "Config" navega a la pantalla ConfiguracionScreen, que ya existe en el proyecto (pantalla separada con sus propias opciones). No es necesario desarrollar esa pantalla aquí, solo la navegación hacia ella.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto
- Autenticación: JWT. Token en el header Authorization.
- Imágenes: expo-image-picker para selección de foto de perfil y publicaciones.
  Las imágenes se suben al storage del proyecto (multipart/form-data).

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:          #C8F0D8  (verde menta — zona del avatar)
- Fondo card blanco (zona inferior):       #FFFFFF
- Botón "Editar perfil":                   #2DBD72  (verde teal), texto #FFFFFF
- Botón "Config":                          #FFFFFF  fondo, borde 1.5px #DDDDDD, texto #2C2C2C
- Botón "Nueva publicación":               #F5C842  (amarillo), texto #2C2C2C
- Botón "+" del avatar:                    #2DBD72, ícono #FFFFFF
- Números de estadísticas:                 #2C2C2C  (Bold)
- Labels de estadísticas:                  #6B6B6B  (Regular pequeño)
- Nombre de usuario (bio):                 #2C2C2C  (Bold)
- Texto bio y ubicación:                   #6B6B6B  (Regular)
- Tab activo (Grid/Lista):                 #2C2C2C  Bold + underline #2DBD72
- Tab inactivo:                            #AAAAAA  Regular
- Toast confirmación:                      #2DBD72  fondo, #FFFFFF texto
- Overlay modal:                           rgba(0, 0, 0, 0.50)
- Título de modales:                       #2DBD72

Tipografía:
- Nombre de usuario grande (debajo avatar):  Bold, 20px, #2C2C2C, centrado
- Texto de botones Editar / Config / Nueva:  Bold, 15px, centrado
- Números de stats (0, 123...):              Bold, 18px, #2C2C2C
- Labels de stats (publicaciones, etc.):     Regular, 12px, #6B6B6B, centrado
- Nombre en bio section:                     Bold, 15px, #2C2C2C
- Bio texto y ubicación:                     Regular, 14px, #6B6B6B
- Título modal:                              Bold, 18px, #2DBD72, centrado
- Labels inputs modal:                       Regular, 14px, #AAAAAA (placeholder)
- Texto botón Guardar:                       Bold, 15px, #FFFFFF
- Texto botón Cancelar:                      Bold, 15px, #2C2C2C

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

La pantalla sigue el mismo patrón que FichaMédica, Vacunas, etc.:
zona superior verde con avatar, y zona inferior en card blanco con el resto del contenido.

  ┌──────────────────────────────────────────┐
  │  [☰]                                     │  ← Header mínimo
  │                                          │
  │          [avatar 84px]                   │  ← Zona verde (#C8F0D8)
  │             [+ verde]                    │
  │         usuario usuario                  │
  │                                          │
  ├──────────────────────────────────────────┤  (borderTopLeftRadius: 28)
  │                                          │
  │   [   Editar perfil   ]  ← verde        │
  │   [      Config       ]  ← outline      │  ← Card blanco
  │   [ Nueva publicación ]  ← amarillo     │
  │                                          │
  │   0           0           0             │
  │   publicaciones  seguidores  siguiendo  │  ← Stats
  │                                          │
  │   usuario usuario                        │
  │   Amante de los animales                 │  ← Bio section
  │   Argentina                              │
  │                                          │
  │   ─────────────────────────────────────  │
  │                                          │
  │   Grid              Lista               │  ← Tabs de publicaciones
  │   ───                                   │
  │                                          │
  │   [grid de fotos / lista / empty state] │
  └──────────────────────────────────────────┘

──────────────────────────────────────
SECCIÓN 1 — HEADER
──────────────────────────────────────

- backgroundColor: 'transparent'.
- Izquierda: ícono hamburguesa ☰, 26px, #2C2C2C, padding: 12px.
- Centro y derecha: vacíos.
- Altura: ~56px. paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — ZONA DEL AVATAR (fondo verde)
──────────────────────────────────────

AVATAR DEL USUARIO:
- Círculo de 84px × 84px, borderRadius: 42.
- Centrado horizontalmente, marginTop: 8px.
- Si el usuario tiene foto_perfil_url: mostrar la imagen con resizeMode: 'cover'.
- Si no tiene foto: mostrar un View circular con fondo #DDDDDD y un ícono genérico
  (Ionicons 'person', 48px, #FFFFFF) centrado.
- shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4.

BOTÓN "+" PARA CAMBIAR FOTO:
- Posición: absolute, bottom: 0, right: 0 (relativo al contenedor del avatar).
- View circular: width: 26, height: 26, borderRadius: 13.
- backgroundColor: '#2DBD72'.
- Borde: 2px sólido #FFFFFF (para separarse visualmente del avatar).
- Ícono: Ionicons 'add', 16px, #FFFFFF.
- Al tocar: abre ImagePicker (expo-image-picker) con opciones cámara y galería.
  → ActionSheet o Alert con opciones: "Cámara", "Galería", "Cancelar".
  → Al seleccionar imagen: subir al backend (multipart/form-data) con PUT /api/perfil/foto.
  → Al éxito: actualizar la foto en pantalla sin recargar.
  → Toast: "Foto actualizada correctamente".

NOMBRE DE USUARIO (bajo el avatar):
- Texto: usuario.nombre_usuario o (usuario.nombre + " " + usuario.apellido) según disponibilidad.
- fontFamily: Bold, fontSize: 20px, color: #2C2C2C, textAlign: 'center'.
- marginTop: 12px, marginBottom: 20px.

──────────────────────────────────────
SECCIÓN 3 — CARD BLANCO (zona inferior)
──────────────────────────────────────

View con:
  backgroundColor: '#FFFFFF'
  borderTopLeftRadius: 28
  borderTopRightRadius: 28
  paddingHorizontal: 20
  paddingTop: 24
  paddingBottom: 0  (el scroll continúa)

──────────────────────────────────────
SUB-SECCIÓN A — TRES BOTONES DE ACCIÓN
──────────────────────────────────────

Los tres botones están apilados verticalmente, con 10px de separación entre ellos.
Todos son pill shape, misma anchura (100% del contenedor con paddingHorizontal: 20).

BOTÓN 1 — "Editar perfil":
  · backgroundColor: '#2DBD72'
  · borderRadius: 30, height: 48
  · Texto "Editar perfil", Bold, 15px, #FFFFFF, centrado
  · shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.10, shadowRadius: 4, elevation: 3
  · Al presionar (pressIn): escala 0.97 en 100ms, vuelve en 150ms
  · Al tocar: abre el MODAL DE EDITAR PERFIL (ver sección correspondiente)

BOTÓN 2 — "Config":
  · backgroundColor: '#FFFFFF'
  · borderRadius: 30, height: 48
  · borderWidth: 1.5, borderColor: '#DDDDDD'
  · Texto "Config", Bold, 15px, #2C2C2C, centrado
  · Sin sombra
  · Al presionar (pressIn): backgroundColor pasa a '#F5F5F5' momentáneamente
  · Al tocar: navegar a ConfiguracionScreen (navigation.navigate('Configuracion'))
    NO se desarrolla el contenido de esa pantalla en este prompt, solo la navegación.

BOTÓN 3 — "Nueva publicación":
  · backgroundColor: '#F5C842'
  · borderRadius: 30, height: 48
  · Texto "Nueva publicación", Bold, 15px, #2C2C2C, centrado
  · shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.10, shadowRadius: 4, elevation: 3
  · Al presionar (pressIn): escala 0.97 en 100ms, vuelve en 150ms
  · Al tocar: abre el MODAL DE NUEVA PUBLICACIÓN (ver sección correspondiente)

──────────────────────────────────────
SUB-SECCIÓN B — ESTADÍSTICAS
──────────────────────────────────────

Tres columnas iguales (flex: 1 cada una) en una fila horizontal.
marginTop: 24px, marginBottom: 16px.

Cada columna:
  · alignItems: 'center'
  · Número: fontFamily Bold, fontSize: 18px, color: #2C2C2C
  · Label: fontFamily Regular, fontSize: 12px, color: #6B6B6B, marginTop: 2px

Columnas:
  1. Número: perfil.total_publicaciones | Label: "publicaciones"
  2. Número: perfil.total_seguidores     | Label: "seguidores"
  3. Número: perfil.total_siguiendo      | Label: "siguiendo"

Entre columnas: separador vertical de 1px altura 30px color #EFEFEF, centrado verticalmente.

Los tres números son tappables:
  · "publicaciones" → scroll al grid de publicaciones
  · "seguidores" → (por ahora, sin navegación — preparar para futuro)
  · "siguiendo" → (por ahora, sin navegación — preparar para futuro)

──────────────────────────────────────
SUB-SECCIÓN C — BIO / DESCRIPCIÓN
──────────────────────────────────────

paddingHorizontal: 0 (hereda el del card blanco), marginBottom: 20px.

Línea 1 — Nombre completo:
  · Texto: usuario.nombre + " " + usuario.apellido (si existen).
  · Si no tiene nombre: mostrar usuario.nombre_usuario.
  · fontFamily: Bold, fontSize: 15px, color: #2C2C2C.

Línea 2 — Bio/Descripción (solo si existe):
  · Texto: usuario.bio.
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B.
  · Si es null o vacío: no renderizar esta línea.

Línea 3 — Ubicación (solo si existe):
  · Texto: usuario.ubicacion (ej: "Argentina").
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B.
  · Si es null o vacío: no renderizar esta línea.

Todas las líneas: textAlign: 'left'.

──────────────────────────────────────
TOAST DE CONFIRMACIÓN (dentro del perfil)
──────────────────────────────────────

Aparece después de guardar cambios (editar perfil o foto). Se ubica como un banner verde 
dentro del card blanco (no flotante como en otras pantallas), justo encima de los tabs.

Estilo:
  · backgroundColor: '#2DBD72', borderRadius: 12
  · paddingVertical: 12, paddingHorizontal: 16
  · marginBottom: 16
  · Contenido: Ionicons 'checkmark-circle' 18px blanco + texto (Bold, 14px, #FFFFFF).
  · Textos posibles: "Perfil actualizado correctamente" | "Foto actualizada correctamente"
  · Animación entrada: opacity 0 → 1 + translateY -8 → 0 en 200ms ease-out.
  · Se mantiene 2.5 segundos.
  · Animación salida: opacity 1 → 0 + translateY 0 → -8 en 200ms ease-in.
  · Implementar con un estado booleano `showToast` y el mensaje correspondiente.

──────────────────────────────────────
SUB-SECCIÓN D — TABS GRID / LISTA
──────────────────────────────────────

Dos tabs horizontales: "Grid" y "Lista".
  · marginBottom: 0 (el contenido empieza justo debajo).
  · Separador horizontal superior: 1px #EFEFEF.
  · Cada tab ocupa el 50% del ancho.

TAB ACTIVO:
  · Texto Bold, 15px, #2C2C2C.
  · Underline: View de height: 2, backgroundColor: '#2DBD72', width: '30%', centrado bajo el texto.

TAB INACTIVO:
  · Texto Regular, 15px, #AAAAAA.
  · Sin underline.

Al tocar un tab: cambiar tabActivo entre 'grid' y 'lista'.
Animación del underline: translateX suave entre posiciones en 200ms ease-out.

CONTENIDO — MODO GRID (tabActivo === 'grid'):
  · FlatList de 3 columnas, sin espacio entre fotos (gap: 1px con backgroundColor del separador: #C8F0D8).
  · Cada foto: cuadrada, (screenWidth / 3) × (screenWidth / 3).
  · resizeMode: 'cover'.
  · Al tocar una foto: navegar a la vista de detalle de publicación (pantalla placeholder por ahora).

CONTENIDO — MODO LISTA (tabActivo === 'lista'):
  · Lista vertical de cards, paddingHorizontal: 0, gap: 12px.
  · Cada card: backgroundColor '#FFFFFF', borderRadius: 12, shadow suave, overflow: 'hidden'.
  · Contenido del card: foto arriba (16:9 o cuadrada), descripción debajo (Regular, 14px, #2C2C2C),
    fecha (Regular, 12px, #AAAAAA) abajo a la izquierda.

ESTADO VACÍO (sin publicaciones):
  · Centrado en el área de contenido de los tabs.
  · Ícono: Ionicons 'camera-outline', 48px, #AAAAAA.
  · Texto: "Aún no publicaste nada 📸", Regular, 15px, #6B6B6B, centrado.
  · marginTop: 40px.
  · Aplica para ambos modos (Grid y Lista).

──────────────────────────────────────
MODAL — EDITAR PERFIL (botón "Editar perfil")
──────────────────────────────────────

Al tocar "Editar perfil", se abre un modal centrado con overlay oscuro.
Mismo patrón que todos los modales anteriores del proyecto.

OVERLAY:
  · Modal de React Native (transparent: true, animationType: 'none').
  · backgroundColor: rgba(0, 0, 0, 0.50).
  · Al tocar fuera del card: cerrar el modal.

CARD DEL MODAL:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 20
  · width: '90%'
  · paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20
  · Centrado en pantalla.
  · Animación entrada: escala 0.92 → 1.0 + opacity 0 → 1, 220ms ease-out.
  · Animación salida: escala 1.0 → 0.92 + opacity 1 → 0, 160ms ease-in.
  · El modal tiene ScrollView interno si el contenido es largo (para que los inputs no queden
    tapados por el teclado — usar KeyboardAvoidingView).

TÍTULO DEL MODAL:
  · Texto: "Editar perfil"
  · Bold, 18px, #2DBD72, textAlign: 'center', marginBottom: 20px.

CAMPO 1 — NOMBRE:
  · TextInput, placeholder: "Nombre", pre-rellenado con usuario.nombre.
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · fontSize: 14px, color: #2C2C2C.
  · Al focus: borde #2DBD72.
  · marginBottom: 12.

CAMPO 2 — APELLIDO:
  · TextInput, placeholder: "Apellido", pre-rellenado con usuario.apellido.
  · Mismo estilo que Campo 1.
  · marginBottom: 12.

CAMPO 3 — NOMBRE DE USUARIO:
  · TextInput, placeholder: "@nombre_de_usuario", pre-rellenado con usuario.nombre_usuario.
  · Mismo estilo.
  · autoCapitalize: 'none', autoCorrect: false.
  · Validación: sin espacios ni caracteres especiales (solo letras, números, _ y .).
  · marginBottom: 12.

CAMPO 4 — BIO / DESCRIPCIÓN:
  · TextInput multilinea, placeholder: "Contá algo sobre vos y tu mascota...",
    pre-rellenado con usuario.bio.
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · fontSize: 14px, color: #2C2C2C.
  · multiline: true, numberOfLines: 3, height: 80.
  · textAlignVertical: 'top'.
  · maxLength: 150.
  · Al focus: borde verde.
  · marginBottom: 12.

CAMPO 5 — UBICACIÓN:
  · TextInput, placeholder: "País o ciudad (ej: Argentina)", pre-rellenado con usuario.ubicacion.
  · Mismo estilo que Campo 1.
  · marginBottom: 20.

BOTÓN GUARDAR:
  · width: '100%', height: 48, borderRadius: 30.
  · backgroundColor: '#2DBD72'.
  · Texto "Guardar", Bold, 15px, #FFFFFF.
  · shadow suave.
  · Al presionar: escala 0.97.
  · Mientras procesa: ActivityIndicator blanco.
  · Al éxito: cerrar modal, actualizar datos en pantalla, Toast "Perfil actualizado correctamente".

BOTÓN CANCELAR:
  · width: '100%', height: 44, borderRadius: 30.
  · backgroundColor: '#E8E8E8'.
  · Texto "Cancelar", Bold, 15px, #2C2C2C.
  · marginTop: 10.
  · Al tocar: cerrar modal sin guardar.

──────────────────────────────────────
MODAL — NUEVA PUBLICACIÓN (botón "Nueva publicación")
──────────────────────────────────────

Al tocar "Nueva publicación", se abre otro modal centrado con el mismo estilo de overlay.

OVERLAY y CARD DEL MODAL: mismos estilos que el modal de Editar perfil.

TÍTULO DEL MODAL:
  · Texto: "Nueva publicación"
  · Bold, 18px, #2DBD72, centrado, marginBottom: 16px.

SELECTOR DE IMAGEN (requerido):
  · View cuadrado: width: '100%', height: 180, borderRadius: 12.
  · backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#DDDDDD', borderStyle: 'dashed'.
  · Si no hay imagen seleccionada:
    - Ícono: Ionicons 'camera-outline', 40px, #AAAAAA, centrado.
    - Texto: "Tocá para agregar una foto", Regular, 13px, #AAAAAA, centrado.
  · Si hay imagen seleccionada:
    - Mostrar la imagen seleccionada con resizeMode: 'cover', borderRadius: 12.
    - Ícono de edición (Ionicons 'create-outline', 20px, blanco) en esquina sup. derecha
      sobre un View circular semitransparente rgba(0,0,0,0.4). Al tocar: vuelve a abrir picker.
  · Al tocar el selector (sin imagen): abre expo-image-picker.
    ActionSheet/Alert: "Cámara" | "Galería" | "Cancelar".
  · marginBottom: 14.
  · Validación: requerido. Si se intenta guardar sin imagen → borde rojo + error inline.

CAMPO — DESCRIPCIÓN (opcional):
  · TextInput multilinea, placeholder: "Agregá una descripción o hashtags...",
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · fontSize: 14px, color: #2C2C2C.
  · multiline: true, numberOfLines: 4, height: 90.
  · textAlignVertical: 'top'.
  · maxLength: 300.
  · Al focus: borde verde.
  · marginBottom: 20.

BOTÓN PUBLICAR:
  · Mismo estilo que Guardar, pero texto "Publicar".
  · backgroundColor: '#F5C842' (amarillo, para diferenciarlo del Guardar del otro modal).
  · Texto color: #2C2C2C Bold.
  · Al éxito: cerrar modal, agregar la nueva publicación al grid/lista sin refetch,
    Toast "Publicación creada correctamente".

BOTÓN CANCELAR:
  · Mismo estilo que en el otro modal.
  · Si el usuario tocó Cancelar con una imagen ya seleccionada: Alert de confirmación
    "¿Cancelar publicación? La imagen seleccionada se perderá."

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla: skeleton loaders:
  · Avatar: círculo gris 84px, shimmer.
  · Nombre: rectángulo 120px × 16px gris, shimmer, centrado.
  · Stats: tres bloques grises de ~50px × 40px en fila.
  · Bio: dos rectángulos grises de distinto ancho.
  · Grid: 6 cuadrados grises (misma disposición 3x2), shimmer.

──────────────────────────────────────
LÓGICA FRONTEND (PerfilScreen.jsx)
──────────────────────────────────────

Archivo: screens/PerfilScreen.jsx

Parámetros: ninguno adicional (es el perfil propio del usuario autenticado).
Si en el futuro se navega al perfil de otro usuario, se puede pasar userId como parámetro.

Estado local (useState):
- perfil:               null | objeto con datos del usuario y estadísticas
- publicaciones:        array de publicaciones
- loading:              boolean
- tabActivo:            'grid' | 'lista'
- modalEditarVisible:   boolean
- modalPublicarVisible: boolean
- guardandoPerfil:      boolean
- publicando:           boolean
- showToast:            boolean
- toastMensaje:         string
- formNombre:           string
- formApellido:         string
- formNombreUsuario:    string
- formBio:              string
- formUbicacion:        string
- formImagen:           null | objeto imagen (uri, type, fileName)
- formDescripcion:      string
- formErrors:           objeto { imagen: string|null }

useEffect al montar:
  · Obtener JWT del AsyncStorage.
  · Llamar GET /api/perfil para obtener datos del usuario + estadísticas.
  · Llamar GET /api/perfil/publicaciones para obtener publicaciones.
  · Guardar en estado.
  · Manejar errores con Alert.

Función abrirModalEditar():
  · Pre-rellenar form con datos actuales del perfil.
  · modalEditarVisible = true.

Función cerrarModalEditar():
  · modalEditarVisible = false.

Función guardarPerfil():
  · Validar: nombre_usuario sin espacios.
  · guardandoPerfil = true.
  · Llamar PUT /api/perfil con los campos del formulario.
  · Al éxito: actualizar perfil en estado local, cerrar modal, mostrarToast("Perfil actualizado correctamente").
  · guardandoPerfil = false.

Función cambiarFotoPerfil():
  · Abrir ImagePicker.
  · Al seleccionar imagen: subir con PUT /api/perfil/foto (multipart/form-data).
  · Al éxito: actualizar perfil.foto_perfil_url, mostrarToast("Foto actualizada correctamente").

Función abrirModalPublicar():
  · Limpiar formImagen y formDescripcion.
  · modalPublicarVisible = true.

Función publicar():
  · Validar: formImagen no null.
  · publicando = true.
  · Subir imagen y descripción con POST /api/publicaciones (multipart/form-data).
  · Al éxito: agregar publicación al inicio del array publicaciones, cerrar modal,
    mostrarToast("Publicación creada correctamente"), incrementar total_publicaciones en 1.
  · publicando = false.

Función mostrarToast(mensaje):
  · toastMensaje = mensaje, showToast = true.
  · setTimeout(() => showToast = false, 2500).

──────────────────────────────────────
BACKEND — MODELOS DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: usuarios (ya existe, verificar que tenga estos campos; agregar los que falten)
  id              SERIAL PRIMARY KEY
  nombre          VARCHAR(100)
  apellido        VARCHAR(100)
  nombre_usuario  VARCHAR(50) UNIQUE NOT NULL
  email           VARCHAR(150) UNIQUE NOT NULL
  password_hash   VARCHAR(255) NOT NULL
  bio             TEXT
  ubicacion       VARCHAR(100)
  foto_perfil_url VARCHAR(255)
  creado_en       TIMESTAMP DEFAULT NOW()
  actualizado_en  TIMESTAMP DEFAULT NOW()

TABLA: publicaciones (nueva)
  CREATE TABLE publicaciones (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    imagen_url   VARCHAR(255) NOT NULL,
    descripcion  TEXT,
    creado_en    TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_publicaciones_usuario ON publicaciones(usuario_id);
  CREATE INDEX idx_publicaciones_fecha ON publicaciones(creado_en DESC);

TABLA: seguidores (para las estadísticas — esqueleto básico)
  CREATE TABLE seguidores (
    id            SERIAL PRIMARY KEY,
    seguidor_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    seguido_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en     TIMESTAMP DEFAULT NOW(),
    UNIQUE (seguidor_id, seguido_id)
  );

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/perfil
Todos los endpoints requieren el middleware verifyToken.

──────────────────────
1. GET /api/perfil
──────────────────────
Devuelve el perfil completo del usuario autenticado con estadísticas.

Lógica:
a) SELECT u.*, 
     (SELECT COUNT(*) FROM publicaciones WHERE usuario_id = u.id) AS total_publicaciones,
     (SELECT COUNT(*) FROM seguidores WHERE seguido_id = u.id) AS total_seguidores,
     (SELECT COUNT(*) FROM seguidores WHERE seguidor_id = u.id) AS total_siguiendo
   FROM usuarios u WHERE u.id = $1.

Response (200):
{
  "perfil": {
    "id": 1,
    "nombre": "usuario",
    "apellido": "usuario",
    "nombre_usuario": "usuario_usuario",
    "bio": "Amante de los animales",
    "ubicacion": "Argentina",
    "foto_perfil_url": null,
    "total_publicaciones": 0,
    "total_seguidores": 0,
    "total_siguiendo": 0
  }
}

──────────────────────
2. PUT /api/perfil
──────────────────────
Actualiza los datos de texto del perfil.

Body:
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "nombre_usuario": "juan_perez",
  "bio": "Amante de los animales 🐾",
  "ubicacion": "Argentina"
}

Lógica:
a) Validar nombre_usuario: sin espacios, caracteres permitidos [a-z0-9_.]
b) Verificar que el nombre_usuario no esté en uso por otro usuario
   (SELECT id FROM usuarios WHERE nombre_usuario = $1 AND id != $2).
c) UPDATE usuarios SET nombre=$1, apellido=$2, nombre_usuario=$3, bio=$4, ubicacion=$5,
   actualizado_en=NOW() WHERE id=$6 RETURNING *.

Response (200):
{
  "mensaje": "Perfil actualizado correctamente",
  "perfil": { ...datos actualizados... }
}

Errores:
- 400: { "error": "El nombre de usuario no puede contener espacios" }
- 409: { "error": "Ese nombre de usuario ya está en uso" }

──────────────────────
3. PUT /api/perfil/foto
──────────────────────
Actualiza la foto de perfil del usuario.

Body: multipart/form-data con campo "foto" (archivo de imagen).

Lógica:
a) Recibir el archivo con multer (o middleware equivalente).
b) Subir al sistema de almacenamiento del proyecto (S3, Cloudinary, o local según config).
c) UPDATE usuarios SET foto_perfil_url = $1, actualizado_en = NOW() WHERE id = $2 RETURNING foto_perfil_url.

Response (200):
{
  "mensaje": "Foto actualizada correctamente",
  "foto_perfil_url": "https://cdn.zooni.com/perfiles/user123.jpg"
}

Errores:
- 400: { "error": "No se recibió ninguna imagen" }
- 400: { "error": "Formato no válido. Solo JPG, PNG y GIF." }

──────────────────────
4. GET /api/perfil/publicaciones
──────────────────────
Devuelve las publicaciones del usuario autenticado.

Lógica:
SELECT * FROM publicaciones WHERE usuario_id = $1 ORDER BY creado_en DESC.

Response (200):
{
  "publicaciones": [
    {
      "id": 1,
      "imagen_url": "https://cdn.zooni.com/publicaciones/img1.jpg",
      "descripcion": "Mi perro en el parque 🐾",
      "creado_en": "2026-06-01T10:00:00Z"
    }
  ]
}

──────────────────────
5. POST /api/publicaciones
──────────────────────
Crea una nueva publicación con imagen.

Body: multipart/form-data
  - "imagen": archivo de imagen (requerido)
  - "descripcion": string (opcional)

Lógica:
a) Validar que se recibió una imagen.
b) Subir imagen al storage.
c) INSERT INTO publicaciones (usuario_id, imagen_url, descripcion) VALUES ($1, $2, $3) RETURNING *.

Response (201):
{
  "mensaje": "Publicación creada correctamente",
  "publicacion": {
    "id": 5,
    "imagen_url": "https://cdn.zooni.com/publicaciones/img5.jpg",
    "descripcion": "Mi perro en el parque 🐾",
    "creado_en": "2026-06-17T14:00:00Z"
  }
}

Errores:
- 400: { "error": "La imagen es requerida para publicar" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/PerfilScreen.jsx            ← pantalla principal (este prompt)
- (reutilizar) utils/api.js           ← ya existe

Backend:
- routes/perfil.js
- routes/publicaciones.js
- controllers/perfilController.js
- controllers/publicacionesController.js
- migrations/007_create_publicaciones.sql   ← CREATE TABLE publicaciones + seguidores
- middleware/upload.js                      ← configuración de multer para subida de imágenes

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                       |
|------------------------------------------------|----------------------------------------------------------------------|
| Sin foto de perfil                             | Placeholder gris con ícono 'person' genérico                        |
| Sin bio o ubicación                            | No renderizar esas líneas (no mostrar vacío)                        |
| nombre_usuario ya tomado al editar             | Error inline: "Ese nombre ya está en uso" en rojo 11px              |
| nombre_usuario con espacios                    | Validación inline antes de llamar al backend                        |
| Publicar sin seleccionar imagen                | Borde rojo en el selector + "Seleccioná una imagen"                 |
| Sin publicaciones                              | Ícono de cámara + "Aún no publicaste nada 📸" en ambos modos        |
| Red caída al guardar perfil                    | Alert "Sin conexión. Intentá de nuevo más tarde."                   |
| Red caída al publicar                          | Alert de error, NO cerrar el modal (mantener datos ingresados)      |
| Nombre muy largo en el avatar                  | numberOfLines: 1, ellipsizeMode: 'tail'                             |
| Nombre de usuario con caracteres especiales    | Bloquear en el TextInput: solo [a-z0-9_.] (sin mayúsculas)         |
| Perfil actualizado → volver a otras pantallas  | El nuevo nombre/foto debe reflejarse en el drawer y en el Home.
|                                                | Usar Context global o callback de navegación para propagarlo.        |
| Imagen de publicación muy pesada               | Comprimir con expo-image-manipulator antes de subir (máx 2MB)       |
| Modal de publicar: cancelar con imagen cargada | Alert "¿Cancelar? La imagen se perderá." con botones Cancelar/Sí    |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- La pantalla de Configuración NO se desarrolla en este prompt: solo implementar la
  navegación navigation.navigate('Configuracion') al tocar "Config".
- Los modales de "Editar perfil" y "Nueva publicación" siguen ESTRICTAMENTE el mismo
  estilo visual de todos los otros modales del proyecto (overlay 50% oscuro, card blanco
  centrado borderRadius 20, título verde teal Bold 18px, inputs con borde #DDDDDD que vira
  a verde al focus, botón Guardar verde pill, botón Cancelar gris pill).
- NO incluir ningún toast de otras pantallas. Los únicos toasts propios de esta pantalla
  son "Perfil actualizado correctamente", "Foto actualizada correctamente" y
  "Publicación creada correctamente".
- La subida de imágenes usa multipart/form-data. Configurar multer en el backend y
  expo-image-picker en el frontend.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores y tipografía de Zooni definidas arriba.
