# Tareas de Implementación — Pantalla Comunidad (Zooni)

## Tarea 1: Configuración de dependencias y estructura base

- [x] 1.1 Instalar `react-native-maps`, `@gorhom/bottom-sheet`, `react-native-map-clustering`, `@react-native-community/netinfo`, `react-native-image-picker`, `@react-native-async-storage/async-storage`
- [x] 1.2 Crear la estructura de carpetas: `src/screens/Comunidad/`, `src/components/Comunidad/`, `src/hooks/comunidad/`, `src/api/comunidad/`
- [x] 1.3 Crear el archivo de constantes y shapes JS `src/types/comunidad.js` con objetos de forma (PropTypes shapes) para `Cartel`, `Servicio`, `Amigo`, `BoundingBox`, `MapaData`, `PopupData`

**Dependencias:** ninguna

---

## Tarea 2: Servicios API — Backend endpoints

- [x] 2.1 Crear migraciones SQL para tablas `carteles`, `servicios`, `amistades`, `ubicaciones_usuarios` con índices geoespaciales
- [x] 2.2 Implementar `GET /api/v1/comunidad/mapa` con filtro por bounding box, máximo 50 markers, filtro de privacidad de amigos
- [x] 2.3 Implementar `POST /api/v1/carteles` con upload de foto via multer y validación de campos
- [x] 2.4 Implementar `DELETE /api/v1/carteles/:id` con verificación de propiedad (soft delete)
- [x] 2.5 Implementar `PUT /api/v1/ubicacion` con actualización asíncrona
- [x] 2.6 Implementar `GET /api/v1/amigos` con distancia calculada y estado online
- [x] 2.7 Implementar `POST /api/v1/amigos/solicitud` con validación de duplicados (409)
- [x] 2.8 Implementar `PATCH /api/v1/amigos/solicitud/:id` para aceptar/rechazar
- [x] 2.9 Implementar `GET /api/v1/usuarios/buscar?q=` con búsqueda por nombre y mascota
- [x] 2.10 Implementar `GET /api/v1/comunidad/servicios` con filtro por bounding box y tipo

**Dependencias:** 1.1, 1.2

---

## Tarea 3: Capa de API en el frontend

- [ ] 3.1 Crear `src/api/comunidad/mapaApi.js` con funciones `fetchMapaData(bbox)`, `fetchServicios(bbox, tipo)`
- [ ] 3.2 Crear `src/api/comunidad/cartelesApi.js` con funciones `crearCartel(formData)`, `eliminarCartel(id)`
- [ ] 3.3 Crear `src/api/comunidad/amigosApi.js` con funciones `fetchAmigos()`, `enviarSolicitud(destinoId)`, `responderSolicitud(id, accion)`, `buscarUsuarios(q)`
- [ ] 3.4 Crear `src/api/comunidad/ubicacionApi.js` con función `actualizarUbicacion(lat, lng)`

**Dependencias:** 1.3

---

## Tarea 4: Hook de geolocalización y polling

- [ ] 4.1 Crear `src/hooks/comunidad/useGeolocalizacion.js`: solicitar permiso, obtener ubicación actual, fallback a Buenos Aires
- [ ] 4.2 Crear `src/hooks/comunidad/usePolling.js`: setInterval de 30s para `PUT /ubicacion` y `GET /mapa`, cleanup al desmontar
- [ ] 4.3 Crear `src/hooks/comunidad/useDebounce.js`: debounce genérico con useRef para el movimiento del mapa (800ms) y búsqueda (400ms)
- [ ] 4.4 Crear `src/hooks/comunidad/useConexion.js`: detectar estado de red con `@react-native-community/netinfo`, gestionar caché en AsyncStorage

**Dependencias:** 3.1, 3.4

---

## Tarea 5: Componente MapaComponent

- [ ] 5.1 Crear `src/components/Comunidad/MapaComponent.jsx` con `react-native-maps`, pantalla completa, zoom inicial 15
- [ ] 5.2 Implementar marker del usuario: círculo azul `#2196F3` con animación de pulso radial (`Animated.loop`)
- [ ] 5.3 Implementar markers de servicios con íconos y colores por tipo (veterinaria, paseador, petshop, peluquería)
- [ ] 5.4 Implementar markers de carteles con íconos por tipo (perdida = rojo, otros = gris)
- [ ] 5.5 Implementar markers de amigos con avatar circular y borde verde `#2DBD72`
- [ ] 5.6 Implementar clustering con `react-native-map-clustering`
- [ ] 5.7 Implementar handler `onDoublePress` para el modo cartel (marker temporal pulsante)
- [ ] 5.8 Implementar handler `onRegionChangeComplete` con debounce 800ms para actualizar bounding box
- [ ] 5.9 Agregar `accessibilityLabel` a todos los markers con formato `"[Tipo]: [Nombre], [distancia] km"`

**Dependencias:** 1.1, 4.3

---

## Tarea 6: Botones flotantes y controles de zoom

- [ ] 6.1 Crear `src/components/Comunidad/BotonesFlotantes.jsx` con los tres botones pill (Mi Ubicación, Agregar Amigo, Crear Cartel)
- [ ] 6.2 Crear `src/components/Comunidad/ControlesZoom.jsx` con botones + y − (36×36px, border-radius 8px)
- [ ] 6.3 Crear `src/components/Comunidad/HeaderFlotante.jsx` con hamburger sobre el mapa (fondo circular blanco, sombra)
- [ ] 6.4 Agregar `accessibilityLabel` y `accessibilityRole="button"` a todos los botones flotantes

**Dependencias:** 1.3

---

## Tarea 7: Popups de markers

- [ ] 7.1 Crear `src/components/Comunidad/PopupServicio.jsx` con nombre, tipo, dirección, teléfono, descripción y botón "Ver en Google Maps" (`Linking.openURL`)
- [ ] 7.2 Crear `src/components/Comunidad/PopupCartel.jsx` con tipo, mascota, descripción (3 líneas + "Ver más"), teléfono, publicador, fecha y botón "Eliminar Cartel" condicional
- [ ] 7.3 Implementar animación de entrada con `Animated.spring` (translateY 50→0)
- [ ] 7.4 Implementar diálogo de confirmación de eliminación (`Alert.alert` o modal custom)

**Dependencias:** 1.3

---

## Tarea 8: Flujo de creación de cartel

- [ ] 8.1 Crear `src/components/Comunidad/BannerModoCartel.jsx` con animación fade + slide down, fondo `#2DBD72`
- [ ] 8.2 Crear `src/components/Comunidad/FormularioCartel.jsx` con todos los campos (tipo, mascota, descripción, teléfono, foto)
- [ ] 8.3 Implementar validación inline del teléfono de contacto con mensaje de error
- [ ] 8.4 Implementar selector de foto con `react-native-image-picker` (JPG/PNG/GIF, máx 5MB)
- [ ] 8.5 Implementar submit con `FormData` multipart y llamada a `POST /api/v1/carteles`
- [ ] 8.6 Implementar Toast de confirmación "Cartel creado exitosamente" (3s, fade-out)
- [ ] 8.7 Implementar cancelación: cerrar formulario, eliminar marker temporal, desactivar modo cartel

**Dependencias:** 3.2, 6.1

---

## Tarea 9: BottomSheet y sistema de tabs

- [ ] 9.1 Crear `src/components/Comunidad/BottomSheet.jsx` con `@gorhom/bottom-sheet`, snap points `['10%', '45%', '90%']`
- [ ] 9.2 Implementar barra de tabs con scroll horizontal, estilo activo (fondo `#2DBD72`, texto blanco) e inactivo (texto `#6B6B6B`)
- [ ] 9.3 Agregar `accessibilityViewIsModal={true}` cuando el sheet está expandido

**Dependencias:** 1.1

---

## Tarea 10: Tab Amigos

- [ ] 10.1 Crear `src/components/Comunidad/TabAmigos.jsx` con lista de amigos (avatar, nombre, mascota, distancia, botón "Ver en mapa")
- [ ] 10.2 Implementar indicador online/offline (borde verde/gris en avatar)
- [ ] 10.3 Implementar selector de filtro "Solo para amigos ▼"
- [ ] 10.4 Implementar estado vacío "No tenés amigos agregados aún"
- [ ] 10.5 Conectar botón "Ver en mapa" con `MapaComponent` para centrar y resaltar marker

**Dependencias:** 3.3, 9.1

---

## Tarea 11: Tab Servicios

- [ ] 11.1 Crear `src/components/Comunidad/TabServicios.jsx` con lista de servicios (ícono, nombre, dirección, distancia)
- [ ] 11.2 Implementar chips de filtro horizontales (Todos, Veterinaria, Paseador, Pet Shop, Peluquería)
- [ ] 11.3 Conectar con debounce 800ms al movimiento del mapa para actualizar la lista
- [ ] 11.4 Conectar tap en ítem con centrado del mapa y apertura del popup

**Dependencias:** 3.1, 9.1, 4.3

---

## Tarea 12: Tab Solicitudes

- [ ] 12.1 Crear `src/components/Comunidad/TabSolicitudes.jsx` con sección de solicitudes pendientes (avatar, nombre, botones Aceptar/Rechazar)
- [ ] 12.2 Implementar aceptar solicitud: `PATCH /solicitud/:id`, agregar marker al mapa, Toast de confirmación
- [ ] 12.3 Implementar rechazar solicitud: `PATCH /solicitud/:id`, eliminar de la lista
- [ ] 12.4 Implementar sección de chats activos (avatar, nombre, último mensaje, timestamp, badge de no leídos)
- [ ] 12.5 Conectar tap en chat con navegación a pantalla de chat

**Dependencias:** 3.3, 9.1

---

## Tarea 13: Tab Buscar y Modal Agregar Amigo

- [ ] 13.1 Crear `src/components/Comunidad/BuscadorUsuarios.jsx` (componente reutilizable): input con debounce 400ms, lista de resultados con botón [+ Agregar] / [✓ Amigos]
- [ ] 13.2 Crear `src/components/Comunidad/TabBuscar.jsx` que usa `BuscadorUsuarios`
- [ ] 13.3 Crear `src/components/Comunidad/ModalAgregarAmigo.jsx` que usa `BuscadorUsuarios` como overlay
- [ ] 13.4 Implementar envío de solicitud con Toast "Solicitud enviada a [Nombre]" y manejo de error 409

**Dependencias:** 3.3, 9.1

---

## Tarea 14: Manejo de errores y estados offline

- [ ] 14.1 Crear `src/components/Comunidad/BannerSinConexion.jsx` con texto "Sin conexión" y estilo de alerta
- [ ] 14.2 Implementar caché en AsyncStorage: guardar última respuesta de `/comunidad/mapa`, cargar al detectar sin conexión
- [ ] 14.3 Implementar placeholder de imagen para fotos de carteles que no cargan (imagen gris con ícono)
- [ ] 14.4 Implementar manejo de error en formulario de cartel (mantener abierto, mostrar mensaje)

**Dependencias:** 4.4, 8.2

---

## Tarea 15: Integración final — ComunidadScreen

- [ ] 15.1 Crear `src/screens/Comunidad/ComunidadScreen.jsx` integrando todos los componentes
- [ ] 15.2 Conectar el ciclo de vida completo: permisos → ubicación → carga inicial → polling
- [ ] 15.3 Conectar el flujo de modo cartel: activar → doble tap → formulario → confirmación → nuevo marker
- [ ] 15.4 Conectar popups con markers del mapa (abrir al tocar, cerrar con ✕)
- [ ] 15.5 Conectar BottomSheet con el estado del mapa (bounding box compartido)
- [ ] 15.6 Registrar la pantalla en el navegador de la app (React Navigation)

**Dependencias:** 4.1, 4.2, 5.1–5.9, 6.1–6.4, 7.1–7.4, 8.1–8.7, 9.1–9.3, 10.1–10.5, 11.1–11.4, 12.1–12.5, 13.1–13.4, 14.1–14.4
