/**
 * geocodificacion.js — Texto ↔ coordenadas con Nominatim (OpenStreetMap).
 *
 * Se usa para la zona del paseador, el punto de encuentro de un paseo y la
 * dirección de un turno a domicilio. Gratis y sin clave. Si el servicio no
 * responde, las búsquedas devuelven vacío / null y la pantalla deja escribir
 * a mano (salvo ubicarDireccion, que avisa con 'sin_geocodificador').
 *
 * No confundir con services/lugaresApi (veterinarias y pet shops del mapa).
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/*
  Nominatim pide un User-Agent que identifique la aplicación; sin él responde
  429 o directamente bloquea. (En el navegador no se puede fijar —es un
  "forbidden header"— pero ahí va el del navegador, que le sirve igual.)
*/
const CABECERAS_NOMINATIM = {
  Accept: 'application/json',
  'User-Agent': 'ZooniApp/1.0 (app de mascotas; contacto en la app)',
};

/**
 * Busca lugares y devuelve VARIAS opciones para que el usuario elija.
 *
 * El buscador viejo pedía `limit=1` con el país como único filtro y se quedaba
 * con el primer resultado, sin mostrarlo. Con nombres de barrio repetidos en
 * Argentina eso mandaba a cualquier lado, en silencio:
 *
 *     "Belgrano" → Estación de Trenes Manuel Belgrano, Candioti Norte, Santa Fe
 *     "Nuñez"    → Nuñez, Güer Aike, Santa Cruz
 *
 * Son barrios de CABA y terminabas a 400 km. Acá se devuelven hasta 6
 * resultados con su nombre completo ("Belgrano, Comuna 13, CABA" vs "…Santa
 * Fe"), así la ambigüedad la resuelve quien sabe: el paseador.
 *
 * @param {string} texto
 * @param {{cerca?: {lat, lng}}} [opciones] prioriza resultados cerca de un punto
 * @returns {Promise<Array<{nombre, detalle, lat, lng}>>}
 */
export async function buscarLugares(texto, { cerca } = {}) {
  const q = (texto ?? '').trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({
      format: 'json', limit: '6', addressdetails: '1',
      'accept-language': 'es', countrycodes: 'ar', q,
    });
    // viewbox + bounded=0: no excluye nada, solo empuja hacia arriba lo cercano
    if (cerca?.lat != null) {
      const d = 0.6; // ~65 km
      params.set('viewbox', `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`);
    }
    const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: CABECERAS_NOMINATIM });
    if (!res.ok) return [];
    const lista = await res.json();
    return (lista ?? []).map((l) => {
      const a = l.address ?? {};
      const nombre = a.suburb || a.neighbourhood || a.quarter || a.city_district
        || a.town || a.village || a.city || l.name || q;
      // Lo que desambigua: partido/provincia. Sin esto, dos "Belgrano" se ven igual.
      const detalle = [a.city_district, a.city || a.town, a.state]
        .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
      return { nombre, detalle, lat: Number(l.lat), lng: Number(l.lon) };
    });
  } catch {
    return [];
  }
}

/**
 * ¿Existe esta dirección? Para no aceptar "gttt7tt" como lugar de encuentro.
 * Devuelve { lat, lng } si la encuentra, null si no existe, y tira
 * 'sin_geocodificador' si el servicio no responde (ahí decide quien llama).
 */
export async function ubicarDireccion(texto, { cerca } = {}) {
  const q = (texto ?? '').trim();
  if (q.length < 5 || !/[a-záéíóúñ]{3}/i.test(q)) return null;
  const params = new URLSearchParams({
    format: 'json', limit: '1', 'accept-language': 'es', countrycodes: 'ar', q,
  });
  if (cerca?.lat != null) {
    const d = 0.6;
    params.set('viewbox', `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`);
  }
  let res;
  try {
    res = await fetch(`${NOMINATIM}/search?${params}`, { headers: CABECERAS_NOMINATIM });
  } catch {
    throw new Error('sin_geocodificador');
  }
  if (!res.ok) throw new Error('sin_geocodificador');
  const [l] = await res.json();
  return l ? { lat: Number(l.lat), lng: Number(l.lon) } : null;
}

/** Compatibilidad: el primer resultado de buscarLugares (solo coordenadas). */
export async function buscarLugar(texto, opciones) {
  const [primero] = await buscarLugares(texto, opciones);
  return primero ? { lat: primero.lat, lng: primero.lng } : null;
}

export async function barrioDe(lat, lng) {
  try {
    const url = `${NOMINATIM}/reverse?format=json&zoom=14&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const a = (await res.json())?.address ?? {};
    return a.suburb || a.neighbourhood || a.quarter || a.city_district || a.town || a.city || null;
  } catch {
    return null;
  }
}

/** Dirección legible de unas coordenadas (para "Usar mi ubicación"). */
export async function direccionDe(lat, lng) {
  try {
    const url = `${NOMINATIM}/reverse?format=json&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const a = (await res.json())?.address ?? {};
    const calle = [a.road, a.house_number].filter(Boolean).join(' ');
    const barrio = a.suburb || a.neighbourhood || a.city_district || a.city;
    return [calle, barrio].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}
