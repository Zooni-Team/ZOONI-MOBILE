/**
 * api/lugares.js — Función de Vercel: veterinarias, pet shops y peluquerías de
 * OpenStreetMap para el mapa de Servicios (GET /api/lugares?s=&w=&n=&e=).
 *
 * POR QUÉ EXISTE: desde el navegador, la API pública de Overpass casi nunca
 * respondía y el mapa mostraba "No hay servicios en esta área" en pleno
 * Palermo. Verificado con curl (12/11/2026):
 *   · overpass-api.de responde 406 a todo pedido que mencione "vercel.app"
 *     (en el Referer o en el User-Agent), y el navegador no deja cambiar el
 *     User-Agent;
 *   · los espejos se cuelgan o devuelven 502/504 "at capacity" muy seguido.
 *
 * Desde acá:
 *   1. Overpass, todos los servidores a la vez, con un User-Agent propio.
 *   2. Si ninguno contesta: Nominatim (el buscador de OpenStreetMap), que
 *      responde en 1-2 s. Trae menos (50 por categoría) pero nunca vacío.
 *   3. La respuesta queda en el CDN de Vercel un día (s-maxage): cada zona de
 *      la grilla se consulta UNA vez para todos los usuarios.
 *
 * Devuelve siempre la forma de Overpass ({ elements: [{ type, id, lat, lon,
 * tags }] }) para que services/lugaresOsm.js no distinga el origen.
 * No es un proxy abierto: la consulta la arma esta función; el cliente sólo
 * manda la caja, y una caja grande se rechaza.
 */

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Sin "vercel.app": overpass-api.de responde 406 a todo lo que lo mencione.
const USER_AGENT = 'ZooniApp/1.0 (app de mascotas; github.com/Zooni-Team)';
const AREA_MAX_GRADOS2 = 0.25; // igual que lugaresOsm.js
const MAX_RESULTADOS = 200;
const ESPERA_OVERPASS_MS = 12000;

// Nominatim no busca por etiqueta: busca texto y se filtra por categoría.
// (Probado en CABA: "veterinario" → amenity=veterinary, "pet shop" → shop=pet;
// "peluquería" trae peluquerías de personas, por eso no se usa.)
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
      const json = await r.json(); // un 200 con XML de error ("too busy") tira acá
      if (!Array.isArray(json.elements)) throw new Error('sin elements');
      return json.elements;
    }));
  } finally {
    clearTimeout(t);
    abortadores.forEach((a) => a.abort());
  }
}

/** Resultado de Nominatim → elemento con la forma de Overpass. */
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
  // De a una (la política de uso de Nominatim pide no más de 1 por segundo).
  for (const q of BUSQUEDAS_NOMINATIM) {
    const url = `${NOMINATIM}?${new URLSearchParams({
      q, viewbox: `${w},${n},${e},${s}`, bounded: '1', format: 'jsonv2',
      limit: '50', addressdetails: '1', extratags: '1',
    })}`;
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' } });
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
    && (caja.n - caja.s) * (caja.e - caja.w) <= AREA_MAX_GRADOS2;
  if (!valida) {
    res.status(400).json({ error: 'caja inválida o demasiado grande' });
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
  // Fallo breve en caché: si OSM está caído, no martillarlo con cada usuario.
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  res.status(503).json({ error: 'OpenStreetMap no respondió', detalle: errores });
};
