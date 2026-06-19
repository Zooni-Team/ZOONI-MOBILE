    === ZOONI — PANTALLA: EVENTOS ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Eventos" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla es accesible desde el menú lateral (drawer). A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
DESCRIPCIÓN FUNCIONAL
──────────────────────────────────────

La pantalla Eventos muestra actividades, jornadas y encuentros para mascotas y sus dueños, organizadas por perfiles verificados por el equipo de Zooni. Los eventos son relevantes para la ciudad o zona del usuario. Desde esta pantalla el usuario puede:

- Ver los eventos disponibles cerca de su ubicación.
- Leer el detalle de cada evento (fecha, hora, lugar, descripción, organizador).
- Agregar un evento directamente a su Calendario de Cuidados (pantalla ya implementada).

SOBRE LA CREACIÓN DE EVENTOS:
Solo los organizadores verificados por el equipo de Zooni pueden crear eventos. La verificación
de organizadores y el panel de creación de eventos son procesos administrativos que se definirán
en una etapa futura. En este prompt se implementa únicamente la pantalla de VISUALIZACIÓN y el
backend de lectura. La tabla `eventos` se puede poblar manualmente desde el backend por ahora.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto
- Autenticación: JWT. Token en el header Authorization.

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:       #C8F0D8  (verde menta)
- Fondo card de evento:                 #FFFFFF
- Pill de categoría/especie en foto:    #2DBD72  fondo, #FFFFFF texto (blanco, uppercase)
- Chip de fecha:                        #F5F5F5  fondo, #2C2C2C texto, borde #E0E0E0
- Chip de hora:                         #F5F5F5  fondo, #2C2C2C texto, borde #E0E0E0
- Pill de ubicación:                    #E8F8F0  fondo (verde muy suave), #2DBD72 texto e ícono
- Pill de organizador:                  #F5F5F5  fondo (gris claro), #6B6B6B texto
- Botón "Agregar al calendario":        #2DBD72  fondo, #FFFFFF texto
- Botón "✓ Agregado" (ya en calendar): #A8D8B8  fondo (verde apagado), #FFFFFF texto, disabled
- Título del evento:                    #2C2C2C  Bold
- Descripción del evento:               #6B6B6B  Regular
- Subtítulo header:                     #6B6B6B  Regular
- Texto fondo vacío:                    #6B6B6B  Regular

Tipografía:
- Título "🎉 Eventos":                 Bold, 22px, #2C2C2C, centrado
- Subtítulo header:                    Regular, 14px, #6B6B6B, centrado
- Indicador de ciudad:                 Regular, 13px, #6B6B6B, centrado (ej: "📍 Eventos en Buenos Aires")
- Nombre del evento en card:           Bold, 18px, #2C2C2C
- Texto de chips (fecha, hora):        Medium, 12px, #2C2C2C
- Texto pill de ubicación:             Medium, 13px, #2DBD72
- Descripción del evento:              Regular, 14px, #6B6B6B, lineHeight: 22
- Texto pill organizador:              Regular, 13px, #6B6B6B
- Texto botón "Agregar al calendario": Bold, 15px, #FFFFFF
- Pill de categoría sobre foto:        Bold, 11px, #FFFFFF, letterSpacing: 0.5, uppercase

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

ScrollView vertical con backgroundColor: '#C8F0D8'. No tiene bottom tab bar.

  ┌──────────────────────────────────────────┐
  │  [☰]                                     │  ← Header
  │         🎉 Eventos                       │
  │  Actividades y jornadas para vos y tu... │
  │  📍 Eventos en Buenos Aires             │  ← Indicador de ciudad (dinámico)
  │                                          │
  │  ┌────────────────────────────────────┐  │
  │  │ [FOTO FULL WIDTH]  [GOLDEN RETRVR] │  │  ← Card evento
  │  │                                    │  │
  │  │ Jornada de Vacunación Gratuita...  │  │
  │  │ [📅 Miérc. 15 abril 2026][🕐 09:00]│  │
  │  │ [📍 Parque Centenario, CABA    ]   │  │
  │  │                                    │  │
  │  │ El Gobierno de la Ciudad Autóno... │  │
  │  │                                    │  │
  │  │ [🏢 Gobierno Ciudad Autónoma...  ] │  │
  │  │ [  📅 Agregar al calendario      ] │  │
  │  └────────────────────────────────────┘  │
  │                                          │
  │  [card evento 2]                         │
  │  [card evento 3]                         │
  └──────────────────────────────────────────┘

──────────────────────────────────────
SECCIÓN 1 — HEADER
──────────────────────────────────────

- backgroundColor: 'transparent'.
- Izquierda: hamburguesa ☰, 26px, #2C2C2C, padding: 12px.
- Centro y derecha: vacíos (sin campana en esta pantalla).
- Altura: ~56px. paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — TÍTULO Y SUBTÍTULO
──────────────────────────────────────

paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16.

- Título: "🎉 Eventos"
  · Bold, 22px, #2C2C2C, textAlign: 'center'.
  · El emoji 🎉 va inline antes del texto.
  · marginBottom: 4px.

- Subtítulo: "Actividades y jornadas para vos y tu mascota"
  · Regular, 14px, #6B6B6B, textAlign: 'center'.
  · marginBottom: 8px.

- Indicador de ciudad (dinámico):
  · Texto: "📍 Eventos en " + ciudad_del_usuario (ej: "📍 Eventos en Buenos Aires").
  · Regular, 13px, #6B6B6B, textAlign: 'center'.
  · Si no se puede determinar la ciudad: mostrar "📍 Eventos cerca tuyo".
  · La ciudad se obtiene del perfil del usuario (campo `ciudad` o `ubicacion`).

──────────────────────────────────────
DISEÑO DEL CARD DE EVENTO
──────────────────────────────────────

Cada evento se muestra como un card vertical completo.
CONTENEDOR DEL CARD:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 18
  · marginHorizontal: 16, marginBottom: 16
  · shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:4
  · overflow: 'hidden'  ← CRÍTICO para que la foto respete el borderRadius del card

─────────────────────────
PARTE 1 — FOTO DEL EVENTO
─────────────────────────

- Image con URI del evento (evento.imagen_url).
- width: '100%', height: 200, resizeMode: 'cover'.
- NO tiene padding. La foto toca los bordes del card (gracias al overflow: 'hidden').
- Las esquinas superiores de la foto son redondeadas automáticamente por el overflow del card.
- Si la imagen no carga: placeholder View con backgroundColor: '#E8E8E8' + 
  Ionicons 'image-outline' centrado (48px, #AAAAAA).

PILL DE CATEGORÍA/ESPECIE (superpuesto sobre la foto):
  · Posición: absolute, top: 12, left: 12.
  · backgroundColor: '#2DBD72' (verde teal).
  · borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12.
  · Texto: evento.categoria_tag en UPPERCASE (ej: "GOLDEN RETRIEVER", "TODAS LAS MASCOTAS", "GATOS").
  · fontFamily: Bold, fontSize: 11px, color: '#FFFFFF', letterSpacing: 0.5.
  · Sombra muy sutil: shadowColor '#000', shadowOpacity: 0.2, shadowRadius: 4.
  · Si evento.categoria_tag es null: no renderizar el pill.

─────────────────────────────────
PARTE 2 — CONTENIDO DEL EVENTO
─────────────────────────────────

paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16.

TÍTULO DEL EVENTO:
  · Texto: evento.titulo.
  · fontFamily: Bold, fontSize: 18px, color: '#2C2C2C'.
  · marginBottom: 12px.
  · Puede ir en múltiples líneas (sin numberOfLines fijo).

FILA DE FECHA Y HORA (side by side):
  · flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap'.

  CHIP DE FECHA:
    · backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20.
    · paddingVertical: 6, paddingHorizontal: 12.
    · Contenido: Ionicons 'calendar-outline' (13px, #2DBD72) + espacio + texto.
    · Texto: fecha formateada en español (ej: "Miércoles 15 de abril de 2026").
      Usar: fechaEvento.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
      Con la primera letra del día en mayúscula.
    · fontFamily: Medium, fontSize: 12px, color: '#2C2C2C'.

  CHIP DE HORA:
    · Mismo estilo que el chip de fecha.
    · Contenido: Ionicons 'time-outline' (13px, #2DBD72) + espacio + texto.
    · Texto: hora formateada "HH:MM hs" (ej: "09:00 hs").
      Usar: fechaEvento.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }) + ' hs'.

PILL DE UBICACIÓN (full width):
  · backgroundColor: '#E8F8F0' (verde muy suave).
  · borderRadius: 20.
  · paddingVertical: 8, paddingHorizontal: 14.
  · flexDirection: 'row', alignItems: 'center', gap: 6.
  · marginBottom: 14.
  · Contenido:
    - Ionicons 'location-outline', 14px, #2DBD72.
    - Texto: evento.ubicacion_nombre (ej: "Parque Centenario, Av. Díaz Vélez 4900, CABA").
    - fontFamily: Medium, fontSize: 13px, color: '#2DBD72'.
    - numberOfLines: 2 (permite 2 líneas si la dirección es larga).
  · TouchableOpacity:
    - Al tocar: abrir Google Maps con la URL:
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.ubicacion_nombre)}`
    - O si tiene lat/lng: `https://www.google.com/maps/search/?api=1&query=${evento.lat},${evento.lng}`
    - Abrir con Linking.openURL().

DESCRIPCIÓN:
  · Texto: evento.descripcion.
  · fontFamily: Regular, fontSize: 14px, color: '#6B6B6B', lineHeight: 22.
  · marginBottom: 16.
  · Si el texto es largo (> 4 líneas): mostrar truncado con botón "Ver más" al final.
    - Estado local: expandido / colapsado.
    - "Ver más" / "Ver menos": Bold, 13px, #2DBD72, al tocar alterna el estado.

PILL DEL ORGANIZADOR:
  · backgroundColor: '#F5F5F5'.
  · borderRadius: 20.
  · paddingVertical: 8, paddingHorizontal: 14.
  · flexDirection: 'row', alignItems: 'center', gap: 6.
  · marginBottom: 14.
  · width: '100%'.
  · Contenido:
    - Ionicons 'business-outline', 15px, #6B6B6B.
    - Texto: evento.organizador_nombre (ej: "Gobierno Ciudad Autónoma de Buenos Aires").
    - fontFamily: Regular, fontSize: 13px, color: '#6B6B6B'.
    - numberOfLines: 1, ellipsizeMode: 'tail'.
    - Ícono de verificación ✓ (Ionicons 'checkmark-circle', 14px, #2DBD72) al final — indica cuenta verificada.

BOTÓN "Agregar al calendario":
  ESTADO NORMAL (aún no agregado):
    · backgroundColor: '#2DBD72', borderRadius: 30, height: 48, width: '100%'.
    · Contenido: Ionicons 'calendar-outline' (18px, #FFFFFF) + texto "Agregar al calendario".
    · fontFamily: Bold, fontSize: 15px, color: '#FFFFFF'.
    · shadowColor: '#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.12, shadowRadius:6, elevation:4.
    · Al presionar: escala 0.97 en 100ms. Mientras procesa: ActivityIndicator blanco.
    · Al éxito: transicionar al estado "Agregado" (animación 200ms).

  ESTADO AGREGADO (ya en el calendario):
    · backgroundColor: '#A8D8B8' (verde apagado/grisáceo — indica estado completado).
    · borderRadius: 30, height: 48, width: '100%'.
    · Contenido: Ionicons 'checkmark-circle-outline' (18px, #FFFFFF) + texto "✓ Agregado al calendario".
    · fontFamily: Bold, fontSize: 15px, color: '#FFFFFF'.
    · disabled: true (no tappable).
    · Sin sombra (para indicar visualmente que ya se realizó la acción).
    · Transición del color del botón: '#2DBD72' → '#A8D8B8', 200ms ease-out.

──────────────────────────────────────
ESTADO VACÍO (sin eventos en la ciudad)
──────────────────────────────────────

Si el backend no devuelve eventos para la ciudad del usuario:
  · Centrado en pantalla (flex: 1, justifyContent: 'center', alignItems: 'center').
  · Emoji grande: 🎪 (o ícono Ionicons 'storefront-outline', 60px, #AAAAAA).
  · Texto: "No hay eventos por ahora"
    Bold, 16px, #2C2C2C, textAlign: 'center', marginTop: 12.
  · Subtexto: "Cuando haya actividades cerca tuyo, las vas a ver acá 🐾"
    Regular, 14px, #6B6B6B, textAlign: 'center', marginTop: 6, paddingHorizontal: 32.

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

Al montar la pantalla: mostrar 2 skeleton cards.
Cada skeleton simula la forma de un card de evento:
  · backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 18, marginHorizontal: 16, marginBottom: 16.
  · Bloque superior (foto): height: 200, backgroundColor: '#E0E0E0', shimmer.
  · Bloque de título: height: 20, width: '70%', backgroundColor: '#E8E8E8', borderRadius: 6,
    marginTop: 14, marginHorizontal: 16, shimmer.
  · Bloque de fecha: height: 14, width: '50%', backgroundColor: '#EBEBEB', borderRadius: 10,
    marginTop: 10, marginHorizontal: 16, shimmer.
  · Bloque de descripción: height: 60, backgroundColor: '#EBEBEB', borderRadius: 6,
    marginTop: 12, marginHorizontal: 16, shimmer.

──────────────────────────────────────
FUNCIONALIDAD — AGREGAR AL CALENDARIO
──────────────────────────────────────

Al tocar "Agregar al calendario":

1. Llamar POST /api/mascotas/:petId/eventos (endpoint ya implementado en CalendarioScreen):
   body = {
     titulo:       evento.titulo,
     descripcion:  evento.descripcion + "\n📍 " + evento.ubicacion_nombre,
     fecha_hora:   evento.fecha_hora,   // ISO string
     tipo:         "Evento"             // categoría predefinida para eventos externos
   }
   donde :petId = mascota activa del usuario autenticado.

2. Al éxito (201):
   · El botón transiciona a estado "✓ Agregado al calendario".
   · Guardar en estado local `eventosAgregados: Set<number>` el id del evento.
   · Toast: no es necesario (el cambio del botón es feedback suficiente).

3. Al error:
   · Alert "No se pudo agregar al calendario. Intentá de nuevo."
   · El botón vuelve al estado normal.

IMPORTANTE: en el GET /api/eventos, el backend también devuelve `ya_en_calendario: boolean` para
cada evento, calculado en función del usuario autenticado. Esto permite que al recargar la pantalla
los botones ya muestren el estado correcto sin depender solo del estado local.

──────────────────────────────────────
LÓGICA FRONTEND (EventosScreen.jsx)
──────────────────────────────────────

Archivo: screens/EventosScreen.jsx

Estado local (useState):
- eventos:            array de objetos evento
- loading:            boolean
- eventosAgregados:   Set de ids de eventos ya agregados al calendario
- descripcionExpandida: Set de ids de eventos con descripción expandida

useEffect al montar:
  · Obtener JWT del AsyncStorage.
  · Obtener ciudad del usuario (del perfil cacheado o de la store global):
    - Intentar con: usuario.ciudad || usuario.ubicacion || null.
  · Llamar GET /api/eventos?ciudad=[ciudad] (ver backend).
  · Guardar en eventos.
  · Inicializar eventosAgregados con los ids donde ya_en_calendario === true.
  · Manejar errores con Alert.

Función toggleDescripcion(eventoId):
  · Si está en descripcionExpandida: quitar.
  · Si no está: agregar.

Función agregarAlCalendario(evento):
  · Si el id ya está en eventosAgregados: no hacer nada (botón deshabilitado).
  · Obtener petId de la mascota activa (del estado global de la app).
  · Llamar POST /api/mascotas/:petId/eventos con los datos del evento.
  · Al éxito: agregar evento.id al Set eventosAgregados.
  · Al error: Alert.

──────────────────────────────────────
BACKEND — MODELO DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: organizadores_verificados
(Cuentas verificadas por el equipo de Zooni que pueden crear eventos. Proceso a definir.)

CREATE TABLE organizadores_verificados (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  logo_url     VARCHAR(255),
  es_oficial   BOOLEAN DEFAULT FALSE,   -- TRUE para organismos gubernamentales
  activo       BOOLEAN DEFAULT TRUE,
  creado_en    TIMESTAMP DEFAULT NOW()
);

TABLA: eventos
(Eventos creados por organizadores verificados. Administrado desde el backend por ahora.)

CREATE TABLE eventos (
  id                 SERIAL PRIMARY KEY,
  organizador_id     INTEGER NOT NULL REFERENCES organizadores_verificados(id),
  titulo             VARCHAR(200) NOT NULL,
  descripcion        TEXT,
  imagen_url         VARCHAR(255),
  fecha_hora         TIMESTAMP NOT NULL,
  ubicacion_nombre   VARCHAR(255) NOT NULL,    -- nombre del lugar + dirección
  lat                DECIMAL(10, 7),            -- latitud (opcional, para mapas)
  lng                DECIMAL(10, 7),            -- longitud (opcional, para mapas)
  ciudad             VARCHAR(100) NOT NULL,     -- ciudad donde se realiza el evento
  provincia          VARCHAR(100),
  pais               VARCHAR(100) DEFAULT 'Argentina',
  categoria_tag      VARCHAR(100),              -- ej: "GOLDEN RETRIEVER", "TODAS LAS MASCOTAS"
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMP DEFAULT NOW()
);

-- Índices:
CREATE INDEX idx_eventos_ciudad ON eventos(ciudad);
CREATE INDEX idx_eventos_fecha ON eventos(fecha_hora);
CREATE INDEX idx_eventos_ciudad_fecha ON eventos(ciudad, fecha_hora);
CREATE INDEX idx_eventos_activo ON eventos(activo);

-- Datos de ejemplo:
INSERT INTO organizadores_verificados (nombre, es_oficial) VALUES
  ('Gobierno Ciudad Autónoma de Buenos Aires', TRUE),
  ('Municipalidad de Córdoba', TRUE),
  ('Zooni Oficial', FALSE);

INSERT INTO eventos (organizador_id, titulo, descripcion, fecha_hora, ubicacion_nombre, lat, lng, ciudad, provincia, categoria_tag) VALUES
  (1,
   'Jornada de Vacunación Gratuita para Golden Retrievers',
   'El Gobierno de la Ciudad Autónoma de Buenos Aires organiza una jornada de vacunación gratuita para Golden Retrievers. Se aplicarán vacunas antirrábicas, séxtuple y contra la leptospirosis. Traé el carnet sanitario de tu mascota.',
   '2026-04-15 09:00:00',
   'Parque Centenario, Av. Díaz Vélez 4900, CABA',
   -34.6063, -58.4345,
   'Buenos Aires', 'Ciudad Autónoma de Buenos Aires',
   'GOLDEN RETRIEVER');

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/eventos
Requiere el middleware verifyToken.

──────────────────────
1. GET /api/eventos
──────────────────────
Devuelve los eventos filtrados por ciudad y vigentes (fecha futura o de hoy).

Query params:
  - ciudad: string (ej: "Buenos Aires") — requerido
  - page: número de página (default: 1)
  - limit: eventos por página (default: 10)

Lógica:
a) Buscar eventos donde:
   - LOWER(ciudad) LIKE LOWER('%' || $1 || '%')  (búsqueda flexible por ciudad)
   - activo = TRUE
   - fecha_hora >= NOW() - INTERVAL '1 hour'  (incluye eventos de hoy, hasta 1h después de empezar)
b) JOIN con organizadores_verificados para obtener el nombre del organizador.
c) Para cada evento, verificar si el usuario autenticado ya lo agregó a su calendario:
   EXISTS (SELECT 1 FROM eventos_calendario ec
           JOIN mascotas m ON ec.mascota_id = m.id
           WHERE m.usuario_id = $usuario_id
             AND ec.titulo = eventos.titulo
             AND DATE(ec.fecha_hora) = DATE(eventos.fecha_hora))
   → Devolver como campo `ya_en_calendario: boolean`.
d) ORDER BY fecha_hora ASC (próximos primero).
e) Paginación con LIMIT y OFFSET.

Response (200):
{
  "eventos": [
    {
      "id": 1,
      "titulo": "Jornada de Vacunación Gratuita para Golden Retrievers",
      "descripcion": "El Gobierno de la Ciudad...",
      "imagen_url": "https://cdn.zooni.com/eventos/vacunacion_golden.jpg",
      "fecha_hora": "2026-04-15T09:00:00.000Z",
      "ubicacion_nombre": "Parque Centenario, Av. Díaz Vélez 4900, CABA",
      "lat": -34.6063,
      "lng": -58.4345,
      "ciudad": "Buenos Aires",
      "categoria_tag": "GOLDEN RETRIEVER",
      "organizador_nombre": "Gobierno Ciudad Autónoma de Buenos Aires",
      "organizador_es_oficial": true,
      "ya_en_calendario": false
    }
  ],
  "total": 5,
  "page": 1,
  "hay_mas": false
}

Errores:
- 400: { "error": "El parámetro ciudad es requerido" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/EventosScreen.jsx                 ← pantalla principal (este prompt)
- (reutilizar) utils/api.js                 ← ya existe

Backend:
- routes/eventos.js
- controllers/eventosController.js
- migrations/009_create_eventos.sql         ← CREATE TABLE organizadores_verificados + eventos + seeds

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                       |
|------------------------------------------------|----------------------------------------------------------------------|
| Sin eventos en la ciudad del usuario           | Estado vacío con 🎪 + texto explicativo                              |
| Imagen del evento no carga                     | Placeholder gris con ícono 'image-outline'                          |
| categoria_tag es null                          | No renderizar el pill de categoría sobre la foto                    |
| Descripción muy larga (> 4 líneas)             | Truncar con "Ver más" tappable que expande                          |
| Ubicación muy larga (> 1 línea)                | numberOfLines: 2 en el pill de ubicación                            |
| Evento ya agregado al recargar la pantalla     | El botón ya muestra "✓ Agregado" (dato viene del backend)           |
| Mascota activa del usuario es null             | Alert "Necesitás tener una mascota registrada para agregar al calendario" |
| Red caída al cargar                            | Alert con botón "Reintentar" → vuelve a hacer el GET               |
| Red caída al agregar al calendario             | Alert "Sin conexión" + el botón vuelve al estado normal             |
| Evento de hoy que ya empezó hace >1h           | No se muestra (filtrado en el backend)                              |
| Tocar la ubicación                             | Abre Google Maps en el navegador del dispositivo                    |
| Error 403 (token inválido)                     | Redirigir a LoginScreen                                             |
| No se puede determinar la ciudad del usuario   | Mostrar todos los eventos sin filtrar + "📍 Eventos cerca tuyo"     |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- Esta es una pantalla de SOLO LECTURA para el usuario. No hay formularios ni creación de eventos.
- La única acción interactiva es "Agregar al calendario", que usa el endpoint ya implementado
  en el CalendarioScreen (POST /api/mascotas/:petId/eventos con tipo: "Evento").
- El campo `ya_en_calendario` del backend permite restaurar el estado correcto de los botones
  al recargar la pantalla, independientemente del estado local del frontend.
- El pill de la categoría (ej: "GOLDEN RETRIEVER") va SUPERPUESTO sobre la foto (position:
  'absolute'). Es posible gracias al overflow: 'hidden' del card.
- La ubicación en el pill de location es TAPPABLE → abre Google Maps con Linking.openURL().
- La descripción larga debe colapsarse a ~4 líneas con "Ver más" tappable. Implementar con
  un estado local Set para saber qué tarjetas están expandidas.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores de Zooni definida en este documento.
- Animaciones: solo la transición del botón "Agregar" → "Agregado" en 200ms. El resto
  es contenido estático sin animaciones complejas (esta pantalla prioriza el contenido).
