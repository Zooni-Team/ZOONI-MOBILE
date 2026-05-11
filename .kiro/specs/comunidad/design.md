# Diseño Técnico — Pantalla Comunidad (Zooni)

## Arquitectura General

La pantalla Comunidad sigue una arquitectura de **componentes React Native** con estado local y llamadas a la API REST. El mapa es el componente central, rodeado de overlays flotantes y un bottom sheet persistente.

```
ComunidadScreen
├── MapaComponent          ← react-native-maps, pantalla completa
│   ├── MarkerUsuario      ← círculo azul pulsante
│   ├── MarkerAmigo[]      ← avatar circular con borde verde
│   ├── MarkerServicio[]   ← íconos por tipo
│   ├── MarkerCartel[]     ← pin por tipo de cartel
│   └── MarkerCluster[]    ← agrupación automática
├── HeaderFlotante         ← hamburger sobre el mapa
├── BotonesFlotantes       ← Mi Ubicación, Agregar Amigo, Crear Cartel
├── ControlesZoom          ← + / −
├── BannerModoCartel       ← instrucción al activar modo cartel
├── BannerSinConexion      ← estado offline
├── PopupServicio          ← card al tocar marker de servicio
├── PopupCartel            ← card al tocar marker de cartel
├── FormularioCartel       ← modal de creación de cartel
├── ModalAgregarAmigo      ← overlay de búsqueda de usuarios
├── ToastNotificacion      ← notificaciones temporales
└── BottomSheet            ← panel inferior deslizable
    ├── TabAmigos
    ├── TabServicios
    ├── TabSolicitudes
    └── TabBuscar
```

---

## Componentes Frontend

### ComunidadScreen

**Responsabilidades:**
- Orquestar el estado global de la pantalla
- Gestionar el ciclo de vida: solicitar permisos, iniciar polling, limpiar timers al desmontar
- Proveer contexto de ubicación y bounding box a los componentes hijos

**Estado:**
```typescript
interface ComunidadState {
  ubicacionUsuario: { lat: number; lng: number } | null;
  permisoUbicacion: 'granted' | 'denied' | 'pending';
  boundingBox: BoundingBox;
  markers: MapaData;           // { servicios, carteles, amigos }
  modoCartel: boolean;
  markerTemporal: { lat: number; lng: number } | null;
  popupActivo: PopupData | null;
  tabActivo: 'amigos' | 'servicios' | 'solicitudes' | 'buscar';
  sinConexion: boolean;
  cargando: boolean;
}
```

---

### MapaComponent

**Librería:** `react-native-maps`  
**Configuración inicial:** zoom 15, centrado en ubicación del usuario o Buenos Aires (-34.6037, -58.3816) como fallback.

**Props:**
```typescript
interface MapaProps {
  ubicacionUsuario: Coordenadas | null;
  markers: MapaData;
  modoCartel: boolean;
  onMapaMovido: (bbox: BoundingBox) => void;
  onDoubleTap: (coordenadas: Coordenadas) => void;
  onMarkerPress: (marker: MarkerData) => void;
  zoomLevel: number;
}
```

**Marker del usuario:** `Animated.View` con `useNativeDriver: true`, escala pulsante de 1.0 → 1.4 → 1.0 en loop continuo, color `#2196F3`.

**Clustering:** usar `react-native-map-clustering` o implementar clustering manual con radio de 50px en pantalla.

---

### BotonesFlotantes

Posición: `position: 'absolute'`, `top: 80`, `right: 16` (debajo del header).

```typescript
const botones = [
  { id: 'ubicacion', label: 'Mi Ubicación', icono: '📍', fondo: '#FFFFFF', textoColor: '#2C2C2C' },
  { id: 'amigo',     label: 'Agregar Amigo', icono: '➕', fondo: '#FFFFFF', textoColor: '#2C2C2C' },
  { id: 'cartel',    label: 'Crear Cartel',  icono: '🚨', fondo: '#E63946', textoColor: '#FFFFFF' },
];
```

Estilo: `borderRadius: 20`, `paddingHorizontal: 14`, `paddingVertical: 8`, `marginBottom: 8`, sombra `elevation: 4`.

---

### PopupServicio / PopupCartel

Posición: `position: 'absolute'`, centrado horizontalmente, `bottom: bottomSheetHeight + 16`.  
Ancho: `80%` del ancho de pantalla.  
Animación de entrada: `Animated.spring` desde `translateY: 50` a `translateY: 0`.

**PopupServicio muestra:**
- Nombre (bold 16px), tipo de servicio (gris 13px)
- Dirección con ícono 📍, teléfono con ícono 📞, descripción con ícono 🔬
- Botón "Ver en Google Maps" → `Linking.openURL(googleMapsUrl)`

**PopupCartel muestra:**
- Tipo con color según tipo, nombre de mascota (bold), raza
- Descripción con `numberOfLines={3}` + botón "Ver más"
- Teléfono, publicador, fecha
- Botón "Eliminar Cartel" (solo si `cartel.usuario_id === usuarioAutenticado.id`)

---

### FormularioCartel

Modal bottom sheet con `KeyboardAvoidingView`.

**Campos:**
```typescript
interface FormCartel {
  tipo: 'perdida' | 'encontrada' | 'adopcion' | 'aviso_general';
  mascota_id: string | null;
  descripcion: string;          // máx 300 chars
  telefono_contacto: string;    // requerido
  foto: ImagePickerAsset | null; // JPG/PNG/GIF, máx 5MB
}
```

**Validación:** antes de submit, verificar `telefono_contacto` no vacío y formato válido (`/^\+?[\d\s\-()]{7,20}$/`).

**Submit:** `FormData` con `multipart/form-data`, incluir foto si existe.

---

### BottomSheet

**Librería recomendada:** `@gorhom/bottom-sheet`

**Snap points:** `['80px', '45%', '90%']`  
**Estado inicial:** índice 1 (medio, 45%)

```typescript
const snapPoints = useMemo(() => ['10%', '45%', '90%'], []);
```

**Tabs:** `ScrollView` horizontal con `showsHorizontalScrollIndicator={false}`.

---

### TabAmigos

**Datos:** `GET /api/v1/amigos` al montar el tab.  
**Cada ítem:**
```
[Avatar 40px] Nombre del amigo          [Ver en mapa]
              Luna · 1.2 km
```
Avatar con borde verde `#2DBD72` si online, gris `#AAAAAA` si offline.  
"Ver en mapa" → llama `onVerEnMapa(amigo.usuario_id)` que centra el mapa.

---

### TabServicios

**Datos:** `GET /api/v1/comunidad/servicios?lat_min=...&tipo=...` con debounce 800ms al cambiar bounding box.  
**Chips de filtro:** `ScrollView` horizontal, chip activo con fondo `#2DBD72`.

---

### TabSolicitudes

**Dos secciones:**
1. Solicitudes pendientes → `GET /api/v1/amigos/solicitudes` (pendientes recibidas)
2. Chats activos → `GET /api/v1/chats` (lista de conversaciones)

Badge de mensajes no leídos: círculo rojo `#E63946` sobre el avatar.

---

### TabBuscar / ModalAgregarAmigo

**Búsqueda:** `TextInput` con debounce 400ms → `GET /api/v1/usuarios/buscar?q=<texto>`.  
**Resultado:** avatar + nombre + mascota + barrio + botón `[+ Agregar]` o `[✓ Amigos]`.  
El modal reutiliza el mismo componente `BuscadorUsuarios` que el tab.

---

## Diseño Backend

### Modelos de Base de Datos

#### Tabla `carteles`
```sql
CREATE TABLE carteles (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  usuario_id    CHAR(36)     NOT NULL,
  mascota_id    CHAR(36)     NULL,
  tipo          ENUM('perdida','encontrada','adopcion','aviso_general') NOT NULL,
  descripcion   TEXT         NULL,
  telefono_contacto VARCHAR(30) NOT NULL,
  foto_url      VARCHAR(500) NULL,
  ubicacion     POINT        NOT NULL,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_ubicacion (ubicacion),
  INDEX idx_usuario (usuario_id),
  INDEX idx_activo (activo)
);
```

#### Tabla `servicios`
```sql
CREATE TABLE servicios (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  tipo          ENUM('veterinaria','paseador','petshop','peluqueria') NOT NULL,
  nombre        VARCHAR(200) NOT NULL,
  direccion     VARCHAR(300) NOT NULL,
  telefono      VARCHAR(30)  NULL,
  descripcion   TEXT         NULL,
  ubicacion     POINT        NOT NULL,
  google_maps_url VARCHAR(500) NULL,
  verified      BOOLEAN      NOT NULL DEFAULT FALSE,
  SPATIAL INDEX idx_ubicacion (ubicacion)
);
```

#### Tabla `amistades`
```sql
CREATE TABLE amistades (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  usuario_a_id  CHAR(36)     NOT NULL,
  usuario_b_id  CHAR(36)     NOT NULL,
  estado        ENUM('pendiente','aceptada','rechazada') NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_amistad (usuario_a_id, usuario_b_id),
  INDEX idx_usuario_b (usuario_b_id),
  INDEX idx_estado (estado)
);
```

#### Tabla `ubicaciones_usuarios`
```sql
CREATE TABLE ubicaciones_usuarios (
  usuario_id          CHAR(36)  PRIMARY KEY,
  ubicacion           POINT     NOT NULL,
  compartir_ubicacion BOOLEAN   NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_ubicacion (ubicacion)
);
```

---

### Endpoints API — Implementación

#### `GET /api/v1/comunidad/mapa`

```javascript
// Query con bounding box geoespacial (MySQL)
const query = `
  SELECT s.id, s.tipo, s.nombre, s.direccion, s.telefono, s.descripcion,
         ST_X(s.ubicacion) AS lng, ST_Y(s.ubicacion) AS lat, s.google_maps_url
  FROM servicios s
  WHERE MBRContains(
    ST_GeomFromText('POLYGON((? ?, ? ?, ? ?, ? ?, ? ?))'),
    s.ubicacion
  )
  ORDER BY ST_Distance(s.ubicacion, ST_GeomFromText('POINT(? ?)')) ASC
  LIMIT 50
`;
```

- Filtrar amigos: solo incluir usuarios cuya `amistad.estado = 'aceptada'` con el usuario autenticado Y `compartir_ubicacion = true`.
- Máximo 50 markers totales, priorizando por distancia al centro del bounding box.

#### `POST /api/v1/carteles`

- Recibir `multipart/form-data` con `multer`.
- Si hay foto: subir a CDN/storage (S3 o local), guardar URL en `foto_url`.
- Insertar en tabla `carteles` con `ST_GeomFromText('POINT(lng lat)')`.
- Responder 201 con el cartel creado.

#### `DELETE /api/v1/carteles/:id`

```javascript
const cartel = await db.query('SELECT usuario_id FROM carteles WHERE id = ?', [id]);
if (!cartel || cartel.usuario_id !== req.user.id) {
  return res.status(403).json({ error: 'No tenés permiso para eliminar este cartel' });
}
await db.query('UPDATE carteles SET activo = FALSE WHERE id = ?', [id]);
res.json({ mensaje: 'Cartel eliminado correctamente' });
```

Soft delete: `activo = FALSE` en lugar de borrar el registro.

#### `PUT /api/v1/ubicacion`

- Actualizar `ubicaciones_usuarios` de forma asíncrona (encolar en worker o usar `setImmediate`).
- Solo actualizar si `compartir_ubicacion = true`.

#### `POST /api/v1/amigos/solicitud`

- Verificar que no exista ya una solicitud o amistad entre los dos usuarios (en ambas direcciones).
- Si existe → 409.
- Si no → insertar con `estado = 'pendiente'`.

#### `PATCH /api/v1/amigos/solicitud/:id`

- Verificar que la solicitud existe y que `usuario_b_id === req.user.id` (solo el destinatario puede responder).
- Si `accion = 'aceptar'` → `UPDATE estado = 'aceptada'`.
- Si `accion = 'rechazar'` → `UPDATE estado = 'rechazada'`.

#### `GET /api/v1/usuarios/buscar`

```sql
SELECT u.id AS usuario_id, u.nombre, u.foto_perfil_url, m.nombre AS mascota_nombre,
       u.barrio,
       EXISTS(
         SELECT 1 FROM amistades a
         WHERE ((a.usuario_a_id = ? AND a.usuario_b_id = u.id)
             OR (a.usuario_b_id = ? AND a.usuario_a_id = u.id))
           AND a.estado = 'aceptada'
       ) AS es_amigo
FROM usuarios u
LEFT JOIN mascotas m ON m.usuario_id = u.id AND m.principal = TRUE
WHERE (u.nombre LIKE ? OR m.nombre LIKE ?)
  AND u.id != ?
LIMIT 20
```

---

## Flujo de Datos — Polling

```
ComunidadScreen montado
  → solicitar permiso geolocalización
  → obtener ubicación actual
  → llamar GET /comunidad/mapa (carga inicial)
  → iniciar setInterval(30s):
      → PUT /ubicacion (si compartir_ubicacion = true)
      → GET /comunidad/mapa (refresh markers)

ComunidadScreen desmontado
  → clearInterval(pollingTimer)
  → clearTimeout(debounceTimer)
```

---

## Manejo de Estado y Caché

- **Caché offline:** guardar última respuesta de `/comunidad/mapa` en `AsyncStorage` con clave `comunidad_mapa_cache`.
- **Detección de conexión:** `@react-native-community/netinfo` para mostrar banner "Sin conexión".
- **Estado de formulario:** estado local en `FormularioCartel`, no persistido.
- **Debounce:** implementar con `useRef` para el timer, limpiar en cleanup del efecto.

```typescript
const debounceRef = useRef<NodeJS.Timeout>();

const onMapaMovido = useCallback((bbox: BoundingBox) => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    fetchMapaData(bbox);
  }, 800);
}, []);
```

---

## Privacidad y Seguridad

- Todos los endpoints requieren JWT en header `Authorization: Bearer <token>`.
- El endpoint `/comunidad/mapa` filtra ubicaciones de usuarios en el backend, nunca en el frontend.
- La verificación de propiedad del cartel se hace en el backend (no confiar en el frontend).
- Las fotos de carteles se sirven desde CDN con URLs firmadas o públicas según configuración.

---

## Accesibilidad

```typescript
// Ejemplo de marker accesible
<Marker
  coordinate={{ latitude: lat, longitude: lng }}
  accessibilityLabel={`Veterinaria: ${nombre}, ${distancia} km`}
  accessibilityRole="button"
/>

// Botón flotante accesible
<TouchableOpacity
  accessibilityLabel="Centrar mapa en mi ubicación"
  accessibilityRole="button"
>
```

El BottomSheet debe tener `accessibilityViewIsModal={true}` cuando está expandido.

---

## Dependencias Nuevas Requeridas

| Paquete | Versión | Uso |
|---|---|---|
| `react-native-maps` | `^1.10.0` | Mapa interactivo |
| `@gorhom/bottom-sheet` | `^4.6.0` | Panel inferior deslizable |
| `react-native-map-clustering` | `^1.1.0` | Clustering de markers |
| `@react-native-community/netinfo` | `^11.0.0` | Detección de conexión |
| `react-native-image-picker` | `^7.1.0` | Selector de foto para cartel |
| `multer` | `^1.4.5` | Upload de archivos en backend |
| `@react-native-async-storage/async-storage` | `^1.23.0` | Caché offline |
