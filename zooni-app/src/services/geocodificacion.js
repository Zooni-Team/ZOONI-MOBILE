const NOMINATIM = 'https://nominatim.openstreetmap.org';

const CABECERAS_NOMINATIM = {
  Accept: 'application/json',
  'User-Agent': 'ZooniApp/1.0 (app de mascotas; contacto en la app)',
};

export async function buscarLugares(texto, { cerca } = {}) {
  const q = (texto ?? '').trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({
      format: 'json', limit: '6', addressdetails: '1',
      'accept-language': 'es', countrycodes: 'ar', q,
    });
    if (cerca?.lat != null) {
      const d = 0.6;
      params.set('viewbox', `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`);
    }
    const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: CABECERAS_NOMINATIM });
    if (!res.ok) return [];
    const lista = await res.json();
    return (lista ?? []).map((l) => {
      const a = l.address ?? {};
      const nombre = a.suburb || a.neighbourhood || a.quarter || a.city_district
        || a.town || a.village || a.city || l.name || q;
      const detalle = [a.city_district, a.city || a.town, a.state]
        .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
      return { nombre, detalle, lat: Number(l.lat), lng: Number(l.lon) };
    });
  } catch {
    return [];
  }
}

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
