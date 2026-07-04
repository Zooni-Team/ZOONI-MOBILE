/**
 * registroAssets.js — Imágenes y catálogo de especies del flujo Login/Registro
 *
 * TODAS las imágenes de este flujo son PLACEHOLDERS por ahora (usan
 * perro_basico.png). El orden y los nombres de archivo con los que hay que
 * reemplazarlas están documentados en /prompts/Instruction-CargarImagenes.md.
 *
 * Los require() de React Native deben ser literales estáticos, por eso cada
 * imagen es una línea propia y no un mapa dinámico.
 */

const PLACEHOLDER = require('../../assets/perro_basico.png');

// Ilustración del grupo de animales del Login (Login1.png de Figma)
// Reemplazar por: require('../../assets/registro/login_illustration.png')
export const LOGIN_ILLUSTRATION = PLACEHOLDER;

// Perro asomando de la caja con "?" del Registro Paso 2 (Login4.png de Figma)
// Es la MISMA para todas las especies.
// Reemplazar por: require('../../assets/registro/mascota_sorpresa.png')
export const MASCOTA_SORPRESA = PLACEHOLDER;

/**
 * Especies del grid del Registro Paso 1 (Login2.png de Figma).
 * `key` es el valor que se guarda en Mascota.Especie y el que usan el catálogo
 * de razas (tabla `razas`) y los consejos/vacunas/tratamientos por especie.
 * `icono` es el emoji que se muestra hasta que se carguen los PNG reales
 * (assets/registro/especie_<key>.png — ver Instruction-CargarImagenes.md);
 * cuando existan, agregar acá una prop `imagen: require(...)` por especie y
 * el tile la va a preferir sobre el emoji.
 */
export const ESPECIES = [
  { key: 'perro',   label: 'Perro',   icono: '🐕', imagen: null },
  { key: 'gato',    label: 'Gato',    icono: '🐈', imagen: null },
  { key: 'conejo',  label: 'Conejo',  icono: '🐰', imagen: null },
  { key: 'ave',     label: 'Ave',     icono: '🐦', imagen: null },
  { key: 'reptil',  label: 'Reptil',  icono: '🐢', imagen: null },
  { key: 'pez',     label: 'Pez',     icono: '🐠', imagen: null },
  { key: 'hamster', label: 'Hamster', icono: '🐹', imagen: null },
  { key: 'raton',   label: 'Ratón',   icono: '🐭', imagen: null },
];

/**
 * Países del selector del Registro Paso 4 (sin dependencia externa).
 * `callingCode` autocompleta el campo Código.
 */
export const PAISES = [
  { codigo: 'AR', nombre: 'Argentina', bandera: '🇦🇷', callingCode: '+54' },
  { codigo: 'UY', nombre: 'Uruguay', bandera: '🇺🇾', callingCode: '+598' },
  { codigo: 'CL', nombre: 'Chile', bandera: '🇨🇱', callingCode: '+56' },
  { codigo: 'BR', nombre: 'Brasil', bandera: '🇧🇷', callingCode: '+55' },
  { codigo: 'PY', nombre: 'Paraguay', bandera: '🇵🇾', callingCode: '+595' },
  { codigo: 'BO', nombre: 'Bolivia', bandera: '🇧🇴', callingCode: '+591' },
  { codigo: 'PE', nombre: 'Perú', bandera: '🇵🇪', callingCode: '+51' },
  { codigo: 'CO', nombre: 'Colombia', bandera: '🇨🇴', callingCode: '+57' },
  { codigo: 'EC', nombre: 'Ecuador', bandera: '🇪🇨', callingCode: '+593' },
  { codigo: 'VE', nombre: 'Venezuela', bandera: '🇻🇪', callingCode: '+58' },
  { codigo: 'MX', nombre: 'México', bandera: '🇲🇽', callingCode: '+52' },
  { codigo: 'ES', nombre: 'España', bandera: '🇪🇸', callingCode: '+34' },
  { codigo: 'US', nombre: 'Estados Unidos', bandera: '🇺🇸', callingCode: '+1' },
];
