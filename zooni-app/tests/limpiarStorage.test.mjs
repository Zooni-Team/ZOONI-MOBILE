import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { borrarHuerfanos, crearCliente, privatizarConsultas } from '../../supabase/scripts/limpiar-storage.mjs';

function servidor(respuestas) {
  const pedidos = [];
  const fetchFalso = async (url, op = {}) => {
    const ruta = url.replace('https://p.supabase.co', '');
    pedidos.push({ metodo: op.method ?? 'GET', ruta, cuerpo: op.body, cabeceras: op.headers ?? {} });
    const r = respuestas(ruta, op) ?? {};
    return {
      ok: (r.status ?? 200) < 400, status: r.status ?? 200,
      json: async () => r.json, text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(4),
      headers: { get: () => r.tipo ?? null },
    };
  };
  return { pedidos, cliente: crearCliente('https://p.supabase.co/', 'clave-secreta', fetchFalso) };
}
const silencio = () => {};

describe('limpiar-storage', () => {
  test('en modo prueba no borra ni marca nada', async () => {
    const { pedidos, cliente } = servidor((ruta) => (ruta.includes('archivos_para_borrar')
      ? { json: [{ id: 1, bucket: 'public-images', ruta: 'u/a.jpg' }] } : { json: [] }));
    assert.equal(await borrarHuerfanos(cliente, { aplicar: false, log: silencio }), 1);
    assert.deepEqual(pedidos.map((p) => p.metodo), ['POST']);
    assert.equal(pedidos[0].cabeceras.apikey, 'clave-secreta');
    assert.equal(pedidos[0].cabeceras.Authorization, undefined);
  });

  test('la service_role legacy (JWT) va también como Bearer', async () => {
    const pedidos = [];
    const fetchFalso = async (url, op = {}) => {
      pedidos.push(op.headers);
      return { ok: true, status: 200, json: async () => [], text: async () => '' };
    };
    await crearCliente('https://p.supabase.co', 'eyJhbGciOi.x.y', fetchFalso).rpc('algo');
    assert.equal(pedidos[0].apikey, 'eyJhbGciOi.x.y');
    assert.equal(pedidos[0].Authorization, 'Bearer eyJhbGciOi.x.y');
  });

  test('borra por bucket y después marca como borrados', async () => {
    const { pedidos, cliente } = servidor((ruta) => (ruta.includes('archivos_para_borrar')
      ? { json: [{ id: 1, bucket: 'public-images', ruta: 'u/a.jpg' }, { id: 2, bucket: 'consultas-privadas', ruta: 'u/consultas/b.jpg' }] }
      : { json: null }));
    assert.equal(await borrarHuerfanos(cliente, { aplicar: true, log: silencio }), 2);
    const borrados = pedidos.filter((p) => p.metodo === 'DELETE');
    assert.deepEqual(borrados.map((p) => [p.ruta, JSON.parse(p.cuerpo).prefixes]), [
      ['/storage/v1/object/public-images', ['u/a.jpg']],
      ['/storage/v1/object/consultas-privadas', ['u/consultas/b.jpg']],
    ]);
    const marcados = pedidos.filter((p) => p.metodo === 'PATCH').map((p) => p.ruta);
    assert.deepEqual(marcados, ['/rest/v1/archivos_por_borrar?id=in.(1)', '/rest/v1/archivos_por_borrar?id=in.(2)']);
  });

  test('muda la imagen de una consulta a la carpeta privada del dueño', async () => {
    const { pedidos, cliente } = servidor((ruta) => {
      if (ruta.includes('consultas_a_privatizar')) {
        return { json: [{ id: 7, imagen_url: 'https://p.supabase.co/storage/v1/object/public/public-images/u/r.png', carpeta: 'uid-1/consultas' }] };
      }
      if (ruta.includes('/object/public/')) return { tipo: 'image/png' };
      if (ruta.includes('privatizar_imagen_consulta')) return { json: true };
      return {};
    });
    assert.equal(await privatizarConsultas(cliente, { aplicar: true, log: silencio }), 1);
    const subida = pedidos.find((p) => p.metodo === 'POST' && p.ruta.startsWith('/storage/v1/object/consultas-privadas/'));
    assert.match(subida.ruta, /^\/storage\/v1\/object\/consultas-privadas\/uid-1\/consultas\/7-[0-9a-f-]{36}\.png$/);
    assert.equal(subida.cabeceras['x-upsert'], 'false');
    const rpc = pedidos.find((p) => p.ruta.endsWith('privatizar_imagen_consulta'));
    assert.equal(JSON.parse(rpc.cuerpo).p_ruta, subida.ruta.replace('/storage/v1/object/consultas-privadas/', ''));
  });

  test('si otro proceso ya la mudó, borra la copia que sobra', async () => {
    const { pedidos, cliente } = servidor((ruta) => {
      if (ruta.includes('consultas_a_privatizar')) return { json: [{ id: 8, imagen_url: 'https://x/storage/v1/object/public/public-images/u/r.jpg', carpeta: 'uid/consultas' }] };
      if (ruta.includes('privatizar_imagen_consulta')) return { json: false };
      return { tipo: 'image/jpeg' };
    });
    assert.equal(await privatizarConsultas(cliente, { aplicar: true, log: silencio }), 0);
    assert.equal(pedidos.at(-1).metodo, 'DELETE');
  });

  test('no sube algo que no es una imagen', async () => {
    const { pedidos, cliente } = servidor((ruta) => (ruta.includes('consultas_a_privatizar')
      ? { json: [{ id: 9, imagen_url: 'https://x/storage/v1/object/public/public-images/u/r.html', carpeta: 'uid/consultas' }] }
      : { tipo: 'text/html' }));
    assert.equal(await privatizarConsultas(cliente, { aplicar: true, log: silencio }), 0);
    assert.equal(pedidos.some((p) => p.ruta.includes('consultas-privadas')), false);
  });
});
