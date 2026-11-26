import { buscarLugaresOsm, areaConsultable } from './lugaresOsm';
import { distanciaMetros } from '../utils/geo';
import { claveComparable } from '../utils/texto';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

export function hayClaveGoogle() {
  return API_KEY.length > 0;
}

const CONSULTAS = {
  veterinaria: 'veterinaria',
  petshop: 'pet shop veterinaria productos para mascotas',
  peluqueria: 'peluquería canina',
};

const TIPOS_GOOGLE = Object.keys(CONSULTAS);

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

function mapLugar(place, tipo) {
  return {
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
    origen: 'google',
  };
}

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
      locationRestriction: {
        rectangle: {
          low:  { latitude: bbox.lat_min, longitude: bbox.lng_min },
          high: { latitude: bbox.lat_max, longitude: bbox.lng_max },
        },
      },
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Places ${res.status}: ${detalle.slice(0, 200)}`);
  }

  const json = await res.json();
  const lugares = (json.places ?? [])
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .filter((p) => p.location?.latitude != null)
    .map((p) => mapLugar(p, tipo));

  cache.set(clave, { ts: Date.now(), datos: lugares });
  return lugares;
}

export async function buscarLugaresGoogle(bbox, tipo = 'todos', { signal } = {}) {
  if (!hayClaveGoogle() || !bbox) return [];

  const tipos = tipo === 'todos' ? TIPOS_GOOGLE : (TIPOS_GOOGLE.includes(tipo) ? [tipo] : []);
  if (!tipos.length) return [];

  const resultados = await Promise.allSettled(
    tipos.map((t) => buscarCategoria(bbox, t, signal)),
  );

  const lugares = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled') lugares.push(...r.value);
    else if (r.reason?.name !== 'AbortError' && __DEV__) console.warn('[lugares] Google Places:', r.reason?.message);
  }
  return lugares;
}

export async function buscarLugares(bbox, tipo = 'todos', opciones = {}) {
  if (hayClaveGoogle()) return buscarLugaresGoogle(bbox, tipo, opciones);
  return buscarLugaresOsm(bbox, tipo, opciones);
}

export function areaBuscable(bbox) {
  return hayClaveGoogle() ? !!bbox : areaConsultable(bbox);
}

const distanciaM = (a, b) => distanciaMetros(a, b) ?? Infinity;

export function combinarServicios(propios = [], deGoogle = []) {
  const salida = [...propios];

  for (const g of deGoogle) {
    const nombreG = claveComparable(g.nombre);
    const repetido = propios.find(
      (p) => claveComparable(p.nombre) === nombreG && distanciaM(p, g) < 150,
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
