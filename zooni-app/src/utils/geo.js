/**
 * geo.js — Distancia entre dos puntos (fórmula de haversine). ÚNICA copia.
 *
 * Antes había siete versiones repartidas por la app (Match, Comunidad,
 * Perfil, SOS, Lugares, Paseadores…) y cuando faltaba una coordenada cada una
 * hacía algo distinto: null, Infinity o NaN. Con NaN, por ejemplo, un
 * paseador sin ubicación quedaba afuera de "los que te cubren" por accidente,
 * y con null habría quedado ADENTRO (null <= 3 es true en JS).
 *
 * Regla única: si falta algún dato, devuelve null. Quien llama decide qué
 * significa "no se sabe" (ordenarlo al final, no filtrarlo, etc.).
 *
 * Los puntos son { lat, lng } (números o strings numéricos).
 */

const RADIO_TIERRA_M = 6371000;
const rad = (g) => (g * Math.PI) / 180;

function coordenada(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Metros entre a y b, o null si falta alguna coordenada. */
export function distanciaMetros(a, b) {
  const lat1 = coordenada(a?.lat);
  const lng1 = coordenada(a?.lng);
  const lat2 = coordenada(b?.lat);
  const lng2 = coordenada(b?.lng);
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kilómetros entre a y b redondeados (1 decimal por defecto), o null. */
export function distanciaKm(a, b, decimales = 1) {
  const m = distanciaMetros(a, b);
  if (m == null) return null;
  const f = 10 ** decimales;
  return Math.round((m / 1000) * f) / f;
}
