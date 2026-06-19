=== ZOONI — FLUJO COMPLETO: LOGIN / REGISTRO ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar el flujo completo de Login y Registro de la app mobile Zooni. Este es el flujo más crítico de la aplicación ya que es la puerta de entrada. A continuación se detalla absolutamente todo lo que necesitás implementar: 5 pantallas, lógica de validación y backend completo.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto
- Autenticación: JWT (jsonwebtoken). Al hacer login exitoso, el servidor devuelve un JWT
  que el frontend guarda en AsyncStorage (clave 'userToken'). Este token se envía en cada
  request posterior como Bearer token.
- Imágenes: expo-image-picker para la foto de mascota en el registro.
- País selector: librería react-native-country-picker-modal o similar para selección de país.

──────────────────────────────────────
FLUJO COMPLETO DE NAVEGACIÓN
──────────────────────────────────────

LoginScreen
  → [Ingresar con credenciales válidas] → HomeScreen
  → [Crear cuenta]                      → RegisterStep1Screen
  → [Registrarse como Proveedor]        → (placeholder: Alert "Próximamente")
  → [Google / Facebook / Apple]         → (placeholder: Alert "Próximamente")

RegisterStep1Screen (nombre + tipo de mascota)
  → [Continuar]  → RegisterStep2Screen (datos de la mascota)
  → [< atrás]    → LoginScreen

RegisterStep2Screen (sexo, raza, peso, edad, foto)
  → [Continuar]  → RegisterStep3Screen (datos del usuario)
  → [< atrás]    → RegisterStep1Screen

RegisterStep3Screen (nombre, apellido, mail, contraseña)
  → [Continuar]  → RegisterStep4Screen (ubicación)
  → [< atrás]    → RegisterStep2Screen

RegisterStep4Screen (país, provincia, ciudad, código, teléfono)
  → [Continuar + registro exitoso] → LoginScreen (con param registroExitoso: true)
  → [< atrás]                      → RegisterStep3Screen

GESTIÓN DEL ESTADO ENTRE PASOS:
  Usar un objeto `datosRegistro` que se pasa acumulando entre steps via navigation.navigate params.
  Estructura final del objeto antes del POST al backend:
  {
    mascota: { nombre, especie, sexo, raza, pesoKg, edadMeses, fotoUri },
    usuario: { nombre, apellido, email, password, pais, paisCodigo, provincia, ciudad, codigoTelefono, telefono }
  }

──────────────────────────────────────
IDENTIDAD VISUAL — DIFERENCIAS CON EL RESTO DE LA APP
──────────────────────────────────────

IMPORTANTE: El Login y Registro tienen una paleta visual PROPIA, diferente a las demás pantallas.

LOGIN SCREEN:
  - Fondo: BLANCO #FFFFFF (NO el verde menta que usan las otras pantallas)
  - Título "Zooni": color MARRÓN CÁLIDO #5C3D1E, fontFamily ExtraBold, fontSize: 36px
  - No hay barra de navegación inferior
  - Estilo de inputs: diferente al resto de la app (ver detalle abajo)

REGISTRO (todos los pasos):
  - Fondo: verde menta #C8F0D8 (igual que el resto de la app)
  - Título "Zooni": mismo marrón cálido #5C3D1E, fontSize: 26px
  - Subtítulo "¡Registrate!": Regular, 15px, #6B6B6B, centrado
  - Decoración: plantas/pasto verdes en los bordes izquierdo y derecho de la pantalla
    (mismo asset decorativo que otras pantallas, posición: absolute, sides)
  - Tarjeta blanca: borderRadius 20, shadow suave, contiene el formulario de cada paso

COLORES DEL FLUJO:
  - Título "Zooni":                     #5C3D1E  (marrón cálido — EXCLUSIVO de este flujo)
  - Header de paso "< Completá...":     #2DBD72  (verde teal), Bold
  - Flecha "<" de volver:               #2DBD72  (verde teal), tappable
  - Botón "Ingresar":                   #2DBD72  fondo, #FFFFFF texto
  - Botón "Crear cuenta":               #F5C842  fondo, #2C2C2C texto
  - Botón "Registrarse como Proveedor": #4A4A4A  fondo (gris oscuro), #FFFFFF texto
  - Botón "Continuar":                  #2DBD72  fondo, #FFFFFF texto
  - Tipo de mascota SELECCIONADO:       #2DBD72  fondo, #FFFFFF texto
  - Tipo de mascota NO seleccionado:    #FFFFFF  fondo, #2C2C2C texto, borde #EFEFEF
  - Raza SELECCIONADA (borde):          borde #2DBD72 de 1.5px (el dropdown toma acento verde)
  - Slider thumb y track activo:        #F5C842  (amarillo dorado)
  - Slider track inactivo:              #DDDDDD  (gris claro)
  - Botones foto ("Seleccionar archivo" / "Abrir cámara"): #F5C842 fondo, #2C2C2C texto
  - Input focus:                        borderColor #2DBD72
  - Input error:                        borderColor #E63946
  - Mensaje error inline:               #E63946, 11px Regular
  - Banner "¡Cuenta creada exitosamente!": borde #2DBD72, fondo #F0FFF8, texto #2DBD72, ícono ✓ verde

──────────────────────────────────────
PANTALLA 1 — LOGIN SCREEN
──────────────────────────────────────

Archivo: screens/LoginScreen.jsx
Fondo: #FFFFFF (blanco puro)
ScrollView vertical con contentContainerStyle: { flexGrow: 1, justifyContent: 'center', padding: 24 }

BANNER DE REGISTRO EXITOSO (condicional):
  · Solo se muestra si navigation.route.params?.registroExitoso === true.
  · Se muestra entre la ilustración y el texto "Iniciá sesión".
  · Diseño:
    - backgroundColor: '#F0FFF8', borderWidth: 1.5, borderColor: '#2DBD72', borderRadius: 12
    - paddingVertical: 12, paddingHorizontal: 16
    - flexDirection: 'row', alignItems: 'center', gap: 8
    - Ícono: Ionicons 'checkmark-circle', 20px, #2DBD72
    - Texto: "¡Cuenta creada exitosamente!", Bold, 14px, #2DBD72
    - marginBottom: 20
  · Animación de entrada: opacity 0 → 1 + translateY -8 → 0 en 300ms ease-out.
  · Se oculta automáticamente después de 4 segundos (fade out).
  · Limpiar el param de navegación después de mostrarlo (para que no reaparezca al volver).

TÍTULO "Zooni":
  · fontFamily: ExtraBold (o la más gruesa disponible), fontSize: 36px.
  · color: '#5C3D1E' (marrón cálido).
  · textAlign: 'center'.
  · marginBottom: 4px.

ILUSTRACIÓN DE ANIMALES:
  · Asset local: assets/images/login_illustration.png (grupo de animales cute sobre pasto verde).
  · width: '80%', height: 180, resizeMode: 'contain', alignSelf: 'center'.
  · marginBottom: 24px.

TEXTO "Iniciá sesión":
  · fontFamily: Bold, fontSize: 18px, color: '#2C2C2C', textAlign: 'center'.
  · marginBottom: 16px.

INPUT — CORREO ELECTRÓNICO:
  · placeholder: "Correo electrónico"
  · keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false
  · borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 16, paddingVertical: 14
  · fontSize: 15px, color: '#2C2C2C'
  · backgroundColor: '#FFFFFF'
  · marginBottom: 10
  · Al focus: borderColor '#2DBD72'
  · Al error: borderColor '#E63946'

INPUT — CONTRASEÑA:
  · placeholder: "Contraseña"
  · secureTextEntry: true (con ícono ojo Ionicons 'eye-outline'/'eye-off-outline' para mostrar/ocultar)
  · mismos estilos que el input de correo
  · marginBottom: 16

BOTÓN "Ingresar":
  · backgroundColor: '#2DBD72', borderRadius: 30, height: 52
  · Texto "Ingresar", Bold, 16px, #FFFFFF, centrado
  · shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4
  · Al presionar: escala 0.97 en 100ms
  · Mientras carga: ActivityIndicator blanco
  · Validación antes de llamar al backend:
    - Email: formato válido (regex básico)
    - Contraseña: no vacía
    - Si falta alguno: shake animation en el input vacío + borde rojo + error inline
  · Al éxito: guardar JWT en AsyncStorage + navegar a HomeScreen (resetear el stack de navegación)
  · Al error 401: mostrar mensaje "Email o contraseña incorrectos" en rojo debajo del botón

TEXTO "O registrate gratis":
  · Regular, 14px, '#6B6B6B', textAlign: 'center', marginVertical: 14

BOTÓN "Crear cuenta":
  · backgroundColor: '#F5C842', borderRadius: 30, height: 52
  · Texto "Crear cuenta", Bold, 16px, '#2C2C2C'
  · shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity: 0.10, shadowRadius: 6, elevation: 3
  · Al tocar: navegar a RegisterStep1Screen

SEPARADOR:
  · View de height: 1, backgroundColor: '#EFEFEF', marginVertical: 20

TEXTO "¿Sos proveedor de servicios?":
  · Regular, 13px, '#6B6B6B', textAlign: 'center', marginBottom: 10

BOTÓN "Registrarse como Proveedor":
  · backgroundColor: '#4A4A4A' (gris oscuro/carbón), borderRadius: 30, height: 48
  · Texto "Registrarse como Proveedor", Bold, 14px, '#FFFFFF'
  · Al tocar: Alert.alert('Próximamente', 'El registro de proveedores estará disponible pronto.')

ICONOS DE SOCIAL LOGIN:
  · Fila horizontal centrada con gap de 20px, marginTop: 16.
  · Tres íconos circulares:
    - Google: ícono G de Google (usar @expo/vector-icons o imagen local), fondo blanco, borde #DDDDDD
    - Facebook: ícono F de Facebook, fondo #1877F2, ícono blanco
    - Apple: ícono 🍎 de Apple, fondo #000000, ícono blanco
  · Cada ícono: width: 44, height: 44, borderRadius: 22.
  · Al tocar cualquiera: Alert.alert('Próximamente', 'El inicio de sesión con redes sociales estará disponible pronto.')

──────────────────────────────────────
PANTALLA 2 — REGISTRO PASO 1: MASCOTA
──────────────────────────────────────

Archivo: screens/RegisterStep1Screen.jsx
Fondo: '#C8F0D8' (verde menta)
ScrollView con paddingHorizontal: 20

HEADER DE PANTALLA (sobre el card):
  · "Zooni" — ExtraBold, 26px, '#5C3D1E', textAlign: 'center', marginTop: 16.
  · "¡Registrate!" — Regular, 15px, '#6B6B6B', textAlign: 'center', marginBottom: 20.

CARD BLANCO:
  · backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20
  · shadowColor: '#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:4
  · marginBottom: 20

CABECERA DEL CARD (fila horizontal):
  · TouchableOpacity con "<" (Ionicons 'chevron-back', 22px, '#2DBD72') a la izquierda.
    Al tocar: volver a LoginScreen.
  · Texto "Contanos sobre tu mascota 🐾" — Bold, 15px, '#2DBD72', flex: 1.
  · paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 14.

INPUT — NOMBRE DE TU MASCOTA:
  · placeholder: "Nombre de tu mascota"
  · borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 12
  · fontSize: 15px, color: '#2C2C2C'
  · Al focus: borderColor '#2DBD72'
  · marginBottom: 18
  · Validación: no puede estar vacío al presionar Continuar.

GRID DE TIPOS DE MASCOTA:
  · 2 columnas, wrap, gap: 12px.
  · 8 opciones: Perro, Gato, Conejo, Ave, Reptil, Pez, Hamster, Ratón.
  
  Cada tile de tipo:
    · backgroundColor según estado (ver colores arriba)
    · borderRadius: 14, padding: 14
    · borderWidth: 1, borderColor: '#EFEFEF' (inactivo) o 0 (activo)
    · alignItems: 'center', justifyContent: 'center'
    · shadowColor: '#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:3, elevation:2
    · Contenido:
      - Emoji de la especie (32px, usando una imagen local del asset o el emoji directamente)
        · Perro: 🐕 (o asset local perro_icon.png)
        · Gato: 🐈
        · Conejo: 🐰
        · Ave: 🐦
        · Reptil: 🐢
        · Pez: 🐠
        · Hamster: 🐹
        · Ratón: 🐭
      - Texto: nombre de la especie, Bold, 14px, color según estado.
    · Al presionar: escala 0.95 en 80ms, vuelve en 100ms.
    · Al seleccionar: animación de backgroundColor '#FFFFFF' → '#2DBD72' en 150ms.

  ANIMACIÓN DE SELECCIÓN DEL TILE:
    · El tile previamente activo vuelve a blanco en 150ms.
    · El nuevo tile activo se pinta verde en 150ms.
    · Solo puede haber UN tipo seleccionado al mismo tiempo.

BOTÓN "Continuar" (fijo al fondo):
  · Fuera del card, al fondo de la pantalla.
  · backgroundColor: '#2DBD72', borderRadius: 30, height: 52.
  · Texto "Continuar", Bold, 16px, #FFFFFF.
  · marginHorizontal: 20, marginBottom: 32.
  · shadow suave.
  · Al presionar: validar que nombre no esté vacío Y que se haya seleccionado un tipo.
    - Si falta nombre: borde rojo en el input + error "Ingresá el nombre de tu mascota".
    - Si falta tipo: leve shake del grid.
  · Al pasar validación: navegar a RegisterStep2Screen pasando { nombre, especie }.

──────────────────────────────────────
PANTALLA 3 — REGISTRO PASO 2: DATOS DE LA MASCOTA
──────────────────────────────────────

Archivo: screens/RegisterStep2Screen.jsx
Recibe navigation.route.params: { nombre, especie }
Fondo: '#C8F0D8'
KeyboardAvoidingView + ScrollView

HEADER DE PANTALLA:
  · TouchableOpacity "<" (Ionicons 'chevron-back', 22px, '#2DBD72') — vuelve al Paso 1.
  · Texto "Completá los datos de tu [Especie] 🐾" (especie en mayúscula inicial, dinámico).
  · Bold, 16px, '#2DBD72'.
  · Posición: fila horizontal, paddingHorizontal: 20, marginTop: 16, marginBottom: 16.
  · Sin "Zooni" ni "¡Registrate!" en este paso (el header es simplificado para dar espacio al form).

ILUSTRACIÓN DE "MASCOTA MISTERIOSA":
  · Asset local: assets/images/mascota_sorpresa.png (perro en caja con signo de interrogación).
  · width: 140, height: 140, resizeMode: 'contain', alignSelf: 'center'.
  · marginBottom: 16.
  · Esta ilustración es IGUAL para todas las especies en este paso (es genérica).

CARD BLANCO (contiene todos los campos):
  · backgroundColor: '#FFFFFF', borderRadius: 20
  · paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24
  · marginHorizontal: 16, marginBottom: 24
  · shadowColor: '#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:4

DROPDOWN — SEXO (requerido):
  · Picker o custom dropdown.
  · Opciones: "Macho", "Hembra".
  · placeholder: "Sexo"
  · Estilo contenedor: borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 12.
  · Flecha ▼: Ionicons 'chevron-down', 16px, '#6B6B6B'.
  · Texto del valor seleccionado: 15px, '#2C2C2C'.
  · Si no seleccionado: placeholder gris '#AAAAAA'.
  · Al seleccionar: borde no cambia (solo el texto actualiza).

DROPDOWN — RAZA (requerido):
  · Picker o custom dropdown.
  · Las razas se cargan del backend: GET /api/razas?especie=[especie_key].
    especie_key: 'perro', 'gato', 'conejo', 'ave', 'reptil', 'pez', 'hamster', 'raton'.
  · placeholder: "Seleccioná una opción"
  · Estilo contenedor: mismos estilos que el dropdown de Sexo.
  · IMPORTANTE: cuando el usuario selecciona una raza, el borde del contenedor cambia a
    '#2DBD72' (1.5px), indicando selección activa. Ver Image 5 donde "Labrador Retriever"
    tiene borde verde.
  · marginBottom: 20.
  · Si está cargando las razas del backend: mostrar ActivityIndicator dentro del dropdown.
  · Si el backend devuelve error: Alert y mostrar solo "Sin raza definida" como opción.

LABEL "Peso (kg)":
  · fontFamily: Bold, fontSize: 14px, color: '#2DBD72' (verde teal).
  · textAlign: 'center', marginBottom: 10.

SLIDER — PESO:
  · Componente: @react-native-community/slider (o expo-compatible).
  · Rango: 0 a 100, step: 0.5.
  · thumbTintColor: '#F5C842', minimumTrackTintColor: '#F5C842', maximumTrackTintColor: '#DDDDDD'.
  · Valor actual mostrado debajo centrado: "X,X kg" (formato argentino con coma).
    · Implementar: peso.toLocaleString('es-AR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' kg'.
  · El número de peso: Bold, 16px, '#2C2C2C', textAlign: 'center', marginBottom: 18.

LABEL "Edad":
  · Mismo estilo que el label de Peso.

SLIDER — EDAD:
  · Valor interno: meses (entero, 0 a 240 meses = 0 a 20 años).
  · Rango: 0 a 240, step: 1.
  · thumbTintColor: '#F5C842', mismos colores que el slider de peso.
  · Valor mostrado debajo centrado con lógica dinámica de unidad:
    - Si meses < 12: mostrar "X meses" (exacto, ej: "0 meses", "8 meses").
    - Si meses >= 12: convertir a años con 1 decimal: (meses / 12).toFixed(1) + " años" (ej: "4.3 años").
  · El número: Bold, 16px, '#2C2C2C', textAlign: 'center', marginBottom: 20.

SECCIÓN FOTO (opcional):
  · Label: "📷 Agregá una foto de tu mascota"
    · Regular, 14px, '#2C2C2C', marginBottom: 10.
  
  Si NO hay imagen seleccionada: solo el botón "Seleccionar archivo".
  Si SÍ hay imagen seleccionada: mostrar miniatura de la imagen + ambos botones.
  
  En todo momento (según el diseño final de la imagen 5), mostrar AMBOS botones:

  BOTÓN "Seleccionar archivo":
    · backgroundColor: '#F5C842', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20.
    · Texto "Seleccionar archivo", Bold, 14px, '#2C2C2C'.
    · Al tocar: expo-image-picker con MediaTypeOptions.Images, galería.
    · marginBottom: 10.

  BOTÓN "📷 Abrir cámara":
    · backgroundColor: '#F5C842', mismo estilo que el anterior.
    · Texto "📷 Abrir cámara", Bold, 14px, '#2C2C2C'.
    · Al tocar: expo-image-picker con cámara.

  PREVIEW DE IMAGEN (si hay imagen seleccionada):
    · Mostrar encima de los botones: Image con uri, 80x80, borderRadius: 10, marginBottom: 10.
    · Con un pequeño "✕" para quitar la imagen seleccionada.

BOTÓN "Continuar":
  · Mismo estilo que en Paso 1, fuera del card.
  · Validaciones:
    - sexo seleccionado (requerido).
    - raza seleccionada (requerido).
    - peso > 0 (si el slider está en 0, mostrar error "Ajustá el peso").
  · Al pasar: navegar a RegisterStep3Screen pasando { ...params_paso1, sexo, raza, pesoKg: peso, edadMeses: edad, fotoUri }.

──────────────────────────────────────
PANTALLA 4 — REGISTRO PASO 3: DATOS PERSONALES
──────────────────────────────────────

Archivo: screens/RegisterStep3Screen.jsx
Recibe navigation.route.params: { nombre (mascota), especie, sexo, raza, pesoKg, edadMeses, fotoUri }
Fondo: '#C8F0D8'
KeyboardAvoidingView + ScrollView

HEADER DE PANTALLA:
  · "Zooni" — ExtraBold, 26px, '#5C3D1E', centrado.
  · "¡Registrate!" — Regular, 15px, '#6B6B6B', centrado.
  · marginTop: 16, marginBottom: 16.

CARD BLANCO:
  · Mismo estilo que en Paso 2.
  · paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24.

CABECERA DEL CARD:
  · Fila horizontal: TouchableOpacity "<" (volver al Paso 2) + nombre de la mascota centrado.
  · Nombre: Bold, 18px, '#2C2C2C', centrado, marginBottom: 16.

ILUSTRACIÓN DE LA MASCOTA:
  · Usa PET_IMAGES[especie + '_default'] o la imagen según la especie seleccionada.
    Mapping sugerido para el paso 3:
      'perro' → PET_IMAGES['perro_default'] (perro sentado dorado)
      'gato'  → PET_IMAGES['gato_default']
      etc.
  · width: 120, height: 120, resizeMode: 'contain', alignSelf: 'center'.
  · Círculo decorativo detrás: 140x140, borderRadius: 70, backgroundColor: '#A8E6C0', opacity: 0.35, absolute.
  · marginBottom: 16.

SUBTÍTULO "¡Ahora ingresá tus datos!":
  · Bold, 16px, '#2C2C2C', textAlign: 'center', marginBottom: 20.

CAMPO 1 — NOMBRE (requerido):
  · placeholder: "Nombre"
  · borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10
  · paddingHorizontal: 14, paddingVertical: 13
  · fontSize: 15px, color: '#2C2C2C'
  · Al focus: borderColor '#2DBD72'
  · marginBottom: 10

CAMPO 2 — APELLIDO (requerido):
  · placeholder: "Apellido", mismos estilos. marginBottom: 10.

CAMPO 3 — MAIL (requerido):
  · placeholder: "Mail"
  · keyboardType: 'email-address', autoCapitalize: 'none'
  · mismos estilos. marginBottom: 10.
  · Validación: formato email válido.

CAMPO 4 — CONTRASEÑA (requerido, mínimo 6 caracteres):
  · placeholder: "Contraseña"
  · secureTextEntry: true con toggle de ojo (Ionicons 'eye-outline'/'eye-off-outline', 20px, '#6B6B6B').
  · mismos estilos. marginBottom: 10.
  · Validación: longitud >= 6. Error inline si < 6: "La contraseña debe tener al menos 6 caracteres".
  · CRÍTICO: el botón "Continuar" NO puede habilitarse si la contraseña tiene menos de 6 dígitos.
    Implementar esto como computed: `const puedeAvanzar = password.length >= 6 && confirmPassword === password && ...`

CAMPO 5 — CONFIRMAR CONTRASEÑA (requerido):
  · placeholder: "Confirmar contraseña"
  · secureTextEntry: true (sin toggle de ojo en este campo).
  · mismos estilos. marginBottom: 10.
  · Validación: debe coincidir exactamente con el campo de contraseña.
  · Si no coincide: borde rojo + error "Las contraseñas no coinciden".

BOTÓN "Continuar":
  · Mismo estilo. Fuera del card.
  · Validaciones (TODAS deben pasar):
    - Nombre no vacío.
    - Apellido no vacío.
    - Email válido (regex).
    - Contraseña >= 6 caracteres.
    - Confirmar contraseña === contraseña.
  · Al pasar: navegar a RegisterStep4Screen con todos los datos acumulados.

──────────────────────────────────────
PANTALLA 5 — REGISTRO PASO 4: UBICACIÓN
──────────────────────────────────────

Archivo: screens/RegisterStep4Screen.jsx
Recibe todos los params acumulados de los pasos anteriores.
Fondo: '#C8F0D8'
KeyboardAvoidingView + ScrollView

HEADER DE PANTALLA: igual que Paso 3 ("Zooni" + "¡Registrate!").

CARD BLANCO: mismo estilo.

CABECERA DEL CARD:
  · Fila: "<" (volver al Paso 3) + nombre de la mascota centrado.
  · Mismo estilo que Paso 3.

ILUSTRACIÓN: misma que Paso 3 (PET_IMAGES según especie).

SUBTÍTULO "¡Ya falta poco!":
  · Bold, 16px, '#2C2C2C', textAlign: 'center', marginBottom: 20.

CAMPO 1 — PAÍS (requerido):
  · Implementar con react-native-country-picker-modal o similar.
  · Muestra: bandera del país (emoji) + código ISO + nombre del país.
    Ej: "🇦🇷 AR Argentina" (como en Image 8).
  · Al seleccionar país: auto-completar el campo de CÓDIGO TELEFÓNICO (callingCode).
  · Estilo contenedor: borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13.
  · Si país seleccionado: borde '#2DBD72' y texto '#2C2C2C'.
  · marginBottom: 10.

CAMPO 2 — PROVINCIA (opcional):
  · TextInput, placeholder: "Provincia".
  · mismos estilos, marginBottom: 10.

CAMPO 3 — CIUDAD / BARRIO (opcional):
  · TextInput, placeholder: "Ciudad / Barrio".
  · mismos estilos, marginBottom: 10.

CAMPO 4 — CÓDIGO (auto-completado + editable):
  · TextInput, placeholder: "Código".
  · Se auto-completa con el callingCode del país seleccionado (ej: "+54").
  · keyboardType: 'phone-pad'.
  · Si auto-completado: texto '#2DBD72' Bold indicando que fue llenado automáticamente.
    Al tocar: el usuario puede editarlo manualmente.
  · mismos estilos, marginBottom: 10.

CAMPO 5 — TELÉFONO (opcional):
  · TextInput, placeholder: "Teléfono".
  · keyboardType: 'phone-pad'.
  · mismos estilos, marginBottom: 10.

BOTÓN "Continuar" (acción final — llama al backend):
  · Mismo estilo visual que en otros pasos.
  · Validación: país seleccionado (requerido).
  · Al presionar: mostrar ActivityIndicator en el botón y llamar a POST /api/auth/registro.
  · AL ÉXITO:
    - Navegar a LoginScreen con params { registroExitoso: true }.
    - Resetear el stack de navegación para que el back button no vuelva al registro.
  · AL ERROR:
    - Alert.alert con el mensaje de error del backend.
    - El botón vuelve a "Continuar" (sin spinner).
  · Los campos opcionales se envían como null si están vacíos.

──────────────────────────────────────
LÓGICA FRONTEND — DETALLE ADICIONAL
──────────────────────────────────────

MANEJO DE LA SESIÓN AL INICIAR LA APP:
  · En App.jsx (o en el Navigator), al montar verificar si hay un 'userToken' en AsyncStorage.
  · Si existe: navegar directamente a HomeScreen (saltar el Login).
  · Si no existe: mostrar LoginScreen.
  · Si el token existe pero el backend responde 401 en cualquier request: 
    limpiar el token y redirigir a Login.

LIMPIEZA DEL ESTADO DE REGISTRO:
  · Al completar el registro exitosamente, no queda ningún estado pendiente en memoria.
  · La navegación resetea el stack: navigation.reset({ index: 0, routes: [{ name: 'Login', params: { registroExitoso: true } }] }).

KEYBOARD AVOIDING:
  · Todos los pasos de registro (y el Login) deben manejar el teclado correctamente.
  · Usar KeyboardAvoidingView con behavior: Platform.OS === 'ios' ? 'padding' : 'height'.
  · El ScrollView debe tener keyboardShouldPersistTaps: 'handled'.

──────────────────────────────────────
BACKEND — MODELOS DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: razas
(Catálogo de razas por especie. Cargadas en la base de datos por el equipo de Zooni.)

CREATE TABLE razas (
  id        SERIAL PRIMARY KEY,
  especie   VARCHAR(50) NOT NULL,    -- 'perro', 'gato', 'conejo', 'ave', 'reptil', 'pez', 'hamster', 'raton'
  nombre    VARCHAR(100) NOT NULL,
  activo    BOOLEAN DEFAULT TRUE,
  orden     INTEGER DEFAULT 0
);
CREATE INDEX idx_razas_especie ON razas(especie);

-- Datos de ejemplo — PERROS (todas las razas principales, el equipo amplía según necesidad):
INSERT INTO razas (especie, nombre, orden) VALUES
  ('perro', 'Labrador Retriever', 1),
  ('perro', 'Golden Retriever', 2),
  ('perro', 'Bulldog Francés', 3),
  ('perro', 'Poodle', 4),
  ('perro', 'Beagle', 5),
  ('perro', 'Pastor Alemán', 6),
  ('perro', 'Husky Siberiano', 7),
  ('perro', 'Yorkshire Terrier', 8),
  ('perro', 'Chihuahua', 9),
  ('perro', 'Dálmata', 10),
  ('perro', 'Rottweiler', 11),
  ('perro', 'Doberman', 12),
  ('perro', 'Boxer', 13),
  ('perro', 'Shih Tzu', 14),
  ('perro', 'Pomerania', 15),
  ('perro', 'Border Collie', 16),
  ('perro', 'Cocker Spaniel', 17),
  ('perro', 'Dachshund (Salchicha)', 18),
  ('perro', 'Schnauzer', 19),
  ('perro', 'Pitbull', 20),
  ('perro', 'Mestizo / Sin raza definida', 99);

-- Datos de ejemplo — GATOS:
INSERT INTO razas (especie, nombre, orden) VALUES
  ('gato', 'Doméstico común', 1),
  ('gato', 'Siamés', 2),
  ('gato', 'Persa', 3),
  ('gato', 'Maine Coon', 4),
  ('gato', 'Bengalí', 5),
  ('gato', 'Ragdoll', 6),
  ('gato', 'Mestizo / Sin raza definida', 99);

-- Para las demás especies (conejo, ave, reptil, pez, hamster, raton), cargar sus variedades principales.
-- El equipo puede agregar más razas directamente en la DB sin necesidad de deploy.

TABLA: usuarios (ya existe — verificar que tenga estos campos):
  id, nombre, apellido, nombre_usuario (generado auto del email), email, password_hash,
  bio, ubicacion, foto_perfil_url, pais, provincia, ciudad, codigo_telefono, telefono,
  creado_en, actualizado_en.

TABLA: mascotas (ya existe — verificar campos):
  id, usuario_id, nombre, especie, sexo, raza_id (FK razas.id), peso, fecha_nacimiento
  (calculada desde edadMeses al registrarse), imagen_asset, foto_url, creado_en.

──────────────────────────────────────
BACKEND — API ENDPOINTS
──────────────────────────────────────

──────────────────────
1. GET /api/razas
──────────────────────
Devuelve la lista de razas para una especie. Público (no requiere token).

Query params: ?especie=perro

Lógica:
SELECT id, nombre FROM razas WHERE especie = $1 AND activo = TRUE ORDER BY orden ASC.

Response (200):
{
  "razas": [
    { "id": 1, "nombre": "Labrador Retriever" },
    { "id": 2, "nombre": "Golden Retriever" }
  ]
}

──────────────────────
2. POST /api/auth/registro
──────────────────────
Registra un nuevo usuario junto con su primera mascota. Transacción atómica.
Público (no requiere token).

Body:
{
  "mascota": {
    "nombre": "Titán",
    "especie": "perro",
    "sexo": "Macho",
    "razaId": 1,
    "pesoKg": 20.4,
    "edadMeses": 52,
    "fotoBase64": "data:image/jpeg;base64,..." // opcional
  },
  "usuario": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@email.com",
    "password": "mipassword123",
    "pais": "Argentina",
    "paisCodigo": "AR",
    "provincia": "Ciudad Autónoma de Buenos Aires",
    "ciudad": "Villa Crespo",
    "codigoTelefono": "+54",
    "telefono": "12345678"
  }
}

Lógica (TODA dentro de una transacción de PostgreSQL):
a) Verificar que el email no esté ya registrado.
   Si está: 409 { "error": "Ya existe una cuenta con ese email" }.
b) Hashear la contraseña con bcrypt (saltRounds: 10).
c) Calcular fecha_nacimiento de la mascota: 
   new Date() - edadMeses meses (restar la cantidad de meses a la fecha actual).
d) Si fotoBase64 existe: subir al storage y obtener la URL.
e) Determinar imagen_asset de la mascota según especie:
   { 'perro': 'perro_default', 'gato': 'gato_default', ... } (el avatar que el equipo asignó).
f) INSERT usuario en tabla usuarios.
g) INSERT mascota en tabla mascotas con usuario_id del INSERT anterior.
h) Si todo sale bien: COMMIT.
i) Generar JWT con payload { id: usuario.id, email: usuario.email }.
   El token tiene expiración de 30 días.

Response (201):
{
  "mensaje": "Cuenta creada exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@email.com"
  }
}

IMPORTANTE: aunque el registro devuelve un token, el FRONTEND NO lo guarda automáticamente.
En cambio, redirige al Login con `registroExitoso: true` para que el usuario ingrese manualmente
(mejor UX para que el usuario vea la confirmación y luego haga login conscientemente).

Errores:
- 409: { "error": "Ya existe una cuenta con ese email" }
- 400: { "error": "La contraseña debe tener al menos 6 caracteres" }
- 400: { "error": "Campos requeridos faltantes: [lista]" }
- 500: { "error": "Error al crear la cuenta. Intentá de nuevo." }

──────────────────────
3. POST /api/auth/login
──────────────────────
Autentica un usuario existente. Público.

Body:
{
  "email": "juan@email.com",
  "password": "mipassword123"
}

Lógica:
a) SELECT * FROM usuarios WHERE email = $1.
b) Si no existe: 401.
c) Comparar password con hash: bcrypt.compare(password, usuario.password_hash).
d) Si no coincide: 401.
e) Generar JWT con payload { id, email }, expiración 30 días.
f) Devolver token + datos básicos del usuario + su mascota activa.

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@email.com",
    "foto_perfil_url": null
  },
  "mascota_activa": {
    "id": 1,
    "nombre": "Titán",
    "especie": "perro",
    "raza": "Labrador Retriever",
    "imagen_asset": "perro_default"
  }
}

Errores:
- 401: { "error": "Email o contraseña incorrectos" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/LoginScreen.jsx
- screens/RegisterStep1Screen.jsx
- screens/RegisterStep2Screen.jsx
- screens/RegisterStep3Screen.jsx
- screens/RegisterStep4Screen.jsx
- navigation/AuthNavigator.jsx         ← Stack Navigator para el flujo de login/registro
- navigation/AppNavigator.jsx          ← Navigator principal que decide entre Auth y App
- assets/images/login_illustration.png ← ilustración del grupo de animales (debe existir)
- assets/images/mascota_sorpresa.png   ← ilustración del perro en caja (debe existir)

Backend:
- routes/auth.js                       ← rutas de login y registro
- routes/razas.js                      ← ruta pública para listar razas
- controllers/authController.js
- controllers/razasController.js
- middleware/verifyToken.js             ← ya existe
- migrations/008_create_razas.sql      ← CREATE TABLE razas + seeds iniciales

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                        | Comportamiento                                                       |
|--------------------------------------------------|----------------------------------------------------------------------|
| Email ya registrado                              | Error 409 → Alert "Ya existe una cuenta con ese email"               |
| Contraseña < 6 caracteres                        | Botón Continuar deshabilitado + error inline                         |
| Contraseñas no coinciden                         | Borde rojo + "Las contraseñas no coinciden" inline                   |
| Email con formato inválido                       | Error inline antes de llamar al backend                              |
| Nombre de mascota vacío al continuar             | Borde rojo + "Ingresá el nombre de tu mascota"                       |
| Ningún tipo de mascota seleccionado              | Leve vibración/shake del grid + no avanza                            |
| Razas no cargan (error de red en Paso 2)         | Alert + opción de reintentar + campo de raza deshabilitado           |
| Foto de mascota muy pesada                       | Comprimir con expo-image-manipulator a max 1.5MB antes de enviar     |
| Sin permiso de cámara                            | Alert explicando cómo habilitarla en configuración del dispositivo   |
| Sin permiso de galería                           | Igual que cámara                                                     |
| Red caída al registrar                           | Alert "Sin conexión. Revisá tu internet y volvé a intentarlo."       |
| Error 500 del servidor                           | Alert "Error del servidor. Intentá de nuevo más tarde."              |
| Usuario presiona back en Paso 4                  | Vuelve al Paso 3 SIN perder los datos ya ingresados                  |
| Token expirado al entrar a la app                | Limpiar AsyncStorage + mostrar LoginScreen                           |
| Login con espacios en el email                   | trim() del email antes de enviar al backend                          |
| Slider de edad queda en 0                        | Se permite (algunos animales son recién nacidos), sin error          |
| País no seleccionado al intentar continuar       | Error "Seleccioná tu país" + no avanza                               |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo ni placeholders vacíos.
- CRÍTICO: la contraseña en el registro NO puede tener menos de 6 dígitos. Validar tanto
  en el frontend (botón deshabilitado) como en el backend (error 400).
- El registro es una transacción atómica: si falla cualquier paso (usuario O mascota),
  no debe quedar ningún registro huérfano en la base de datos (usar BEGIN/COMMIT/ROLLBACK).
- Las razas ESTÁN EN LA BASE DE DATOS. No están hardcodeadas en el frontend. El Paso 2
  siempre debe hacer un GET /api/razas?especie=[especie] antes de mostrar el dropdown.
- El flujo de navegación debe resetear el stack después del registro exitoso para evitar
  que el usuario vuelva al formulario con el botón físico de "Atrás".
- El "Zooni" en login/registro usa el color marrón '#5C3D1E', diferente al '#2C2C2C' del
  resto de la app. Esto es intencional y diferencia visualmente este flujo de entrada.
- El login tiene fondo BLANCO, no verde menta. Solo los pasos de registro tienen fondo verde.
- Los modales sociales (Google, Facebook, Apple) son PLACEHOLDERS que muestran un Alert
  "Próximamente". No implementar OAuth en este prompt.
- El botón "Registrarse como Proveedor" también es un PLACEHOLDER con Alert.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
- Respetar estrictamente la paleta de colores definida en este documento para cada pantalla.
- Manejar todos los estados de carga con ActivityIndicator y todos los errores con Alert
  o mensajes inline según corresponda.
