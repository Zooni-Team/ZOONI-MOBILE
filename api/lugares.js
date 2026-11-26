const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ZooniApp/1.0 (app de mascotas; github.com/Zooni-Team)';
const AREA_MAX_GRADOS2 = 0.25;
const MAX_RESULTADOS = 200;
const ESPERA_OVERPASS_MS = 12000;
const ESPERA_NOMINATIM_MS = 6000;
const GRILLA = 0.02;
const enGrilla = (x) => Math.abs(x / GRILLA - Math.round(x / GRILLA)) < 1e-6;

const BUSQUEDAS_NOMINATIM = ['veterinario', 'pet shop'];
const ES_DE_MASCOTAS = (x) =>
  (x.category === 'amenity' && x.type === 'veterinary')
  || (x.category === 'shop' && (x.type === 'pet' || x.type === 'pet_grooming'));

function consultaOverpass({ s, w, n, e }) {
  const caja = `${s},${w},${n},${e}`;
  const partes = ['["amenity"="veterinary"]', '["shop"="pet"]', '["shop"="pet_grooming"]']
    .map((t) => `nwr${t}(${caja});`).join('');
  return `[out:json][timeout:10];(${partes});out center ${MAX_RESULTADOS};`;
}

async function desdeOverpass(caja) {
  const abortadores = OVERPASS.map(() => new AbortController());
  const t = setTimeout(() => abortadores.forEach((a) => a.abort()), ESPERA_OVERPASS_MS);
  const cuerpo = `data=${encodeURIComponent(consultaOverpass(caja))}`;
  try {
    return await Promise.any(OVERPASS.map(async (url, i) => {
      const r = await fetch(url, {
        method: 'POST',
        signal: abortadores[i].signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: cuerpo,
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json.elements)) throw new Error('sin elements');
      return json.elements;
    }));
  } finally {
    clearTimeout(t);
    abortadores.forEach((a) => a.abort());
  }
}

function aElemento(x) {
  const a = x.address ?? {};
  const extra = x.extratags ?? {};
  const tags = {
    name: x.name || undefined,
    [x.category]: x.type,
    'addr:street': a.road,
    'addr:housenumber': a.house_number,
    'addr:suburb': a.suburb ?? a.neighbourhood,
    'addr:city': a.city ?? a.town,
    phone: extra.phone ?? extra['contact:phone'],
    opening_hours: extra.opening_hours,
    website: extra.website ?? extra['contact:website'],
  };
  Object.keys(tags).forEach((k) => tags[k] == null && delete tags[k]);
  return { type: x.osm_type, id: x.osm_id, lat: Number(x.lat), lon: Number(x.lon), tags };
}

async function desdeNominatim({ s, w, n, e }) {
  const vistos = new Set();
  const elementos = [];
  for (const q of BUSQUEDAS_NOMINATIM) {
    const url = `${NOMINATIM}?${new URLSearchParams({
      q, viewbox: `${w},${n},${e},${s}`, bounded: '1', format: 'jsonv2',
      limit: '50', addressdetails: '1', extratags: '1',
    })}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(ESPERA_NOMINATIM_MS),
    });
    if (!r.ok) throw new Error(`nominatim ${r.status}`);
    for (const x of await r.json()) {
      const clave = `${x.osm_type}${x.osm_id}`;
      if (ES_DE_MASCOTAS(x) && !vistos.has(clave)) {
        vistos.add(clave);
        elementos.push(aElemento(x));
      }
    }
  }
  return elementos;
}

module.exports = async function handler(req, res) {
  const num = (k) => Number.parseFloat(req.query?.[k]);
  const caja = { s: num('s'), w: num('w'), n: num('n'), e: num('e') };
  const valida = Object.values(caja).every(Number.isFinite)
    && caja.s < caja.n && caja.w < caja.e
    && Math.abs(caja.s) <= 90 && Math.abs(caja.n) <= 90
    && Math.abs(caja.w) <= 180 && Math.abs(caja.e) <= 180
    && (caja.n - caja.s) * (caja.e - caja.w) <= AREA_MAX_GRADOS2;
  if (!valida) {
    res.status(400).json({ error: 'caja inválida o demasiado grande' });
    return;
  }
  if (!Object.values(caja).every(enGrilla)) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.status(400).json({ error: `la caja tiene que estar alineada a una grilla de ${GRILLA}°` });
    return;
  }

  const errores = [];
  for (const [fuente, buscar] of [['overpass', desdeOverpass], ['nominatim', desdeNominatim]]) {
    try {
      const elements = await buscar(caja);
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.setHeader('X-Zooni-Fuente', fuente);
      res.status(200).json({ elements });
      return;
    } catch (e) {
      errores.push(`${fuente}: ${e?.errors?.map((x) => x.message).join(', ') ?? e?.message}`);
    }
  }
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  res.status(503).json({ error: 'OpenStreetMap no respondió', detalle: errores });
};
