# Requirements Document — Pantalla Home de Zooni

## Introduction

La pantalla **Home** es la pantalla principal de la aplicación Zooni. Es el primer punto de contacto del usuario autenticado con la app. Su propósito es personalizar la experiencia mostrando la mascota activa del usuario (nombre e imagen generada con IA), proveer acceso rápido a las secciones principales mediante botones de navegación configurables, y ofrecer acceso al menú lateral, notificaciones y el botón de emergencia veterinaria S.O.S.

La pantalla se divide en cuatro zonas verticales: Header, Hero (mascota activa), Botones de Navegación y FABs de personalización. Incluye además el Menú Lateral (Drawer) y el Panel de Notificaciones como componentes superpuestos.

---

## Glossary

- **HomeScreen**: La pantalla principal de Zooni que se muestra al usuario autenticado al abrir la app.
- **HomeAPI**: El servicio backend que expone los endpoints `/api/v1/home` y `/api/v1/home/config`.
- **AuthService**: El servicio responsable de verificar y gestionar el JWT del usuario.
- **NotificationService**: El servicio que gestiona la obtención, lectura y envío de notificaciones.
- **HomeConfig**: La entidad que almacena la configuración personalizada de botones de la Home para cada usuario.
- **Mascota_Activa**: La mascota del usuario marcada con `activa: true` en la base de datos; es la que se muestra en la Home.
- **Drawer**: El menú lateral que se despliega desde la izquierda al tocar el ícono ☰.
- **PanelNotificaciones**: El panel modal que muestra las notificaciones del usuario al tocar el ícono 🔔.
- **FAB**: Floating Action Button; botón circular flotante en la esquina inferior derecha de la pantalla.
- **ModoEdicion**: Estado de la HomeScreen en el que los botones de navegación son reordenables y eliminables mediante drag & drop.
- **BottomSheet**: Panel modal que se desliza desde la parte inferior de la pantalla.
- **SkeletonLoader**: Componente de carga animado que ocupa el espacio de un elemento mientras sus datos se obtienen del backend.
- **SOS_Button**: El botón de emergencia veterinaria "S.O.S Veterinario", siempre visible y no eliminable.
- **JWT**: JSON Web Token; token de autenticación almacenado localmente en el dispositivo.
- **FCM**: Firebase Cloud Messaging; servicio de notificaciones push para Android.
- **APNs**: Apple Push Notification service; servicio de notificaciones push para iOS.
- **CDN**: Content Delivery Network; red de distribución de contenido usada para servir imágenes de mascotas.
- **StaleWhileRevalidate**: Estrategia de caché que muestra datos cacheados inmediatamente mientras actualiza en segundo plano.

---

## Requirements

---

### Requirement 1: Verificación de Autenticación al Iniciar

**User Story:** Como usuario de Zooni, quiero que la app verifique mi sesión al abrirla, para que solo pueda acceder a la Home si tengo un token válido.

#### Criterios de Aceptación

1. WHEN el usuario abre la aplicación, THE AuthService SHALL verificar la existencia y validez del JWT almacenado en el dispositivo.
2. WHEN el JWT es válido, THE HomeScreen SHALL iniciar la carga de datos del endpoint `GET /api/v1/home`.
3. WHEN el JWT está ausente o expirado, THE AuthService SHALL redirigir al usuario a la pantalla de Login sin mostrar la HomeScreen.
4. IF el endpoint `GET /api/v1/home` responde con código 401, THEN THE AuthService SHALL eliminar el JWT almacenado y redirigir al usuario a la pantalla de Login.

---

### Requirement 2: Carga de Datos de la Home

**User Story:** Como usuario de Zooni, quiero que la pantalla Home cargue mis datos y los de mi mascota activa en una sola operación, para tener una experiencia de inicio rápida.

#### Criterios de Aceptación

1. WHEN la HomeScreen se monta con un JWT válido, THE HomeAPI SHALL retornar en una sola respuesta los datos del usuario, la Mascota_Activa y el conteo de notificaciones no leídas.
2. WHILE los datos del endpoint `GET /api/v1/home` están siendo obtenidos, THE HomeScreen SHALL mostrar un SkeletonLoader en el área del nombre de la mascota y un SkeletonLoader circular en el área de la imagen de la mascota.
3. WHEN los datos del endpoint `GET /api/v1/home` se reciben exitosamente, THE HomeScreen SHALL reemplazar los SkeletonLoaders con el nombre y la imagen de la Mascota_Activa.
4. WHEN existen datos cacheados de una sesión anterior, THE HomeScreen SHALL mostrar los datos cacheados inmediatamente y actualizar en segundo plano siguiendo la estrategia StaleWhileRevalidate.
5. IF el dispositivo no tiene conexión a internet, THEN THE HomeScreen SHALL mostrar los datos cacheados disponibles y un banner de texto "Sin conexión" visible en la parte superior de la pantalla.
6. IF el endpoint `GET /api/v1/home` responde con código 500, THEN THE HomeScreen SHALL mostrar un mensaje de error indicando que no se pudieron cargar los datos.

---

### Requirement 3: Zona Hero — Visualización de la Mascota Activa

**User Story:** Como dueño de mascotas, quiero ver el nombre y la imagen de mi mascota activa en la pantalla principal, para sentir que la app está personalizada para mí y mi mascota.

#### Criterios de Aceptación

1. WHEN los datos de la Mascota_Activa se cargan exitosamente, THE HomeScreen SHALL mostrar el nombre de la Mascota_Activa con tipografía Nunito ExtraBold de entre 28 y 32 píxeles en color `#27AE60`, centrado horizontalmente en la zona Hero.
2. WHEN el nombre de la Mascota_Activa supera los 20 caracteres, THE HomeScreen SHALL truncar el nombre a 20 caracteres y agregar "..." al final.
3. WHEN el nombre de la Mascota_Activa se renderiza por primera vez, THE HomeScreen SHALL aplicar una animación fade-in de 300ms con easing ease-in-out.
4. WHEN la imagen de la Mascota_Activa se carga desde su URL, THE HomeScreen SHALL mostrarla con una altura de entre 180 y 200 píxeles, centrada horizontalmente, con una animación de escala de 0.9 a 1.0 en 400ms.
5. IF la URL de la imagen de la Mascota_Activa es nula o la imagen no puede cargarse, THEN THE HomeScreen SHALL mostrar un placeholder con la silueta genérica de un animal en color gris claro.
6. THE HomeScreen SHALL mostrar la imagen de fondo estática `assets/images/home_background.png` en la zona Hero ocupando el 100% del ancho sin distorsión, con estilo `cover`.
7. WHEN el campo `mascota_activa` del endpoint `GET /api/v1/home` es nulo, THE HomeScreen SHALL mostrar un estado vacío con una ilustración, el mensaje "Todavía no tenés mascotas" y un botón CTA "Agregar mascota" que navega a la pantalla MisMascotas.

---

### Requirement 4: Zona Header

**User Story:** Como usuario de Zooni, quiero tener acceso al menú lateral y a las notificaciones desde el header de la Home, para navegar rápidamente a cualquier sección de la app.

#### Criterios de Aceptación

1. THE HomeScreen SHALL mostrar un header transparente de 56 píxeles de altura con padding horizontal de 20 píxeles.
2. THE HomeScreen SHALL mostrar el ícono de menú hamburguesa (☰) en el extremo izquierdo del header con color `#2C2C2C` y tamaño 24 píxeles.
3. THE HomeScreen SHALL mostrar el ícono de campana (🔔) en el extremo derecho del header con color `#F5A623`.
4. WHEN el campo `notificaciones_no_leidas` del endpoint `GET /api/v1/home` es mayor a cero, THE HomeScreen SHALL mostrar un badge rojo circular sobre el ícono de campana con el número de notificaciones no leídas.
5. WHEN el valor de `notificaciones_no_leidas` supera 9, THE HomeScreen SHALL mostrar el texto "9+" en el badge en lugar del número exacto.
6. WHEN el usuario toca el ícono ☰, THE HomeScreen SHALL abrir el Drawer.
7. WHEN el usuario toca el ícono 🔔, THE HomeScreen SHALL abrir el PanelNotificaciones.

---

### Requirement 5: Zona de Botones de Navegación

**User Story:** Como usuario de Zooni, quiero acceder rápidamente a las secciones principales de la app desde la Home, para no tener que navegar por menús secundarios.

#### Criterios de Aceptación

1. THE HomeScreen SHALL mostrar los botones de navegación visibles según la HomeConfig del usuario, apilados verticalmente con separación de 12 píxeles entre cada uno y padding horizontal de 24 píxeles.
2. THE HomeScreen SHALL mostrar cada botón de navegación (excepto SOS_Button) con fondo amarillo `#F5C842`, border-radius de 30 píxeles, altura de 54 píxeles, texto bold de entre 16 y 18 píxeles en color `#2C2C2C`, y sombra `0px 4px 10px rgba(0, 0, 0, 0.15)`.
3. WHEN el usuario presiona un botón de navegación, THE HomeScreen SHALL aplicar un oscurecimiento del 10% en el fondo del botón y una escala de 0.97 como feedback visual.
4. WHEN el usuario toca el botón "Comunidad", THE HomeScreen SHALL navegar a la pantalla Comunidad.
5. WHEN el usuario toca el botón "Ficha Médica", THE HomeScreen SHALL navegar a la pantalla FichaMedica pasando el ID de la Mascota_Activa como parámetro.
6. WHEN el usuario toca el botón "Mis Mascotas", THE HomeScreen SHALL navegar a la pantalla MisMascotas.
7. THE HomeScreen SHALL mostrar el SOS_Button con fondo rojo `#E63946`, border-radius de 30 píxeles, altura de 54 píxeles, texto "S.O.S Veterinario" en bold de entre 16 y 18 píxeles en color `#FFFFFF`, ícono 🚨, y sombra `0px 4px 14px rgba(230, 57, 70, 0.45)`.
8. WHEN el usuario toca el SOS_Button, THE HomeScreen SHALL navegar al flujo de emergencia veterinaria y activar vibración háptica si el dispositivo lo soporta.
9. THE HomeScreen SHALL mantener el SOS_Button siempre visible en la parte inferior de la zona de botones, independientemente del scroll o del ModoEdicion.
10. WHEN la HomeScreen se carga por primera vez sin HomeConfig guardada, THE HomeAPI SHALL retornar la configuración por defecto con los botones Comunidad, Ficha Médica y Mis Mascotas visibles en ese orden.

---

### Requirement 6: FABs y Personalización de Botones

**User Story:** Como usuario de Zooni, quiero poder personalizar qué botones aparecen en mi Home y en qué orden, para adaptar la app a mis secciones más usadas.

#### Criterios de Aceptación

1. THE HomeScreen SHALL mostrar dos FABs circulares de 48 píxeles en la esquina inferior derecha, con fondo verde teal `#2DBD72`, ícono blanco y sombra `0px 4px 12px rgba(0,0,0,0.2)`, separados entre sí por 10 píxeles horizontales y con margen de 16 píxeles desde los bordes de la pantalla.
2. WHEN el usuario toca el FAB izquierdo (ícono 🔄), THE HomeScreen SHALL activar el ModoEdicion mostrando en cada botón de navegación un ícono de drag (⠿) en el extremo izquierdo y un ícono de eliminar (✖️) en el extremo derecho.
3. WHILE el ModoEdicion está activo, THE HomeScreen SHALL permitir al usuario reordenar los botones de navegación mediante drag & drop.
4. WHILE el ModoEdicion está activo, THE HomeScreen SHALL mostrar un botón "Guardar" con estilo pill amarillo al fondo de la zona de botones.
5. WHILE el ModoEdicion está activo, THE HomeScreen SHALL mantener el SOS_Button fijo en su posición sin mostrar íconos de drag ni de eliminar.
6. WHEN el usuario toca el ícono ✖️ de un botón en ModoEdicion, THE HomeScreen SHALL eliminar ese botón de la lista visible de botones de la Home.
7. WHEN el usuario toca el botón "Guardar" en ModoEdicion, THE HomeScreen SHALL enviar la nueva configuración al endpoint `PUT /api/v1/home/config` y salir del ModoEdicion.
8. IF el endpoint `PUT /api/v1/home/config` responde con un error, THEN THE HomeScreen SHALL mostrar un mensaje de error y mantener la configuración anterior sin cambios.
9. WHEN el usuario toca el FAB derecho (ícono ➕), THE HomeScreen SHALL abrir un BottomSheet con la lista de todas las secciones disponibles para agregar como botón.
10. THE HomeScreen SHALL mostrar en el BottomSheet las secciones: Comunidad, Match, Planificador de Servicios, Ficha Médica, Calendario, Eventos, ChatBot, Closet, Perfil y Configuración; cada una con su ícono y nombre.
11. WHEN una sección ya está presente como botón visible en la Home, THE HomeScreen SHALL mostrarla en el BottomSheet en estado deshabilitado con color gris y un tilde ✓.
12. WHEN el usuario toca una sección habilitada en el BottomSheet, THE HomeScreen SHALL agregar esa sección como nuevo botón al final de la lista de botones (antes del SOS_Button) y cerrar el BottomSheet.

---

### Requirement 7: Persistencia de la Configuración de Botones

**User Story:** Como usuario de Zooni, quiero que mi configuración personalizada de botones se guarde en el servidor, para que se mantenga entre sesiones y dispositivos.

#### Criterios de Aceptación

1. WHEN la HomeScreen se monta, THE HomeAPI SHALL retornar la HomeConfig del usuario mediante el endpoint `GET /api/v1/home/config`.
2. THE HomeAPI SHALL retornar en la HomeConfig únicamente los botones con `visible: true`, ordenados por el campo `orden` de forma ascendente.
3. THE HomeAPI SHALL excluir el SOS_Button de la entidad HomeConfig almacenada, ya que siempre está presente en la HomeScreen.
4. WHEN el usuario guarda una nueva configuración, THE HomeAPI SHALL actualizar la entidad HomeConfig del usuario con los nuevos valores de `seccion`, `orden` y `visible` para cada botón.
5. IF un usuario no tiene HomeConfig guardada, THEN THE HomeAPI SHALL retornar la configuración por defecto con Comunidad en orden 1, Ficha Médica en orden 2 y Mis Mascotas en orden 3, todos con `visible: true`.

---

### Requirement 8: Menú Lateral (Drawer)

**User Story:** Como usuario de Zooni, quiero acceder a todas las secciones de la app desde un menú lateral, para navegar sin perder el contexto de la pantalla actual.

#### Criterios de Aceptación

1. WHEN el usuario toca el ícono ☰, THE HomeScreen SHALL abrir el Drawer con una animación slide-in desde la izquierda de 250ms con easing ease-out.
2. THE HomeScreen SHALL mostrar el Drawer con fondo blanco `#FFFFFF`, ancho del 80% de la pantalla con un máximo de 320 píxeles, border-radius de 20 píxeles en las esquinas superior e inferior derechas, y sombra `4px 0px 20px rgba(0,0,0,0.15)`.
3. THE HomeScreen SHALL mostrar un overlay semi-transparente `rgba(0,0,0,0.4)` sobre el resto de la pantalla mientras el Drawer está abierto.
4. WHEN el usuario toca el overlay mientras el Drawer está abierto, THE HomeScreen SHALL cerrar el Drawer con una animación slide-out hacia la izquierda de 200ms con easing ease-in.
5. THE HomeScreen SHALL mostrar en el encabezado del Drawer el avatar circular del usuario de 48 píxeles con borde verde teal `#2DBD72` de 2 píxeles, el nombre del usuario en bold de 16 píxeles en color `#2C2C2C`, y el nombre y raza de la Mascota_Activa en regular de 13 píxeles en color `#6B6B6B`.
6. IF el usuario no tiene foto de perfil, THEN THE HomeScreen SHALL mostrar en el avatar del Drawer las iniciales del nombre del usuario sobre un fondo verde menta.
7. THE HomeScreen SHALL mostrar en el Drawer los ítems de navegación: Inicio, Comunidad, Match, Planificador de Servicios, Ficha médica, Calendario, Eventos, ChatBot, Closet, Perfil y Configuración; cada uno con su ícono de 22 píxeles, texto de 15 píxeles en color `#2C2C2C`, altura de 52 píxeles y padding horizontal de 20 píxeles.
8. WHEN el ítem del Drawer corresponde a la sección actualmente visible, THE HomeScreen SHALL resaltar ese ítem con fondo `rgba(45, 189, 114, 0.12)`, texto en bold y color `#2DBD72`.
9. WHEN el usuario toca un ítem del Drawer, THE HomeScreen SHALL cerrar el Drawer y navegar a la sección correspondiente.
10. THE HomeScreen SHALL mostrar el ítem "Cerrar sesión" separado del resto por un divider, con texto e ícono en color rojo `#E63946`.
11. WHEN el usuario toca "Cerrar sesión", THE HomeScreen SHALL mostrar un diálogo de confirmación con título "¿Cerrar sesión?", mensaje "¿Seguro que querés salir de tu cuenta?" y botones "Cancelar" y "Sí, salir".
12. WHEN el usuario confirma el cierre de sesión en el diálogo, THE AuthService SHALL eliminar el JWT del almacenamiento local, limpiar el caché de datos del usuario y redirigir a la pantalla de Login.

---

### Requirement 9: Panel de Notificaciones

**User Story:** Como usuario de Zooni, quiero ver y gestionar mis notificaciones desde la pantalla Home, para estar al tanto de la actividad relacionada con mis mascotas y mi comunidad.

#### Criterios de Aceptación

1. WHEN el usuario toca el ícono 🔔, THE HomeScreen SHALL abrir el PanelNotificaciones mostrando las notificaciones del usuario ordenadas de más reciente a más antigua.
2. THE NotificationService SHALL obtener las notificaciones mediante el endpoint `GET /api/v1/notificaciones` con soporte de paginación mediante los parámetros `page` y `limit`.
3. WHEN el PanelNotificaciones se abre, THE NotificationService SHALL llamar al endpoint `PATCH /api/v1/notificaciones/leer-todas` para marcar todas las notificaciones como leídas.
4. THE HomeScreen SHALL mostrar cada notificación con un avatar circular de 40 píxeles, el título en bold de 14 píxeles, el cuerpo en regular de 13 píxeles en color `#6B6B6B`, y el tiempo relativo a la derecha (ej: "hace 5 min", "ayer").
5. WHEN una notificación tiene el campo `leida` en `false`, THE HomeScreen SHALL mostrar un punto verde teal `#2DBD72` de 8 píxeles a la derecha del ítem y un fondo `rgba(45, 189, 114, 0.08)`.
6. WHEN el usuario toca una notificación, THE NotificationService SHALL llamar al endpoint `PATCH /api/v1/notificaciones/:id/leer` y THE HomeScreen SHALL navegar a la ruta indicada en el campo `redirige_a` de la notificación.
7. THE HomeScreen SHALL mostrar en el header del PanelNotificaciones el título "Notificaciones" centrado en bold y un botón "Marcar todas como leídas" en texto pequeño verde teal `#2DBD72` a la derecha.
8. WHEN el usuario toca "Marcar todas como leídas", THE NotificationService SHALL llamar al endpoint `PATCH /api/v1/notificaciones/leer-todas` y THE HomeScreen SHALL actualizar visualmente todos los ítems como leídos.
9. WHEN el usuario no tiene notificaciones, THE HomeScreen SHALL mostrar en el PanelNotificaciones un ícono de campana tachada y el texto "No tenés notificaciones por ahora".
10. THE NotificationService SHALL recibir notificaciones push mediante FCM en dispositivos Android y APNs en dispositivos iOS cuando la app está en segundo plano o cerrada.
11. WHEN el backend envía una notificación push, THE NotificationService SHALL actualizar el badge del ícono 🔔 en la HomeScreen con el nuevo conteo de notificaciones no leídas.

---

### Requirement 10: Accesibilidad

**User Story:** Como usuario de Zooni con necesidades de accesibilidad, quiero que todos los elementos interactivos de la Home tengan etiquetas descriptivas, para poder usar la app con tecnologías de asistencia.

#### Criterios de Aceptación

1. THE HomeScreen SHALL asignar un `accessibilityLabel` descriptivo a cada botón de navegación (ej: "Ir a Comunidad", "Ver Ficha Médica de [nombre mascota]", "Ver Mis Mascotas", "Emergencia veterinaria S.O.S").
2. THE HomeScreen SHALL asignar un `accessibilityLabel` con el nombre de la Mascota_Activa a la imagen de la mascota en la zona Hero.
3. THE HomeScreen SHALL garantizar que el contraste entre el texto `#2C2C2C` y el fondo de botones amarillo `#F5C842` cumpla con el ratio mínimo de 4.5:1 definido por WCAG AA.
4. THE HomeScreen SHALL garantizar que el contraste entre el texto blanco `#FFFFFF` y el fondo rojo `#E63946` del SOS_Button cumpla con el ratio mínimo de 4.5:1 definido por WCAG AA.
5. THE HomeScreen SHALL asignar un `accessibilityLabel` descriptivo al ícono ☰ (ej: "Abrir menú") y al ícono 🔔 (ej: "Notificaciones, [N] sin leer").

---

### Requirement 11: Responsividad y Performance Visual

**User Story:** Como usuario de Zooni en distintos dispositivos, quiero que la pantalla Home se vea correctamente en diferentes tamaños de pantalla y cargue rápidamente, para tener una experiencia fluida.

#### Criterios de Aceptación

1. THE HomeScreen SHALL estar diseñada con un ancho de referencia de 390 píxeles y usar unidades relativas para adaptarse a pantallas más grandes.
2. WHEN la pantalla tiene un ancho superior a 480 píxeles, THE HomeScreen SHALL centrar el contenido con un `maxWidth` de 480 píxeles.
3. THE HomeAPI SHALL responder al endpoint `GET /api/v1/home` mediante una única query con JOIN entre las tablas `users` y `mascotas`, sin generar consultas N+1.
4. THE HomeAPI SHALL servir las imágenes de mascotas desde una CDN con una política de caché mínima de 7 días.
5. WHEN los datos del endpoint `GET /api/v1/home` están disponibles en caché local, THE HomeScreen SHALL renderizar el contenido cacheado en menos de 1 segundo antes de recibir la respuesta del servidor.
