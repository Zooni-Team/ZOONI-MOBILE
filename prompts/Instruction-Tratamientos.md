=== ZOONI — PANTALLA: TRATAMIENTOS ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Tratamientos" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde FichaMedicaScreen pasando el `petId` como parámetro de ruta. A continuación se detalla absolutamente todo lo que necesitás implementar.

IMPORTANTE: Esta pantalla es estructuralmente similar a la pantalla Vacunas del proyecto, pero tiene diferencias de diseño y funcionalidad significativas. Leé todo con atención antes de codear.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto (Sequelize o Prisma, mantener consistencia)
- Autenticación: JWT. El token viaja en el header Authorization como Bearer token en cada request.
- Imágenes de mascotas: assets locales resueltos con el objeto PET_IMAGES ya definido en el proyecto (mismo patrón que FichaMedicaScreen y VacunasScreen).

──────────────────────────────────────
DIFERENCIAS CLAVE RESPECTO A LA PANTALLA VACUNAS
──────────────────────────────────────
1. Los cards de tratamientos aplicados tienen fondo amarillo ámbar claro (#FFFBE6), no blanco.
2. Los campos del card son distintos: Inicio, Próximo control, Veterinaria, y "Faltan X días".
3. NO hay botón de editar (✏️). Solo existe el botón de eliminar (🗑).
4. Los tratamientos sugeridos son PURAMENTE INFORMATIVOS: no tienen botón "Marcar".
   Solo muestran nombre (izquierda) y frecuencia (derecha). Sirven de referencia al usuario.
5. El ícono de la sección sugerida es 📋 (clipboard), no 📅.
6. El emoji del estado vacío es 💊 (pastilla).
7. Los campos del formulario modal son distintos (ver detalle más abajo).

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal de la pantalla:          #C8F0D8  (verde menta suave)
- Fondo card blanco (sugeridos, modal):    #FFFFFF
- Fondo card de tratamiento APLICADO:      #FFFBE6  (amarillo ámbar muy suave)
- Borde card de tratamiento aplicado:      #F5E6A3  (amarillo más saturado, sutil)
- Botón acción principal (Añadir, Guardar):#2DBD72  (verde teal)
- Botón cancelar / secundario:             #E8E8E8  (gris claro, texto #2C2C2C)
- Botón eliminar (ícono papelera):         #E63946  (rojo vibrante)
- Texto principal:                         #2C2C2C
- Texto secundario / labels:               #6B6B6B
- "Faltan X días" (con tiempo restante):   #2C2C2C  (negro/gris oscuro, Bold)
- "Vencido" (sin tiempo restante / pasado):#E63946  (rojo urgencia, Bold)
- "Hoy" (vence hoy):                       #F5A623  (naranja alerta, Bold)
- Overlay modal:                           rgba(0, 0, 0, 0.50)
- Título del modal:                        #2DBD72  (verde teal)
- Borde de inputs:                         #DDDDDD

Tipografía (fuente: Nunito o Poppins, importada con @expo-google-fonts):
- Título pantalla "Tratamientos de [Nombre]": ExtraBold / Bold, 24px, #2C2C2C
- Info mascota (edad, peso, raza):            Regular, 13px, #6B6B6B
- Encabezado sección "Tratamientos":          Bold, 18px, #2C2C2C
- Nombre tratamiento en card aplicado:        Bold, 14px, #2C2C2C (puede ser multilinea)
- Campos secundarios card (Inicio, Próximo control, Veterinaria): Regular, 12px, #6B6B6B
- "Faltan X días" / "Vencido":                Bold, 13px (color según estado, ver arriba)
- Nombre sugerido en card informativo:         Bold, 14px, #2C2C2C (puede ser multilinea)
- Frecuencia en card informativo:              Regular, 12px, #6B6B6B, textAlign: 'right'
- Encabezado "Tratamientos sugeridos":         Bold, 16px, #2C2C2C
- Título modal "Nuevo tratamiento":            Bold, 18px, #2DBD72, centrado
- Labels/placeholders inputs del modal:        Regular, 13px, #AAAAAA
- Texto botón "Guardar":                       Bold, 15px, #FFFFFF
- Texto botón "Cancelar":                      Bold, 15px, #2C2C2C

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
  │      Tratamientos de Titán            │  ← Hero / cabecera
  │   Edad: 4 años y 4 meses             │
  │   Peso: 20,40 kg                     │
  │   Raza: Labrador Retriever           │
  │                                       │
  ├───────────────────────────────────────┤
  │                                       │
  │  Tratamientos         [➕ Añadir]     │  ← Sección Tratamientos aplicados
  │  No hay tratamientos registrados 💊   │
  │                                       │
  │  📋 Tratamientos sugeridos           │  ← Sección informativa (sin Marcar)
  │                                       │
  │  ┌──────────────────────────────┐    │
  │  │ Desparasitación Interna  Cada 3 m│ │
  │  └──────────────────────────────┘    │
  │  ┌──────────────────────────────┐    │
  │  │ Desparasitación Externa  Cada 2 m│ │
  │  └──────────────────────────────┘    │
  │            ... más tratamientos ...  │
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
- Detrás de la imagen: View circular decorativo de 130x130, borderRadius: 65,
  backgroundColor: '#A8E6C0', opacity: 0.45, position: 'absolute', centrado.
- Animación de entrada: escala 0.88 → 1.0 + opacity 0 → 1, duración 350ms,
  easing ease-out (cubic-bezier(0.23, 1, 0.32, 1)).

TÍTULO "Tratamientos de [Nombre]":
- Texto dinámico: "Tratamientos de " + mascota.nombre (ej: "Tratamientos de Titán").
- fontFamily: 'Nunito_700Bold' (o Poppins_700Bold).
- fontSize: 24, color: '#2C2C2C', textAlign: 'center'.
- marginTop: 10px (debajo de la imagen).

SUBTÍTULO CON INFO DE MASCOTA:
- Tres líneas de texto centradas, una debajo de la otra, gap de 2px entre ellas.
- "Edad: X años y Y meses" — Regular 13px, #6B6B6B.
- "Peso: 20,40 kg" — Regular 13px, #6B6B6B (formato con coma decimal, toLocaleString('es-AR') + ' kg').
- "Raza: Labrador Retriever" — Regular 13px, #6B6B6B.
- marginTop: 6px sobre el bloque, marginBottom: 22px.

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

Este View contiene la sección de tratamientos aplicados y la de tratamientos sugeridos.

─────────────────────────────────────────────────────
SUB-SECCIÓN A — TRATAMIENTOS APLICADOS (dentro del card blanco)
─────────────────────────────────────────────────────

ROW DE ENCABEZADO:
- View con flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'.
- Izquierda: texto "Tratamientos", fontFamily Bold, fontSize: 18px, color: #2C2C2C.
- Derecha: botón pill "➕ Añadir".
  · backgroundColor: '#2DBD72'
  · borderRadius: 20
  · paddingVertical: 8, paddingHorizontal: 16
  · Contenido interno: row con ícono "+" (Ionicons 'add', blanco, 16px) + texto "Añadir" (Bold, 14px, #FFFFFF).
  · shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3.
  · Al presionar: escala 0.96 en 100ms, vuelve a 1.0 en 150ms.
  · Al tocar: abre el MODAL DE AÑADIR TRATAMIENTO (ver sección modal más abajo).
- marginBottom: 14px.

ESTADO VACÍO (sin tratamientos aplicados):
- Si la lista de tratamientos aplicados está vacía, mostrar:
  · Texto: "No hay tratamientos registrados 💊"
  · fontFamily: Regular, fontSize: 14px, color: #6B6B6B.
  · textAlign: 'center'.
  · marginTop: 4px, marginBottom: 18px.

LISTA DE TRATAMIENTOS APLICADOS (cuando hay registros):
- Si hay tratamientos, mostrar cards uno debajo del otro con marginBottom: 10px.

ESTRUCTURA DEL CARD DE TRATAMIENTO APLICADO:

IMPORTANTE: a diferencia de la pantalla Vacunas, estos cards tienen un fondo amarillo ámbar 
suave para diferenciarlos visualmente de los sugeridos y del fondo blanco general.

  · backgroundColor: '#FFFBE6'   (amarillo ámbar muy suave)
  · borderRadius: 14
  · borderWidth: 1, borderColor: '#F5E6A3'  (borde amarillo sutil que marca el límite del card)
  · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
  · paddingHorizontal: 14, paddingVertical: 12
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  · marginBottom: 10

COLUMNA IZQUIERDA (flex: 1, paddingRight: 10):
  Stack vertical de 5 líneas (gap: 3px entre cada una):

  Línea 1 — Nombre del tratamiento:
    · fontFamily: Bold, fontSize: 14px, color: '#2C2C2C'.
    · Puede ocupar dos líneas si el nombre es largo.
    · marginBottom: 4px.

  Línea 2 — Fecha de inicio:
    · Texto: "Inicio: DD/MM/YYYY" (formato argentino, ej: "Inicio: 19/3/2026").
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.

  Línea 3 — Próximo control:
    · Texto: "Próximo control: DD/MM/YYYY" si existe proximo_control,
      o "Próximo control: Sin fecha" si es null.
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.
    · Si la fecha es en los próximos 7 días: color '#F5A623' (naranja).
    · Si la fecha ya pasó: color '#E63946' (rojo).

  Línea 4 — Veterinaria:
    · Texto: "Veterinaria: " + nombre, o "Veterinaria: Sin registro" si es null.
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B'.

  Línea 5 — Contador de días ("Faltan X días"):
    · Calculado en el frontend en tiempo real: Math.ceil((new Date(proximo_control) - new Date()) / (1000*60*60*24)).
    · Si proximo_control es null: NO mostrar esta línea (omitir).
    · Si faltan días > 0: texto "Faltan X días", fontFamily: Bold, fontSize: 13px, color: '#2C2C2C'.
    · Si es hoy (días === 0): texto "Vence hoy", Bold, 13px, color: '#F5A623'.
    · Si está vencido (días < 0): texto "Vencido hace X días", Bold, 13px, color: '#E63946'.
    · marginTop: 4px (separación visual del bloque de campos secundarios).

COLUMNA DERECHA (alignItems: 'center', justifyContent: 'center'):
  UN SOLO BOTÓN — el de eliminar (NO hay botón de editar en tratamientos):

  BOTÓN ELIMINAR:
    · TouchableOpacity con Pressable.
    · backgroundColor: '#E63946' (rojo vibrante).
    · width: 36, height: 36, borderRadius: 10.
    · alignItems: 'center', justifyContent: 'center'.
    · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2.
    · Ícono: Ionicons 'trash-outline', tamaño 18px, color '#FFFFFF'.
    · Al presionar (pressIn): escala 0.90 en 100ms, vuelve a 1.0 en 150ms (ease-out).
    · Al tocar: muestra Alert de confirmación (ver función eliminarTratamiento).

DIAGRAMA ASCII DEL CARD:
  ┌─────────────────────────────────────────────────┐ (fondo #FFFBE6)
  │  Tratamiento Ejemplo                [🗑 rojo  ] │
  │  Inicio: 19/3/2026                              │
  │  Próximo control: 27/3/2026                     │
  │  Veterinaria: Sin registro                      │
  │  Faltan 11 días                                 │
  └─────────────────────────────────────────────────┘

ANIMACIONES DE LA LISTA:
- Entrada: cada card entra con translateY de 12px → 0 + opacity 0 → 1,
  stagger de 60ms entre cards, duración 280ms, ease-out.
- Eliminación: colapsar height del card de su valor actual → 0 + opacity → 0 en 250ms ease-in
  antes de quitarlo del estado (evita el salto brusco de la lista).

─────────────────────────────────────────────────────
SUB-SECCIÓN B — TRATAMIENTOS SUGERIDOS (dentro del card blanco)
─────────────────────────────────────────────────────

ENCABEZADO DE SECCIÓN:
- marginTop: 24px.
- Texto: "📋 Tratamientos sugeridos"
  · fontFamily: Bold, fontSize: 16px, color: #2C2C2C.
  · El emoji 📋 actúa como ícono decorativo a la izquierda.
- marginBottom: 12px.

LISTA DE TRATAMIENTOS SUGERIDOS:
- Los tratamientos sugeridos se cargan desde el backend según la ESPECIE de la mascota.
  NO están hardcodeados en el frontend.
- Son PURAMENTE INFORMATIVOS: no tienen botón "Marcar" ni ninguna acción al tocarlos.
  Sirven de referencia para que el usuario sepa qué tratamientos debería hacer.
- Al tocar un card sugerido: no pasa nada (o leve efecto de press sin acción real).

DISEÑO DEL CARD INFORMATIVO:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 12
  · borderWidth: 1, borderColor: '#EFEFEF'
  · shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  · paddingHorizontal: 14, paddingVertical: 12
  · marginBottom: 10
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'

  COLUMNA IZQUIERDA (flex: 1, paddingRight: 8):
    · Nombre del tratamiento sugerido.
    · fontFamily: Bold, fontSize: 14px, color: '#2C2C2C'.
    · Puede ocupar dos líneas si el nombre es largo (sin numberOfLines fijo).
    · Ejemplos: "Desparasitación Interna", "Desparasitación Externa",
      "Control Dental", "Chequeo General Veterinario",
      "Chequeo Articular y de Cadera", "Control de Peso",
      "Profilaxis Cardiaca", "Control de Pulgas y Garrapatas",
      "Chequeo Dermatológico", "Evaluación Conductual",
      "Esterilización / Castración Preventiva".

  COLUMNA DERECHA (alignItems: 'flex-end', justifyContent: 'center'):
    · Solo muestra la frecuencia recomendada.
    · Texto: "Cada X meses" o "Cada X semana(s)".
    · fontFamily: Regular, fontSize: 12px, color: '#6B6B6B', textAlign: 'right'.
    · El texto puede ir en dos líneas si es largo (ej: "Cada 12\nmeses").
    · NO hay ningún botón, badge ni ícono adicional.

DIAGRAMA ASCII DEL CARD INFORMATIVO:
  ┌──────────────────────────────────────────────┐ (fondo blanco)
  │  Desparasitación Interna         Cada 3 meses│
  └──────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────┐
  │  Chequeo Articular y             Cada 12      │
  │  de Cadera                       meses        │
  └──────────────────────────────────────────────┘

- Animación de entrada: igual que la lista de aplicados (stagger 60ms, translateY 12→0 + opacity).

──────────────────────────────────────
MODAL — AÑADIR TRATAMIENTO (botón "➕ Añadir")
──────────────────────────────────────

Cuando el usuario toca "➕ Añadir", se muestra un modal centrado en pantalla sobre un overlay oscuro.
NO existe modal de edición en esta pantalla (los tratamientos solo se pueden eliminar, no editar).

OVERLAY:
- Componente Modal de React Native (transparent: true, animationType: 'none').
- Fondo: rgba(0, 0, 0, 0.50) cubriendo toda la pantalla.
- Animación de entrada: opacity 0 → 0.5 en 200ms ease-out.
- Al tocar fuera del card modal (sobre el overlay): cerrar el modal.

CARD DEL MODAL:
- backgroundColor: '#FFFFFF'
- borderRadius: 20
- width: '88%' del ancho de pantalla (máx 360px)
- paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20
- shadowColor: '#000', shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10
- Posicionado al centro exacto de la pantalla.
- Animación de entrada: escala 0.92 → 1.0 + opacity 0 → 1 en 220ms, ease-out (cubic-bezier(0.23, 1, 0.32, 1)).
- Animación de salida: escala 1.0 → 0.92 + opacity 1 → 0 en 160ms, ease-in.

TÍTULO DEL MODAL:
- Texto: "Nuevo tratamiento"
- fontFamily: Bold, fontSize: 18px, color: '#2DBD72', textAlign: 'center'.
- marginBottom: 20px.

CAMPO 1 — NOMBRE DEL TRATAMIENTO (requerido):
- TextInput con:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 14px, color: '#2C2C2C'
  · placeholder: "Nombre del tratamiento", placeholderTextColor: '#AAAAAA'
  · backgroundColor: '#FFFFFF'
  · marginBottom: 12
- Al hacer foco: borderColor '#DDDDDD' → '#2DBD72' en 150ms.
- Validación: no puede estar vacío al guardar.
- Error inline: si vacío y se intentó guardar, mostrar texto "Este campo es requerido" en
  Regular, 11px, #E63946, debajo del input, marginBottom: 4.

CAMPO 2 — FECHA DE INICIO (requerido):
- View que al tocar abre el DateTimePicker nativo (@react-native-community/datetimepicker).
- El valor seleccionado se muestra como texto "DD/MM/YYYY" dentro del View.
- Estilo contenedor:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  · marginBottom: 12
- Si no hay fecha: texto placeholder "dd/mm/aaaa" en #AAAAAA, 14px, + ícono calendario derecha.
- Si hay fecha: texto "DD/MM/YYYY" en #2C2C2C, 14px, + ícono calendario derecha.
- Ícono: Ionicons 'calendar-outline', 18px, #6B6B6B.
- No tiene restricción de fecha futura (un tratamiento puede comenzar en el futuro).
- Error inline: si null y se intentó guardar → "Seleccioná una fecha de inicio".

CAMPO 3 — PRÓXIMO CONTROL (opcional):
- Mismo estilo visual que el Campo 2 (DateTimePicker).
- placeholder: "Próximo control (opcional)".
- Si el usuario no selecciona fecha: se guarda como null. El card NO mostrará la línea "Faltan X días".
- La fecha de próximo control puede ser futura (es lo más común).
- No tiene validación de requerido.
- marginBottom: 12.

CAMPO 4 — VETERINARIA (opcional):
- TextInput con:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 14px, color: '#2C2C2C'
  · placeholder: "Veterinaria (opcional)", placeholderTextColor: '#AAAAAA'
  · backgroundColor: '#FFFFFF'
  · marginBottom: 12
- Al hacer foco: borde verde.
- Si se deja vacío: guarda null en el backend.

CAMPO 5 — DESCRIPCIÓN / NOTAS (opcional):
- TextInput multilinea con:
  · borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 14px, color: '#2C2C2C'
  · placeholder: "Notas u observaciones (opcional)", placeholderTextColor: '#AAAAAA'
  · backgroundColor: '#FFFFFF'
  · multiline: true, numberOfLines: 3, height: 72
  · textAlignVertical: 'top'
  · marginBottom: 20
- Al hacer foco: borde verde.

BOTÓN GUARDAR:
- width: '100%', height: 48, borderRadius: 30.
- backgroundColor: '#2DBD72'.
- Texto "Guardar", Bold, 15px, color: '#FFFFFF', textAlign: 'center'.
- shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4.
- Al presionar: escala 0.97 en 100ms, vuelve en 150ms.
- Mientras se procesa: ActivityIndicator blanco en lugar del texto.
- Al éxito: cerrar modal, agregar el nuevo tratamiento al inicio de la lista, Toast verde.

BOTÓN CANCELAR:
- width: '100%', height: 44, borderRadius: 30.
- backgroundColor: '#E8E8E8'.
- Texto "Cancelar", Bold, 15px, color: '#2C2C2C', textAlign: 'center'.
- marginTop: 10px.
- Al presionar: cerrar modal con animación de salida. Sin guardar nada.

──────────────────────────────────────
TOAST / SNACKBAR DE CONFIRMACIÓN
──────────────────────────────────────

Al guardar un tratamiento exitosamente:
- Posición: top: 56px (debajo del header), centrado horizontalmente.
- backgroundColor: '#2DBD72', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12.
- Sombra: shadowColor '#000', shadowOffset {width:0, height:4}, shadowOpacity: 0.15, shadowRadius: 8.
- Contenido: ícono ✅ (Ionicons 'checkmark-circle', 18px, blanco) + texto "Tratamiento registrado correctamente", Bold, 14px, #FFFFFF.
- Aparece: opacity 0 → 1 + translateY -12 → 0 en 220ms ease-out.
- Se mantiene 2.5 segundos.
- Desaparece: opacity 1 → 0 + translateY 0 → -12 en 200ms ease-in.

Al eliminar un tratamiento exitosamente:
- Mismo toast pero backgroundColor: '#E63946' y texto "Tratamiento eliminado".

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla:
  · Mostrar skeleton loaders donde irían los cards: 3 rectángulos grises (#E8E8E8) animados
    con shimmer, borderRadius: 12, height: 80px (un poco más alto que vacunas por el campo extra),
    marginBottom: 10px.
  · El shimmer es un gradiente lineal animado (react-native-linear-gradient o Reanimated).

- Spinner del botón Guardar: ActivityIndicator color '#FFFFFF', size 'small', centrado.

- Al eliminar (tap 🗑):
  · El card colapsa con animación antes de confirmar el request (optimistic UI).
  · Si el DELETE falla: el card vuelve a aparecer con la animación inversa + Alert de error.

──────────────────────────────────────
LÓGICA FRONTEND (TratamientosScreen.jsx)
──────────────────────────────────────

Archivo: screens/TratamientosScreen.jsx

Props de navegación: route.params.petId

Estado local (useState):
- mascota:             null | objeto mascota
- tratamientosAplicados: array de tratamientos del usuario para esta mascota
- tratamientosSugeridos: array de tratamientos sugeridos para la especie
- loading:             boolean (carga inicial)
- modalVisible:        boolean
- formNombre:          string
- formFechaInicio:     Date | null
- formProximoControl:  Date | null
- formVeterinaria:     string
- formDescripcion:     string
- formErrors:          objeto { nombre: string|null, fechaInicio: string|null }
- guardando:           boolean
- showDatePickerInicio:   boolean  (controla si se muestra el picker de inicio)
- showDatePickerControl:  boolean  (controla si se muestra el picker de próximo control)

useEffect al montar:
- Obtener JWT del AsyncStorage (clave 'userToken').
- Llamar GET /api/mascotas/:petId/tratamientos.
- Guardar en mascota, tratamientosAplicados, tratamientosSugeridos.
- Manejar errores con Alert.

Función calcularDiasRestantes(fechaProximoControl):
- Recibe string "YYYY-MM-DD".
- Calcula: Math.ceil((new Date(fechaProximoControl) - new Date()) / (1000 * 60 * 60 * 24)).
- Devuelve el número entero de días (puede ser negativo si está vencido, 0 si es hoy).

Función formatearContadorDias(dias):
- Si dias > 1: devuelve "Faltan " + dias + " días".
- Si dias === 1: devuelve "Falta 1 día".
- Si dias === 0: devuelve "Vence hoy".
- Si dias < 0: devuelve "Vencido hace " + Math.abs(dias) + " día(s)".

Función abrirModal():
- Limpiar formulario (todos los campos vacíos/null, formErrors limpio).
- modalVisible = true.

Función cerrarModal():
- modalVisible = false (con animación de salida del card modal).
- Limpiar formErrors después de 200ms.

Función guardarTratamiento():
- Validar: formNombre no vacío (→ formErrors.nombre), formFechaInicio no null (→ formErrors.fechaInicio).
- Si hay errores: setFormErrors y retornar sin continuar.
- guardando = true.
- body = {
    nombre: formNombre,
    fecha_inicio: formatDate(formFechaInicio),             // 'YYYY-MM-DD'
    proximo_control: formProximoControl ? formatDate(formProximoControl) : null,
    veterinaria: formVeterinaria.trim() || null,
    descripcion: formDescripcion.trim() || null
  }.
- Llamar POST /api/mascotas/:petId/tratamientos.
- Al éxito:
  · Agregar nuevo tratamiento al inicio de tratamientosAplicados (unshift).
  · Cerrar modal con animación de salida.
  · Mostrar Toast verde "Tratamiento registrado correctamente".
- Al error: Alert.alert('Error', 'No se pudo registrar el tratamiento').
- guardando = false (en finally).

Función eliminarTratamiento(tratamientoId):
- Alert.alert(
    '¿Eliminar tratamiento?',
    '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', onPress: () => confirmarEliminar(tratamientoId), style: 'destructive' }
    ]
  ).

Función confirmarEliminar(tratamientoId):
- Animar el card: opacity 1 → 0 + height → 0 en 250ms ease-in.
- Al terminar animación: filtrar tratamientosAplicados quitando el id.
- Llamar DELETE /api/mascotas/:petId/tratamientos/:tratamientoId en segundo plano.
- Mostrar Toast rojo "Tratamiento eliminado".
- Al error del DELETE: restaurar el card en la lista (revertir el estado) + Alert.

──────────────────────────────────────
BACKEND — MODELOS DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: tratamientos_tipo_sugeridos
(Catálogo de tratamientos recomendados por especie. No hardcodeados en el frontend.)

CREATE TABLE tratamientos_tipo_sugeridos (
  id                     SERIAL PRIMARY KEY,
  especie                VARCHAR(50) NOT NULL,   -- 'perro', 'gato', 'conejo', etc.
  nombre                 VARCHAR(150) NOT NULL,
  descripcion            TEXT,
  frecuencia_descripcion VARCHAR(80) NOT NULL,   -- ej: "Cada 3 meses", "Cada 12 meses"
  frecuencia_meses       INTEGER,                -- opcional, para cálculos futuros
  orden                  INTEGER DEFAULT 0,      -- para ordenar la lista
  activo                 BOOLEAN DEFAULT TRUE,
  creado_en              TIMESTAMP DEFAULT NOW()
);

-- Datos iniciales para perros (insertar en seed/migration):
INSERT INTO tratamientos_tipo_sugeridos (especie, nombre, frecuencia_descripcion, frecuencia_meses, orden) VALUES
  ('perro', 'Desparasitación Interna',               'Cada 3 meses',   3,  1),
  ('perro', 'Desparasitación Externa',               'Cada 2 meses',   2,  2),
  ('perro', 'Control Dental',                        'Cada 6 meses',   6,  3),
  ('perro', 'Chequeo General Veterinario',           'Cada 6 meses',   6,  4),
  ('perro', 'Chequeo Articular y de Cadera',         'Cada 12 meses', 12,  5),
  ('perro', 'Control de Peso',                       'Cada 6 meses',   6,  6),
  ('perro', 'Profilaxis Cardiaca',                   'Cada 6 meses',   6,  7),
  ('perro', 'Control de Pulgas y Garrapatas',        'Cada 2 meses',   2,  8),
  ('perro', 'Chequeo Dermatológico',                 'Cada 12 meses', 12,  9),
  ('perro', 'Evaluación Conductual',                 'Cada 12 meses', 12, 10),
  ('perro', 'Esterilización / Castración Preventiva','Cada 12 meses', 12, 11);

-- Para gatos: Desparasitación Interna, Desparasitación Externa, Control Dental,
-- Chequeo Renal, Chequeo General, Limpieza de Oídos, Control de Pulgas, etc.

TABLA: tratamientos_aplicados
(Registro de cada tratamiento que un usuario registra para su mascota.)

CREATE TABLE tratamientos_aplicados (
  id               SERIAL PRIMARY KEY,
  mascota_id       INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  nombre           VARCHAR(150) NOT NULL,
  descripcion      TEXT,
  fecha_inicio     DATE NOT NULL,
  proximo_control  DATE,                          -- opcional (puede ser null)
  veterinaria      VARCHAR(150),                  -- nombre de la veterinaria donde se realiza
  creado_en        TIMESTAMP DEFAULT NOW()
  -- NOTA: no tiene campo actualizado_en porque los tratamientos no se editan
);

-- Índice:
CREATE INDEX idx_tratamientos_aplicados_mascota ON tratamientos_aplicados(mascota_id);
CREATE INDEX idx_tratamientos_tipo_especie ON tratamientos_tipo_sugeridos(especie);

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

BASE URL: /api/mascotas/:petId/tratamientos
Todos los endpoints requieren el middleware verifyToken.

──────────────────────
1. GET /api/mascotas/:petId/tratamientos
──────────────────────
Devuelve en una sola llamada:
- Datos básicos de la mascota (para el hero).
- Los tratamientos aplicados de esa mascota.
- Los tratamientos sugeridos para la especie de esa mascota.

Lógica del backend:
a) Verificar que la mascota existe y pertenece al usuario autenticado. Si no: 404 o 403.
b) Query 1: SELECT * FROM mascotas WHERE id = $1 AND usuario_id = $2.
c) Query 2: SELECT * FROM tratamientos_aplicados WHERE mascota_id = $1 ORDER BY fecha_inicio DESC.
d) Query 3: SELECT * FROM tratamientos_tipo_sugeridos WHERE especie = $1 AND activo = TRUE ORDER BY orden ASC.
e) NO es necesario calcular estados "applied" en los sugeridos (son puramente informativos).

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
  "tratamientosAplicados": [
    {
      "id": 5,
      "nombre": "Tratamiento Ejemplo",
      "descripcion": null,
      "fecha_inicio": "2026-03-19",
      "proximo_control": "2026-03-27",
      "veterinaria": null,
      "creado_en": "2026-03-19T10:00:00Z"
    }
  ],
  "tratamientosSugeridos": [
    {
      "id": 1,
      "nombre": "Desparasitación Interna",
      "frecuencia_descripcion": "Cada 3 meses",
      "frecuencia_meses": 3
    },
    {
      "id": 2,
      "nombre": "Desparasitación Externa",
      "frecuencia_descripcion": "Cada 2 meses",
      "frecuencia_meses": 2
    }
  ]
}

──────────────────────
2. POST /api/mascotas/:petId/tratamientos
──────────────────────
Crea un nuevo registro de tratamiento aplicado.

Body:
{
  "nombre": "Desparasitación Interna",
  "descripcion": "Pastilla Milbemax",
  "fecha_inicio": "2026-06-01",
  "proximo_control": "2026-09-01",     // opcional, puede ser null
  "veterinaria": "Clínica del Barrio"  // opcional, puede ser null
}

Lógica del backend:
a) Verificar que la mascota pertenece al usuario autenticado.
b) Validar: nombre no vacío, fecha_inicio es una fecha válida (no requerir que sea pasada o futura).
c) INSERT en tratamientos_aplicados con todos los campos.

Response (201):
{
  "mensaje": "Tratamiento registrado correctamente",
  "tratamiento": {
    "id": 6,
    "nombre": "Desparasitación Interna",
    "descripcion": "Pastilla Milbemax",
    "fecha_inicio": "2026-06-01",
    "proximo_control": "2026-09-01",
    "veterinaria": "Clínica del Barrio",
    "creado_en": "2026-06-17T14:00:00Z"
  }
}

Errores:
- 400: { "error": "El nombre del tratamiento es requerido" }
- 400: { "error": "La fecha de inicio es requerida" }
- 403: { "error": "No tenés permiso para modificar esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────
3. DELETE /api/mascotas/:petId/tratamientos/:tratamientoId
──────────────────────
Elimina un registro de tratamiento aplicado.
NO existe endpoint de edición (PUT/PATCH) para tratamientos.

Lógica:
a) Verificar que tratamientos_aplicados.mascota_id coincide con petId.
b) Verificar que la mascota pertenece al usuario autenticado.
c) DELETE FROM tratamientos_aplicados WHERE id = $1 AND mascota_id = $2.

Response (200): { "mensaje": "Tratamiento eliminado correctamente" }
Response (403): { "error": "No tenés permiso para eliminar este tratamiento" }
Response (404): { "error": "Tratamiento no encontrado" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/TratamientosScreen.jsx         ← pantalla principal (este prompt)
- (reutilizar) utils/calcularEdad.js     ← ya existe desde FichaMedicaScreen
- (reutilizar) utils/api.js              ← ya existe desde FichaMedicaScreen
- (reutilizar) constants/petImages.js    ← ya existe desde FichaMedicaScreen

Backend:
- routes/tratamientos.js
- controllers/tratamientosController.js
- migrations/003_create_tratamientos.sql ← CREATE TABLE tratamientos_tipo_sugeridos, tratamientos_aplicados
- seeds/tratamientos_perro.sql           ← datos iniciales para perros
- seeds/tratamientos_gato.sql            ← datos iniciales para gatos

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                         |
|------------------------------------------------|------------------------------------------------------------------------|
| Sin tratamientos aplicados                     | Mostrar "No hay tratamientos registrados 💊" en gris, centrado         |
| Mascota de especie sin sugeridos en DB         | Mostrar "No hay tratamientos sugeridos para esta especie" en gris      |
| Guardar sin nombre                             | Borde rojo + "Este campo es requerido" inline en 11px rojo             |
| Guardar sin fecha de inicio                    | "Seleccioná una fecha de inicio" inline                                |
| proximo_control es null                        | NO mostrar línea "Faltan X días" en el card                            |
| proximo_control pasó (vencido)                 | "Vencido hace X días" en Bold rojo #E63946                             |
| proximo_control es hoy                         | "Vence hoy" en Bold naranja #F5A623                                    |
| Nombre del tratamiento muy largo               | Texto wrap en el card (sin truncar)                                    |
| Veterinaria muy larga en card                  | numberOfLines: 1 + ellipsizeMode: 'tail'                               |
| Red caída al guardar                           | Alert "Sin conexión. Intentá de nuevo más tarde."                      |
| Error 403 al intentar operar otra mascota      | Alert + redirigir a FichaMédica                                        |
| Muchos tratamientos aplicados                  | ScrollView maneja el scroll, sin límite de items                       |
| Mascota sin peso o sin raza                    | Campo correspondiente en el hero muestra "—"                           |
| Nombre de mascota muy largo en título          | numberOfLines: 1, ellipsizeMode: 'tail' en el título del hero          |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- Separar siempre lógica de UI de lógica de negocio.
- Todos los textos en español (Argentina): coma decimal para el peso, fechas en DD/MM/YYYY.
- Manejar todos los estados de carga y error con ActivityIndicator y Alert.
- No usar librerías incompatibles con Expo managed workflow sin eject.
- Para las queries SQL usar el módulo 'pg' (node-postgres) con el pool de conexiones ya configurado en db/pool.js del proyecto.
- NO implementar endpoint PUT ni funcionalidad de edición: los tratamientos son inmutables una vez registrados.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores de Zooni. En particular: los cards de tratamientos aplicados SIEMPRE tienen fondo #FFFBE6 (ámbar suave), no blanco.
- Las animaciones deben implementarse con Animated API de React Native. Usar ease-out para entradas, ease-in para salidas, duraciones entre 150ms y 350ms.
