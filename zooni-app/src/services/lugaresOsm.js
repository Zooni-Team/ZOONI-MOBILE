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
 */

// Espejos públicos, en orden. Si el primero está saturado (429/504) se prueba
// el siguiente: son instancias distintas de la misma base de datos.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

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

// Tope de resultados por categoría (el mismo que se pedía a Google).
const MAX_RESULTADOS = 30;

const TIMEOUT_MS = 12000;

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

  La clave redondea el área a ~0,01° (≈1 km): mover el mapa unas cuadras
  reutiliza el resultado en vez de volver a consultar.
*/
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function claveCache(bbox, tipo) {
  const r = (n) => Math.round(n * 100) / 100;
  return `${tipo}|${r(bbox.lat_min)},${r(bbox.lng_min)},${r(bbox.lat_max)},${r(bbox.lng_max)}`;
}

function deCache(clave) {
  const hit = cache.get(clave);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(clave); return null; }
  return hit.datos;
}

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
function mapLugar(el, tipo) {
  const tags = el.tags ?? {};
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

/** Consulta Overpass QL para una categoría dentro del área visible. */
function armarConsulta(bbox, tipo) {
  // Overpass usa el orden (sur, oeste, norte, este).
  const area = `${bbox.lat_min},${bbox.lng_min},${bbox.lat_max},${bbox.lng_max}`;
  // `nwr` = nodes + ways + relations: una veterinaria puede estar mapeada como
  // punto o como el polígono del edificio, y las dos formas son igual de comunes.
  return `[out:json][timeout:20];nwr${TAGS[tipo]}(${area});out center ${MAX_RESULTADOS};`;
}

/** Prueba los espejos en orden hasta que uno responda. */
async function consultarOverpass(consulta, signal) {
  let ultimoError = null;

  for (const endpoint of ENDPOINTS) {
    // Timeout propio: sin esto, un espejo colgado deja la pestaña esperando
    // para siempre en vez de pasar al siguiente.
    const abortador = new AbortController();
    const temporizador = setTimeout(() => abortador.abort(), TIMEOUT_MS);
    // Si quien llama cancela (el usuario siguió moviendo el mapa), se corta todo.
    const alCancelar = () => abortador.abort();
    signal?.addEventListener?.('abort', alCancelar);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: abortador.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(consulta)}`,
      });
      if (!res.ok) {
        // 429 = demasiadas consultas, 504 = espejo saturado. Los dos se
        // resuelven probando otro servidor.
        ultimoError = new Error(`Overpass ${res.status}`);
        continue;
      }
      // Overpass a veces contesta 200 con un cuerpo XML de error ("runtime
      // error: ... too busy"). Ahí json() tira y se cae al catch, que prueba el
      // espejo siguiente — que es justo lo que corresponde hacer.
      return await res.json();
    } catch (e) {
      // Si canceló quien llama, no tiene sentido seguir probando espejos.
      if (signal?.aborted) throw e;
      ultimoError = e;
    } finally {
      clearTimeout(temporizador);
      signal?.removeEventListener?.('abort', alCancelar);
    }
  }

  throw ultimoError ?? new Error('Overpass no respondió');
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

async function buscarCategoria(bbox, tipo, signal) {
  const clave = claveCache(bbox, tipo);
  const enCache = deCache(clave);
  if (enCache) return enCache;

  const json = await consultarOverpass(armarConsulta(bbox, tipo), signal);

  const lugares = quitarRepetidos(
    (json.elements ?? [])
      .map((el) => mapLugar(el, tipo))
      .filter((l) => l.lat != null && l.lng != null)
      // Sin nombre no sirve de nada en la lista: es un punto anónimo.
      .filter((l) => l.nombre !== 'Sin nombre'),
  );

  cache.set(clave, { ts: Date.now(), datos: lugares });
  return lugares;
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
export async function buscarLugaresOsm(bbox, tipo = 'todos', { signal } = {}) {
  if (!bbox || !areaConsultable(bbox)) return [];

  const tipos = tipo === 'todos' ? TIPOS_OSM : (TIPOS_OSM.includes(tipo) ? [tipo] : []);
  if (!tipos.length) return [];

  // allSettled y no all: que una categoría falle no puede dejar sin resultados
  // a las otras dos.
  const resultados = await Promise.allSettled(
    tipos.map((t) => buscarCategoria(bbox, t, signal)),
  );

  const lugares = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled') lugares.push(...r.value);
    else if (r.reason?.name !== 'AbortError') console.warn('[lugares] OpenStreetMap:', r.reason?.message);
  }

  /*
    Un mismo local puede estar en dos categorías a la vez: es muy común que una
    veterinaria de barrio también venda alimento y esté etiquetada
    `amenity=veterinary` + `shop=pet`. Como el id sale del elemento de OSM, esas
    dos apariciones traen la MISMA key: la FlatList de la pestaña y los
    marcadores del mapa se rompen con keys repetidas.

    Se queda la primera, y el orden de TIPOS_OSM pone `veterinaria` adelante:
    ante la duda, para esta app un lugar es antes veterinaria que pet shop.
  */
  const vistos = new Set();
  return lugares.filter((l) => {
    if (vistos.has(l.id)) return false;
    vistos.add(l.id);
    return true;
  });
}
