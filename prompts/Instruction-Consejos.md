=== ZOONI — PANTALLA: CONSEJOS Y CURIOSIDADES ===

Sos un desarrollador full-stack experto en React Native + Node.js/Express + PostgreSQL. Vas a programar la pantalla "Consejos y Curiosidades" completa de la app mobile Zooni, incluyendo frontend y backend. La pantalla se navega desde FichaMedicaScreen pasando el `petId` como parámetro de ruta.

OBJETIVO PRINCIPAL DE ESTE PROMPT: Esta pantalla es una pantalla de SOLO LECTURA. El usuario NO puede agregar, editar ni eliminar consejos. El contenido es administrado por el equipo de Zooni. El foco del desarrollo está en mostrar los consejos de forma visualmente atractiva y clara. No repetir el estilo plano anterior (card genérico con fondo amarillo y texto sin jerarquía).

──────────────────────────────────────
STACK TECNOLÓGICO
──────────────────────────────────────
- Frontend: React Native con Expo
- Backend: Node.js + Express (REST API)
- Base de datos: PostgreSQL
- ORM: el mismo que se esté usando en el proyecto (Sequelize o Prisma, mantener consistencia)
- Autenticación: JWT. El token viaja en el header Authorization como Bearer token.
- Imágenes de mascotas: assets locales resueltos con PET_IMAGES (mismo patrón que otras pantallas).

──────────────────────────────────────
IDENTIDAD VISUAL BASE (paleta Zooni)
──────────────────────────────────────
- Fondo principal de la pantalla:  #C8F0D8  (verde menta suave — NO MODIFICAR)
- Fondo card blanco general:       #FFFFFF
- Texto principal:                 #2C2C2C
- Texto secundario:                #6B6B6B
- Acento teal:                     #2DBD72
- Amarillo:                        #F5C842
- Rojo:                            #E63946
- Naranja:                         #F5A623

──────────────────────────────────────
SISTEMA DE CATEGORÍAS DE CONSEJOS
──────────────────────────────────────

Cada consejo pertenece a una de las siguientes 6 categorías. Cada categoría tiene:
- Un nombre en español
- Un emoji representativo (como ícono principal)
- Un color de fondo del chip (pastél suave)
- Un color de acento (para el texto del chip, el ícono y el borde izquierdo de la card)

| categoria_key   | Nombre           | Emoji | Color fondo chip | Color acento   |
|-----------------|------------------|-------|------------------|----------------|
| general         | General          |  💡   | #FFFDE7          | #F5C842        |
| salud           | Salud            |  ❤️   | #FFF0F0          | #E63946        |
| alimentacion    | Alimentación     |  🍖   | #F0FFF6          | #2DBD72        |
| ejercicio       | Ejercicio        |  🏃   | #FFF4E8          | #F5A623        |
| comportamiento  | Comportamiento   |  🧠   | #F5F0FF          | #9B59B6        |
| cuidado         | Cuidado          |  ✂️   | #EAF5FF          | #3498DB        |

Estos valores deben estar definidos en una constante CATEGORIAS_CONSEJOS en el frontend
para mapear cada categoria_key al emoji, color de fondo y color de acento correspondiente.

Ejemplo:
const CATEGORIAS_CONSEJOS = {
  general:        { nombre: 'General',        emoji: '💡', fondo: '#FFFDE7', acento: '#F5C842' },
  salud:          { nombre: 'Salud',           emoji: '❤️', fondo: '#FFF0F0', acento: '#E63946' },
  alimentacion:   { nombre: 'Alimentación',    emoji: '🍖', fondo: '#F0FFF6', acento: '#2DBD72' },
  ejercicio:      { nombre: 'Ejercicio',       emoji: '🏃', fondo: '#FFF4E8', acento: '#F5A623' },
  comportamiento: { nombre: 'Comportamiento',  emoji: '🧠', fondo: '#F5F0FF', acento: '#9B59B6' },
  cuidado:        { nombre: 'Cuidado',         emoji: '✂️', fondo: '#EAF5FF', acento: '#3498DB' },
};

──────────────────────────────────────
ESTRUCTURA VISUAL DE LA PANTALLA
──────────────────────────────────────

La pantalla es un ScrollView vertical con backgroundColor: '#C8F0D8'.
NO tiene bottom tab bar (subpantalla de Ficha Médica).

  ┌──────────────────────────────────────────┐
  │  [☰]  Curiosidades de Labrador Retriever 🐾│  ← Header con título centrado
  │                                          │
  │         [ilustración mascota]            │  ← Hero
  │                                          │
  ├──────────────────────────────────────────┤
  │                                          │
  │  [💡 General][❤️ Salud][🍖 Alim.][...]   │  ← Chips de filtro (scroll horizontal)
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  ║ 🍖  Alimentación                 ║    │  ← Card consejo (diseño mejorado)
  │  ║                                  ║    │
  │  ║  Los Labrador Retriever son...   ║    │
  │  ║  propensos a la obesidad, por   ║    │
  │  ║  lo que es importante controlar ║    │
  │  ║  las porciones.                 ║    │
  │  └──────────────────────────────────┘    │
  │                                          │
  │  ┌──────────────────────────────────┐    │
  │  ║ 🏃  Ejercicio                    ║    │
  │  ║                                  ║    │
  │  ║  Necesitan al menos 1 hora de   ║    │
  │  ║  ejercicio diario para...        ║    │
  │  └──────────────────────────────────┘    │
  │            ... más consejos ...          │
  └──────────────────────────────────────────┘

──────────────────────────────────────
SECCIÓN 1 — HEADER
──────────────────────────────────────

- backgroundColor: 'transparent'.
- Izquierda: ícono hamburguesa ☰, 26px, color #2C2C2C, padding: 12px.
- Centro: título dinámico "Curiosidades de [Raza] 🐾".
  · Si la mascota tiene raza definida: "Curiosidades de Labrador Retriever 🐾".
  · Si no tiene raza o es "mestizo": "Curiosidades de [Especie] 🐾" (ej: "Curiosidades de Perro 🐾").
  · fontFamily: Bold, fontSize: 15px, color: #2C2C2C, textAlign: 'center'.
  · Puede ir en 2 líneas si el nombre de la raza es largo (numberOfLines no fijado).
  · maxWidth: 220px para no invadir los botones laterales.
- Derecha: vacío (sin campana en subpantallas).
- Altura: ~56px. paddingHorizontal: 20px.

──────────────────────────────────────
SECCIÓN 2 — HERO CON MASCOTA
──────────────────────────────────────

- backgroundColor: '#C8F0D8'.
- Ilustración de la mascota centrada (PET_IMAGES[mascota.imagenAsset], width: 110, height: 110, resizeMode: 'contain').
- Círculo decorativo detrás: 130x130, borderRadius: 65, backgroundColor: '#A8E6C0', opacity: 0.45, position: 'absolute'.
- Animación de entrada: escala 0.88 → 1.0 + opacity 0 → 1, 350ms ease-out.
- marginTop: 8px (desde el header).
- marginBottom: 20px (espacio antes del card blanco).
- NO hay nombre ni subtítulos de mascota en esta pantalla (el título ya está en el header).

──────────────────────────────────────
SECCIÓN 3 — CARD BLANCO (parte inferior)
──────────────────────────────────────

Inmediatamente debajo del hero:
  backgroundColor: '#FFFFFF'
  borderTopLeftRadius: 28
  borderTopRightRadius: 28
  paddingHorizontal: 16
  paddingTop: 20
  paddingBottom: 40

Este View contiene los chips de filtro y la lista de consejos.

──────────────────────────────────────
CHIPS DE FILTRO (dentro del card blanco)
──────────────────────────────────────

Una fila horizontal con scroll horizontal (ScrollView horizontal con showsHorizontalScrollIndicator: false).
Permite al usuario filtrar los consejos por categoría.

CHIP "Todos" (siempre primero):
- Cuando está activo: fondo #2DBD72, texto "Todos" Bold 13px blanco, borderRadius: 20, padding 8x14.
- Cuando está inactivo: fondo #F0F0F0, texto "Todos" Regular 13px #6B6B6B.
- Al tocar: muestra todos los consejos sin filtro.

CHIPS DE CATEGORÍA (uno por cada categoría presente en los datos):
- Se generan dinámicamente a partir de las categorías disponibles en los consejos recibidos.
- No se muestran categorías sin consejos.
- Cuando está ACTIVO: fondo = color acento de la categoría, texto = nombre de la categoría Bold 13px blanco.
- Cuando está INACTIVO: fondo = color fondo del chip (pastel suave), texto = nombre Regular 13px color acento.
- Cada chip: borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14.
- Entre chips: gap de 8px.
- marginBottom: 16px (separación antes de la lista de consejos).
- Animación al cambiar el filtro activo: el chip activo se escala de 1.0 a 1.05 y vuelve en 150ms.

──────────────────────────────────────
DISEÑO MEJORADO DE LAS CARDS DE CONSEJOS
──────────────────────────────────────

IMPORTANTE: Este es el núcleo del prompt. El diseño de los consejos debe ser visualmente rico,
con jerarquía clara y diferenciación por categoría. NO usar el diseño anterior (card genérico
con fondo amarillo y texto plano).

Cada card de consejo tiene la siguiente estructura:

┌─────────────────────────────────────────┐
│  ┌────────────────────────────────────┐ │
│  │ [emoji circle] Nombre Categoría    │ │  ← Encabezado de la card
│  └────────────────────────────────────┘ │
│  ──────────────────────────────────────  │  ← Línea separadora sutil
│                                         │
│    Texto del consejo con buena          │
│    tipografía y excelente legibilidad.  │
│    Puede ocupar varias líneas.          │
│                                         │
└─────────────────────────────────────────┘

CONTENEDOR PRINCIPAL DEL CARD:
  · backgroundColor: '#FFFFFF'
  · borderRadius: 18
  · marginHorizontal: 4   (leve margen para que la sombra se vea bien)
  · marginBottom: 14
  · shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4
  · overflow: 'hidden'    (para que el encabezado coloreado respete el borderRadius)
  · Borde izquierdo destacado: un View absoluto de width: 4px, height: '100%', backgroundColor: acento de la categoría,
    position: 'absolute', left: 0, top: 0. Esto crea un acento visual lateral que diferencia la categoría.

ENCABEZADO DE LA CARD (sección superior coloreada):
  · backgroundColor: fondo pastel de la categoría (ej: #F0FFF6 para alimentacion).
  · paddingHorizontal: 16, paddingVertical: 12.
  · flexDirection: 'row', alignItems: 'center', gap: 10.
  · paddingLeft: 20  (para compensar el borde izquierdo de 4px + espacio visual).

  Círculo del emoji (ícono de categoría):
  · View circular: width: 38, height: 38, borderRadius: 19.
  · backgroundColor: color acento de la categoría con 20% de opacidad (ej: rgba(45,189,114,0.15)).
  · alignItems: 'center', justifyContent: 'center'.
  · Dentro: el emoji de la categoría, fontSize: 20.

  Nombre de la categoría:
  · fontFamily: Bold, fontSize: 14px.
  · color: color acento de la categoría (ej: #2DBD72 para alimentacion).
  · letterSpacing: 0.3.

SEPARADOR:
  · View de height: 1, backgroundColor: '#F0F0F0' (gris muy claro).
  · marginHorizontal: 0 (full width del card).

CUERPO DEL CONSEJO (sección de texto):
  · paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16.
  · paddingLeft: 24  (compensar visualmente el borde izquierdo).

  Texto del consejo:
  · fontFamily: Regular (o Medium para mejor legibilidad), fontSize: 14px.
  · color: #2C2C2C.
  · lineHeight: 22  (espaciado entre líneas generoso para lectura cómoda).
  · textAlign: 'left'.

DIAGRAMA COMPLETO:
  ┌─────────────────────────────────────────┐
  ┃ (borde izq. 4px color categoría)       ┃
  ├─────────────────────────────────────────┤
  │ [fondo pastel]                          │
  │  ┌────┐  Alimentación                   │  ← encabezado
  │  │ 🍖 │                                 │
  │  └────┘                                 │
  ├─────────────────────────────────────────┤  ← separador 1px gris
  │                                         │
  │  Los Labrador Retriever son propensos   │  ← cuerpo del consejo
  │  a la obesidad, así que es importante   │
  │  controlar las porciones y evitar       │
  │  premios en exceso.                     │
  │                                         │
  └─────────────────────────────────────────┘

EJEMPLO DE CADA CATEGORÍA (cómo se vería):

  Categoría Alimentación (🍖):
  - Encabezado: fondo #F0FFF6, emoji en círculo rgba(45,189,114,0.15), texto "Alimentación" en #2DBD72
  - Borde izquierdo: #2DBD72

  Categoría Salud (❤️):
  - Encabezado: fondo #FFF0F0, emoji en círculo rgba(230,57,70,0.12), texto "Salud" en #E63946
  - Borde izquierdo: #E63946

  Categoría Ejercicio (🏃):
  - Encabezado: fondo #FFF4E8, emoji en círculo rgba(245,166,35,0.15), texto "Ejercicio" en #F5A623
  - Borde izquierdo: #F5A623

  Categoría Comportamiento (🧠):
  - Encabezado: fondo #F5F0FF, emoji en círculo rgba(155,89,182,0.12), texto "Comportamiento" en #9B59B6
  - Borde izquierdo: #9B59B6

  Categoría Cuidado (✂️):
  - Encabezado: fondo #EAF5FF, emoji en círculo rgba(52,152,219,0.12), texto "Cuidado" en #3498DB
  - Borde izquierdo: #3498DB

  Categoría General (💡):
  - Encabezado: fondo #FFFDE7, emoji en círculo rgba(245,200,66,0.20), texto "General" en #F5C842
  - Borde izquierdo: #F5C842

ANIMACIONES DE LOS CARDS:
- Entrada al cargar: cada card aparece con translateY 16px → 0 + opacity 0 → 1,
  stagger de 80ms entre cards, duración 300ms ease-out.
- Al cambiar el filtro: los cards que no corresponden al filtro desaparecen con opacity → 0 en 150ms,
  y los nuevos aparecen con la animación de entrada (stagger 50ms).
- Al presionar (tocar) un card: leve escala 1.0 → 0.98 en 100ms (feedback visual),
  pero en esta pantalla los cards NO son navegables (no tienen acción al tocar).

──────────────────────────────────────
ESTADO VACÍO (sin consejos para la especie/raza)
──────────────────────────────────────

Si no hay consejos en la base de datos para la especie/raza de la mascota, mostrar:

- Un solo card con diseño especial de "fallback":
  · backgroundColor: '#FFFFFF', borderRadius: 18, shadow suave.
  · Centrado: emoji 🐾 grande (48px) arriba.
  · Título: "Próximamente", Bold, 16px, #2DBD72, centrado.
  · Subtítulo: "Estamos preparando consejos especiales para tu " + especie + ". ¡Volvé pronto!",
    Regular, 14px, #6B6B6B, textAlign: 'center', lineHeight: 22.
  · paddingHorizontal: 24, paddingVertical: 28.

- NO mostrar el mensaje anterior "No hay curiosidades específicas para esta raza...".
- NO mostrar los chips de filtro si no hay consejos.

──────────────────────────────────────
ESTADOS DE CARGA
──────────────────────────────────────

- Al montar la pantalla: mostrar 3 skeleton loaders con la forma de las cards mejoradas.
  Cada skeleton tiene:
  · backgroundColor: #F0F0F0, borderRadius: 18, marginBottom: 14.
  · Una franja superior (simula el encabezado de categoría): height: 56px, backgroundColor: #E8E8E8, borderRadius 0.
  · Un bloque de texto (simula el cuerpo): height: 80px, margin: 14, borderRadius: 8.
  · Animación shimmer de izquierda a derecha.

──────────────────────────────────────
LÓGICA FRONTEND (ConsejosScreen.jsx)
──────────────────────────────────────

Archivo: screens/ConsejosScreen.jsx

Props de navegación: route.params.petId

Estado local (useState):
- mascota:            null | objeto mascota
- consejos:           array de objetos consejo (todos los cargados del backend)
- categoriaActiva:    'todos' | string de categoria_key
- loading:            boolean
- categoriasPresentes: array de strings (categorías únicas en los consejos recibidos)

useEffect al montar:
- Obtener JWT del AsyncStorage (clave 'userToken').
- Llamar GET /api/mascotas/:petId/consejos.
- Guardar en mascota y consejos.
- Calcular categoriasPresentes: [...new Set(consejos.map(c => c.categoria))].
- Manejar errores con Alert.

Computed value — consejosFiltrados:
- Si categoriaActiva === 'todos': devuelve todos los consejos.
- Si no: devuelve consejos.filter(c => c.categoria === categoriaActiva).
- Usar useMemo(() => ..., [consejos, categoriaActiva]) para performance.

Función seleccionarCategoria(key):
- Si key === categoriaActiva: no hacer nada (o setear 'todos').
- Si no: categoriaActiva = key.
- Animar la transición de los cards (ver sección de animaciones).

Función getTituloHeader(mascota):
- Si mascota.raza y mascota.raza.toLowerCase() !== 'mestizo': "Curiosidades de " + mascota.raza + " 🐾".
- Si no: "Curiosidades de " + capitalizar(mascota.especie) + " 🐾".

──────────────────────────────────────
BACKEND — MODELO DE DATOS EN POSTGRESQL
──────────────────────────────────────

TABLA: consejos
(Contenido administrado por el equipo de Zooni. No es editable por los usuarios.)

CREATE TABLE consejos (
  id          SERIAL PRIMARY KEY,
  especie     VARCHAR(50) NOT NULL,      -- 'perro', 'gato', 'conejo', etc.
  raza        VARCHAR(100),              -- NULL significa que aplica a toda la especie
  categoria   VARCHAR(50) NOT NULL,      -- 'general', 'salud', 'alimentacion', 'ejercicio', 'comportamiento', 'cuidado'
  contenido   TEXT NOT NULL,             -- el texto del consejo (1–4 oraciones)
  activo      BOOLEAN DEFAULT TRUE,
  orden       INTEGER DEFAULT 0,         -- para controlar el orden de aparición
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- Índices:
CREATE INDEX idx_consejos_especie ON consejos(especie);
CREATE INDEX idx_consejos_especie_raza ON consejos(especie, raza);
CREATE INDEX idx_consejos_categoria ON consejos(categoria);

-- DATOS DE EJEMPLO — Perro genérico y Labrador Retriever:
INSERT INTO consejos (especie, raza, categoria, contenido, orden) VALUES
  -- GENERALES (todas las razas de perro)
  ('perro', NULL, 'general',        'Los perros son animales sociales que necesitan compañía y afecto a diario. Dedicarles tiempo de calidad fortalece el vínculo y mejora su bienestar emocional.', 1),
  ('perro', NULL, 'salud',          'Revisá las orejas de tu perro una vez por semana. Las infecciones de oído son comunes y detectarlas temprano evita complicaciones mayores.', 2),
  ('perro', NULL, 'alimentacion',   'Establecé un horario fijo de comida. Los perros se estresarán menos y tendrán mejor digestión si comen a la misma hora todos los días.', 3),
  ('perro', NULL, 'ejercicio',      'El ejercicio diario es esencial para la salud física y mental de tu perro. Un perro bien ejercitado es más tranquilo en casa.', 4),
  ('perro', NULL, 'comportamiento', 'Los perros aprenden mejor con refuerzo positivo. Premiá los comportamientos que querés repetir en lugar de castigar los que no querés.', 5),
  ('perro', NULL, 'cuidado',        'Cepillá los dientes de tu perro al menos 2 veces por semana con pasta dental canina. La higiene bucal previene enfermedades sistémicas.', 6),

  -- ESPECÍFICOS Labrador Retriever
  ('perro', 'Labrador Retriever', 'alimentacion',   'Los Labrador Retriever son una de las razas más propensas a la obesidad. Controlá las porciones, evitá los premios en exceso y optá por alimentos de alta calidad sin rellenos.', 1),
  ('perro', 'Labrador Retriever', 'ejercicio',      'Los Labradores necesitan al menos 1 hora de ejercicio intenso diario. Son ideales para actividades como natación, fetch y senderismo. Sin suficiente actividad pueden volverse destructivos.', 2),
  ('perro', 'Labrador Retriever', 'salud',          'Esta raza es susceptible a displasia de cadera y codo. Consultá con tu veterinario sobre suplementos articulares y evitá el ejercicio excesivo de impacto en cachorros menores de 18 meses.', 3),
  ('perro', 'Labrador Retriever', 'comportamiento', 'Los Labradores son perros de alto nivel de energía y pueden aburrirse fácilmente. Los juguetes de enriquecimiento mental, como los Kong rellenos, son excelentes para mantenerlos estimulados.', 4),
  ('perro', 'Labrador Retriever', 'cuidado',        'Su pelaje denso y de doble capa muda intensamente 2 veces al año. Cepillalo 2-3 veces por semana con un cepillo de cerdas firmes para minimizar el pelo en casa.', 5),
  ('perro', 'Labrador Retriever', 'general',        'Los Labrador Retriever son conocidos por su boca suave: pueden llevar un huevo en la boca sin romperlo. Esta característica los hace ideales como perros de asistencia y rescate.', 6);

  -- Para gatos: categorías similares, contenido específico de felinos.
  -- Para otras razas: ir agregando en el mismo formato.

──────────────────────────────────────
BACKEND — API ENDPOINT
──────────────────────────────────────

BASE URL: /api/mascotas/:petId/consejos
Requiere el middleware verifyToken.

──────────────────────
GET /api/mascotas/:petId/consejos
──────────────────────
Devuelve los datos de la mascota y los consejos correspondientes.

Lógica del backend:
a) Verificar que la mascota existe y pertenece al usuario autenticado. Si no: 404 o 403.
b) Query 1: SELECT * FROM mascotas WHERE id = $1 AND usuario_id = $2.
c) Query 2: buscar consejos con esta lógica de prioridad:
   - Primero: buscar consejos específicos de la raza (especie = mascota.especie AND raza = mascota.raza AND activo = TRUE).
   - Segundo: buscar consejos genéricos de la especie (especie = mascota.especie AND raza IS NULL AND activo = TRUE).
   - Combinar ambos resultados. Si hay consejos específicos de raza, incluirlos junto con los genéricos.
   - Ordenar por: primero los de raza específica (por orden ASC), luego los genéricos (por orden ASC).
   - Query SQL:
     SELECT * FROM consejos
     WHERE especie = $1 AND activo = TRUE
       AND (raza = $2 OR raza IS NULL)
     ORDER BY
       CASE WHEN raza IS NOT NULL THEN 0 ELSE 1 END,
       orden ASC;
d) Si no hay ningún consejo: devolver array vacío (el frontend mostrará el estado vacío).

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
  "consejos": [
    {
      "id": 7,
      "especie": "perro",
      "raza": "Labrador Retriever",
      "categoria": "alimentacion",
      "contenido": "Los Labrador Retriever son una de las razas más propensas a la obesidad. Controlá las porciones, evitá los premios en exceso y optá por alimentos de alta calidad sin rellenos.",
      "orden": 1
    },
    {
      "id": 8,
      "especie": "perro",
      "raza": "Labrador Retriever",
      "categoria": "ejercicio",
      "contenido": "Los Labradores necesitan al menos 1 hora de ejercicio intenso diario...",
      "orden": 2
    },
    {
      "id": 1,
      "especie": "perro",
      "raza": null,
      "categoria": "general",
      "contenido": "Los perros son animales sociales que necesitan compañía y afecto a diario...",
      "orden": 1
    }
  ]
}

Response errores:
- 403: { "error": "No tenés permiso para ver esta mascota" }
- 404: { "error": "Mascota no encontrada" }

──────────────────────────────────────
ARCHIVOS A CREAR
──────────────────────────────────────

Frontend:
- screens/ConsejosScreen.jsx             ← pantalla principal (este prompt)
- constants/categoriasConsejos.js        ← objeto CATEGORIAS_CONSEJOS con emoji, fondo y acento
- (reutilizar) utils/api.js              ← ya existe
- (reutilizar) constants/petImages.js    ← ya existe

Backend:
- routes/consejos.js
- controllers/consejosController.js
- migrations/004_create_consejos.sql     ← CREATE TABLE consejos + índices
- seeds/consejos_perro.sql               ← datos de ejemplo para perros (genéricos y por raza)
- seeds/consejos_gato.sql               ← datos de ejemplo para gatos

──────────────────────────────────────
EDGE CASES A MANEJAR
──────────────────────────────────────

| Situación                                      | Comportamiento                                                        |
|------------------------------------------------|-----------------------------------------------------------------------|
| Sin consejos en DB para esa especie/raza       | Card de estado vacío con 🐾 y texto "Próximamente..."                 |
| Mascota sin raza definida o "mestizo"          | Mostrar solo consejos genéricos de la especie                         |
| Raza con acento o mayúsculas distintas         | Normalizar la búsqueda: LOWER(raza) = LOWER($2) en el query           |
| Consejo con texto muy largo                    | El card crece en height naturalmente, sin truncar                     |
| Solo hay consejos de una categoría             | Mostrar solo el chip de esa categoría + "Todos"                       |
| Filtro activo sin resultados (edge case)       | No debería ocurrir (chips dinámicos), pero si pasa: texto "No hay consejos en esta categoría" centrado |
| Red caída al cargar                            | Alert + mostrar botón "Reintentar" debajo del skeleton                |
| Error 403                                      | Alert + redirigir a FichaMédica                                       |
| Cambio rápido de filtro (debounce)             | Cancelar animaciones previas antes de iniciar las nuevas              |

──────────────────────────────────────
INSTRUCCIONES FINALES
──────────────────────────────────────

- Código limpio, funcional y completo. No pseudocódigo.
- Esta pantalla es de SOLO LECTURA: no hay formularios, no hay POST/PUT/DELETE del usuario.
- El foco del desarrollo visual está en los CARDS DE CONSEJOS. El diseño mejorado descripto
  arriba es no negociable: encabezado coloreado por categoría, borde izquierdo de acento,
  emoji en círculo, texto con buen line-height.
- NO reproducir el diseño anterior (card genérico amarillo con texto plano y "Consejo General"
  como texto sin estilo). Ese diseño fue reemplazado completamente por el nuevo sistema.
- Las animaciones deben usar Animated API de React Native. Ease-out en entradas, 300ms máx.
- Respetar estrictamente el fondo #C8F0D8 (verde menta) de la pantalla — NO modificar el fondo.
- El sistema de categorías (CATEGORIAS_CONSEJOS) debe definirse como constante separada e
  importarse donde se necesite, para facilitar agregar nuevas categorías en el futuro.
- Entregá todos los archivos completos, uno por uno, sin omitir ninguna línea.
