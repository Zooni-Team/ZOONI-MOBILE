import { Platform } from 'react-native';
import { claveComparable } from '../utils/texto';

const URL_LUGARES = Platform.OS === 'web'
  ? '/api/lugares'
  : 'https://zooni-mobile.vercel.app/api/lugares';

const PAUSA_TRAS_FALLO_MS = 2 * 60 * 1000;
const fallosRecientes = new Map();

const TAGS = {
  veterinaria: '["amenity"="veterinary"]',
  petshop: '["shop"="pet"]',
  peluqueria: '["shop"="pet_grooming"]',
};

const TIPOS_OSM = Object.keys(TAGS);

const AREA_MAX_GRADOS2 = 0.25;

const TIMEOUT_MS = 25000;

const GRILLA = 0.02;

export function hayProveedorGratuito() {
  return true;
}

export function areaConsultable(bbox) {
  if (!bbox) return false;
  const alto  = Math.abs(bbox.lat_max - bbox.lat_min);
  const ancho = Math.abs(bbox.lng_max - bbox.lng_min);
  return alto * ancho <= AREA_MAX_GRADOS2;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 30;
const CACHE_STORAGE_KEY = 'zooni:lugaresOsm:v3';
let cache = leerCacheGuardado();

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
  try { storage()?.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache)); } catch {  }
}

const contiene = (a, b) =>
  a.lat_min <= b.lat_min && a.lng_min <= b.lng_min && a.lat_max >= b.lat_max && a.lng_max >= b.lng_max;

function deCache(bbox) {
  const hit = cache.find((e) => Date.now() - e.ts < CACHE_TTL_MS && contiene(e.area, bbox));
  return hit ? hit.datos : null;
}

function alCache(area, datos) {
  cache = [{ area, ts: Date.now(), datos }, ...cache.filter((e) => !contiene(area, e.area))]
    .slice(0, CACHE_MAX);
  guardarCache();
}

function areaAConsultar(bbox) {
  const abajo = (n) => Math.floor(n / GRILLA) * GRILLA;
  const arriba = (n) => Math.ceil(n / GRILLA) * GRILLA;
  const fix = (n) => Number(n.toFixed(4));
  return {
    lat_min: fix(abajo(bbox.lat_min)), lng_min: fix(abajo(bbox.lng_min)),
    lat_max: fix(arriba(bbox.lat_max)), lng_max: fix(arriba(bbox.lng_max)),
  };
}

const enVuelo = new Map();

function direccionDe(tags) {
  const calle = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const ciudad = tags['addr:city'] ?? tags['addr:suburb'] ?? null;
  const partes = [calle || null, ciudad].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

function tipoDe(tags) {
  if (tags.amenity === 'veterinary') return 'veterinaria';
  if (tags.shop === 'pet') return 'petshop';
  if (tags.shop === 'pet_grooming') return 'peluqueria';
  return null;
}

function mapLugar(el) {
  const tags = el.tags ?? {};
  const tipo = tipoDe(tags);
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;

  return {
    id: `osm:${el.type}:${el.id}`,
    tipo,
    nombre: tags.name ?? tags['name:es'] ?? tags.operator ?? 'Sin nombre',
    direccion: direccionDe(tags),
    telefono: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null,
    lat,
    lng,
    google_maps_url: lat != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null,
    rating: null,
    ratingCount: 0,
    abiertoAhora: null,
    horario: tags.opening_hours ?? null,
    sitioWeb: tags.website ?? tags['contact:website'] ?? null,
    descripcion: null,
    origen: 'osm',
  };
}

async function consultarZona(area) {
  const abortador = new AbortController();
  const temporizador = setTimeout(() => abortador.abort(), TIMEOUT_MS);
  try {
    const q = new URLSearchParams({ s: area.lat_min, w: area.lng_min, n: area.lat_max, e: area.lng_max });
    const res = await fetch(`${URL_LUGARES}?${q}`, { signal: abortador.signal });
    if (!res.ok) throw new Error(`lugares ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(temporizador);
  }
}

function quitarRepetidos(lugares) {
  const vistos = new Set();
  return lugares.filter((l) => {
    const clave = `${claveComparable(l.nombre)}|${l.lat?.toFixed(3)},${l.lng?.toFixed(3)}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

async function buscarTodos(bbox) {
  const enCache = deCache(bbox);
  if (enCache) return enCache;

  const area = areaAConsultar(bbox);
  const clave = JSON.stringify(area);
  if (Date.now() - (fallosRecientes.get(clave) ?? 0) < PAUSA_TRAS_FALLO_MS) return [];
  if (!enVuelo.has(clave)) {
    const pedido = consultarZona(area)
      .then((json) => {
        const lugares = quitarRepetidos(
          (json.elements ?? [])
            .map(mapLugar)
            .filter((l) => l.tipo && l.lat != null && l.lng != null)
            .filter((l) => l.nombre !== 'Sin nombre'),
        );
        alCache(area, lugares);
        fallosRecientes.delete(clave);
        return lugares;
      })
      .catch((e) => { fallosRecientes.set(clave, Date.now()); throw e; })
      .finally(() => enVuelo.delete(clave));
    enVuelo.set(clave, pedido);
  }
  return enVuelo.get(clave);
}

export async function buscarLugaresOsm(bbox, tipo = 'todos') {
  if (!bbox || !areaConsultable(bbox)) return [];
  if (tipo !== 'todos' && !TIPOS_OSM.includes(tipo)) return [];

  try {
    const lugares = await buscarTodos(bbox);
    return tipo === 'todos' ? lugares : lugares.filter((l) => l.tipo === tipo);
  } catch (e) {
    if (e?.name !== 'AbortError' && __DEV__) console.warn('[lugares] OpenStreetMap:', e?.message);
    return [];
  }
}
