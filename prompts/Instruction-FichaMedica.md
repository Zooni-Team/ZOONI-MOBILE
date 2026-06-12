=== ZOONI — PANTALLA: FICHA MÉDICA ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Ficha Médica" completa de la app mobile Zooni, incluyendo frontend, backend y generación de PDF. A continuación se detalla absolutamente todo lo que necesitás implementar.

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: Sequelize (o Prisma si preferís, elegí uno y mantené consistencia)
- Autenticación: JWT (jsonwebtoken). El token se genera al login y se envía en cada request como Bearer token en el header Authorization.
- Imágenes de mascotas: assets locales dentro de la app (require('../assets/mascotas/perro.png'), etc.). No hay storage externo. La base de datos guarda solo el nombre del asset (ej: "perro_labrador"), y el frontend resuelve qué imagen mostrar con un map de assets locales.

──────────────────────────────────────
IDENTIDAD VISUAL (respetar estrictamente)
──────────────────────────────────────
Paleta de colores:
- Fondo principal: #C8F0D8 (verde menta suave)
- Fondo cards/contenedores: #FFFFFF
- Botón primario CTA: #F5C842 (amarillo dorado)
- Botón acción verde (PDF, confirmación): #2DBD72
- Texto principal: #2C2C2C
- Texto secundario/subtítulos: #6B6B6B
- Íconos activos: #2DBD72
- Íconos edit/lápiz: #F5A623 (naranja/ámbar)

Tipografía:
- Fuente: Nunito o Poppins (importar con @expo-google-fonts)
- Títulos/nombres: Bold o ExtraBold, 22–24px
- Labels de datos: Regular, 14–15px, color #6B6B6B
- Valores de datos: Medium/SemiBold, 14–15px, color #2C2C2C
- Texto de botones: Bold, 15–16px

Botones:
- borderRadius: 30 (pill shape)
- height: 52–58
- shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4
- Texto centrado en bold

Cards/contenedores de datos:
- backgroundColor: '#FFFFFF'
- borderRadius: 16
- shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3
- padding: 14px 18px
- marginBottom: 10

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

La pantalla usa ScrollView vertical con backgroundColor: '#C8F0D8'.
No tiene bottom tab bar. Es una subpantalla navegada desde Home.

SECCIÓN 1 — ENCABEZADO CON MASCOTA
---
- Nombre de la mascota centrado, fuente Bold, 24px, color #2C2C2C. (ej: "Titán")
- Debajo, centrada, la imagen de la mascota. Es un asset local resuelto desde un objeto:
  const PET_IMAGES = {
    perro_labrador: require('../assets/mascotas/perro_labrador.png'),
    perro_default: require('../assets/mascotas/perro_default.png'),
    gato_default: require('../assets/mascotas/gato_default.png'),
    // etc.
  };
  Se muestra con: <Image source={PET_IMAGES[mascota.imagenAsset] ?? PET_IMAGES['perro_default']} style={{ width: 130, height: 130 }} resizeMode="contain" />
- Detrás de la imagen, un View circular con backgroundColor: '#A8E6C0', opacity: 0.4, width: 150, height: 150, borderRadius: 75, position: 'absolute', como fondo decorativo.
- Debajo de la imagen arranca un View con backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, que cubre el resto de la pantalla con padding 20.

SECCIÓN 2 — DATOS DE LA MASCOTA
---
Cada dato se muestra en una card individual con los estilos definidos arriba.

CARD 1 — Especie:
- Ícono de pata a la izquierda (usar emoji 🐾 o un ícono SVG flat), color #2DBD72, 20px
- Label "Especie:" color #6B6B6B, 14px, a la izquierda
- Valor (ej: "perro") color #2C2C2C, 14px Medium, a la derecha
- Sin botón de edición (campo fijo)

CARD 2 — Raza:
- Ícono de tag/lista flat a la izquierda, color #2DBD72
- Label "Raza:" a la izquierda
- Valor (ej: "Labrador Retriever") a la derecha
- Sin botón de edición (campo fijo)

CARD 3 — Peso:
- Ícono de balanza flat a la izquierda, color #2DBD72
- Texto "Peso: 20,40 kg" (usar toLocaleString('es-AR') para el formato con coma)
- A la derecha: ícono lápiz (✏️ o SVG), color #F5A623, 18px, TouchableOpacity
- Al tocar el lápiz: editandoPeso = true → reemplaza el texto del valor por un TextInput inline con keyboardType="decimal-pad", y aparecen dos botones chicos: ✓ verde para confirmar y ✕ gris para cancelar. Al confirmar llama al endpoint PATCH /mascotas/:petId/peso.

CARD 4 — Edad:
- Ícono de corona/cake flat a la izquierda, color #2DBD72
- Texto "Edad: X años y Y meses" (calculado en tiempo real con la función calcularEdad)
- A la derecha: ícono lápiz color #F5A623, TouchableOpacity
- Al tocar: muestra DateTimePicker modal (usar @react-native-community/datetimepicker) para cambiar la fecha de nacimiento. Al confirmar llama al endpoint PATCH /mascotas/:petId/fecha-nacimiento. La edad se recalcula automáticamente.

SECCIÓN 3 — BOTONES DE NAVEGACIÓN
---
4 cards navegables, cada una con:
- backgroundColor: '#FFFFFF', borderRadius: 16, height: 54, paddingHorizontal: 18
- shadow suave, marginBottom: 10
- Ícono a la izquierda (20px), texto en bold 15px color #2C2C2C, flecha "›" a la derecha color #AAAAAA

Los 4 ítems:

1. Virtual Vet
   - Ícono: estetoscopio o robot flat, color #2DBD72
   - onPress → navegar a VirtualVetScreen (placeholder "Próximamente")

2. Vacunas
   - Ícono: jeringa flat, color #2DBD72
   - onPress → navegar a VacunasScreen, pasar { petId }

3. Tratamientos
   - Ícono: pastilla o botiquín flat, color #E63946 (rojo/coral para diferenciarlo)
   - onPress → navegar a TratamientosScreen, pasar { petId }

4. Consejos y curiosidades
   - Ícono: bombilla flat, color #F5C842
   - onPress → navegar a ConsejosScreen, pasar { petId }

SECCIÓN 4 — BOTÓN DESCARGAR PDF
---
- Pill button, borderRadius: 30
- width: '65%', alignSelf: 'center'
- height: 48 (más chico que los botones primarios de 56)
- backgroundColor: '#2DBD72'
- color texto: '#FFFFFF', Bold, 15px
- Ícono de archivo/documento a la izquierda, blanco, 18px
- Texto: "Descargar PDF"
- shadow suave
- marginTop: 20, marginBottom: 30
- onPress → llama a generarPDF()
- Mientras carga: muestra ActivityIndicator blanco en lugar del ícono

──────────────────────────────────────
BACKEND — MODELO DE DATOS EN POSTGRESQL
──────────────────────────────────────

Tabla: mascotas
CREATE TABLE mascotas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,
  especie     VARCHAR(50) NOT NULL,
  raza        VARCHAR(100),
  peso        DECIMAL(5,2),
  fecha_nacimiento DATE NOT NULL,
  imagen_asset VARCHAR(100) DEFAULT 'perro_default',
  creado_en   TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

Tabla: vacunas (subentidad, para el PDF)
CREATE TABLE vacunas (
  id              SERIAL PRIMARY KEY,
  mascota_id      INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  nombre          VARCHAR(100) NOT NULL,
  fecha_aplicacion DATE,
  proximo_refuerzo DATE,
  creado_en       TIMESTAMP DEFAULT NOW()
);

Tabla: tratamientos (subentidad, para el PDF)
CREATE TABLE tratamientos (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,
  dosis       VARCHAR(100),
  frecuencia  VARCHAR(100),
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT NOW()
);

──────────────────────────────────────
BACKEND — API ENDPOINTS (Node.js + Express)
──────────────────────────────────────

BASE URL: /api/mascotas

Middleware de autenticación (middleware/verifyToken.js):
- Extrae el Bearer token del header Authorization
- Verifica con jsonwebtoken usando JWT_SECRET del .env
- Si es válido, adjunta req.usuario = { id, email } y llama a next()
- Si es inválido o expirado: res.status(401).json({ error: 'Token inválido o expirado' })

1. GET /api/mascotas/:petId
   - Verifica token con middleware verifyToken
   - Query: SELECT * FROM mascotas WHERE id = $1 AND usuario_id = $2
   - Si no existe: 404. Si usuario_id no coincide: 403.
   - Retorna: { success: true, data: { ...mascota } }

2. PATCH /api/mascotas/:petId/peso
   - Body: { peso: number }
   - Validar: peso debe ser número > 0 y < 500
   - Query: UPDATE mascotas SET peso = $1, actualizado_en = NOW() WHERE id = $2 AND usuario_id = $3 RETURNING *
   - Retorna: { success: true, data: { peso, actualizado_en } }

3. PATCH /api/mascotas/:petId/fecha-nacimiento
   - Body: { fechaNacimiento: "YYYY-MM-DD" }
   - Validar: que la fecha no sea futura, que no sea más de 30 años atrás
   - Query: UPDATE mascotas SET fecha_nacimiento = $1, actualizado_en = NOW() WHERE id = $2 AND usuario_id = $3 RETURNING *
   - Retorna: { success: true, data: { fecha_nacimiento } }

4. GET /api/mascotas/:petId/pdf
   - Obtiene datos de la mascota, sus vacunas y tratamientos activos con 3 queries:
     · SELECT * FROM mascotas WHERE id = $1 AND usuario_id = $2
     · SELECT * FROM vacunas WHERE mascota_id = $1 ORDER BY fecha_aplicacion DESC
     · SELECT * FROM tratamientos WHERE mascota_id = $1 AND activo = TRUE
   - Genera el PDF con pdfmake (ver sección PDF)
   - res.setHeader('Content-Type', 'application/pdf')
   - res.setHeader('Content-Disposition', 'attachment; filename=ficha-medica-zooni.pdf')
   - Envía el buffer del PDF

──────────────────────────────────────
FRONTEND — LÓGICA Y ESTADO
──────────────────────────────────────

Archivo: screens/FichaMedicaScreen.jsx

Props de navegación: route.params.petId

Estado local (useState):
- mascota: null | objeto con datos de la mascota
- loading: boolean
- editandoPeso: boolean
- pesoBorrador: string
- editandoFecha: boolean
- generandoPdf: boolean

useEffect al montar:
- Obtener el JWT del AsyncStorage (clave 'userToken')
- Llamar a GET /api/mascotas/:petId con Authorization: Bearer <token>
- Guardar resultado en mascota
- Manejar errores con Alert.alert()

Función calcularEdad(fechaNacimiento: string): string
- Recibe string "YYYY-MM-DD"
- Calcula diferencia con new Date()
- Retorna: "4 años y 4 meses" | "8 meses" (si < 1 año) | "1 año y 0 meses"

Función generarPDF():
- generandoPdf = true
- Llamar a GET /api/mascotas/:petId/pdf con el token
- Recibir la respuesta como blob
- Usar expo-file-system para guardar en FileSystem.documentDirectory + 'ficha-medica.pdf'
- Usar expo-sharing para abrir el diálogo de compartir/guardar
- generandoPdf = false al terminar
- Manejar errores con Alert

──────────────────────────────────────
GENERACIÓN DE PDF (Backend — services/pdfService.js)
──────────────────────────────────────

Librería: pdfmake
Instalar: npm install pdfmake

El PDF es formal y limpio. Usa blanco, grises y #2DBD72 como único acento de color.
Tamaño: A4. Márgenes: [40, 60, 40, 60].

ESTRUCTURA DEL PDF:

1. ENCABEZADO:
   - Tabla de 2 columnas sin bordes:
     · Izquierda: texto "Zooni" en 24pt, bold, color #2DBD72 + debajo "Ficha Médica de Mascota" en 11pt, color #888888
     · Derecha (alineado a la derecha): "Generado el DD/MM/YYYY" en 9pt, color #888888
   - Línea separadora: canvas con línea horizontal color #2DBD72, ancho 1pt, debajo del encabezado

2. TÍTULO DE SECCIÓN — DATOS DE LA MASCOTA:
   - Texto "DATOS DE LA MASCOTA", 13pt, bold, color #444444, marginTop: 20

3. TABLA DE DATOS (pdfmake table):
   - 2 columnas: widths: ['35%', '65%']
   - Filas: Nombre | Especie | Raza | Peso | Edad | Fecha de nacimiento
   - Celdas izquierda (label): fontSize 10, color #888888, fillColor alternado: '#F5F5F5' y '#FFFFFF'
   - Celdas derecha (valor): fontSize 11, color #2C2C2C
   - Sin bordes exteriores, solo línea inferior en cada fila color #E0E0E0, 0.5pt
   - El peso se formatea como "20,40 kg" (reemplazar punto por coma)
   - La edad se calcula con la misma lógica de calcularEdad (reimplementar en Node.js)

4. SECCIÓN VACUNAS:
   - Título "VACUNAS REGISTRADAS", mismo estilo que sección anterior, marginTop: 24
   - Si hay vacunas: tabla con columnas Vacuna | Fecha aplicación | Próximo refuerzo
     · Fila de headers: fillColor '#2DBD72', color '#FFFFFF', bold, 10pt
     · Filas de datos: fontSize 10, color #2C2C2C, filas alternadas '#FFFFFF' / '#F9FFF9'
   - Si no hay vacunas: texto "Sin vacunas registradas aún.", fontSize 10, color #888888, italics: true

5. SECCIÓN TRATAMIENTOS:
   - Título "TRATAMIENTOS ACTIVOS", mismo estilo
   - Si hay tratamientos: tabla con columnas Tratamiento | Dosis | Frecuencia
     · Mismo estilo de tabla que vacunas
   - Si no hay: texto "Sin tratamientos activos.", fontSize 10, color #888888, italics: true

6. PIE DE PÁGINA (footer function de pdfmake):
   - Izquierda: "Este documento fue generado automáticamente por Zooni. Para consultas médicas, contactá a tu veterinario de confianza." fontSize 8, color #AAAAAA
   - Derecha: "Página X de Y" fontSize 8, color #AAAAAA, alineado a la derecha

──────────────────────────────────────
PANTALLAS PLACEHOLDER A CREAR
──────────────────────────────────────

Crear los siguientes archivos con fondo #C8F0D8, texto centrado y el header básico de Zooni:

- screens/VacunasScreen.jsx → recibe route.params.petId (se desarrollará luego)
- screens/TratamientosScreen.jsx → recibe route.params.petId (se desarrollará luego)
- screens/ConsejosScreen.jsx → recibe route.params.petId (se desarrollará luego)
- screens/VirtualVetScreen.jsx → muestra "Próximamente 🐾" centrado

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/FichaMedicaScreen.jsx
- utils/calcularEdad.js
- utils/api.js (funciones fetch reutilizables con JWT)
- constants/petImages.js (mapa de nombre de asset → require())
- screens/VacunasScreen.jsx (placeholder)
- screens/TratamientosScreen.jsx (placeholder)
- screens/ConsejosScreen.jsx (placeholder)
- screens/VirtualVetScreen.jsx (placeholder)

Backend:
- routes/mascotas.js
- controllers/mascotasController.js
- middleware/verifyToken.js
- services/pdfService.js
- db/pool.js (configuración de conexión a PostgreSQL con pg: host, port, database, user, password desde .env)
- migrations/001_create_mascotas.sql (CREATE TABLE mascotas, vacunas, tratamientos)

──────────────────────────────────────
VARIABLES DE ENTORNO (.env del backend)
──────────────────────────────────────

DB_HOST=localhost
DB_PORT=5432
DB_NAME=zooni
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=tu_secreto_jwt

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo.
- Separar siempre lógica de UI de lógica de negocio.
- Todos los textos en español (Argentina): coma decimal para peso, fechas en DD/MM/YYYY.
- Manejar todos los estados de carga y error con ActivityIndicator y Alert.
- No usar librerías incompatibles con Expo managed workflow sin eject.
- Para las queries SQL usar el módulo 'pg' (node-postgres) con pool de conexiones.
- Entregá todos los archivos completos, uno por uno.