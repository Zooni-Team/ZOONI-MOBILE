=== ZOONI — PANTALLA: VACUNAS ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Vacunas" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde FichaMedicaScreen pasando el `petId` como parámetro de ruta. A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto (Sequelize o Prisma, mantener consistencia)
- Autenticación: JWT. El token viaja en el header Authorization como Bearer token en cada request.
- Imágenes de mascotas: assets locales resueltos con el objeto PET_IMAGES ya definido en el proyecto (mismo patrón que FichaMedicaScreen).

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:    #C8F0D8  (verde menta suave)
- Fondo cards/contenedores:          #FFFFFF
- Botón acción principal (Añadir, Guardar, Marcar): #2DBD72 (verde teal)
- Botón cancelar / secundario:       #E8E8E8  (gris claro, texto #2C2C2C)
- Texto principal:                   #2C2C2C
- Texto secundario / labels:         #6B6B6B
- Acento aplicada / check:           #2DBD72  (verde teal)
- Tag "Aún no corresponde":          #6B6B6B  (gris medio)
- Badge "✓ Aplicada":                #2DBD72  (verde teal)
- Botón editar (ícono lápiz):        #5BC8D0  (azul teal claro, distinto del verde para diferenciarlo del eliminar y del principal)
- Botón eliminar (ícono papelera):   #E63946  (rojo vibrante)
- Overlay modal:                     rgba(0, 0, 0, 0.50)
- Título del modal:                  #2DBD72  (verde teal)
- Borde de inputs:                   #DDDDDD

Tipografía (fuente: Nunito o Poppins, importada con @expo-google-fonts):
- Título pantalla "Vacunas de [Nombre]": ExtraBold / Bold, 24px, #2C2C2C
- Info mascota (edad, peso, raza):       Regular, 13px, #6B6B6B
- Encabezado sección "Vacunas":          Bold, 18px, #2C2C2C
- Nombre vacuna en card:                 Bold, 14px, #2C2C2C (multilinea permitida)
- Texto estado (Aún no corresponde):     Regular, 12px, #6B6B6B
- Texto frecuencia (Cada 1 año(s)):      Regular, 12px, #6B6B6B
- Texto botón "Marcar" / "Añadir":       Bold, 13–14px, #FFFFFF
- Encabezado "Calendario sugerido":      Bold, 16px, #2C2C2C
- Título modal "Nuevo evento":           Bold, 18px, #2DBD72, centrado
- Labels inputs del modal:              Regular, 13px, #6B6B6B (como placeholder)
- Texto botón "Guardar":                Bold, 15px, #FFFFFF
- Texto botón "Cancelar":               Bold, 15px, #2C2C2C
- Campos secundarios card (Aplicada, Próxima dosis, Veterinaria): Regular, 12px, #6B6B6B

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

La pantalla es un ScrollView vertical con backgroundColor: '#C8F0D8'.
NO tiene bottom tab bar (es una subpantalla de Ficha Médica).
Se divide en tres zonas verticales:

  ┌───────────────────────────────────────┐
  │  [☰]                                  │  ← Header mínimo
  │                                       │
  │         [ilustración mascota]         │
  │       Vacunas de Titán                │  ← Hero / cabecera
  │   Edad: 4 años y 4 meses             │
  │   Peso: 20,40 kg                     │
  │   Raza: Labrador Retriever           │
  │                                       │
  ├───────────────────────────────────────┤
  │                                       │
  │  Vacunas              [➕ Añadir]      │  ← Sección Vacunas aplicadas
  │  No hay vacunas registradas ✏️         │
  │                                       │
  │  📅 Calendario sugerido              │  ← Sección Calendario sugerido
  │                                       │
  │  ┌────────────────────────────────┐   │
  │  │ Moquillo Canino   Aún no corr. │   │
  │  │ (Distemper)       Cada 1 año(s)│   │
  │  │                   [  Marcar  ] │   │
  │  └────────────────────────────────┘   │
  │  ┌────────────────────────────────┐   │
  │  │ Parvovirus Canino Aún no corr. │   │
  │  │                   Cada 1 año(s)│   │
  │  │                   [  Marcar  ] │   │
  │  └────────────────────────────────┘   │
  │            ... más vacunas ...        │
  └───────────────────────────────────────┘

──────────────────────────────────────
SECCIÓN 1 — HEADER MÍNIMO
──────────────────────────────────────

- backgroundColor: 'transparent' (se ve el fondo verde menta de la pantalla).
- Izquierda: ícono hamburguesa ☰ con TouchableOpacity que abre el drawer de navegación.
  · Tamaño del ícono: 26px, color #2C2C2C.
  · Hitbox generosa: padding: 12px alrededor del ícono.
- Centro: vacío.
- Derecha: vacío (esta subpantalla no tiene campana de notificaciones).
- Altura total del header: ~56px.
- paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — HERO CON MASCOTA (parte verde)
──────────────────────────────────────

Esta zona tiene backgroundColor: '#C8F0D8' y es visible por encima del card blanco.
paddingTop: 12px, paddingBottom: 0.

ILUSTRACIÓN DE LA MASCOTA:
- Centrada horizontalmente.
- Usa el asset local resuelto desde PET_IMAGES[mascota.imagenAsset] con fallback a PET_IMAGES['perro_default'].
- Tamaño display: width: 110, height: 110, resizeMode: 'contain'.
- Detrás de la imagen: un View circular decorativo de 130x130, borderRadius: 65, 
  backgroundColor: '#A8E6C0', opacity: 0.45, position: 'absolute', centrado.
- La imagen de la mascota se posiciona sobre ese círculo decorativo.
- Animación de entrada: al montar la pantalla la imagen entra con un efecto de escala 
  0.88 → 1.0 + opacity 0 → 1, duración 350ms, easing ease-out 
  (cubic-bezier(0.23, 1, 0.32, 1)). Usar Animated.spring o Animated.timing de React Native.

TÍTULO "Vacunas de [Nombre]":
- Texto dinámico: "Vacunas de " + mascota.nombre (ej: "Vacunas de Titán").
- fontFamily: 'Nunito_700Bold' (o Poppins_700Bold).
- fontSize: 24, color: '#2C2C2C', textAlign: 'center'.
- marginTop: 10px (debajo de la imagen).

SUBTÍTULO CON INFO DE MASCOTA:
- Tres líneas de texto centradas, una debajo de la otra, gap de 2px entre ellas.
- "Edad: X años y Y meses" — Regular 13px, #6B6B6B. La edad se calcula con calcularEdad(mascota.fecha_nacimiento) reutilizando la función de FichaMedicaScreen.
- "Peso: 20,40 kg" — Regular 13px, #6B6B6B. El peso formateado con coma decimal (toLocaleString('es-AR') + ' kg').
- "Raza: Labrador Retriever" — Regular 13px, #6B6B6B. El campo mascota.raza.
- marginTop: 6px sobre el bloque de subtítulos, marginBottom: 22px.

──────────────────────────────────────
SECCIÓN 3 — CARD BLANCO (parte inferior scrolleable)
──────────────────────────────────────

Inmediatamente debajo del hero arranca un View con:
  backgroundColor: '#FFFFFF'
  borderTopLeftRadius: 28
  borderTopRightRadius: 28
  paddingHorizontal: 20
  paddingTop: 22
  paddingBottom: 40
  minHeight: suficiente para llenar el resto de la pantalla

Este View contiene todo el resto del contenido: la sección de vacunas aplicadas y el calendario sugerido.

─────────────────────────────────────────────────────
SUB-SECCIÓN A — VACUNAS APLICADAS (dentro del card blanco)
─────────────────────────────────────────────────────

ROW DE ENCABEZADO:
- Es un View con flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'.
- Izquierda: texto "Vacunas", fontFamily Bold, fontSize: 18px, color: #2C2C2C.
- Derecha: botón pill "➕ Añadir".
  · backgroundColor: '#2DBD72'
  · borderRadius: 20
  · paddingVertical: 8, paddingHorizontal: 16
  · El contenido interno es un row con ícono "+" (texto "+" o Ionicons 'add', blanco, 16px) + texto "Añadir" (Bold, 14px, #FFFFFF).
  · shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3.
  · Al presionar: escala 0.96 en 100ms (estado active/pressIn) y vuelve a 1.0 en 150ms (pressOut). Implementar con Animated o con Pressable y transform.
  · Al tocar: abre el MODAL DE AÑADIR VACUNA (ver sección modal más abajo).
- marginBottom: 14px.

ESTADO VACÍO (sin vacunas aplicadas):
- Si la lista de vacunas aplicadas está vacía, mostrar:
  · Texto: "No hay vacunas registradas ✏️"
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B.
  · textAlign: 'center'.
  · marginTop: 4px, marginBottom: 18px.

LISTA DE VACUNAS APLICADAS (cuando hay registros):
- Si la lista tiene vacunas, mostrar cards uno debajo del otro con marginBottom: 10px.
- Cada card de vacuna aplicada tiene dos columnas: izquierda (datos) y derecha (botones de acción).

ESTRUCTURA DEL CARD:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 14
  · borderWidth: 1, borderColor: '#EFEFEF'
  · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
  · paddingHorizontal: 14, paddingVertical: 12
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  · marginBottom: 10

COLUMNA IZQUIERDA (flex: 1, paddingRight: 10):
  Stack vertical de 4 líneas de texto (gap: 3px entre cada una):

  Línea 1 — Nombre de la vacuna:
    · fontFamily: Bold, fontSize: 14px, color: '#2C2C2C'.
    · Puede ocupar dos líneas si el nombre es largo (ej: "adenovirus tipo 2 (tos de las perreras)").
    · numberOfLines no fijado (se permite wrap natural).
    · marginBottom: 4px (separación visual antes de los campos secundarios).

  Línea 2 — Fecha de aplicación:
    · Texto: "Aplicada: DD/MM/YYYY" (formato argentino, ej: "Aplicada: 16/3/2026").
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.

  Línea 3 — Próxima dosis:
    · Texto: "Próxima dosis: DD/MM/YYYY" si existe proximo_refuerzo, 
      o "Próxima dosis: —" si es null.
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.
    · Si hay fecha próxima y está dentro de los próximos 30 días: color '#F5A623' (naranja alerta).
    · Si la fecha ya pasó (vencida): color '#E63946' (rojo urgencia).

  Línea 4 — Veterinaria:
    · Texto: "Veterinaria: " + nombre de la veterinaria, o "Veterinaria: Sin registro" si es null.
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.

COLUMNA DERECHA (flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center'):
  Dos botones apilados verticalmente (uno sobre el otro):

  BOTÓN EDITAR (arriba):
    · TouchableOpacity con Pressable para feedback táctil.
    · backgroundColor: '#5BC8D0'  (azul teal claro).
    · width: 36, height: 36, borderRadius: 10.
    · alignItems: 'center', justifyContent: 'center'.
    · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2.
    · Ícono: Ionicons 'create-outline' (lápiz/editar), tamaño 18px, color '#FFFFFF'.
    · Al presionar (pressIn): escala 0.90 en 100ms, vuelve a 1.0 en 150ms (ease-out).
    · Al tocar: abre el MODAL DE EDITAR VACUNA con los datos de esta vacuna pre-rellenados.

  BOTÓN ELIMINAR (abajo):
    · TouchableOpacity con Pressable para feedback táctil.
    · backgroundColor: '#E63946'  (rojo vibrante).
    · width: 36, height: 36, borderRadius: 10.
    · alignItems: 'center', justifyContent: 'center'.
    · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2.
    · Ícono: Ionicons 'trash-outline' (papelera), tamaño 18px, color '#FFFFFF'.
    · Al presionar (pressIn): escala 0.90 en 100ms, vuelve a 1.0 en 150ms (ease-out).
    · Al tocar: muestra Alert de confirmación (ver función eliminarVacuna).

DIAGRAMA ASCII DEL CARD:
  ┌─────────────────────────────────────────────────┐
  │  adenovirus tipo 2 (tos          [✏️ azul teal] │
  │  de las perreras)                               │
  │  Aplicada: 16/3/2026             [🗑 rojo      ] │
  │  Próxima dosis: —                               │
  │  Veterinaria: Sin registro                      │
  └─────────────────────────────────────────────────┘

- Animación de entrada de la lista: cada card entra con translateY de 12px → 0 + opacity 0 → 1, 
  con stagger de 60ms entre cards (el primer card tarda 0ms, el segundo 60ms, el tercero 120ms, etc.).
  Duración por item: 280ms, ease-out.
- Animación de eliminación: cuando se elimina un card, colapsar su height de su valor actual → 0 
  + opacity → 0 en 250ms ease-in antes de quitarlo del estado. Esto evita el "salto" brusco de la lista.

─────────────────────────────────────────────────────
SUB-SECCIÓN B — CALENDARIO SUGERIDO (dentro del card blanco)
─────────────────────────────────────────────────────

ENCABEZADO DE SECCIÓN:
- marginTop: 24px (separación visual de la sección anterior).
- Texto: "📅 Calendario sugerido"
  · fontFamily: Bold, fontSize: 16px, color: #2C2C2C.
  · El emoji 📅 actúa como ícono decorativo a la izquierda del texto.
- marginBottom: 12px.

LISTA DE VACUNAS SUGERIDAS:
- Las vacunas sugeridas se cargan desde el backend según la ESPECIE de la mascota (perro, gato, etc.). No están hardcodeadas en el frontend.
- Cada card de vacuna sugerida es un View con:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 12
  · borderWidth: 1, borderColor: '#EFEFEF'
  · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  · paddingHorizontal: 14, paddingVertical: 12
  · marginBottom: 10
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'

  COLUMNA IZQUIERDA (flex: 1, paddingRight: 8):
    · Nombre de la vacuna: fontFamily Bold, fontSize: 14px, color: #2C2C2C.
      Si el nombre es largo se permite salto de línea (flexWrap: 'wrap', numberOfLines no fijado).
      Ejemplos: "Moquillo Canino (Distemper)", "Parvovirus Canino", 
      "Hepatitis Infecciosa Canina (Adenovirus tipo 1)", etc.
  
  COLUMNA DERECHA (alignItems: 'flex-end', justifyContent: 'center', gap: 4):
    · Texto de estado: 
      - Si NO fue aplicada aún: "Aún no corresponde" — Regular, 12px, #6B6B6B, textAlign: 'right'.
      - Si fue aplicada recientemente y no toca refuerzo: "Al día ✓" — Regular 12px, #2DBD72.
      - Si hay refuerzo próximo en menos de 30 días: "Refuerzo próximo" — Regular 12px, #F5A623.
      - Si está vencida (pasó la fecha de refuerzo): "Vencida" — Regular 12px, #E63946.
    · Texto de frecuencia: "Cada X año(s)" o "Cada X mes(es)" — Regular, 12px, #6B6B6B, textAlign: 'right'.
      Este dato viene del campo `frecuencia_descripcion` del backend.
    · Botón o badge de estado:
      - Si la vacuna NO fue aplicada (applied: false): botón pill "Marcar".
        backgroundColor: '#2DBD72', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12.
        Texto "Marcar", Bold, 13px, color '#FFFFFF'.
        shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2.
        Al presionar: escala 0.95 en 100ms y vuelve en 150ms.
        Al tocar: abre el MODAL MARCAR VACUNA (ver sección modal más abajo).
      - Si la vacuna YA fue aplicada (applied: true): badge "✓ Aplicada".
        backgroundColor: '#E8F8F0' (verde muy claro), borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10.
        Texto "✓ Aplicada", Bold, 12px, color '#2DBD72'.
        NO es tappable. Transición visual de "Marcar" → "✓ Aplicada" animada: 
        opacity del botón viejo cae a 0 (150ms), el badge nuevo sube de opacity 0 a 1 (150ms).

  SEPARADOR:
    Usar marginBottom: 10px entre cards. No hay línea divisora explícita (el borde sutil del card es suficiente).

- Animación de entrada: igual que la lista de vacunas aplicadas (stagger 60ms, translateY 12→0 + opacity).

──────────────────────────────────────
MODAL — AÑADIR VACUNA (botón "➕ Añadir")
──────────────────────────────────────

Cuando el usuario toca "➕ Añadir", se muestra un modal centrado en pantalla sobre un overlay oscuro.

OVERLAY:
- Un View de posición absolute que cubre toda la pantalla (top:0, left:0, right:0, bottom:0).
- backgroundColor: 'rgba(0, 0, 0, 0.50)'.
- Implementado con el componente Modal de React Native (transparent: true, animationType: 'none').
- Animación de entrada del overlay: opacity 0 → 0.5 en 200ms, ease-out.
- Al tocar fuera del card modal (sobre el overlay): cerrar el modal.

CARD DEL MODAL:
- Posicionado en el centro exacto de la pantalla (justifyContent: 'center', alignItems: 'center' en el wrapper).
- backgroundColor: '#FFFFFF'
- borderRadius: 20
- width: '88%' del ancho de pantalla (máx 360px)
- paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20
- shadowColor: '#000', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10
- Animación de entrada del card: escala 0.92 → 1.0 + opacity 0 → 1 en 220ms, 
  easing ease-out (cubic-bezier(0.23, 1, 0.32, 1)).
- Animación de salida: escala 1.0 → 0.92 + opacity 1 → 0 en 160ms, ease-in.

TÍTULO DEL MODAL:
- Texto: "Nuevo evento"
- fontFamily: Bold, fontSize: 18px, color: '#2DBD72', textAlign: 'center'.
- marginBottom: 20px.

CAMPO 1 — TÍTULO DEL EVENTO (requerido):
- Label implícito como placeholder: "Título del evento".
- TextInput con:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 14px, color: '#2C2C2C'
  · placeholder: "Título del evento", placeholderTextColor: '#AAAAAA'
  · backgroundColor: '#FFFFFF'
  · marginBottom: 12
- Al hacer foco: borderColor cambia de '#DDDDDD' a '#2DBD72' en una transición suave de 150ms.
- Validación: no puede estar vacío al guardar.

CAMPO 2 — DESCRIPCIÓN OPCIONAL:
- TextInput multilinea con:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 14px, color: '#2C2C2C'
  · placeholder: "Descripción opcional", placeholderTextColor: '#AAAAAA'
  · backgroundColor: '#FFFFFF'
  · multiline: true, numberOfLines: 3, height: 80
  · textAlignVertical: 'top'
  · marginBottom: 12
- Al hacer foco: mismo efecto de borde verde.

CAMPO 3 — FECHA:
- TextInput o DateTimePicker (usar @react-native-community/datetimepicker).
  · Si es TextInput: placeholder "dd/mm/aaaa", con ícono de calendario a la derecha (Ionicons 'calendar-outline', 18px, #6B6B6B).
  · Mejor opción: View que al tocar abre el DateTimePicker nativo.
  · El valor seleccionado se muestra como texto "DD/MM/YYYY" dentro del mismo View.
  · Estilo contenedor: borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10, 
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 12.
  · Si no hay fecha seleccionada: texto placeholder "dd/mm/aaaa" en #AAAAAA, 14px.
  · Si hay fecha seleccionada: texto "DD/MM/YYYY" en #2C2C2C, 14px.
- Al tocar: abre el DateTimePicker nativo de la plataforma. Fecha máxima: hoy (no puede registrar vacunas en el futuro por este campo; el calendario sugerido maneja el "cuándo corresponde").

CAMPO 4 — TIPO / CATEGORÍA (Dropdown):
- Un selector de categoría implementado como un picker nativo (@react-native-picker/picker) 
  o como un custom dropdown (View + Modal interno).
  · Opciones: "Vacuna", "Desparasitación", "Tratamiento", "Otro".
  · Default seleccionado: "Vacuna".
  · Estilo contenedor: borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10, 
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 20.
  · Texto del valor seleccionado: 14px, #2C2C2C.
  · Flecha ▼ a la derecha: Ionicons 'chevron-down', 16px, #6B6B6B.
- Este campo determina qué tabla/endpoint usa el backend al guardar (en este contexto solo "Vacuna" guarda en tabla `vacunas_aplicadas`; los otros tipos son para uso futuro o del Calendario de Cuidados).

BOTÓN GUARDAR:
- width: '100%', height: 48, borderRadius: 30.
- backgroundColor: '#2DBD72'.
- Texto "Guardar", Bold, 15px, color: '#FFFFFF', textAlign: 'center'.
- shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4.
- Al presionar: escala 0.97 en 100ms, vuelve en 150ms.
- Mientras se procesa: muestra ActivityIndicator blanco en lugar del texto.
- Al éxito: cierra el modal, agrega la nueva vacuna a la lista con animación (fade + slide desde arriba), y muestra un Toast/Snackbar (ver sección Toast).

BOTÓN CANCELAR:
- width: '100%', height: 44, borderRadius: 30.
- backgroundColor: '#E8E8E8'.
- Texto "Cancelar", Bold, 15px, color: '#2C2C2C', textAlign: 'center'.
- marginTop: 10px.
- Al presionar: cierra el modal sin guardar nada. Animación de salida del modal (escala + opacity).
- Sin sombra.

──────────────────────────────────────
MODAL — MARCAR VACUNA SUGERIDA (botón "Marcar")
──────────────────────────────────────

Cuando el usuario toca "Marcar" en una vacuna del Calendario Sugerido, se abre el MISMO modal que "Añadir" con las siguientes diferencias:

- El CAMPO 1 (Título) viene PRE-RELLENADO con el nombre de la vacuna sugerida (ej: "Moquillo Canino (Distemper)") y es NON-EDITABLE (backgroundColor: '#F5F5F5', color: '#2C2C2C', editable: false).
- El CAMPO 4 (Tipo) viene PRE-SELECCIONADO en "Vacuna" y es NON-EDITABLE (mismo estilo gris desactivado).
- El título del modal sigue siendo "Nuevo evento" (igual al de Añadir).
- El campo DESCRIPCIÓN y el campo FECHA siguen siendo editables libremente.
- Al guardar, el backend vincula la vacuna aplicada con el `vacuna_sugerida_id` correspondiente, lo que actualiza el estado de ese ítem en el Calendario Sugerido a "✓ Aplicada".
- La lógica de guardado y animaciones es idéntica al modal de Añadir.

──────────────────────────────────────
MODAL — EDITAR VACUNA (botón lápiz azul del card)
──────────────────────────────────────

Cuando el usuario toca el botón azul teal (✏️) en un card de vacuna aplicada, se abre un modal 
idéntico en estructura al de Añadir pero con los datos de esa vacuna pre-rellenados y editables.

DIFERENCIAS respecto al modal Añadir:
- El título del modal cambia a: "Editar vacuna" (mismo estilo: Bold, 18px, #2DBD72, centrado).
- El CAMPO 1 (Nombre) viene pre-rellenado con vacuna.nombre y es EDITABLE (a diferencia del modo Marcar).
- El CAMPO 2 (Descripción) viene pre-rellenado con vacuna.descripcion (puede ser vacío).
- El CAMPO 3 (Fecha) viene pre-seleccionado con vacuna.fecha_aplicacion.
- El CAMPO 4 (Tipo) viene pre-seleccionado con vacuna.tipo y es EDITABLE.
- CAMPO 5 — VETERINARIA (nuevo campo exclusivo del modal editar y añadir):
  · TextInput con:
    - borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
    - paddingHorizontal: 14, paddingVertical: 12
    - fontSize: 14px, color: '#2C2C2C'
    - placeholder: "Veterinaria (opcional)", placeholderTextColor: '#AAAAAA'
    - backgroundColor: '#FFFFFF'
    - marginBottom: 20
  · Si vacuna.veterinaria es null: campo vacío.
  · Si existe: pre-rellenado con el nombre de la veterinaria.
  · Al hacer foco: borde cambia a '#2DBD72' en 150ms.
  · Este campo también debe estar presente en el modal AÑADIR (posición antes del botón Guardar).
  · Si el usuario deja vacío: se guarda como null en el backend.

- El botón de acción principal dice "Guardar cambios" (mismo estilo visual que "Guardar").
- Al guardar: llamar al endpoint PUT /api/mascotas/:petId/vacunas/:vacunaId (ver backend).
- Al éxito:
  · Cerrar el modal con animación de salida (igual que los otros modales).
  · Actualizar el card en el estado vacunasAplicadas con los nuevos datos (sin refetch).
  · Mostrar Toast verde: "Vacuna actualizada correctamente".
- Al error: Alert.alert('Error', 'No se pudo actualizar la vacuna').

NOTA IMPORTANTE: el modal de AÑADIR también debe incluir el CAMPO 5 (Veterinaria) en la misma 
posición (antes del botón Guardar), ya que es coherente ofrecer registrar la veterinaria al agregar.

──────────────────────────────────────
TOAST / SNACKBAR DE CONFIRMACIÓN
──────────────────────────────────────

Al guardar una vacuna exitosamente (desde cualquiera de los modales), mostrar un toast en la parte superior de la pantalla:

- Posición: top: 56px (debajo del header), centrado horizontalmente.
- backgroundColor: '#2DBD72', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12.
- Sombra: shadowColor '#000', shadowOffset {width:0, height:4}, shadowOpacity: 0.15, shadowRadius: 8.
- Contenido: ícono ✅ (Ionicons 'checkmark-circle', 18px, blanco) + texto según acción:
  · Al añadir:  "Vacuna registrada correctamente"
  · Al editar:  "Vacuna actualizada correctamente"
  Texto en Bold, 14px, #FFFFFF.
- Aparece con opacity 0 → 1 + translateY -12 → 0 en 220ms (ease-out).
- Se mantiene 2.5 segundos.
- Desaparece con opacity 1 → 0 + translateY 0 → -12 en 200ms (ease-in).

Al eliminar una vacuna exitosamente:
- Mismo toast pero con backgroundColor: '#E63946' y texto "Vacuna eliminada".

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla y hacer el fetch inicial:
  · Mostrar en lugar de los cards un skeleton loader: 3 rectángulos grises (#E8E8E8) animados 
    con una ola de brillo (shimmer animation) de izquierda a derecha, 
    borderRadius: 12, height: 70px, marginBottom: 10px.
  · El shimmer es un gradiente lineal animado usando react-native-linear-gradient o Reanimated.
  · Los skeletons se ubican donde estarían las vacunas sugeridas.
  
- Spinner del botón Guardar del modal: ActivityIndicator color '#FFFFFF', size 'small', centrado.

- Al marcar una vacuna del calendario (tap "Marcar"):
  · El botón "Marcar" muestra un ActivityIndicator chico blanco durante 400-800ms (el tiempo del request al backend).
  · Al completarse, el botón se transforma al badge "✓ Aplicada" con la animación descripta.

──────────────────────────────────────
LÓGICA FRONTEND (VacunasScreen.jsx)
──────────────────────────────────────

Archivo: screens/VacunasScreen.jsx

Props de navegación: route.params.petId

Estado local (useState):
- mascota:               null | objeto mascota
- vacunasAplicadas:      array de vacunas aplicadas de la mascota
- vacunasSugeridas:      array de vacunas sugeridas para la especie
- loading:               boolean (carga inicial)
- modalVisible:          boolean (cualquier modal abierto)
- modalModo:             'añadir' | 'marcar' | 'editar'   ← NUEVO modo editar
- vacunaEnEdicion:       null | objeto vacuna_aplicada completo (cuando modo es 'editar')
- vacunaPreseleccionada: null | objeto vacuna_sugerida (cuando modo es 'marcar')
- formTitulo:            string
- formDescripcion:       string
- formFecha:             Date | null
- formTipo:              string (default 'Vacuna')
- formVeterinaria:       string   ← NUEVO campo veterinaria
- formErrors:            objeto { titulo: string|null, fecha: string|null }  ← errores inline
- guardando:             boolean (loader del botón guardar)
- marcandoId:            string | null (id de la vacuna sugerida que está siendo procesada)

useEffect al montar:
- Obtener el JWT del AsyncStorage (clave 'userToken').
- Llamar al endpoint GET /api/mascotas/:petId/vacunas (ver backend).
- Guardar resultados en mascota, vacunasAplicadas, vacunasSugeridas.
- Manejar errores con Alert.alert('Error', 'No se pudieron cargar las vacunas').

Función abrirModalAñadir():
- Limpiar el formulario completo (todos los campos en blanco, formErrors limpio).
- modalModo = 'añadir'.
- vacunaEnEdicion = null, vacunaPreseleccionada = null.
- modalVisible = true.

Función abrirModalMarcar(vacunaSugerida):
- formTitulo = vacunaSugerida.nombre.
- formDescripcion = '', formFecha = null, formTipo = 'Vacuna', formVeterinaria = ''.
- formErrors = { titulo: null, fecha: null }.
- vacunaPreseleccionada = vacunaSugerida.
- vacunaEnEdicion = null.
- modalModo = 'marcar'.
- modalVisible = true.

Función abrirModalEditar(vacuna):  ← NUEVA
- formTitulo = vacuna.nombre.
- formDescripcion = vacuna.descripcion ?? ''.
- formFecha = new Date(vacuna.fecha_aplicacion).
- formTipo = vacuna.tipo ?? 'Vacuna'.
- formVeterinaria = vacuna.veterinaria ?? ''.
- formErrors = { titulo: null, fecha: null }.
- vacunaEnEdicion = vacuna.  (guarda el objeto completo para tener el id)
- vacunaPreseleccionada = null.
- modalModo = 'editar'.
- modalVisible = true.

Función cerrarModal():
- modalVisible = false (con animación de salida del card).
- Limpiar formErrors después de que termine la animación (setTimeout 200ms).

Función guardarVacuna():
- Validar: formTitulo no vacío (→ formErrors.titulo = "Este campo es requerido"), 
           formFecha no null (→ formErrors.fecha = "Seleccioná una fecha").
- Si hay errores: setFormErrors(...) y no continuar.
- guardando = true.
- Según modalModo:

  Si 'añadir':
    · body = { nombre: formTitulo, descripcion: formDescripcion || null, 
               fecha_aplicacion: formatDate(formFecha), tipo: formTipo,
               veterinaria: formVeterinaria || null }.
    · Llamar POST /api/mascotas/:petId/vacunas.
    · Al éxito: agregar la nueva vacuna al inicio de vacunasAplicadas (unshift), cerrar modal, Toast "Vacuna registrada correctamente".

  Si 'marcar':
    · body = { vacuna_sugerida_id: vacunaPreseleccionada.id, nombre: formTitulo,
               descripcion: formDescripcion || null, fecha_aplicacion: formatDate(formFecha),
               veterinaria: formVeterinaria || null }.
    · Llamar POST /api/mascotas/:petId/vacunas.
    · Al éxito: agregar al inicio de vacunasAplicadas, marcar la vacunaSugerida como applied:true 
      en el estado vacunasSugeridas, cerrar modal, Toast.

  Si 'editar':
    · body = { nombre: formTitulo, descripcion: formDescripcion || null,
               fecha_aplicacion: formatDate(formFecha), tipo: formTipo,
               veterinaria: formVeterinaria || null }.
    · Llamar PUT /api/mascotas/:petId/vacunas/:vacunaEnEdicion.id.
    · Al éxito: reemplazar el objeto en vacunasAplicadas (map sobre el array, reemplazar por id),
      cerrar modal, Toast "Vacuna actualizada correctamente".

- Al error (cualquier modo): Alert.alert('Error', mensaje).
- guardando = false (en finally).

Función eliminarVacuna(vacunaId):
- Alert.alert(
    '¿Eliminar vacuna?',
    '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', onPress: () => confirmarEliminar(vacunaId), style: 'destructive' }
    ]
  ).

Función confirmarEliminar(vacunaId):
- Animar el card que se elimina: opacity 1 → 0 + height → 0 en 250ms ease-in.
- Al terminar la animación: filtrar vacunasAplicadas quitando el id.
- Llamar DELETE /api/mascotas/:petId/vacunas/:vacunaId en segundo plano.
- Mostrar Toast rojo "Vacuna eliminada".
- Al error del DELETE: restaurar el card en la lista (revertir el estado) y Alert.

──────────────────────────────────────
BACKEND — MODELOS DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: vacunas_tipo_sugeridas
(Catálogo de vacunas recomendadas por especie. No hardcodeadas en el frontend.)

CREATE TABLE vacunas_tipo_sugeridas (
  id                    SERIAL PRIMARY KEY,
  especie               VARCHAR(50) NOT NULL,  -- 'perro', 'gato', 'conejo', etc.
  nombre                VARCHAR(150) NOT NULL,
  descripcion           TEXT,
  frecuencia_meses      INTEGER NOT NULL,       -- cada cuántos meses se repite (ej: 12 = anual)
  frecuencia_descripcion VARCHAR(80) NOT NULL,  -- ej: "Cada 1 año(s)", "Cada 6 meses"
  edad_minima_meses     INTEGER DEFAULT 0,      -- a partir de qué edad corresponde
  orden                 INTEGER DEFAULT 0,      -- para ordenar la lista
  activa                BOOLEAN DEFAULT TRUE,
  creado_en             TIMESTAMP DEFAULT NOW()
);

-- Datos de ejemplo para perros (insertar en seed/migration):
INSERT INTO vacunas_tipo_sugeridas (especie, nombre, frecuencia_meses, frecuencia_descripcion, edad_minima_meses, orden) VALUES
  ('perro', 'Moquillo Canino (Distemper)',                  12, 'Cada 1 año(s)',  0, 1),
  ('perro', 'Parvovirus Canino',                            12, 'Cada 1 año(s)',  0, 2),
  ('perro', 'Hepatitis Infecciosa Canina (Adenovirus tipo 1)', 12, 'Cada 1 año(s)', 0, 3),
  ('perro', 'Adenovirus tipo 2 (Tos de las Perreras)',      12, 'Cada 1 año(s)',  0, 4),
  ('perro', 'Parainfluenza Canina',                         12, 'Cada 1 año(s)',  0, 5),
  ('perro', 'Leptospirosis',                                12, 'Cada 1 año(s)',  0, 6),
  ('perro', 'Rabia',                                        12, 'Cada 1 año(s)',  3, 7),
  ('perro', 'Bordetella (Tos de las Perreras)',              6, 'Cada 6 meses',  0, 8);

-- Para gatos agregar: Panleucopenia, Herpesvirus felino, Calicivirus, Rabia, Leucemia felina, etc.

TABLA: vacunas_aplicadas
(Registro de cada vacuna que un usuario registra para su mascota.)

CREATE TABLE vacunas_aplicadas (
  id                 SERIAL PRIMARY KEY,
  mascota_id         INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  vacuna_sugerida_id INTEGER REFERENCES vacunas_tipo_sugeridas(id) ON DELETE SET NULL,
                     -- puede ser NULL si la vacuna fue agregada libremente (no del calendario)
  nombre             VARCHAR(150) NOT NULL,
  descripcion        TEXT,
  fecha_aplicacion   DATE NOT NULL,
  proximo_refuerzo   DATE,                        -- calculado en el backend al guardar
  tipo               VARCHAR(50) DEFAULT 'vacuna', -- 'vacuna', 'desparasitacion', 'tratamiento', 'otro'
  veterinaria        VARCHAR(150),                 -- NUEVO: nombre de la veterinaria donde se aplicó
  creado_en          TIMESTAMP DEFAULT NOW(),
  actualizado_en     TIMESTAMP DEFAULT NOW()
);

-- Índices:
CREATE INDEX idx_vacunas_aplicadas_mascota ON vacunas_aplicadas(mascota_id);
CREATE INDEX idx_vacunas_tipo_especie ON vacunas_tipo_sugeridas(especie);

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/mascotas/:petId/vacunas
Todos los endpoints requieren el middleware verifyToken.

──────────────────────
1. GET /api/mascotas/:petId/vacunas
──────────────────────
Devuelve en una sola llamada:
- Los datos básicos de la mascota (para el hero de la pantalla).
- Las vacunas ya aplicadas de esa mascota.
- Las vacunas sugeridas para la especie de esa mascota, con el estado "applied" calculado.

Lógica del backend:
a) Verificar que la mascota existe y pertenece al usuario autenticado.
   Si no: 404 o 403.
b) Query 1: SELECT * FROM mascotas WHERE id = $1 AND usuario_id = $2.
c) Query 2: SELECT * FROM vacunas_aplicadas WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC.
d) Query 3: SELECT * FROM vacunas_tipo_sugeridas WHERE especie = $1 AND activa = TRUE ORDER BY orden ASC.
e) Para cada vacuna sugerida, calcular si fue aplicada:
   - Una vacuna sugerida está "aplicada" si existe al menos un registro en vacunas_aplicadas 
     con vacuna_sugerida_id = vacuna.id y fecha_aplicacion dentro de los últimos 
     (frecuencia_meses) meses (contando desde hoy hacia atrás).
   - Si está aplicada: applied: true, proximo_refuerzo: fecha_aplicacion + frecuencia_meses.
   - Si no está aplicada: applied: false.
f) Para cada vacuna sugerida, calcular el campo estado_display:
   - Si applied false: "Aún no corresponde".
   - Si applied true y proximo_refuerzo > hoy + 30 días: "Al día".
   - Si applied true y proximo_refuerzo entre hoy y hoy+30: "Refuerzo próximo".
   - Si applied true y proximo_refuerzo < hoy: "Vencida".

Response (200):
{
  "mascota": {
    "id": 1,
    "nombre": "Titán",
    "especie": "perro",
    "raza": "Labrador Retriever",
    "peso": 20.40,
    "fecha_nacimiento": "2022-01-15",
    "imagen_asset": "perro_labrador"
  },
  "vacunasAplicadas": [
    {
      "id": 10,
      "nombre": "Rabia",
      "descripcion": null,
      "fecha_aplicacion": "2025-03-10",
      "proximo_refuerzo": "2026-03-10",
      "tipo": "vacuna",
      "veterinaria": "Clínica Veterinaria del Centro",
      "vacuna_sugerida_id": 7
    }
  ],
  "vacunasSugeridas": [
    {
      "id": 1,
      "nombre": "Moquillo Canino (Distemper)",
      "frecuencia_meses": 12,
      "frecuencia_descripcion": "Cada 1 año(s)",
      "applied": false,
      "estado_display": "Aún no corresponde",
      "proximo_refuerzo": null
    },
    {
      "id": 7,
      "nombre": "Rabia",
      "frecuencia_meses": 12,
      "frecuencia_descripcion": "Cada 1 año(s)",
      "applied": true,
      "estado_display": "Al día",
      "proximo_refuerzo": "2026-03-10"
    }
  ]
}

──────────────────────
2. POST /api/mascotas/:petId/vacunas
──────────────────────
Crea un nuevo registro de vacuna aplicada.

Body:
{
  "nombre": "Moquillo Canino (Distemper)",
  "descripcion": "Aplicada en la veterinaria del barrio",
  "fecha_aplicacion": "2026-06-01",
  "tipo": "vacuna",
  "veterinaria": "Clínica Veterinaria del Centro",   // opcional, puede ser null
  "vacuna_sugerida_id": 1                             // opcional, present si viene desde "Marcar"
}

Lógica del backend:
a) Verificar que la mascota pertenece al usuario autenticado.
b) Validar: nombre no vacío, fecha_aplicacion no es futura (date <= TODAY), tipo válido.
c) Si vacuna_sugerida_id está presente: buscar la vacuna sugerida y calcular proximo_refuerzo 
   sumando frecuencia_meses a fecha_aplicacion.
d) Si vacuna_sugerida_id no está presente: proximo_refuerzo = null.
e) INSERT en vacunas_aplicadas con todos los campos (incluido veterinaria).

Response (201):
{
  "mensaje": "Vacuna registrada correctamente",
  "vacuna": {
    "id": 15,
    "nombre": "Moquillo Canino (Distemper)",
    "descripcion": "Aplicada en la veterinaria del barrio",
    "fecha_aplicacion": "2026-06-01",
    "proximo_refuerzo": "2027-06-01",
    "tipo": "vacuna",
    "veterinaria": "Clínica Veterinaria del Centro",
    "vacuna_sugerida_id": 1
  }
}

Errores:
- 400: { "error": "El nombre de la vacuna es requerido" }
- 400: { "error": "La fecha no puede ser futura" }
- 403: { "error": "No tenés permiso para modificar esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────
3. DELETE /api/mascotas/:petId/vacunas/:vacunaId
──────────────────────
Elimina un registro de vacuna aplicada.

Lógica: verificar que vacunas_aplicadas.mascota_id coincide con petId y que la mascota pertenece al usuario.

Response (200): { "mensaje": "Vacuna eliminada correctamente" }
Response (403): { "error": "No tenés permiso para eliminar esta vacuna" }
Response (404): { "error": "Vacuna no encontrada" }

──────────────────────
4. PUT /api/mascotas/:petId/vacunas/:vacunaId
──────────────────────
Edita un registro de vacuna aplicada existente.

Body:
{
  "nombre": "Moquillo Canino (Distemper)",
  "descripcion": "Actualización de descripción",
  "fecha_aplicacion": "2026-06-15",
  "tipo": "vacuna",
  "veterinaria": "Clínica Neurológica Veterinaria"
}

Lógica del backend:
a) Verificar que la vacuna existe y pertenece a una mascota del usuario autenticado.
b) Validar: nombre no vacío, fecha_aplicacion no futura, tipo válido.
c) Si la vacuna tiene vacuna_sugerida_id vinculada: recalcular proximo_refuerzo 
   sumando frecuencia_meses a la nueva fecha_aplicacion.
   Si no tiene vacuna_sugerida_id: proximo_refuerzo permanece null.
d) UPDATE vacunas_aplicadas SET nombre=$1, descripcion=$2, fecha_aplicacion=$3, tipo=$4,
   veterinaria=$5, proximo_refuerzo=$6, actualizado_en=NOW()
   WHERE id=$7 AND mascota_id=$8 RETURNING *.

Response (200):
{
  "mensaje": "Vacuna actualizada correctamente",
  "vacuna": {
    "id": 15,
    "nombre": "Moquillo Canino (Distemper)",
    "descripcion": "Actualización de descripción",
    "fecha_aplicacion": "2026-06-15",
    "proximo_refuerzo": "2027-06-15",
    "tipo": "vacuna",
    "veterinaria": "Clínica Neurológica Veterinaria",
    "vacuna_sugerida_id": 1,
    "actualizado_en": "2026-06-17T10:30:00Z"
  }
}

Response (400): { "error": "El nombre de la vacuna es requerido" }
Response (400): { "error": "La fecha no puede ser futura" }
Response (403): { "error": "No tenés permiso para modificar esta vacuna" }
Response (404): { "error": "Vacuna no encontrada" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/VacunasScreen.jsx          ← pantalla principal (este prompt)
- (reutilizar) utils/calcularEdad.js ← ya existe desde FichaMedicaScreen
- (reutilizar) utils/api.js          ← ya existe desde FichaMedicaScreen
- (reutilizar) constants/petImages.js← ya existe desde FichaMedicaScreen

Backend:
- routes/vacunas.js
- controllers/vacunasController.js
- migrations/002_create_vacunas.sql  ← CREATE TABLE vacunas_tipo_sugeridas, vacunas_aplicadas
- seeds/vacunas_perro.sql            ← datos iniciales de vacunas sugeridas para perros
- seeds/vacunas_gato.sql             ← datos iniciales de vacunas sugeridas para gatos

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                     |
|------------------------------------------------|---------------------------------------------------------------------|
| Sin vacunas aplicadas                          | Mostrar "No hay vacunas registradas ✏️" en gris                     |
| Mascota de especie sin sugeridas en DB         | Mostrar "No hay vacunas sugeridas para esta especie" en gris         |
| Guardar sin título en el modal                 | Borde rojo en el input + texto error "Este campo es requerido" 12px  |
| Guardar sin fecha en el modal                  | Mismo error inline bajo el campo de fecha                            |
| Red caída al guardar                           | Alert "Sin conexión. Intentá de nuevo más tarde."                   |
| Marcar vacuna que ya fue marcada               | El botón "Marcar" ya no se muestra (estado applied: true)           |
| Mascota sin peso o sin raza                    | El campo correspondiente en el hero muestra "—"                     |
| Nombre de mascota muy largo                    | Truncar con numberOfLines: 1 + ellipsizeMode: 'tail' en el hero     |
| Error 403 al intentar operar otra mascota      | Alert y redirigir de vuelta a FichaMédica                           |
| Lista de vacunas aplicadas muy larga           | ScrollView contenedor ya maneja el scroll sin problema              |
| Nombre de vacuna muy largo en el card          | Texto ocupa 2-3 líneas, los botones se mantienen centrados          |
| Red caída al editar                            | Revertir cambios en el estado local + Alert de error                 |
| Editar nombre de una vacuna sugerida vinculada | Se guarda el nombre nuevo en vacunas_aplicadas pero el vínculo con  |
|                                                | vacuna_sugerida_id permanece (para mantener el "✓ Aplicada" en el   |
|                                                | calendario sugerido)                                                |
| Veterinaria con texto muy largo                | El texto se trunca visualmente en el card (numberOfLines: 1, ellipsis)|

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- Separar siempre lógica de UI de lógica de negocio (el controlador no debería tener lógica de presentación).
- Todos los textos en español (Argentina): coma decimal para peso, fechas en DD/MM/YYYY.
- Manejar todos los estados de carga y error con ActivityIndicator y Alert.
- No usar librerías incompatibles con Expo managed workflow sin eject.
- Para las queries SQL usar el módulo 'pg' (node-postgres) con el pool de conexiones ya configurado en db/pool.js del proyecto.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores y tipografía de Zooni definidas al inicio de este documento.
- Las animaciones deben implementarse con Animated API de React Native (no Reanimated a menos que ya esté instalado en el proyecto). Usar ease-out para entradas, ease-in para salidas, duraciones entre 150ms y 350ms. Nunca animar con 'all' o con duraciones mayores a 400ms en interacciones de UI.
