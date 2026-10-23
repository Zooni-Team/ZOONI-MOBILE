/**
 * lugaresOsm.js — Veterinarias, pet shops y peluquerías caninas desde OpenStreetMap
 *
 * Es el proveedor GRATUITO de la pestaña "Servicios" de Comunidad, y el que se
 * usa por defecto.
 *
 * Antes esto dependía de Google Places (ver lugaresApi.js), que exige una clave
 * de API con facturación activada: sin esa clave la pestaña quedaba vacía y el
 * mapa no mostraba una sola veterinaria. La API de Overpass consulta los mismos
 * datos de OpenStreetMap que ya alimentan los tiles del mapa de Comunidad, es
 * pública y NO necesita clave, cuenta ni tarjeta.
 *
 * ─── QUÉ SE CONSULTA ─────────────────────────────────────────────────────────
 * Las tres categorías salen de etiquetas estándar de OSM:
 *   · veterinaria → amenity=veterinary
 *   · petshop     → shop=pet
 *   · peluqueria  → shop=pet_grooming
 * `paseador` no está: los paseadores son personas, no locales, y OSM mapea
 * lugares. Esos siguen viniendo de la tabla `servicios` de Supabase.
 *
 * ─── LÍMITES RESPECTO DE GOOGLE ──────────────────────────────────────────────
 * OSM no tiene puntaje ni reseñas, así que `rating` va en null (la lista y el
 * popup ya lo contemplan y simplemente no muestran la estrella). El horario
 * viene como texto libre (`opening_hours`), que no se puede evaluar de forma
 * confiable sin una librería: `abiertoAhora` también queda en null.
 *
 * A cambio: sin clave, sin costo y sin límite de cuota por proyecto.
 *
 * ─── BUEN USO DE LA API PÚBLICA ──────────────────────────────────────────────
 * Overpass es un servicio comunitario y gratuito; abusarlo hace que corte por
 * IP. Por eso acá hay: caché por área, un tope de superficie consultable, un
 * timeout corto y varios servidores espejo. Nunca lanza error hacia arriba.
 *
 * ─── VELOCIDAD ───────────────────────────────────────────────────────────────
 * Overpass tarda segundos, y Comunidad tiene que sentirse instantáneo:
 *   · Las tres categorías van en UNA consulta (antes eran tres, y Overpass
 *     atiende de a dos pedidos por IP: el tercero hacía cola).
 *   · Se consulta un área más grande que la visible, alineada a una grilla:
 *     mover el mapa unas cuadras o acercarlo cae dentro de lo ya traído.
 *   · El caché se guarda en el navegador: al volver a entrar, los locales de
 *     la zona aparecen al instante y no se vuelve a consultar.
 */
import { Platform } from 'react-native';

/*
  Espejos públicos: instancias distintas de la misma base de datos. Se les
  pregunta a todos a la vez y gana el primero que contesta bien (ver
  consultarOverpass): suelen estar saturados, y uno colgado ya no hace esperar
  a los demás.
*/
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Servidores que fallaron por algo que no se arregla reintentando (CORS, 403,
// 406): se saltean el resto de la sesión en vez de volver a pegarles en cada
// movimiento del mapa. Si fallan todos, se vuelve a probar con la lista entera.
const endpointsDescartados = new Set();

// Etiqueta de OSM por cada filtro de la pestaña Servicios. Las claves coinciden
// con `tipo` en la tabla `servicios` para que todo hable el mismo idioma (los
// iconos y colores de TabServicios se indexan por ahí).
const TAGS = {
  veterinaria: '["amenity"="veterinary"]',
  petshop: '["shop"="pet"]',
  peluqueria: '["shop"="pet_grooming"]',
};

const TIPOS_OSM = Object.keys(TAGS);

/*
  Superficie máxima consultable, en grados cuadrados (~1 grado ≈ 111 km).
  0.25 ≈ medio grado de lado, más o menos el área metropolitana de Buenos Aires.

  Con el mapa muy alejado, Overpass tendría que barrer medio país para devolver
  miles de puntos que además no entran en la pantalla: tarda, y el servidor
  público lo corta. Por encima de este tope no se consulta y la pestaña muestra
  solo los servicios propios (el aviso de "acercá el mapa" lo pone TabServicios).
*/
const AREA_MAX_GRADOS2 = 0.25;

// Tope de resultados de la consulta (las tres categorías juntas, en el área
// agrandada por la grilla).
const MAX_RESULTADOS = 200;

// Espera máxima de la consulta (a todos los espejos juntos). Una consulta chica
// responde en 1-3 s; más que esto es que están todos saturados.
const TIMEOUT_MS = 10000;

/*
  Grilla (en grados, ~2,2 km) a la que se agranda el área consultada. Así el
  área consultada no cambia con cada arrastre del mapa: mientras la vista quede
  dentro, sale del caché sin consultar nada.
*/
const GRILLA = 0.02;

/*
  Overpass EXIGE un User-Agent que identifique a la aplicación: sin él los
  espejos responden 429 ("Please include a meaningful User-Agent string...") y
  overpass-api.de directamente 406. Verificado contra los tres servidores.

  En el navegador este header no se puede fijar —User-Agent es un "forbidden
  header name" y fetch lo descarta— pero ahí no hace falta: el navegador manda
  su propio User-Agent real, que Overpass acepta. En nativo sí se aplica.
*/
const USER_AGENT = 'ZooniApp/1.0 (app de mascotas; contacto en la app)';

/** El proveedor gratuito está siempre disponible: no hay clave que configurar. */
export function hayProveedorGratuito() {
  return true;
}

/** ¿El área visible es lo bastante chica como para consultarla? */
export function areaConsultable(bbox) {
  if (!bbox) return false;
  const alto  = Math.abs(bbox.lat_max - bbox.lat_min);
  const ancho = Math.abs(bbox.lng_max - bbox.lng_min);
  return alto * ancho <= AREA_MAX_GRADOS2;
}

// ─── CACHÉ ────────────────────────────────────────────────────────────────────

/*
  El mapa dispara una búsqueda cada vez que el usuario mueve la vista. Sin
  caché, arrastrarlo un rato genera decenas de consultas a un servidor público
  gratuito por los mismos locales — que es exactamente lo que hace que Overpass
  bloquee por IP.

  Cada entrada guarda el área que se consultó: cualquier vista que entre en un
  área ya traída se responde de acá. Los locales casi no cambian, así que dura
  un día, y en web se guarda en localStorage para sobrevivir a la recarga.
*/
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 30;
const CACHE_STORAGE_KEY = 'zooni:lugaresOsm:v2';
let cache = leerCacheGuardado(); // [{ area, ts, datos }]

function storage() {
  try { return Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage : null; }
  catch { return null; }
}

function leerCacheGuardado() {
  try {
    const crudo = storage()?.getItem(CACHE_STORAGE_KEY);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter((e) => Date.now() - e.ts < CACHE_TTL_MS) : [];
  } catch { return []; }
}

function guardarCache() {
  try { storage()?.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache)); } catch { /* lleno o bloqueado */ }
}

const contiene = (a, b) =>
  a.lat_min <= b.lat_min && a.lng_min <= b.lng_min && a.lat_max >= b.lat_max && a.lng_max >= b.lng_max;

function deCache(bbox) {
  const hit = cache.find((e) => Date.now() - e.ts < CACHE_TTL_MS && contiene(e.area, bbox));
  return hit ? hit.datos : null;
}

function alCache(area, datos) {
  // La más nueva adelante; las que quedan contenidas en ella ya no hacen falta
  cache = [{ area, ts: Date.now(), datos }, ...cache.filter((e) => !contiene(area, e.area))]
    .slice(0, CACHE_MAX);
  guardarCache();
}

/** El área visible agrandada hasta la grilla (ver GRILLA). */
function areaAConsultar(bbox) {
  const abajo = (n) => Math.floor(n / GRILLA) * GRILLA;
  const arriba = (n) => Math.ceil(n / GRILLA) * GRILLA;
  const fix = (n) => Number(n.toFixed(4));
  return {
    lat_min: fix(abajo(bbox.lat_min)), lng_min: fix(abajo(bbox.lng_min)),
    lat_max: fix(arriba(bbox.lat_max)), lng_max: fix(arriba(bbox.lng_max)),
  };
}

// Consultas en vuelo por área: si dos partes de la app piden la misma zona a
// la vez, comparten el pedido en vez de duplicarlo.
const enVuelo = new Map();

// ─── MAPEO ────────────────────────────────────────────────────────────────────

/** Dirección legible a partir de las etiquetas addr:* de OSM. */
function direccionDe(tags) {
  const calle = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const ciudad = tags['addr:city'] ?? tags['addr:suburb'] ?? null;
  const partes = [calle || null, ciudad].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

/**
 * Elemento de Overpass → misma forma que una fila de `servicios`, para que
 * TabServicios, los marcadores del mapa y PopupServicio no tengan que
 * distinguir de dónde vino cada uno.
 */
/**
 * Categoría del elemento según sus etiquetas. Un local puede tener varias (una
 * veterinaria de barrio que además vende alimento es `amenity=veterinary` +
 * `shop=pet`): se queda con una sola, y `veterinaria` va primero — para esta
 * app, ante la duda, un lugar es antes veterinaria que pet shop.
 */
function tipoDe(tags) {
  if (tags.amenity === 'veterinary') return 'veterinaria';
  if (tags.shop === 'pet') return 'petshop';
  if (tags.shop === 'pet_grooming') return 'peluqueria';
  return null;
}

function mapLugar(el) {
  const tags = el.tags ?? {};
  const tipo = tipoDe(tags);
  // Los nodos traen lat/lon directo; las ways y relations (un edificio mapeado
  // como polígono) traen el centroide en `center` gracias a `out center`.
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;

  return {
    // Prefijo `osm:` + tipo de elemento para que nunca choque con los ids
    // numéricos de Supabase ni con los `g:` de Google (dos servicios con la
    // misma key rompen la FlatList y los marcadores).
    id: `osm:${el.type}:${el.id}`,
    tipo,
    nombre: tags.name ?? tags['name:es'] ?? tags.operator ?? 'Sin nombre',
    direccion: direccionDe(tags),
    telefono: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null,
    lat,
    lng,
    // OSM no tiene ficha propia para enlazar, así que el botón "Ver en Google
    // Maps" del popup apunta a las coordenadas.
    google_maps_url: lat != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null,
    // OSM no tiene reseñas ni horario evaluable (ver cabecera).
    rating: null,
    ratingCount: 0,
    abiertoAhora: null,
    // El horario en crudo sí sirve como dato: "Lu-Vi 09:00-19:00" se entiende.
    horario: tags.opening_hours ?? null,
    sitioWeb: tags.website ?? tags['contact:website'] ?? null,
    descripcion: null,
    // Marca el origen: PopupServicio oculta "Enviar mensaje" en estos, porque
    // un local de OSM no tiene usuario en Zooni con quien chatear.
    origen: 'osm',
  };
}

// ─── BÚSQUEDA ─────────────────────────────────────────────────────────────────

/** Consulta Overpass QL con las tres categorías dentro del área. */
function armarConsulta(area) {
  // Overpass usa el orden (sur, oeste, norte, este).
  const caja = `${area.lat_min},${area.lng_min},${area.lat_max},${area.lng_max}`;
  // `nwr` = nodes + ways + relations: una veterinaria puede estar mapeada como
  // punto o como el polígono del edificio, y las dos formas son igual de comunes.
  const partes = TIPOS_OSM.map((t) => `nwr${TAGS[t]}(${caja});`).join('');
  return `[out:json][timeout:10];(${partes});out center ${MAX_RESULTADOS};`;
}

/*
  Les pregunta a todos los espejos a la vez y se queda con la primera respuesta
  válida; a las demás las corta.

  Antes se probaban de a uno, con 12 s de espera cada uno: con los espejos
  saturados (pasa seguido: colgados o devolviendo 502) eran más de 30 s hasta
  ver una veterinaria. En paralelo, lo que tarde el más rápido. No carga de más
  a los servidores: cada zona se consulta una vez y después sale del caché.
*/
async function consultarOverpass(consulta) {
  const candidatos = ENDPOINTS.filter((e) => !endpointsDescartados.has(e));
  const lista = candidatos.length ? candidatos : ENDPOINTS;
  const abortadores = lista.map(() => new AbortController());
  // Timeout propio: sin esto, si todos están colgados la pestaña queda
  // esperando para siempre.
  const temporizador = setTimeout(() => abortadores.forEach((a) => a.abort()), TIMEOUT_MS);

  const pedir = async (endpoint, abortador) => {
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        signal: abortador.signal,
        // En web, User-Agent no se puede fijar y sólo agregaría un preflight
        // CORS: se manda únicamente el Content-Type de un formulario común.
        headers: Platform.OS === 'web'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(consulta)}`,
      });
    } catch (e) {
      // TypeError = error de red/CORS: ese servidor no le responde a la app
      if (e instanceof TypeError) endpointsDescartados.add(endpoint);
      throw e;
    }
    if (!res.ok) {
      // 429 = demasiadas consultas, 502/504 = espejo saturado: puede andar en
      // la próxima. 403/405/406 no se arreglan reintentando.
      if ([403, 405, 406].includes(res.status)) endpointsDescartados.add(endpoint);
      throw new Error(`Overpass ${res.status}`);
    }
    // Overpass a veces contesta 200 con un cuerpo XML de error ("runtime
    // error: ... too busy"): json() tira y ese espejo cuenta como fallido.
    return res.json();
  };

  try {
    return await Promise.any(lista.map((e, i) => pedir(e, abortadores[i])));
  } catch (e) {
    throw e?.errors?.[0] ?? new Error('Overpass no respondió');
  } finally {
    clearTimeout(temporizador);
    abortadores.forEach((a) => a.abort());
  }
}

/** Nombre comparable: sin tildes, sin mayúsculas, sin puntuación. */
function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/*
  Un mismo local suele estar mapeado dos veces en OSM: como nodo (el punto del
  negocio) y como way (el polígono del edificio). Sin esto aparecen dos
  marcadores pegados con el mismo nombre.
*/
function quitarRepetidos(lugares) {
  const vistos = new Set();
  return lugares.filter((l) => {
    const clave = `${normalizar(l.nombre)}|${l.lat?.toFixed(3)},${l.lng?.toFixed(3)}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** Los locales de las tres categorías en el área; del caché si ya se trajo. */
async function buscarTodos(bbox) {
  const enCache = deCache(bbox);
  if (enCache) return enCache;

  const area = areaAConsultar(bbox);
  const clave = JSON.stringify(area);
  if (!enVuelo.has(clave)) {
    const pedido = consultarOverpass(armarConsulta(area))
      .then((json) => {
        const lugares = quitarRepetidos(
          (json.elements ?? [])
            .map(mapLugar)
            .filter((l) => l.tipo && l.lat != null && l.lng != null)
            // Sin nombre no sirve de nada en la lista: es un punto anónimo.
            .filter((l) => l.nombre !== 'Sin nombre'),
        );
        alCache(area, lugares);
        return lugares;
      })
      .finally(() => enVuelo.delete(clave));
    enVuelo.set(clave, pedido);
  }
  return enVuelo.get(clave);
}

/**
 * Locales reales en el área visible del mapa, desde OpenStreetMap.
 *
 * @param {{lat_min,lat_max,lng_min,lng_max}} bbox  área visible
 * @param {string} tipo  'todos' | 'veterinaria' | 'petshop' | 'peluqueria'
 * @returns {Promise<Array>} lista con la forma de `servicios` ([] si no aplica)
 *
 * Nunca tira error: si Overpass falla, Comunidad tiene que seguir mostrando lo
 * que haya en Supabase igual.
 */
export async function buscarLugaresOsm(bbox, tipo = 'todos') {
  if (!bbox || !areaConsultable(bbox)) return [];
  if (tipo !== 'todos' && !TIPOS_OSM.includes(tipo)) return [];

  try {
    const lugares = await buscarTodos(bbox);
    return tipo === 'todos' ? lugares : lugares.filter((l) => l.tipo === tipo);
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('[lugares] OpenStreetMap:', e?.message);
    return [];
  }
}
