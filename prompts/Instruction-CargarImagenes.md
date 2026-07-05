=== ZOONI — CARGA DE IMÁGENES DEL FLUJO LOGIN / REGISTRO ===

Este documento explica QUÉ imágenes hay que exportar de Figma (las de
/Imagenes-Figma/Login - Registro/), CON QUÉ NOMBRE guardarlas, EN QUÉ CARPETA
ponerlas y EN QUÉ ORDEN cargarlas. Hoy todas estas imágenes usan un placeholder
(assets/perro_basico.png); la app funciona igual, solo que se ve el mismo perro
en todos lados hasta que se carguen los PNG reales.

Los dos archivos de código involucrados son:
  - zooni-app/src/constants/registroAssets.js  → imágenes del flujo Login/Registro
  - zooni-app/src/constants/petImages.js       → imágenes de mascotas (usadas en
                                                  toda la app: Home, Perfil, Registro Paso 3/4)

REGLA DE REACT NATIVE: los require() de imágenes deben ser literales estáticos.
No se puede hacer require(variable). Por eso cada imagen se agrega a mano como
una línea nueva en esos archivos.

──────────────────────────────────────
CARPETAS DESTINO (crearlas si no existen)
──────────────────────────────────────

  zooni-app/assets/registro/    ← ilustraciones del flujo login/registro (nuevas)
  zooni-app/assets/mascotas/    ← imágenes de mascotas por especie/raza

──────────────────────────────────────
ORDEN DE CARGA
──────────────────────────────────────

El orden importa: primero lo que se ve en TODAS las pantallas del flujo, después
lo que solo aparece en un paso, y al final lo opcional.

────────────
ORDEN 1 — LA CAJA: mascota_sorpresa.png  (Registro Paso 2)
────────────
  · Qué es: el perro asomando de la CAJA de cartón amarilla con el signo "?"
    (se ve en Login4.png y Login5.png de Figma).
  · Es LA MISMA imagen para todas las especies (es genérica a propósito:
    "todavía no sabemos qué mascota es").
  · Exportar como: PNG con fondo transparente, ~420x420px.
  · Guardar en:  zooni-app/assets/registro/mascota_sorpresa.png
  · Tocar código en registroAssets.js:
      ANTES:  export const MASCOTA_SORPRESA = PLACEHOLDER;
      DESPUÉS: export const MASCOTA_SORPRESA = require('../../assets/registro/mascota_sorpresa.png');

────────────
ORDEN 2 — ILUSTRACIÓN DEL LOGIN: login_illustration.png
────────────
  · Qué es: el grupo de animales (perros, gatos, loro, pollito, ratón) sobre el
    pasto verde, arriba del formulario de login (Login1.png, Login9.png, Login10.png).
  · Exportar como: PNG con fondo transparente, ~800x520px.
  · Guardar en:  zooni-app/assets/registro/login_illustration.png
  · Tocar código en registroAssets.js:
      ANTES:  export const LOGIN_ILLUSTRATION = PLACEHOLDER;
      DESPUÉS: export const LOGIN_ILLUSTRATION = require('../../assets/registro/login_illustration.png');

────────────
ORDEN 3 — LAS MASCOTAS DEFAULT POR ESPECIE  (Registro Paso 3 y 4 + resto de la app)
────────────
  · Qué es: la mascota "ya revelada" que aparece arriba del formulario en los
    pasos 3 y 4 (en Login6/7/8.png es el perro dorado sentado sonriendo).
    Esa misma imagen es la que la app usa como avatar de la mascota en Home,
    Perfil, Ficha Médica, etc. — el registro guarda el nombre del asset en
    Mascota.ImagenAsset (ej: 'perro_default').
  · Exportar UNA por especie, PNG transparente, ~400x400px:

    | Archivo                  | Especie  | Key en petImages.js |
    |--------------------------|----------|---------------------|
    | perro_default.png        | Perro    | perro_default       |
    | gato_default.png         | Gato     | gato_default        |
    | conejo_default.png       | Conejo   | conejo_default      |
    | pajaro_default.png       | Ave      | pajaro_default      |
    | hamster_default.png      | Hamster  | hamster_default     |

  · Guardar en:  zooni-app/assets/mascotas/
  · Tocar código en petImages.js: reemplazar el FALLBACK del key correspondiente.
      ANTES:  perro_default: FALLBACK,
      DESPUÉS: perro_default: require('../../assets/mascotas/perro_default.png'),
  · NOTA: reptil, pez y ratón hoy NO tienen key propio: el registro les asigna
    'perro_default' (reptil, pez) y 'hamster_default' (ratón) — ver
    IMAGEN_ASSET_POR_ESPECIE en src/services/authApi.js. Cuando se diseñen sus
    ilustraciones: agregar reptil_default / pez_default / raton_default a
    petImages.js Y actualizar ese mapa en authApi.js.

────────────
ORDEN 4 — ICONITOS DEL GRID DE ESPECIES  (Registro Paso 1)
────────────
  · Qué es: los 8 iconitos chiquitos de las tarjetas "Perro / Gato / Conejo /
    Ave / Reptil / Pez / Hamster / Ratón" (Login2.png y Login3.png).
  · HOY: se muestran emojis (🐕 🐈 🐰 🐦 🐢 🐠 🐹 🐭) y se ve bien — por eso
    estos son los MENOS urgentes. Cargarlos solo para que quede idéntico a Figma.
  · Exportar como: PNG transparente, ~96x96px, nombre especie_<key>.png:

      especie_perro.png, especie_gato.png, especie_conejo.png, especie_ave.png,
      especie_reptil.png, especie_pez.png, especie_hamster.png, especie_raton.png

  · Guardar en:  zooni-app/assets/registro/
  · Tocar código en registroAssets.js, en el array ESPECIES:
      ANTES:  { key: 'perro', label: 'Perro', icono: '🐕', imagen: null },
      DESPUÉS: { key: 'perro', label: 'Perro', icono: '🐕', imagen: require('../../assets/registro/especie_perro.png') },
    (el tile prefiere `imagen` sobre el emoji cuando no es null)

────────────
ORDEN 5 — OPCIONAL / MÁS ADELANTE
────────────
  a) MASCOTAS POR RAZA: petImages.js ya tiene los keys preparados
     (perro_labrador, perro_golden, gato_siames, etc. — todos apuntando al
     FALLBACK). Mismo procedimiento que el Orden 3: PNG en assets/mascotas/
     con el nombre del key + reemplazar el FALLBACK por el require().
  b) PLANTAS DECORATIVAS de los bordes de las pantallas de registro
     (se asoman abajo a izquierda y derecha en Login2–Login8): hoy se usa el
     mismo asset decorativo que el resto de la app. Solo tocar si diseño
     entrega una versión específica.

──────────────────────────────────────
CHECKLIST DESPUÉS DE CARGAR CADA TANDA
──────────────────────────────────────

  1. El nombre del archivo coincide EXACTO (minúsculas, sin espacios ni ñ).
  2. PNG con transparencia real (sin cuadrado blanco/negro de fondo).
  3. Se editó la línea correspondiente en registroAssets.js o petImages.js.
  4. Reiniciar Expo con caché limpia:  npx expo start -c
  5. Recorrer Login → Registro Paso 1 → 2 → 3 → 4 y verificar contra las
     capturas de /Imagenes-Figma/Login - Registro/.
