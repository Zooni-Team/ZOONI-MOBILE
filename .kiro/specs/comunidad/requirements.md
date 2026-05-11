# Documento de Requisitos — Pantalla Comunidad (Zooni)

## Introducción

La pantalla **Comunidad** es la funcionalidad social central de Zooni, la app mobile para dueños de mascotas. Combina un mapa interactivo a pantalla completa con un panel inferior deslizable (bottom sheet) que agrupa cuatro áreas funcionales: gestión de amigos, exploración de servicios para mascotas, solicitudes de amistad y búsqueda de usuarios.

El objetivo de esta pantalla es permitir que los dueños de mascotas descubran servicios cercanos, se conecten con otros usuarios, compartan su ubicación con amigos y publiquen o consulten carteles comunitarios (mascotas perdidas, en adopción, avisos generales).

---

## Glosario

- **Sistema**: La aplicación Zooni (frontend React Native + backend Node.js).
- **Usuario**: Dueño de mascota autenticado que utiliza la app Zooni.
- **Amigo**: Otro usuario con quien se tiene una relación de amistad confirmada (estado `aceptada` en la entidad `Amistad`).
- **Cartel**: Publicación geolocalizada creada por un usuario para comunicar información sobre una mascota (perdida, encontrada, en adopción) o un aviso general.
- **Servicio**: Establecimiento o profesional de servicios para mascotas (veterinaria, paseador, pet shop, peluquería canina) registrado en la base de datos.
- **Marker**: Elemento visual sobre el mapa que representa la posición de un usuario, amigo, servicio o cartel.
- **Bounding Box**: Rectángulo de coordenadas geográficas que delimita el área visible del mapa en un momento dado.
- **Bottom Sheet**: Panel inferior deslizable con múltiples estados de altura (colapsado, medio, expandido).
- **Clustering**: Agrupación visual de múltiples markers cercanos en un único marcador con contador.
- **Mapa_Component**: Componente de mapa interactivo implementado con `react-native-maps`.
- **API**: Backend REST de Zooni (Node.js).
- **Solicitud_Amistad**: Petición enviada por un usuario a otro para establecer una relación de amistad.
- **UbicacionUsuario**: Registro de la posición geográfica actual de un usuario, actualizable periódicamente.
- **Toast**: Notificación temporal no bloqueante que aparece en pantalla por un período breve.
- **Popup**: Tarjeta de información que aparece sobre el mapa al tocar un marker.
- **Modo_Cartel**: Estado de la interfaz en el que el usuario puede seleccionar una posición en el mapa para crear un cartel.

---

## Requisitos

### Requisito 1: Carga inicial del mapa y geolocalización

**User Story:** Como usuario, quiero que al entrar a la pantalla Comunidad el mapa se centre automáticamente en mi ubicación actual, para poder ver los servicios y amigos cercanos a mí.

#### Criterios de Aceptación

1. WHEN el usuario navega a la pantalla Comunidad, THE Sistema SHALL solicitar permiso de geolocalización si aún no fue otorgado, mostrando el mensaje `"Zooni necesita tu ubicación para mostrarte servicios y amigos cercanos"`.
2. WHEN el permiso de geolocalización es otorgado, THE Mapa_Component SHALL centrarse en la ubicación actual del usuario con nivel de zoom 15.
3. IF el permiso de geolocalización es denegado, THEN THE Mapa_Component SHALL centrarse en Buenos Aires, CABA como posición de respaldo y THE Sistema SHALL mostrar un banner informativo explicando la limitación.
4. WHEN el mapa se carga por primera vez, THE Sistema SHALL realizar una llamada a `GET /api/v1/comunidad/mapa` con el bounding box del área visible para obtener markers iniciales.
5. IF la llamada a la API falla por falta de conexión, THEN THE Sistema SHALL mostrar el último estado cacheado del mapa y un banner `"Sin conexión"`.
6. THE Mapa_Component SHALL mostrar un marker especial para la posición del usuario: un círculo azul `#2196F3` con animación de pulso radial continuo.

---

### Requisito 2: Visualización de markers en el mapa

**User Story:** Como usuario, quiero ver en el mapa los markers de amigos, servicios y carteles comunitarios, para tener una visión completa de mi entorno con mascotas.

#### Criterios de Aceptación

1. THE Mapa_Component SHALL mostrar markers diferenciados por tipo: amigos (avatar circular con borde verde `#2DBD72`), veterinarias (ícono de cruz roja `#E63946`), paseadores (ícono naranja `#F5A623`), pet shops (ícono amarillo `#F5C842`), peluquerías caninas (ícono púrpura `#9B59B6`), carteles de mascota perdida (círculo rojo `#E63946`) y carteles generales (pin gris `#6B6B6B`).
2. THE API SHALL devolver un máximo de 50 markers por request al endpoint `GET /api/v1/comunidad/mapa`, priorizando los más cercanos al centro del bounding box.
3. WHEN hay múltiples markers de la misma zona, THE Mapa_Component SHALL agruparlos en un cluster con el número de elementos agrupados visible.
4. WHEN el usuario arrastra el mapa, THE Sistema SHALL esperar 800ms (debounce) antes de realizar una nueva llamada a `GET /api/v1/comunidad/mapa` con el nuevo bounding box.
5. THE Sistema SHALL mostrar únicamente la ubicación de amigos confirmados en el mapa, nunca la de usuarios no relacionados.
6. WHEN un usuario tiene `compartir_ubicacion: false`, THE Sistema SHALL omitir su marker del mapa de todos sus amigos.

---

### Requisito 3: Interacción con markers — Popups

**User Story:** Como usuario, quiero ver información detallada al tocar un marker en el mapa, para conocer los datos del servicio o cartel sin salir de la pantalla.

#### Criterios de Aceptación

1. WHEN el usuario toca un marker de servicio, THE Sistema SHALL mostrar un popup con: nombre del lugar, tipo de servicio, dirección, teléfono, descripción y un botón `"Ver en Google Maps"`.
2. WHEN el usuario toca el botón `"Ver en Google Maps"` en el popup de un servicio, THE Sistema SHALL abrir la URL `https://www.google.com/maps/search/?api=1&query=LAT,LNG` en el navegador externo o en la app de Google Maps si está instalada.
3. WHEN el usuario toca un marker de cartel, THE Sistema SHALL mostrar un popup con: tipo de cartel, nombre y raza de la mascota (si aplica), descripción (máximo 3 líneas con opción `"Ver más"`), teléfono de contacto, nombre del publicador y fecha de creación.
4. WHEN el cartel mostrado en el popup pertenece al usuario autenticado, THE Sistema SHALL mostrar el botón `"Eliminar Cartel"` con fondo rojo `#E63946`.
5. WHEN el cartel mostrado en el popup no pertenece al usuario autenticado, THE Sistema SHALL ocultar el botón `"Eliminar Cartel"`.
6. WHEN el usuario toca el botón de cierre `[✕]` del popup, THE Sistema SHALL cerrar el popup y volver al estado normal del mapa.

---

### Requisito 4: Botones flotantes sobre el mapa

**User Story:** Como usuario, quiero acceder rápidamente a las acciones principales del mapa desde botones flotantes, para no tener que abrir el panel inferior para cada acción frecuente.

#### Criterios de Aceptación

1. THE Mapa_Component SHALL mostrar tres botones flotantes en la esquina superior derecha del mapa: `"Mi Ubicación"` (fondo blanco), `"Agregar Amigo"` (fondo blanco) y `"Crear Cartel"` (fondo rojo `#E63946`).
2. WHEN el usuario toca el botón `"Mi Ubicación"`, THE Mapa_Component SHALL centrar el mapa en la posición actual del usuario con una animación suave.
3. WHEN el usuario toca el botón `"Agregar Amigo"`, THE Sistema SHALL abrir el modal de búsqueda de usuarios como overlay sobre el mapa.
4. WHEN el usuario toca el botón `"Crear Cartel"`, THE Sistema SHALL activar el Modo_Cartel y mostrar el banner de instrucción `"Hacé doble clic en el mapa donde querés crear el cartel"`.
5. THE Mapa_Component SHALL mostrar controles de zoom `[+]` y `[−]` en el lado derecho del mapa, debajo de los botones flotantes.
6. WHEN el usuario toca `[+]`, THE Mapa_Component SHALL incrementar el nivel de zoom en 1 unidad.
7. WHEN el usuario toca `[−]`, THE Mapa_Component SHALL decrementar el nivel de zoom en 1 unidad.

---

### Requisito 5: Flujo de creación de cartel

**User Story:** Como usuario, quiero poder crear un cartel comunitario geoposicionado en el mapa, para informar a otros usuarios sobre una mascota perdida, encontrada, en adopción o un aviso general.

#### Criterios de Aceptación

1. WHEN el Modo_Cartel está activo, THE Sistema SHALL mostrar un banner verde teal `#2DBD72` con el texto `"Hacé doble clic en el mapa donde querés crear el cartel"` en la parte superior del mapa.
2. WHEN el usuario realiza doble tap en el mapa mientras el Modo_Cartel está activo, THE Sistema SHALL colocar un marker temporal pulsante en esa posición y abrir el formulario de creación de cartel.
3. THE Sistema SHALL presentar el formulario de creación con los campos: tipo (dropdown requerido: `Mascota Perdida`, `Mascota Encontrada`, `En Adopción`, `Aviso General`), mascota (dropdown opcional con las mascotas del usuario), descripción (textarea opcional, máximo 300 caracteres), teléfono de contacto (requerido, validación de formato) y foto (file picker opcional, formatos JPG/PNG/GIF, máximo 5MB).
4. IF el usuario intenta enviar el formulario sin completar el teléfono de contacto, THEN THE Sistema SHALL mostrar el mensaje de validación `"El teléfono de contacto es requerido"` junto al campo correspondiente.
5. WHEN el usuario completa el formulario y toca `"Crear Cartel"`, THE Sistema SHALL enviar una solicitud `POST /api/v1/carteles` con los datos del formulario en formato `multipart/form-data`.
6. WHEN la API responde con código 201, THE Sistema SHALL cerrar el formulario, mostrar un Toast verde `"Cartel creado exitosamente"` durante 3 segundos y agregar el nuevo marker al mapa en la posición seleccionada.
7. WHEN el usuario toca `"Cancelar"` en el formulario, THE Sistema SHALL cerrar el formulario, eliminar el marker temporal y desactivar el Modo_Cartel.
8. IF la llamada `POST /api/v1/carteles` falla, THEN THE Sistema SHALL mostrar un mensaje de error y mantener el formulario abierto para que el usuario pueda reintentar.

---

### Requisito 6: Flujo de eliminación de cartel

**User Story:** Como usuario, quiero poder eliminar mis propios carteles del mapa, para mantener actualizada la información comunitaria cuando ya no sea relevante.

#### Criterios de Aceptación

1. WHEN el usuario toca `"Eliminar Cartel"` en el popup de un cartel propio, THE Sistema SHALL mostrar un diálogo de confirmación con el texto `"¿Eliminar este cartel? Esta acción no se puede deshacer."` y los botones `[Cancelar]` y `[Eliminar]`.
2. WHEN el usuario confirma la eliminación, THE Sistema SHALL enviar `DELETE /api/v1/carteles/:id` al backend.
3. WHEN la API responde con código 200, THE Sistema SHALL cerrar el popup, eliminar el marker del mapa y mostrar un Toast `"Cartel eliminado"`.
4. IF la API responde con código 403, THEN THE Sistema SHALL mostrar el mensaje `"No tenés permiso para eliminar este cartel"` y mantener el marker en el mapa.
5. THE API SHALL verificar que `cartel.usuario_id` coincide con el `id` del usuario autenticado antes de procesar la eliminación; IF no coincide, THEN THE API SHALL responder con código 403 y el mensaje `"No tenés permiso para eliminar este cartel"`.

---

### Requisito 7: Panel inferior deslizable (Bottom Sheet)

**User Story:** Como usuario, quiero un panel inferior deslizable con múltiples tabs, para acceder a las funcionalidades sociales sin abandonar la vista del mapa.

#### Criterios de Aceptación

1. THE Sistema SHALL mostrar un Bottom Sheet persistente con tres estados de altura: colapsado (~80px, solo handle y tabs visibles), medio (~45% de la pantalla, estado por defecto al entrar), y expandido (~90% de la pantalla).
2. WHEN el usuario arrastra el Bottom Sheet hacia arriba o hacia abajo, THE Sistema SHALL transicionar entre los estados de altura con animación fluida.
3. THE Bottom Sheet SHALL contener cuatro tabs: `Amigos`, `Servicios`, `Solicitudes` y `Buscar`, con scroll horizontal si el espacio es insuficiente.
4. WHEN el usuario toca un tab, THE Sistema SHALL mostrar el contenido correspondiente a ese tab dentro del Bottom Sheet.
5. THE Sistema SHALL resaltar el tab activo con fondo verde teal `#2DBD72` y texto blanco, y mostrar los tabs inactivos con texto gris `#6B6B6B` sin fondo.

---

### Requisito 8: Tab Amigos

**User Story:** Como usuario, quiero ver la lista de mis amigos con su ubicación aproximada y poder centrar el mapa en cualquiera de ellos, para encontrarlos fácilmente en el mapa.

#### Criterios de Aceptación

1. WHEN el usuario selecciona el tab `Amigos`, THE Sistema SHALL llamar a `GET /api/v1/amigos` y mostrar la lista de amigos con: avatar circular (40px), nombre, nombre de mascota y distancia aproximada en km.
2. THE Sistema SHALL indicar visualmente si cada amigo está online (borde verde en el avatar) u offline (borde gris).
3. WHEN el usuario toca el botón `"Ver en mapa"` de un amigo, THE Mapa_Component SHALL centrar el mapa en la ubicación de ese amigo y resaltar su marker.
4. WHEN el usuario toca el nombre o avatar de un amigo en la lista, THE Mapa_Component SHALL centrar el mapa en la ubicación de ese amigo.
5. IF el usuario no tiene amigos agregados, THEN THE Sistema SHALL mostrar el mensaje `"No tenés amigos agregados aún"` con un ícono de personas.
6. THE Sistema SHALL ofrecer un selector de filtro `"Solo para amigos ▼"` que permita alternar entre ver solo amigos o todos los usuarios en el mapa.

---

### Requisito 9: Tab Servicios

**User Story:** Como usuario, quiero ver la lista de servicios para mascotas del área visible del mapa, para encontrar veterinarias, paseadores y otros servicios cercanos.

#### Criterios de Aceptación

1. WHEN el usuario selecciona el tab `Servicios`, THE Sistema SHALL llamar a `GET /api/v1/comunidad/servicios` con el bounding box actual y mostrar la lista de servicios del área visible.
2. WHEN el usuario mueve el mapa, THE Sistema SHALL actualizar la lista de servicios del tab con un debounce de 800ms.
3. THE Sistema SHALL mostrar chips de filtro horizontales al tope de la lista: `Todos`, `Veterinaria`, `Paseador`, `Pet Shop`, `Peluquería`.
4. WHEN el usuario selecciona un chip de filtro, THE Sistema SHALL filtrar la lista de servicios mostrando únicamente los del tipo seleccionado.
5. WHEN el usuario toca un ítem de la lista de servicios, THE Mapa_Component SHALL centrar el mapa en ese servicio y abrir su popup.
6. THE Sistema SHALL mostrar en cada ítem de servicio: ícono del tipo (con color según tipo), nombre en bold, dirección en gris y distancia aproximada en verde teal.

---

### Requisito 10: Tab Solicitudes

**User Story:** Como usuario, quiero gestionar las solicitudes de amistad recibidas y acceder a mis chats activos, para mantener mi red social de dueños de mascotas actualizada.

#### Criterios de Aceptación

1. WHEN el usuario selecciona el tab `Solicitudes`, THE Sistema SHALL mostrar las solicitudes de amistad pendientes recibidas con: avatar, nombre del solicitante y botones `[Aceptar ✓]` (verde) y `[Rechazar ✕]` (rojo outline).
2. WHEN el usuario toca `[Aceptar ✓]` en una solicitud, THE Sistema SHALL enviar `PATCH /api/v1/amigos/solicitud/:id` con `{ "accion": "aceptar" }`, agregar al nuevo amigo en el mapa y mostrar un Toast de confirmación.
3. WHEN el usuario toca `[Rechazar ✕]` en una solicitud, THE Sistema SHALL enviar `PATCH /api/v1/amigos/solicitud/:id` con `{ "accion": "rechazar" }` y eliminar la solicitud de la lista.
4. THE Sistema SHALL mostrar la lista de chats activos debajo de las solicitudes, con: avatar, nombre del contacto, último mensaje truncado y timestamp.
5. WHEN el usuario toca un chat activo, THE Sistema SHALL navegar a la pantalla de chat correspondiente.
6. THE Sistema SHALL mostrar un badge con el número de mensajes no leídos sobre el avatar de cada chat con mensajes pendientes.

---

### Requisito 11: Tab Buscar

**User Story:** Como usuario, quiero buscar otros usuarios por nombre o nombre de mascota, para encontrar y agregar como amigos a personas que conozco o que tienen mascotas similares.

#### Criterios de Aceptación

1. WHEN el usuario selecciona el tab `Buscar`, THE Sistema SHALL mostrar un campo de búsqueda con placeholder `"🔍 Buscar usuarios..."` y fondo gris claro `#F5F5F5`.
2. WHEN el usuario escribe en el campo de búsqueda con al menos 2 caracteres, THE Sistema SHALL esperar 400ms (debounce) y luego llamar a `GET /api/v1/usuarios/buscar?q=<texto>`.
3. THE Sistema SHALL mostrar los resultados con: avatar, nombre del usuario, nombre de mascota y barrio.
4. WHEN el resultado corresponde a un usuario que no es amigo del usuario autenticado, THE Sistema SHALL mostrar el botón `[+ Agregar]` junto al resultado.
5. WHEN el resultado corresponde a un usuario que ya es amigo, THE Sistema SHALL mostrar el indicador `[✓ Amigos]` deshabilitado junto al resultado.
6. WHEN el usuario toca `[+ Agregar]`, THE Sistema SHALL enviar `POST /api/v1/amigos/solicitud` con el `usuario_destino_id` correspondiente y mostrar un Toast `"Solicitud enviada a [Nombre]"`.
7. IF el campo de búsqueda está vacío o tiene menos de 2 caracteres, THEN THE Sistema SHALL mostrar el mensaje `"Buscá amigos por nombre o mascota"` con ícono de lupa.
8. IF ya existe una solicitud pendiente o ya son amigos, THEN THE API SHALL responder con código 409 y THE Sistema SHALL mostrar el mensaje `"Ya existe una solicitud o ya son amigos"`.

---

### Requisito 12: Modal Agregar Amigo (desde botón flotante)

**User Story:** Como usuario, quiero poder buscar y agregar amigos directamente desde el mapa sin tener que abrir el panel inferior, para una experiencia más fluida mientras navego el mapa.

#### Criterios de Aceptación

1. WHEN el usuario toca el botón flotante `"Agregar Amigo"`, THE Sistema SHALL abrir un modal overlay sobre el mapa con el mismo buscador del Tab Buscar.
2. THE Sistema SHALL aplicar las mismas reglas de búsqueda, debounce y envío de solicitud que el Tab Buscar (Requisito 11).
3. WHEN el usuario toca fuera del modal o toca el botón de cierre, THE Sistema SHALL cerrar el modal y volver al estado normal del mapa.
4. WHEN se envía una solicitud desde el modal, THE Sistema SHALL mostrar el Toast `"Solicitud enviada a [Nombre]"` y mantener el modal abierto para permitir búsquedas adicionales.

---

### Requisito 13: Actualización de ubicación en tiempo real

**User Story:** Como usuario, quiero que mi ubicación se actualice periódicamente en el mapa de mis amigos, para que puedan verme en tiempo real mientras uso la app.

#### Criterios de Aceptación

1. WHILE la pantalla Comunidad está activa y el usuario tiene `compartir_ubicacion: true`, THE Sistema SHALL enviar `PUT /api/v1/ubicacion` con las coordenadas actuales cada 30 segundos.
2. THE Sistema SHALL refrescar los markers del mapa llamando a `GET /api/v1/comunidad/mapa` cada 30 segundos mientras la pantalla está activa (polling MVP).
3. IF el usuario tiene `compartir_ubicacion: false`, THEN THE Sistema SHALL omitir las llamadas periódicas a `PUT /api/v1/ubicacion`.
4. THE API SHALL actualizar el registro `UbicacionUsuario` de forma asíncrona para no bloquear el hilo principal del servidor.

---

### Requisito 14: Privacidad y permisos de ubicación

**User Story:** Como usuario, quiero tener control sobre quién puede ver mi ubicación, para proteger mi privacidad mientras uso las funcionalidades sociales de la app.

#### Criterios de Aceptación

1. THE Sistema SHALL mostrar la ubicación exacta de un usuario únicamente a sus amigos confirmados (estado `aceptada` en `Amistad`).
2. THE API SHALL excluir de la respuesta de `GET /api/v1/comunidad/mapa` las ubicaciones de usuarios que no sean amigos del usuario autenticado.
3. WHEN el usuario desactiva `compartir_ubicacion` desde Configuración, THE Sistema SHALL dejar de enviar actualizaciones de ubicación y THE API SHALL omitir su marker en el mapa de sus amigos.
4. THE Sistema SHALL almacenar la ubicación del usuario únicamente si `compartir_ubicacion: true`.

---

### Requisito 15: Accesibilidad y rendimiento

**User Story:** Como usuario con necesidades de accesibilidad, quiero que la pantalla Comunidad sea navegable con lectores de pantalla y que el mapa responda de forma fluida, para tener una experiencia inclusiva y sin interrupciones.

#### Criterios de Aceptación

1. THE Sistema SHALL asignar `accessibilityLabel` descriptivos a todos los markers del mapa, con el formato `"[Tipo]: [Nombre], [distancia] km"`.
2. THE Sistema SHALL asignar `accessibilityLabel` descriptivos a todos los botones flotantes del mapa.
3. THE Bottom Sheet SHALL ser navegable con lectores de pantalla (VoiceOver en iOS, TalkBack en Android).
4. IF una imagen de cartel no puede cargarse, THEN THE Sistema SHALL mostrar un placeholder gris con ícono de imagen en su lugar.
5. THE Sistema SHALL aplicar índices geoespaciales (`SPATIAL INDEX` en MySQL o índice GiST en PostgreSQL) en las tablas `carteles` y `ubicaciones_usuarios` para garantizar queries por bounding box con tiempo de respuesta menor a 500ms para conjuntos de hasta 10.000 registros.
