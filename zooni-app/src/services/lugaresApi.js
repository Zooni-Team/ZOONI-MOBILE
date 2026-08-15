/**
 * lugaresApi.js — Veterinarias, pet shops y peluquerías caninas reales
 *
 * Este módulo decide DE DÓNDE salen los locales que ve el usuario en la pestaña
 * "Servicios" de Comunidad, y combina lo que venga con los servicios propios de
 * Zooni. Hay dos proveedores:
 *
 *   · OpenStreetMap (services/lugaresOsm.js) — GRATIS, sin clave. El que se usa
 *     por defecto y el que ve cualquiera que clone el repo y levante la app.
 *   · Google Places — opcional, solo si hay clave configurada. Aporta puntaje,
 *     cantidad de reseñas y "abierto ahora", que OSM no tiene.
 *
 * ─── POR QUÉ EL CAMBIO ───────────────────────────────────────────────────────
 * Antes esto era solo Google Places, que exige una clave de API con facturación
 * activada. Sin esa clave —el caso real de la app— la pestaña quedaba vacía y
 * el mapa no mostraba una sola veterinaria: la tabla `servicios` de Supabase
 * está prácticamente vacía y era lo único que quedaba.
 *
 * Ahora el camino por defecto NO necesita clave, cuenta ni tarjeta: los datos
 * salen de OpenStreetMap, el mismo proyecto que ya provee los tiles del mapa de
 * Comunidad. Ver services/lugaresOsm.js para los detalles y los límites.
 *
 * ─── GOOGLE (opcional, ya no hace falta) ─────────────────────────────────────
 * Si algún día se quiere el puntaje y el "abierto ahora" de Google:
 *
 *   1. En console.cloud.google.com: crear proyecto → habilitar "Places API (New)"
 *      → Credenciales → Crear clave de API. Requiere facturación activada.
 *   2. RESTRINGIR la clave, porque al ser EXPO_PUBLIC_ viaja al cliente y es
 *      visible: restricción de aplicación por referente HTTP (tu dominio de
 *      Vercel) y restricción de API a Places API (New) únicamente.
 *   3. Agregar en zooni-app/.env  (y en las variables de entorno de Vercel):
 *
 *        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
 *
 *   4. Reiniciar Expo: las EXPO_PUBLIC_ se incrustan en tiempo de build.
 *
 * Con la clave puesta, Google reemplaza a OSM (es el mismo dato pero más rico).
 * Sin clave —lo normal— se usa OSM y no falta nada esencial.
 *
 * Se usa Places API (New) — Text Search — y no Nearby Search porque "peluquería
 * canina" no existe como tipo de lugar en Google: Nearby solo tiene
 * `veterinary_care` y `pet_store`. Con Text Search las tres categorías se
 * resuelven igual, en español y con el mismo código.
 */

import { buscarLugaresOsm, areaConsultable } from './lugaresOsm';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

/** ¿Está configurada la integración con Google? */
export function hayClaveGoogle() {
  return API_KEY.length > 0;
}

// Texto de búsqueda por cada filtro de la pestaña Servicios. Las claves
// coinciden con `tipo` en la tabla `servicios` para que todo hable el mismo
// idioma (los iconos y colores de TabServicios se indexan por ahí).
const CONSULTAS = {
  veterinaria: 'veterinaria',
  petshop: 'pet shop veterinaria productos para mascotas',
  peluqueria: 'peluquería canina',
};

// `paseador` no está: los paseadores son personas, no locales, y Google no los
// lista. Esos siguen viniendo de la tabla `servicios`.
const TIPOS_GOOGLE = Object.keys(CONSULTAS);

// Solo los campos que se muestran. El field mask es obligatorio en Places (New)
// y además define el precio: pedir campos de más sale más caro.
const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.googleMapsUri',
  'places.currentOpeningHours.openNow',
  'places.businessStatus',
].join(',');

// ─── CACHÉ ────────────────────────────────────────────────────────────────────

/*
  Cada consulta a Places se cobra, y el mapa dispara una búsqueda cada vez que
  el usuario mueve la vista. Sin caché, arrastrar el mapa un rato genera
  decenas de consultas pagas por los mismos locales.

  La clave redondea el área a ~0,01° (≈1 km): mover el mapa unas cuadras
  reutiliza el resultado en vez de volver a pagar.
*/
const CACHE_TTL_MS = 10 * 60 * 1000;
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

/**
 * Lugar de Google → misma forma que una fila de `servicios`, para que
 * TabServicios, los marcadores del mapa y PopupServicio no tengan que
 * distinguir de dónde vino cada uno.
 */
function mapLugar(place, tipo) {
  return {
    // Prefijo `g:` para que nunca choque con los ids numéricos de Supabase
    // (dos servicios con la misma key rompen la FlatList y los marcadores).
    id: `g:${place.id}`,
    tipo,
    nombre: place.displayName?.text ?? 'Sin nombre',
    direccion: place.formattedAddress ?? null,
    telefono: place.nationalPhoneNumber ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    google_maps_url: place.googleMapsUri ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? 0,
    abiertoAhora: place.currentOpeningHours?.openNow ?? null,
    descripcion: null,
    // Marca el origen: PopupServicio oculta "Enviar mensaje" en estos, porque
    // un negocio de Google no tiene usuario en Zooni con quien chatear.
    origen: 'google',
  };
}

// ─── BÚSQUEDA ─────────────────────────────────────────────────────────────────

async function buscarCategoria(bbox, tipo, signal) {
  const clave = claveCache(bbox, tipo);
  const enCache = deCache(clave);
  if (enCache) return enCache;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify({
      textQuery: CONSULTAS[tipo],
      languageCode: 'es',
      maxResultCount: 20,
      // Restricción, no sesgo: así no aparecen locales de la otra punta de la
      // ciudad cuando la zona visible no tiene ninguno.
      locationRestriction: {
        rectangle: {
          low:  { latitude: bbox.lat_min, longitude: bbox.lng_min },
          high: { latitude: bbox.lat_max, longitude: bbox.lng_max },
        },
      },
    }),
  });

  if (!res.ok) {
    // 403 suele ser clave sin restringir/sin Places API habilitada; 429, cuota.
    const detalle = await res.text().catch(() => '');
    throw new Error(`Places ${res.status}: ${detalle.slice(0, 200)}`);
  }

  const json = await res.json();
  const lugares = (json.places ?? [])
    // Los cerrados definitivamente siguen figurando en Google; no sirven.
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .filter((p) => p.location?.latitude != null)
    .map((p) => mapLugar(p, tipo));

  cache.set(clave, { ts: Date.now(), datos: lugares });
  return lugares;
}

/**
 * Locales reales en el área visible del mapa.
 *
 * @param {{lat_min,lat_max,lng_min,lng_max}} bbox  área visible
 * @param {string} tipo  'todos' | 'veterinaria' | 'petshop' | 'peluqueria'
 * @returns {Promise<Array>} lista con la forma de `servicios` ([] si no hay clave)
 *
 * Nunca tira error: si Google falla, Comunidad tiene que seguir mostrando lo
 * que haya en Supabase igual.
 */
export async function buscarLugaresGoogle(bbox, tipo = 'todos', { signal } = {}) {
  if (!hayClaveGoogle() || !bbox) return [];

  const tipos = tipo === 'todos' ? TIPOS_GOOGLE : (TIPOS_GOOGLE.includes(tipo) ? [tipo] : []);
  if (!tipos.length) return [];

  // allSettled y no all: que una categoría falle no puede dejar sin resultados
  // a las otras dos.
  const resultados = await Promise.allSettled(
    tipos.map((t) => buscarCategoria(bbox, t, signal)),
  );

  const lugares = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled') lugares.push(...r.value);
    else if (r.reason?.name !== 'AbortError') console.warn('[lugares] Google Places:', r.reason?.message);
  }
  return lugares;
}

// ─── PROVEEDOR EFECTIVO ───────────────────────────────────────────────────────

/**
 * Locales reales en el área visible, del proveedor que corresponda.
 *
 * Es la única función que debería llamar el resto de la app: elige proveedor
 * sola, así que ni Comunidad ni las pestañas tienen que saber si hay clave de
 * Google configurada.
 *
 * @param {{lat_min,lat_max,lng_min,lng_max}} bbox  área visible
 * @param {string} tipo  'todos' | 'veterinaria' | 'petshop' | 'peluqueria'
 * @returns {Promise<Array>} lista con la forma de `servicios`
 *
 * Nunca tira error: si el proveedor falla, Comunidad tiene que seguir mostrando
 * los servicios propios igual.
 */
export async function buscarLugares(bbox, tipo = 'todos', opciones = {}) {
  // Con clave, Google: mismos locales pero con puntaje y "abierto ahora".
  if (hayClaveGoogle()) return buscarLugaresGoogle(bbox, tipo, opciones);
  // Sin clave —el caso normal—, OpenStreetMap: gratis y sin configurar nada.
  return buscarLugaresOsm(bbox, tipo, opciones);
}

/**
 * ¿Se puede buscar en el área que se está mirando?
 *
 * Solo dice que no cuando el mapa está tan alejado que el proveedor gratuito no
 * consulta (ver AREA_MAX_GRADOS2 en lugaresOsm.js). Con clave de Google no hay
 * tope: la restricción por rectángulo la resuelve el propio Places.
 */
export function areaBuscable(bbox) {
  return hayClaveGoogle() ? !!bbox : areaConsultable(bbox);
}

// ─── COMBINAR CON LOS SERVICIOS PROPIOS ───────────────────────────────────────

/** Nombre comparable: sin tildes, sin mayúsculas, sin puntuación. */
function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Metros entre dos puntos (haversine). */
function distanciaM(a, b) {
  if ([a?.lat, a?.lng, b?.lat, b?.lng].some((v) => v == null)) return Infinity;
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Une los servicios propios con los de Google, sin repetir.
 *
 * Un mismo local suele estar en los dos lados (alguien lo cargó a mano y Google
 * también lo conoce). Se considera repetido si el nombre normalizado coincide y
 * están a menos de 150 m. Gana el propio —tiene datos curados y usuario para
 * chatear— pero se le completan los huecos con lo de Google.
 */
export function combinarServicios(propios = [], deGoogle = []) {
  const salida = [...propios];

  for (const g of deGoogle) {
    const nombreG = normalizar(g.nombre);
    const repetido = propios.find(
      (p) => normalizar(p.nombre) === nombreG && distanciaM(p, g) < 150,
    );
    if (repetido) {
      repetido.telefono ??= g.telefono;
      repetido.direccion ??= g.direccion;
      repetido.google_maps_url ??= g.google_maps_url;
      repetido.rating ??= g.rating;
      repetido.abiertoAhora ??= g.abiertoAhora;
      continue;
    }
    salida.push(g);
  }
  return salida;
}
