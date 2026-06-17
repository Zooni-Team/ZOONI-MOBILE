=== ZOONI — PANTALLA: CALENDARIO DE CUIDADOS ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Calendario de Cuidados" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde FichaMedicaScreen pasando el `petId` como parámetro de ruta. A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
DIFERENCIAS CLAVE RESPECTO A OTRAS PANTALLAS
──────────────────────────────────────
1. Los eventos del calendario incluyen FECHA + HORA (no solo fecha).
2. Los cards flotan directamente sobre el fondo verde (NO hay un contenedor blanco global).
3. El fondo tiene una ilustración de pasto/plantas en la parte inferior de la pantalla.
4. Se agrega con un FAB (Floating Action Button) circular, no con un botón en el header.
5. El FAB está centrado cuando no hay eventos y se mueve al bottom-right cuando hay eventos.
6. El TIPO de evento (categoría) se muestra con un COLOR que varía dinámicamente según
   la proximidad de la fecha al día de hoy (más cerca = más rojo, más lejos = más verde).
7. Los íconos de editar y eliminar son iconos planos sin fondo de botón (distinto a Vacunas).
8. No hay sección de "sugeridos": es un calendar puro de eventos del usuario.
9. El usuario puede AÑADIR y EDITAR eventos (a diferencia de Tratamientos que no tiene edición).

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto (Sequelize o Prisma, mantener consistencia)
- Autenticación: JWT. El token viaja en el header Authorization como Bearer token.
- Imágenes de mascotas: NO se usan en esta pantalla.

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:     #C8F0D8  (verde menta suave)
- Fondo cards de evento:              #FFFFFF
- Título de pantalla:                 #2C2C2C
- Texto principal del card:           #2C2C2C
- Texto secundario del card:          #6B6B6B
- Botón Guardar / FAB:                #2DBD72  (verde teal)
- Botón Cancelar:                     #E8E8E8
- Ícono editar (lápiz):               #F5A623  (naranja/ámbar)
- Ícono eliminar (papelera):          #8A8A8A  (gris neutro — NO rojo en esta pantalla)
- Overlay del modal:                  rgba(0, 0, 0, 0.50)
- Título del modal "Nuevo evento":    #2DBD72
- Borde inputs:                       #DDDDDD

SISTEMA DE COLOR POR PROXIMIDAD (el más importante de esta pantalla):
Calculado a partir de los días entre la fecha del evento y HOY.

| Días restantes       | Color              | Hex     | Uso                              |
|----------------------|--------------------|---------|----------------------------------|
| Evento pasado (< 0)  | Gris               | #AAAAAA | Evento ya ocurrió                |
| Hoy (0 días)         | Rojo               | #E63946 | ¡Urgente! Es hoy                 |
| 1 – 3 días           | Rojo               | #E63946 | Muy próximo                      |
| 4 – 7 días           | Naranja            | #F5A623 | Esta semana                      |
| 8 – 14 días          | Amarillo/ámbar     | #F5C842 | Próximas dos semanas             |
| 15 – 30 días         | Verde claro        | #7FCFA0 | Este mes                         |
| 31+ días             | Verde teal         | #2DBD72 | Lejos, sin urgencia              |

Este color se aplica en el card del evento en:
  1. El texto del TIPO de evento (ej: "Paseo", "Vacuna") — el campo de color en la segunda línea del card.
  2. Un borde izquierdo delgado (4px) del card del color correspondiente.
  3. Un mini-badge de días restantes (ver diseño del card más abajo).

Tipografía:
- Título pantalla "Calendario de Cuidados": ExtraBold / Bold, 22px, #2C2C2C, centrado
- Texto empty state:                        Regular, 15px, #6B6B6B, centrado
- Título del evento en card:                Bold, 16px, #2C2C2C
- Tipo del evento en card:                  Medium, 13px, COLOR DINÁMICO (sistema de proximidad)
- Fecha y hora en card:                     Regular, 13px, #6B6B6B
- Descripción en card:                      Regular, 13px, #6B6B6B
- Badge de días ("X días"):                 Bold, 11px, COLOR DINÁMICO (misma escala)
- Título modal:                             Bold, 18px, #2DBD72, centrado
- Texto inputs:                             Regular, 14px, #2C2C2C
- Texto botón Guardar:                      Bold, 15px, #FFFFFF
- Texto botón Cancelar:                     Bold, 15px, #2C2C2C

──────────────────────────────────────
FUNCIÓN getColorByProximidad(fechaHora)
──────────────────────────────────────

Esta función DEBE ser reutilizable y definirse en utils/colorProximidad.js:

const getColorByProximidad = (fechaHora) => {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)   return '#AAAAAA';  // pasado
  if (dias <= 3)  return '#E63946';  // hoy / muy próximo
  if (dias <= 7)  return '#F5A623';  // esta semana
  if (dias <= 14) return '#F5C842';  // próximas dos semanas
  if (dias <= 30) return '#7FCFA0';  // este mes
  return '#2DBD72';                   // más de un mes
};

const getTextoDias = (fechaHora) => {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)  return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return 'En ' + dias + ' días';
};

──────────────────────────────────────
TIPOS DE EVENTO (dropdown del modal)
──────────────────────────────────────

El dropdown del formulario tiene las siguientes opciones en orden:
  - "Vacuna"
  - "Turno Veterinario"
  - "Desparasitación"
  - "Peluquería"
  - "Paseo"
  - "Medicación"
  - "Control"
  - "Otro"

Default seleccionado: "Vacuna".

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

La pantalla NO usa un ScrollView con fondo blanco global como otras pantallas.
Su estructura es:

  ┌──────────────────────────────────────────┐
  │  [☰]                                     │  ← Header mínimo (sin campana)
  │                                          │
  │       Calendario de Cuidados             │  ← Título centrado
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  │ Veterinario              ✏️   🗑  │    │  ← Card evento (flota sobre verde)
  │  │ Paseo  [En 14 días]              │    │
  │  │ 31/03/2026 08:57                 │    │
  │  │ Veterinario para Titan           │    │
  │  └──────────────────────────────────┘    │
  │                                          │
  │  [card 2]                                │
  │  [card 3]                                │
  │                                          │
  │  ~~~~~ ilustración de pasto ~~~~~~~~~~~~ │  ← Grass SVG/asset al fondo
  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   │
  │                                   [+]   │  ← FAB bottom-right
  └──────────────────────────────────────────┘

Importante:
- El fondo COMPLETO de la pantalla es #C8F0D8 (verde menta).
- La ilustración de pasto es un asset estático (`assets/images/grass_background.png` o un SVG inline).
  Se posiciona en absolute, bottom: 0, width: '100%', height: ~200px, resizeMode: 'cover'.
  Debe quedar DETRÁS de los cards y del FAB.
- Los cards de eventos NO están dentro de ningún contenedor blanco: flotan directamente
  sobre el verde.
- El ScrollView tiene backgroundColor: '#C8F0D8' y paddingHorizontal: 16.

──────────────────────────────────────
SECCIÓN 1 — HEADER
──────────────────────────────────────

- backgroundColor: 'transparent'.
- Izquierda: ícono hamburguesa ☰, 26px, color #2C2C2C, TouchableOpacity con padding: 12px.
- Centro: vacío (el título va debajo del header, como componente separado).
- Derecha: vacío.
- Altura: ~56px. paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — TÍTULO DE LA PANTALLA
──────────────────────────────────────

- Texto: "Calendario de Cuidados"
- fontFamily: Bold (o ExtraBold), fontSize: 22px, color: '#2C2C2C', textAlign: 'center'.
- marginTop: 8px, marginBottom: 20px.
- paddingHorizontal: 20px.
- Es un componente de texto simple, no dentro de ningún card.

──────────────────────────────────────
ESTADO VACÍO
──────────────────────────────────────

Cuando no hay eventos en la lista:
- Texto: "No hay eventos programados."
  · fontFamily: Regular, fontSize: 15px, color: '#6B6B6B', textAlign: 'center'.
  · Posición: centrado vertical y horizontal en la pantalla, por encima de la ilustración de pasto.
  · marginBottom: 24px (separación antes del FAB centrado).
- El FAB aparece CENTRADO horizontalmente (no en bottom-right) cuando no hay eventos:
  · position: 'absolute', bottom: 220px (arriba de la hierba), alignSelf: 'center'.
  · O implementar con flexbox: centrado en el espacio visible encima del pasto.
  · Al tocar: abre el modal de añadir evento.

──────────────────────────────────────
DISEÑO DE LOS CARDS DE EVENTOS
──────────────────────────────────────

Cada card de evento es un View con:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 14
  · marginHorizontal: 0  (el paddingHorizontal del ScrollView ya da el margen)
  · marginBottom: 12
  · paddingHorizontal: 16, paddingVertical: 14
  · shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4
  · overflow: 'hidden'

BORDE IZQUIERDO DE PROXIMIDAD:
  · View absoluto: position: 'absolute', left: 0, top: 0, bottom: 0, width: 4.
  · backgroundColor: getColorByProximidad(evento.fecha_hora).
  · Crea el acento visual lateral que cambia de color según la cercanía del evento.

FILA 1 — Título del evento + íconos de acción:
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'.
  · paddingLeft: 8  (compensa visualmente el borde izquierdo de 4px).

  Columna izquierda (flex: 1, marginRight: 8):
    · Texto del título del evento: Bold, 16px, #2C2C2C. Puede ir en 2 líneas.

  Columna derecha (flexDirection: 'row', gap: 14, alignItems: 'center'):
    · Ícono EDITAR: Ionicons 'create-outline', 22px, color '#F5A623'.
      TouchableOpacity con hitSlop: {top:8, bottom:8, left:8, right:8}.
      Al tocar: abre el modal de edición con los datos pre-rellenados.
    · Ícono ELIMINAR: Ionicons 'trash-outline', 20px, color '#8A8A8A'.
      TouchableOpacity con hitSlop: {top:8, bottom:8, left:8, right:8}.
      Al tocar: Alert de confirmación.
    · Ambos íconos son PLANOS (sin fondo de botón ni borde). Solo el ícono.

FILA 2 — Tipo del evento + badge de días:
  · flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 8.

  Tipo del evento:
    · Texto: el tipo del evento (ej: "Paseo", "Vacuna", "Turno Veterinario").
    · fontFamily: Medium, fontSize: 13px.
    · color: getColorByProximidad(evento.fecha_hora).  ← dinámico
    · Este color cambia automáticamente al recalcular (no se guarda en BD, se calcula en render).

  Badge de días restantes:
    · View pill: backgroundColor con la misma color de proximidad al 15% de opacidad.
      (ej: si color es '#E63946', backgroundColor: 'rgba(230,57,70,0.12)').
    · borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8.
    · Texto: getTextoDias(evento.fecha_hora) (ej: "En 14 días", "¡Hoy!", "Mañana", "Pasado").
    · fontFamily: Bold, fontSize: 11px, color: getColorByProximidad(evento.fecha_hora).

FILA 3 — Fecha y hora:
  · Texto: formato "DD/MM/YYYY HH:MM" (ej: "31/03/2026 08:57").
  · fontFamily: Regular, fontSize: 13px, color: '#6B6B6B'.
  · marginTop: 4, paddingLeft: 8.

FILA 4 — Descripción (solo si existe):
  · Si evento.descripcion es null o vacío: no renderizar esta fila.
  · Texto: descripcion del evento.
  · fontFamily: Regular, fontSize: 13px, color: '#6B6B6B'.
  · marginTop: 2, paddingLeft: 8.
  · numberOfLines: 2, ellipsizeMode: 'tail'.

DIAGRAMA ASCII DEL CARD:
  ┌───────────────────────────────────────────────┐
  ┃ (borde izq 4px — color dinámico proximidad)  ┃
  ├───────────────────────────────────────────────┤
  │  Veterinario                      ✏️  🗑       │  ← fila 1
  │  Paseo   [En 14 días]                         │  ← fila 2 (color dinámico)
  │  31/03/2026 08:57                             │  ← fila 3
  │  Veterinario para Titan                       │  ← fila 4 (si existe desc.)
  └───────────────────────────────────────────────┘

ORDEN DE LOS CARDS:
- Los eventos se muestran ordenados por fecha_hora ASCENDENTE (el más próximo primero).
- Los eventos pasados se muestran al final de la lista (o pueden ocultarse — ver edge cases).
- Los eventos de hoy van primero, con el badge "¡Hoy!" en rojo.

ANIMACIONES:
- Entrada de cada card: translateY 14px → 0 + opacity 0 → 1, stagger 70ms entre cards, 280ms ease-out.
- Eliminación: el card colapsa (height → 0 + opacity → 0) en 220ms ease-in antes de quitarse del estado.

──────────────────────────────────────
FAB (Floating Action Button)
──────────────────────────────────────

El FAB es un botón circular verde teal con ícono blanco "+".

ESTILOS:
  · width: 56, height: 56, borderRadius: 28.
  · backgroundColor: '#2DBD72'.
  · alignItems: 'center', justifyContent: 'center'.
  · shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.20, shadowRadius: 8, elevation: 6.
  · Ícono: Ionicons 'add', 28px, color '#FFFFFF'.
  · Al presionar (pressIn): escala 0.92 en 120ms, vuelve a 1.0 en 150ms ease-out.

POSICIÓN SEGÚN ESTADO:
  · Estado vacío (sin eventos):
    - position: 'absolute', bottom: 220px (por encima de la ilustración de pasto), left: 0, right: 0.
    - alignSelf: 'center' (centrado horizontalmente).
    - Animación de entrada: fade-in + scale 0.5 → 1 en 400ms ease-out (llamativo al primer uso).

  · Estado con eventos:
    - position: 'absolute', bottom: 32px, right: 20px.
    - Animación: el FAB se mueve de la posición central a la esquina inferior derecha con
      una animación de traslación (Animated.timing, 300ms ease-in-out) al agregar el primer evento.

  NOTA DE IMPLEMENTACIÓN: usar un estado `tieneEventos: boolean` para determinar la posición.
  Al agregar el primer evento, animar el FAB de la posición central a bottom-right.

──────────────────────────────────────
MODAL — AÑADIR EVENTO (FAB "➕")
──────────────────────────────────────

Al tocar el FAB, se abre el modal de nuevo evento.

OVERLAY:
  · Modal de React Native (transparent: true, animationType: 'none').
  · backgroundColor: 'rgba(0, 0, 0, 0.50)' cubriendo toda la pantalla.
  · Al tocar el overlay fuera del card: cerrar el modal.
  · Animación de entrada del overlay: opacity 0 → 0.50 en 200ms ease-out.

CARD DEL MODAL:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 20
  · width: '90%'
  · paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20
  · Centrado en pantalla (justifyContent: 'center', alignItems: 'center' en el wrapper).
  · shadowColor: '#000', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10.
  · Animación de entrada: escala 0.92 → 1.0 + opacity 0 → 1 en 220ms ease-out.
  · Animación de salida: escala 1.0 → 0.92 + opacity 1 → 0 en 160ms ease-in.

TÍTULO DEL MODAL:
  · Texto: "Nuevo evento"
  · Bold, 18px, #2DBD72, textAlign: 'center', marginBottom: 20px.

CAMPO 1 — TÍTULO DEL EVENTO (requerido):
  · TextInput.
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · fontSize: 14px, color: '#2C2C2C'.
  · placeholder: "Título del evento", placeholderTextColor: '#AAAAAA'.
  · marginBottom: 12.
  · Al focus: borderColor → '#2DBD72' en 150ms.
  · Validación: requerido. Error inline: borde rojo + texto "Este campo es requerido" 11px rojo.

CAMPO 2 — DESCRIPCIÓN OPCIONAL:
  · TextInput multilinea.
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · fontSize: 14px, color: '#2C2C2C'.
  · placeholder: "Descripción opcional", placeholderTextColor: '#AAAAAA'.
  · multiline: true, numberOfLines: 3, height: 80.
  · textAlignVertical: 'top'.
  · marginBottom: 12.
  · Al focus: borde verde.

CAMPO 3 — FECHA Y HORA (requerido):
  IMPORTANTE: Este campo captura tanto FECHA como HORA del evento.
  Implementar con @react-native-community/datetimepicker en dos pasos:
    - Paso 1: al tocar el campo, abrir el DateTimePicker en modo 'date' (selección de fecha).
    - Paso 2: al confirmar la fecha, abrir inmediatamente el DateTimePicker en modo 'time' (selección de hora).
    - El valor final combinado se muestra como "DD/MM/YYYY HH:MM" en el campo.
  
  Contenedor del campo:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
  · paddingHorizontal: 14, paddingVertical: 12.
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'.
  · marginBottom: 12.
  
  Contenido:
  · Si no hay fecha seleccionada: texto "dd/mm/aaaa --:--" en #AAAAAA, 14px.
  · Si hay fecha: texto "DD/MM/YYYY HH:MM" en #2C2C2C, 14px.
  · Ícono: Ionicons 'calendar-outline', 18px, #6B6B6B, a la derecha.
  
  Al tocar: abre el DateTimePicker nativo (no hay restricción de fecha futura ni pasada).
  Error: si null al guardar → texto "Seleccioná fecha y hora" en rojo.

CAMPO 4 — TIPO DE EVENTO (Dropdown/Picker):
  · Picker nativo (@react-native-picker/picker) o custom dropdown (View + Modal interno).
  · Opciones: "Vacuna", "Turno Veterinario", "Desparasitación", "Peluquería", "Paseo",
    "Medicación", "Control", "Otro".
  · Default: "Vacuna".
  · Estilo contenedor:
    - borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10.
    - paddingHorizontal: 14, paddingVertical: 12.
    - flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'.
    - marginBottom: 20.
  · Texto del valor: 14px, #2C2C2C.
  · Flecha ▼: Ionicons 'chevron-down', 16px, #6B6B6B.

BOTÓN GUARDAR:
  · width: '100%', height: 48, borderRadius: 30.
  · backgroundColor: '#2DBD72'.
  · Texto "Guardar", Bold, 15px, #FFFFFF.
  · shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4.
  · Al presionar: escala 0.97 en 100ms, vuelve en 150ms.
  · Mientras se procesa: ActivityIndicator blanco.

BOTÓN CANCELAR:
  · width: '100%', height: 44, borderRadius: 30.
  · backgroundColor: '#E8E8E8'.
  · Texto "Cancelar", Bold, 15px, #2C2C2C.
  · marginTop: 10.
  · Al presionar: cerrar modal sin guardar.

──────────────────────────────────────
MODAL — EDITAR EVENTO (ícono lápiz naranja)
──────────────────────────────────────

Al tocar el ícono ✏️ naranja en un card, se abre el MISMO modal pero:
- El título cambia a: "Editar evento" (mismo estilo: Bold, 18px, #2DBD72).
- Todos los campos vienen PRE-RELLENADOS con los datos del evento y son EDITABLES.
- El botón de acción dice "Guardar cambios" (mismo estilo visual).
- Al guardar: llamar PUT /api/mascotas/:petId/eventos/:eventoId.
- Al éxito: actualizar el card en el estado local, cerrar modal, Toast verde "Evento actualizado".

──────────────────────────────────────
TOAST / SNACKBAR DE CONFIRMACIÓN
──────────────────────────────────────

Al guardar un evento (añadir o editar):
  · Posición: top: 56px, centrado horizontalmente.
  · backgroundColor: '#2DBD72', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12.
  · Contenido: ícono ✅ (Ionicons 'checkmark-circle', 18px, blanco) + texto:
    - Al añadir: "Evento registrado correctamente"
    - Al editar: "Evento actualizado correctamente"
    Bold, 14px, #FFFFFF.
  · Aparece: opacity 0 → 1 + translateY -12 → 0 en 220ms ease-out.
  · Duración: 2.5 segundos.
  · Desaparece: opacity 1 → 0 + translateY 0 → -12 en 200ms ease-in.

Al eliminar un evento:
  · Mismo toast con backgroundColor: '#E63946' y texto "Evento eliminado".

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla: mostrar 2 skeleton loaders con forma de card.
  · backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, height: 90px, marginBottom: 12.
  · Shimmer animation de izquierda a derecha.

- Spinner del botón Guardar: ActivityIndicator blanco.

- Al eliminar (optimistic UI):
  · El card colapsa (height → 0 + opacity → 0) en 220ms ANTES de confirmar el request.
  · Si el DELETE falla: restaurar el card con animación inversa + Alert de error.

──────────────────────────────────────
LÓGICA FRONTEND (CalendarioScreen.jsx)
──────────────────────────────────────

Archivo: screens/CalendarioScreen.jsx

Props de navegación: route.params.petId

Estado local (useState):
- eventos:              array de objetos evento (ordenados por fecha_hora ASC)
- loading:              boolean
- modalVisible:         boolean
- modalModo:            'añadir' | 'editar'
- eventoEnEdicion:      null | objeto evento completo
- formTitulo:           string
- formDescripcion:      string
- formFechaHora:        Date | null       ← fecha Y hora combinadas
- formTipo:             string (default 'Vacuna')
- formErrors:           { titulo: string|null, fechaHora: string|null }
- guardando:            boolean
- showDatePicker:       boolean
- datePickerModo:       'date' | 'time'   ← flujo en dos pasos
- fechaTemporal:        Date | null       ← guarda la fecha seleccionada antes de elegir hora

useEffect al montar:
  · Obtener JWT del AsyncStorage.
  · Llamar GET /api/mascotas/:petId/eventos.
  · Guardar en eventos.
  · Manejar errores con Alert.

Computed: tieneEventos = eventos.length > 0.

Función abrirModalAñadir():
  · Limpiar formulario (campos vacíos, formErrors limpio).
  · modalModo = 'añadir', eventoEnEdicion = null.
  · modalVisible = true.

Función abrirModalEditar(evento):
  · formTitulo = evento.titulo.
  · formDescripcion = evento.descripcion ?? ''.
  · formFechaHora = new Date(evento.fecha_hora).
  · formTipo = evento.tipo.
  · formErrors = { titulo: null, fechaHora: null }.
  · eventoEnEdicion = evento.
  · modalModo = 'editar'.
  · modalVisible = true.

Función onFechaSeleccionada(date):
  · Si datePickerModo === 'date':
    - fechaTemporal = date (solo la fecha).
    - showDatePicker = false.
    - Después de 300ms: showDatePicker = true, datePickerModo = 'time'.
  · Si datePickerModo === 'time':
    - Combinar fechaTemporal (fecha) con date (hora) → formFechaHora.
    - showDatePicker = false, datePickerModo = 'date' (reset para la próxima vez).

Función guardarEvento():
  · Validar: formTitulo no vacío, formFechaHora no null.
  · Si errores: setFormErrors y retornar.
  · guardando = true.
  · body = { titulo: formTitulo, descripcion: formDescripcion || null,
             fecha_hora: formFechaHora.toISOString(), tipo: formTipo }.
  · Si 'añadir': POST /api/mascotas/:petId/eventos → agregar al array y re-ordenar por fecha.
  · Si 'editar': PUT /api/mascotas/:petId/eventos/:eventoEnEdicion.id → actualizar en array.
  · Al éxito: cerrar modal, Toast.
  · guardando = false (en finally).

Función eliminarEvento(eventoId):
  · Alert de confirmación.
  · Al confirmar: colapsar card (animación), filtrar del array, DELETE en background.
  · Si falla: restaurar + Alert.

──────────────────────────────────────
BACKEND — MODELO DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: eventos_calendario

CREATE TABLE eventos_calendario (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  titulo      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  fecha_hora  TIMESTAMP NOT NULL,             -- fecha Y hora exacta del evento
  tipo        VARCHAR(80) NOT NULL DEFAULT 'Otro',
              -- valores válidos: 'Vacuna', 'Turno Veterinario', 'Desparasitación',
              --   'Peluquería', 'Paseo', 'Medicación', 'Control', 'Otro'
  creado_en   TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Índices:
CREATE INDEX idx_eventos_mascota ON eventos_calendario(mascota_id);
CREATE INDEX idx_eventos_fecha ON eventos_calendario(fecha_hora);
CREATE INDEX idx_eventos_mascota_fecha ON eventos_calendario(mascota_id, fecha_hora);

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/mascotas/:petId/eventos
Todos los endpoints requieren el middleware verifyToken.

──────────────────────
1. GET /api/mascotas/:petId/eventos
──────────────────────
Devuelve todos los eventos del calendario de esa mascota.

Lógica:
a) Verificar que la mascota pertenece al usuario autenticado.
b) SELECT * FROM eventos_calendario
   WHERE mascota_id = $1
   ORDER BY fecha_hora ASC;

Response (200):
{
  "eventos": [
    {
      "id": 1,
      "mascota_id": 1,
      "titulo": "Veterinario",
      "descripcion": "Veterinario para Titan",
      "fecha_hora": "2026-03-31T08:57:00.000Z",
      "tipo": "Paseo",
      "creado_en": "2026-03-19T10:00:00Z"
    }
  ]
}

──────────────────────
2. POST /api/mascotas/:petId/eventos
──────────────────────
Crea un nuevo evento.

Body:
{
  "titulo": "Turno vacuna antirrábica",
  "descripcion": "Llevar el carnet de vacunas",
  "fecha_hora": "2026-07-15T10:30:00.000Z",
  "tipo": "Vacuna"
}

Lógica:
a) Verificar que la mascota pertenece al usuario autenticado.
b) Validar: titulo no vacío, fecha_hora fecha válida, tipo en lista de valores permitidos.
c) INSERT en eventos_calendario.

Response (201):
{
  "mensaje": "Evento registrado correctamente",
  "evento": {
    "id": 2,
    "titulo": "Turno vacuna antirrábica",
    "descripcion": "Llevar el carnet de vacunas",
    "fecha_hora": "2026-07-15T10:30:00.000Z",
    "tipo": "Vacuna",
    "creado_en": "2026-06-17T14:00:00Z"
  }
}

Errores:
- 400: { "error": "El título del evento es requerido" }
- 400: { "error": "La fecha y hora son requeridas" }
- 400: { "error": "Tipo de evento no válido" }
- 403: { "error": "No tenés permiso para modificar esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────
3. PUT /api/mascotas/:petId/eventos/:eventoId
──────────────────────
Edita un evento existente.

Body:
{
  "titulo": "Turno vacuna antirrábica (reprogramado)",
  "descripcion": "Nueva fecha acordada con el vet",
  "fecha_hora": "2026-07-22T11:00:00.000Z",
  "tipo": "Vacuna"
}

Lógica:
a) Verificar que el evento pertenece a una mascota del usuario autenticado.
b) Validar campos igual que POST.
c) UPDATE eventos_calendario SET titulo=$1, descripcion=$2, fecha_hora=$3, tipo=$4,
   actualizado_en=NOW() WHERE id=$5 AND mascota_id=$6 RETURNING *.

Response (200):
{
  "mensaje": "Evento actualizado correctamente",
  "evento": { "id": 2, "titulo": "...", "fecha_hora": "...", "tipo": "...", ... }
}

Errores:
- 403: { "error": "No tenés permiso para modificar este evento" }
- 404: { "error": "Evento no encontrado" }

──────────────────────
4. DELETE /api/mascotas/:petId/eventos/:eventoId
──────────────────────
Elimina un evento.

Lógica:
a) Verificar que el evento pertenece a una mascota del usuario autenticado.
b) DELETE FROM eventos_calendario WHERE id = $1 AND mascota_id = $2.

Response (200): { "mensaje": "Evento eliminado correctamente" }
Response (403): { "error": "No tenés permiso para eliminar este evento" }
Response (404): { "error": "Evento no encontrado" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/CalendarioScreen.jsx        ← pantalla principal (este prompt)
- utils/colorProximidad.js            ← funciones getColorByProximidad y getTextoDias
- (reutilizar) utils/api.js           ← ya existe
- assets/images/grass_background.png  ← ilustración de pasto (ya debe existir o crearla como SVG)

Backend:
- routes/eventos.js
- controllers/eventosController.js
- migrations/005_create_eventos.sql   ← CREATE TABLE eventos_calendario + índices

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                   | Comportamiento                                                          |
|---------------------------------------------|-------------------------------------------------------------------------|
| Sin eventos                                 | Texto "No hay eventos programados." centrado + FAB centrado             |
| Evento pasado                               | Badge "Pasado" en #AAAAAA, borde gris, tipo en gris                     |
| Evento es hoy                               | Badge "¡Hoy!" en rojo pulsante (leve animación de opacity 0.7→1→0.7)   |
| Evento es mañana                            | Badge "Mañana" en rojo #E63946                                          |
| Título del evento muy largo                 | numberOfLines: 2, ellipsizeMode: 'tail'                                 |
| Descripción muy larga                       | numberOfLines: 2, ellipsizeMode: 'tail'                                 |
| Guardar sin título                          | Borde rojo + error "Este campo es requerido"                            |
| Guardar sin fecha/hora                      | Error "Seleccioná fecha y hora"                                         |
| Tipo no válido enviado al backend           | Error 400 del servidor                                                  |
| Red caída al guardar                        | Alert "Sin conexión. Intentá de nuevo más tarde."                       |
| Error 403                                   | Alert + redirigir a FichaMédica                                         |
| Muchos eventos                              | ScrollView maneja el scroll; la ilustración de pasto sigue al fondo     |
| Evento del mismo día que otro               | Se ordenan por hora (más temprano primero)                              |
| Re-cálculo del color en tiempo real         | Usar useEffect con intervalo de 1 hora para recalcular si la pantalla   |
|                                             | queda abierta mucho tiempo (edge case raro pero prolijo)                |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- Separar siempre lógica de UI de lógica de negocio.
- Todos los textos en español (Argentina): coma decimal para peso, fechas en DD/MM/YYYY HH:MM.
- Las fechas se guardan en UTC en la base de datos (TIMESTAMP) y se convierten al timezone
  local en el frontend al mostrar (usar toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })).
- NO olvidar el flujo en dos pasos del DateTimePicker (primero fecha, luego hora).
- La función getColorByProximidad debe recalcularse en cada render del card (no cachear).
- La ilustración de pasto debe quedar en position: 'absolute', bottom: 0, sin scroll
  (debe ser parte del contenedor externo, no del ScrollView).
- Animaciones con Animated API de React Native. Ease-out entradas, ease-in salidas, máx 300ms.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente el fondo #C8F0D8 y la identidad visual de Zooni.
