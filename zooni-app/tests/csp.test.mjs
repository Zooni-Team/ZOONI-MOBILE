import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import * as mapas from '../src/components/mapas/mapasHtml.js';

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')).split(/\s+/);
const hashesEnCsp = scriptSrc.filter((t) => t.startsWith("'sha256-"));

const hashesDeMapas = Object.entries(mapas)
  .filter(([, v]) => typeof v === 'string')
  .flatMap(([nombre, html]) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(([, cuerpo]) => ({ nombre, hash: `'sha256-${createHash('sha256').update(cuerpo, 'utf8').digest('base64')}'` })));

test('la CSP de vercel.json deja correr el script de cada mapa', () => {
  assert.ok(hashesDeMapas.length >= 3);
  for (const { nombre, hash } of hashesDeMapas) {
    assert.ok(hashesEnCsp.includes(hash), `${nombre}: agregá ${hash} a script-src en vercel.json`);
  }
});

test('la CSP no guarda hashes de scripts que ya no existen', () => {
  const vigentes = new Set(hashesDeMapas.map((h) => h.hash));
  for (const hash of hashesEnCsp) {
    assert.ok(vigentes.has(hash), `${hash} ya no corresponde a ningún mapa: sacalo de vercel.json`);
  }
});

test('la CSP no habilita scripts inline en general', () => {
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
});

test('la CSP deja leer con fetch las fotos elegidas en la web (data: y blob:)', () => {
  const connectSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src ')).split(/\s+/);
  assert.ok(connectSrc.includes('data:') && connectSrc.includes('blob:'));
});
