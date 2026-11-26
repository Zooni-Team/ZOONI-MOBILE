#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const LOTE = 200;
const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' };

export function crearCliente(url, clave, fetchImpl = fetch) {
  const base = url.replace(/\/+$/, '');
  const cabeceras = clave.startsWith('eyJ')
    ? { apikey: clave, Authorization: `Bearer ${clave}` }
    : { apikey: clave };

  async function pedir(ruta, opciones = {}) {
    const res = await fetchImpl(`${base}${ruta}`, { ...opciones, headers: { ...cabeceras, ...opciones.headers } });
    if (!res.ok) throw new Error(`${opciones.method ?? 'GET'} ${ruta} → ${res.status} ${await res.text().catch(() => '')}`);
    return res;
  }
  const json = { 'Content-Type': 'application/json' };

  return {
    rpc: async (nombre, params = {}) =>
      (await pedir(`/rest/v1/rpc/${nombre}`, { method: 'POST', headers: json, body: JSON.stringify(params) })).json(),
    marcarBorrados: (ids) => pedir(`/rest/v1/archivos_por_borrar?id=in.(${ids.map(Number).join(',')})`, {
      method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' },
      body: JSON.stringify({ borrado_en: new Date().toISOString() }),
    }),
    borrar: (bucket, rutas) => pedir(`/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE', headers: json, body: JSON.stringify({ prefixes: rutas }),
    }),
    subir: (bucket, ruta, cuerpo, tipo) => pedir(`/storage/v1/object/${encodeURIComponent(bucket)}/${ruta}`, {
      method: 'POST', headers: { 'Content-Type': tipo, 'x-upsert': 'false' }, body: cuerpo,
    }),
    descargar: async (urlArchivo) => {
      const res = await fetchImpl(urlArchivo);
      if (!res.ok) throw new Error(`no se pudo bajar ${urlArchivo} (${res.status})`);
      return { cuerpo: Buffer.from(await res.arrayBuffer()), tipo: res.headers.get('content-type') ?? 'image/jpeg' };
    },
  };
}

export async function privatizarConsultas(cliente, { aplicar, log = console.log }) {
  const pendientes = await cliente.rpc('consultas_a_privatizar');
  log(`Consultas con imagen pública: ${pendientes.length}`);
  let movidas = 0;
  for (const c of pendientes) {
    if (!aplicar) { log(`  · consulta ${c.id} → ${c.carpeta}/`); continue; }
    try {
      const { cuerpo, tipo } = await cliente.descargar(c.imagen_url);
      const tipoLimpio = tipo.split(';')[0].trim().toLowerCase();
      const ext = EXTENSIONES[tipoLimpio];
      if (!ext) throw new Error(`tipo no admitido: ${tipo}`);
      const ruta = `${c.carpeta}/${c.id}-${randomUUID()}.${ext}`;
      await cliente.subir('consultas-privadas', ruta, cuerpo, tipoLimpio);
      if (await cliente.rpc('privatizar_imagen_consulta', { p_id: c.id, p_ruta: ruta })) {
        movidas += 1;
      } else {
        await cliente.borrar('consultas-privadas', [ruta]);
      }
    } catch (e) {
      log(`  ✗ consulta ${c.id}: ${e.message}`);
    }
  }
  if (aplicar) log(`  ✓ ${movidas} mudadas al bucket privado`);
  return movidas;
}

export async function borrarHuerfanos(cliente, { aplicar, log = console.log }) {
  let total = 0;
  for (;;) {
    const lote = await cliente.rpc('archivos_para_borrar', { p_limite: LOTE });
    if (!lote.length) break;
    if (!aplicar) {
      lote.forEach((a) => log(`  · ${a.bucket}/${a.ruta}`));
      total += lote.length;
      break;
    }
    const porBucket = new Map();
    lote.forEach((a) => porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a]));
    for (const [bucket, archivos] of porBucket) {
      await cliente.borrar(bucket, archivos.map((a) => a.ruta));
      await cliente.marcarBorrados(archivos.map((a) => a.id));
      total += archivos.length;
    }
    if (lote.length < LOTE) break;
  }
  log(aplicar ? `  ✓ ${total} archivos borrados de Storage` : `Archivos para borrar (primeros ${LOTE}): ${total}`);
  return total;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ver el comentario de arriba de este archivo).');
    process.exit(1);
  }
  const aplicar = process.argv.includes('--aplicar');
  if (!aplicar) console.log('Modo prueba: no se cambia nada. Agregá --aplicar para hacerlo.\n');
  const cliente = crearCliente(url, clave);
  await privatizarConsultas(cliente, { aplicar });
  await borrarHuerfanos(cliente, { aplicar });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
