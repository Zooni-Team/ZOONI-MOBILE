/**
 * registroImages.js — Imágenes del flujo Login/Registro extraídas de
 * ZOONI-MVC (github.com/Zooni-Team/ZOONI-MVC), replicadas en wwwroot/img/
 * con la MISMA estructura que el repo original:
 *   wwwroot/img/cajas/{especie}caja.png
 *   wwwroot/img/mascotas/{especie}s/{raza}/{especie}_basico.png
 *
 * Este archivo es GENERADO (ver prompts/ o pedirle a Claude que lo regenere
 * si se agregan/sacan imágenes de wwwroot/img). No editar los mapas a mano.
 */

const FALLBACK = require('../../assets/perro_basico.png');

export const MASCOTAS_BIENVENIDA = require('../../wwwroot/img/mascotas-bienvenida.png');
export const GOOGLE_ICON = require('../../wwwroot/img/google-icon.png');
export const FACEBOOK_ICON = require('../../wwwroot/img/facebook-icon.png');
export const APPLE_ICON = require('../../wwwroot/img/apple-icon.png');

// ── Caja por especie (Registro Paso 2 / Registro3.cshtml) ──────────────────
export const CAJAS_POR_ESPECIE = {
  perro: require('../../wwwroot/img/cajas/perrocaja.png'),
  gato: require('../../wwwroot/img/cajas/gatocaja.png'),
  conejo: require('../../wwwroot/img/cajas/conejocaja.png'),
  ave: require('../../wwwroot/img/cajas/avecaja.png'),
  reptil: require('../../wwwroot/img/cajas/reptilcaja.png'),
  pez: require('../../wwwroot/img/cajas/pezcaja.png'),
  hamster: require('../../wwwroot/img/cajas/hamstercaja.png'),
  raton: require('../../wwwroot/img/cajas/ratoncaja.png'),
};

export function resolveCajaImage(especie) {
  return CAJAS_POR_ESPECIE[especie] ?? FALLBACK;
}

// ── Mascota básica por especie + raza (Registro Paso 3/4 / Registro4-5.cshtml) ──
const MASCOTAS_POR_ESPECIE_Y_RAZA = {
  perro: {
    'akita inu': require('../../wwwroot/img/mascotas/perros/Akita Inu/perro_basico.png'),
    'basset hound': require('../../wwwroot/img/mascotas/perros/Basset Hound/perro_basico.png'),
    'beagle': require('../../wwwroot/img/mascotas/perros/beagle/perro_basico.png'),
    'border collie': require('../../wwwroot/img/mascotas/perros/Border Collie/perro_basico.png'),
    'boxer': require('../../wwwroot/img/mascotas/perros/Boxer/perro_basico.png'),
    'bulldog': require('../../wwwroot/img/mascotas/perros/bulldog/perro_basico.png'),
    'caniche': require('../../wwwroot/img/mascotas/perros/Caniche/perro_basico.png'),
    'caniche negro': require('../../wwwroot/img/mascotas/perros/caniche negro/perro_basico.png'),
    'chihuahua': require('../../wwwroot/img/mascotas/perros/chihuahua/perro_basico.png'),
    'cocker spaniel': require('../../wwwroot/img/mascotas/perros/cocker spaniel/perro_basico.png'),
    'dalmata': require('../../wwwroot/img/mascotas/perros/dálmata/perro_basico.png'),
    'doberman': require('../../wwwroot/img/mascotas/perros/Doberman/perro_basico.png'),
    'galgo': require('../../wwwroot/img/mascotas/perros/galgo/perro_basico.png'),
    'golden retriever': require('../../wwwroot/img/mascotas/perros/golden retriever/perro_basico.png'),
    'husky siberiano': require('../../wwwroot/img/mascotas/perros/husky siberiano/perro_basico.png'),
    'jack russell terrier': require('../../wwwroot/img/mascotas/perros/Jack Russell Terrier/perro_basico.png'),
    'labrador retriever': require('../../wwwroot/img/mascotas/perros/labrador retriever/perro_basico.png'),
    'maltes': require('../../wwwroot/img/mascotas/perros/Maltés/perro_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/perros/otra raza/perro_basico.png'),
    'pastor aleman': require('../../wwwroot/img/mascotas/perros/Pastor Alemán/perro_basico.png'),
    'pitbull': require('../../wwwroot/img/mascotas/perros/Pitbull/perro_basico.png'),
    'pomerania': require('../../wwwroot/img/mascotas/perros/Pomerania/perro_basico.png'),
    'pug': require('../../wwwroot/img/mascotas/perros/pug/perro_basico.png'),
    'rottweiler': require('../../wwwroot/img/mascotas/perros/Rottweiler/perro_basico.png'),
    'salchicha': require('../../wwwroot/img/mascotas/perros/Salchicha/perro_basico.png'),
    'samoyedo': require('../../wwwroot/img/mascotas/perros/samoyedo/perro_basico.png'),
    'san bernardo': require('../../wwwroot/img/mascotas/perros/San Bernardo/perro_basico.png'),
    'schnauzer': require('../../wwwroot/img/mascotas/perros/Schnauzer/perro_basico.png'),
    'shih tzu': require('../../wwwroot/img/mascotas/perros/Shih Tzu/perro_basico.png'),
    'weimaraner': require('../../wwwroot/img/mascotas/perros/Weimaraner/perro_basico.png'),
    'yorkshire terrier': require('../../wwwroot/img/mascotas/perros/Yorkshire Terrier/perro_basico.png'),
  },
  gato: {
    'abisinio': require('../../wwwroot/img/mascotas/gatos/abisinio/gato_basico.png'),
    'angora turco': require('../../wwwroot/img/mascotas/gatos/angora turco/gato_basico.png'),
    'azul ruso': require('../../wwwroot/img/mascotas/gatos/azul ruso/gato_basico.png'),
    'bengala': require('../../wwwroot/img/mascotas/gatos/bengala/gato_basico.png'),
    'birmano': require('../../wwwroot/img/mascotas/gatos/birmano/gato_basico.png'),
    'bombay': require('../../wwwroot/img/mascotas/gatos/bombay/gato_basico.png'),
    'bosque de noruega': require('../../wwwroot/img/mascotas/gatos/bosque de noruega/gato_basico.png'),
    'british shorthair': require('../../wwwroot/img/mascotas/gatos/british shorthair/gato_basico.png'),
    'cornish rex': require('../../wwwroot/img/mascotas/gatos/cornish rex/gato_basico.png'),
    'esfinge': require('../../wwwroot/img/mascotas/gatos/esfinge/gato_basico.png'),
    'himalayo': require('../../wwwroot/img/mascotas/gatos/himalayo/gato_basico.png'),
    'maine coon': require('../../wwwroot/img/mascotas/gatos/maine coon/gato_basico.png'),
    'oriental de pelo corto': require('../../wwwroot/img/mascotas/gatos/oriental de pelo corto/gato_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/gatos/otra raza/gato_basico.png'),
    'persa': require('../../wwwroot/img/mascotas/gatos/persa/gato_basico.png'),
    'ragdoll': require('../../wwwroot/img/mascotas/gatos/ragdoll/gato_basico.png'),
    'savannah': require('../../wwwroot/img/mascotas/gatos/savannah/gato_basico.png'),
    'scottish fold': require('../../wwwroot/img/mascotas/gatos/scottish fold/gato_basico.png'),
    'siames': require('../../wwwroot/img/mascotas/gatos/siames/gato_basico.png'),
    'siberiano': require('../../wwwroot/img/mascotas/gatos/siberiano/gato_basico.png'),
  },
  conejo: {
    'angora': require('../../wwwroot/img/mascotas/conejos/Angora/conejo_basico.png'),
    'belier': require('../../wwwroot/img/mascotas/conejos/Belier/conejo_basico.png'),
    'cabeza de leon': require('../../wwwroot/img/mascotas/conejos/Cabeza de león/conejo_basico.png'),
    'mini lop': require('../../wwwroot/img/mascotas/conejos/Mini Lop/conejo_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/conejos/otra raza/conejo_basico.png'),
    'rex': require('../../wwwroot/img/mascotas/conejos/Rex/conejo_basico.png'),
  },
  ave: {
    'agapornis': require('../../wwwroot/img/mascotas/aves/agapornis/ave_basico.png'),
    'amazonas': require('../../wwwroot/img/mascotas/aves/amazonas/ave_basico.png'),
    'cacatua': require('../../wwwroot/img/mascotas/aves/Cacatúa/ave_basico.png'),
    'guacamayo': require('../../wwwroot/img/mascotas/aves/guacamayo/ave_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/aves/otra raza/ave_basico.png'),
    'periquito': require('../../wwwroot/img/mascotas/aves/periquito/ave_basico.png'),
  },
  reptil: {
    'boa': require('../../wwwroot/img/mascotas/reptils/Boa/reptil_basico.png'),
    'camaleon': require('../../wwwroot/img/mascotas/reptils/camaleón/reptil_basico.png'),
    'camaleon pantera': require('../../wwwroot/img/mascotas/reptils/Camaleón pantera/reptil_basico.png'),
    'dragon barbudo': require('../../wwwroot/img/mascotas/reptils/Dragón Barbudo/reptil_basico.png'),
    'gecko crestado': require('../../wwwroot/img/mascotas/reptils/Gecko crestado/reptil_basico.png'),
    'gecko leopardo': require('../../wwwroot/img/mascotas/reptils/Gecko Leopardo/reptil_basico.png'),
    'iguana': require('../../wwwroot/img/mascotas/reptils/iguana/reptil_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/reptils/otra raza/reptil_basico.png'),
    'serpiente del maiz': require('../../wwwroot/img/mascotas/reptils/Serpiente del maíz/reptil_basico.png'),
    'tortuga': require('../../wwwroot/img/mascotas/reptils/tortuga/reptil_basico.png'),
    'tortuga acuatica': require('../../wwwroot/img/mascotas/reptils/Tortuga acuática/reptil_basico.png'),
    'varano': require('../../wwwroot/img/mascotas/reptils/Varano/reptil_basico.png'),
  },
  pez: {
    'betta': require('../../wwwroot/img/mascotas/pezs/betta/pez_basico.png'),
    'ciclido': require('../../wwwroot/img/mascotas/pezs/Cíclido/pez_basico.png'),
    'goldfish': require('../../wwwroot/img/mascotas/pezs/Goldfish/pez_basico.png'),
    'guppy': require('../../wwwroot/img/mascotas/pezs/Guppy/pez_basico.png'),
    'koi': require('../../wwwroot/img/mascotas/pezs/Koi/pez_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/pezs/otra raza/pez_basico.png'),
  },
  hamster: {
    'campbell': require('../../wwwroot/img/mascotas/hamsters/campbell/hamster_basico.png'),
    'chino': require('../../wwwroot/img/mascotas/hamsters/chino/hamster_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/hamsters/otra raza/hamster_basico.png'),
    'roborovski': require('../../wwwroot/img/mascotas/hamsters/roborovski/hamster_basico.png'),
    'ruso': require('../../wwwroot/img/mascotas/hamsters/ruso/hamster_basico.png'),
    'sirio (doradito)': require('../../wwwroot/img/mascotas/hamsters/sirio (doradito)/hamster_basico.png'),
  },
  raton: {
    'blanco de laboratorio': require('../../wwwroot/img/mascotas/ratons/blanco de laboratorio/raton_basico.png'),
    'domestico': require('../../wwwroot/img/mascotas/ratons/doméstico/raton_basico.png'),
    'fancy': require('../../wwwroot/img/mascotas/ratons/fancy/raton_basico.png'),
    'otra raza': require('../../wwwroot/img/mascotas/ratons/otra raza/raton_basico.png'),
    'rata dumbo': require('../../wwwroot/img/mascotas/ratons/rata dumbo/raton_basico.png'),
    'rata rex': require('../../wwwroot/img/mascotas/ratons/rata rex/raton_basico.png'),
  },
};

// Alias: nombre de raza (tabla `razas` de Supabase) → carpeta real en wwwroot/img.
// No todas las razas del catálogo de la app existen tal cual en el MVC original.
const ALIASES = {
  perro: {
    'bulldog frances': 'bulldog',
    'poodle': 'caniche',
    'dachshund (salchicha)': 'salchicha',
    'mestizo / sin raza definida': 'otra raza',
  },
  gato: {
    'bengali': 'bengala',
    'domestico comun': 'otra raza',
    'mestizo / sin raza definida': 'otra raza',
  },
  conejo: {
    'belier (orejas caidas)': 'belier',
    'comun / sin raza definida': 'otra raza',
  },
  ave: {
    'canario': 'otra raza',
    'cotorra': 'otra raza',
    'loro': 'otra raza',
    'otra / sin especificar': 'otra raza',
  },
  reptil: {
    'tortuga de tierra': 'tortuga',
    'tortuga de agua': 'tortuga acuatica',
    'gecko': 'gecko crestado',
    'otro / sin especificar': 'otra raza',
  },
  pez: {
    'tetra': 'otra raza',
    'otro / sin especificar': 'otra raza',
  },
  hamster: {
    'sirio (dorado)': 'sirio (doradito)',
    'roborowski': 'roborovski',
    'otro / sin especificar': 'otra raza',
  },
  raton: {
    'domestico comun': 'domestico',
    'otro / sin especificar': 'otra raza',
  },
};

function normalizarRaza(raza) {
  return (raza ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * resolveMascotaBasicoImage(especie, razaNombre)
 * Busca la imagen básica de la mascota (Registro Paso 3/4) para la especie
 * y raza dadas. Si la raza no tiene imagen propia, cae en 'otra raza' de
 * esa especie; si la especie tampoco existe, devuelve el FALLBACK genérico.
 */
export function resolveMascotaBasicoImage(especie, razaNombre) {
  const mapaEspecie = MASCOTAS_POR_ESPECIE_Y_RAZA[especie];
  if (!mapaEspecie) return FALLBACK;

  const razaNorm = normalizarRaza(razaNombre);
  if (mapaEspecie[razaNorm]) return mapaEspecie[razaNorm];

  const alias = ALIASES[especie]?.[razaNorm];
  if (alias && mapaEspecie[alias]) return mapaEspecie[alias];

  return mapaEspecie['otra raza'] ?? FALLBACK;
}
