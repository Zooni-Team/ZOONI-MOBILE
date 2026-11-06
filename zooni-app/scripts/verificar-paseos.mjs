#!/usr/bin/env node
// verificar-paseos.mjs — Prueba la lógica pura de paseos y distancias SIN
// Supabase ni pantalla (npm run verify:paseos). Sale con código 1 si algo falla.
//
// Es posible porque esa lógica ya no vive dentro de services/paseadorApi.js
// (que habla con la base) sino en src/domain/paseos.js y src/utils/geo.js.

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cargar = (rel) => import(pathToFileURL(path.join(raiz, rel)).href);

const paseos = await cargar('src/domain/paseos.js');
const geo = await cargar('src/utils/geo.js');

let fallas = 0;
function caso(nombre, fn) {
  try {
    fn();
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallas++;
    console.error(`  ✗ ${nombre}\n    ${e.message}`);
  }
}

console.log('Precios de paseo');
const paseador = { servicios: [{ minutos: 60, precio: 9000 }, { minutos: 30, precio: '5000' }] };
caso('precioPara usa el servicio de esa duración', () => assert.equal(paseos.precioPara(paseador, 30), 5000));
caso('precioPara devuelve null si no ofrece esa duración', () => assert.equal(paseos.precioPara(paseador, 45), null));
caso('perfil viejo (precio_30 / precio_60) sigue funcionando', () =>
  assert.equal(paseos.precioPara({ precio30: 4000, precio60: 7000 }, 60), 7000));
caso('serviciosDe ordena por duración y descarta precios vacíos', () =>
  assert.deepEqual(paseos.serviciosDe({ servicios: [{ minutos: 60, precio: 1 }, { minutos: 30, precio: 0 }] }),
    [{ minutos: 60, precio: 1 }]));
caso('validarServicios rechaza duraciones repetidas', () =>
  assert.match(paseos.validarServicios([{ minutos: 30, precio: 1 }, { minutos: 30, precio: 2 }]), /misma duración/));
caso('comisión hoy es 0 (igual que comision_zooni() en la base)', () => assert.equal(paseos.comisionDe(10000), 0));
caso('aCentavos evita errores de punto flotante', () => assert.equal(paseos.aCentavos(0.1 + 0.2), 0.3));

console.log('Formatos');
caso('formatoPlata con miles y centavos', () => assert.equal(paseos.formatoPlata(12500.5), '$12.500,50'));
caso('formatoDistancia en metros y km', () => {
  assert.equal(paseos.formatoDistancia(850), '850 m');
  assert.equal(paseos.formatoDistancia(1234), '1,2 km');
});
caso('formatoTimer', () => assert.equal(paseos.formatoTimer(3725), '1:02:05'));
caso('formatoTiempoPaseado', () => assert.equal(paseos.formatoTiempoPaseado(250), '4 min 10 s'));

console.log('Tiempos');
caso('segundosDePaseo suma el tramo en curso', () => {
  const ahora = Date.parse('2030-01-01T10:10:00Z');
  const p = { segundosAcumulados: 60, reanudadoEn: '2030-01-01T10:00:00Z' };
  assert.equal(paseos.segundosDePaseo(p, ahora), 660);
});
caso('sePuedeRetomar sólo dentro de los 15 minutos', () => {
  const fin = Date.parse('2030-01-01T10:00:00Z');
  const p = { estado: 'finalizado', horaFin: new Date(fin).toISOString() };
  assert.equal(paseos.sePuedeRetomar(p, fin + 14 * 60000), true);
  assert.equal(paseos.sePuedeRetomar(p, fin + 16 * 60000), false);
});
caso('ultimoCierre semanal es el domingo', () =>
  assert.equal(paseos.ultimoCierre('semanal', new Date(2030, 0, 2)), '2029-12-30'));

console.log('Distancias (utils/geo: una sola fórmula)');
const obelisco = { lat: -34.6037, lng: -58.3816 };
const congreso = { lat: -34.6098, lng: -58.3925 };
caso('Obelisco → Congreso ≈ 1,2 km', () => assert.equal(geo.distanciaKm(obelisco, congreso), 1.2));
caso('acepta coordenadas como string (numeric de Postgres)', () =>
  assert.equal(geo.distanciaKm({ lat: '-34.6037', lng: '-58.3816' }, congreso), 1.2));
caso('si falta un dato devuelve null (no NaN ni Infinity)', () => {
  assert.equal(geo.distanciaMetros(obelisco, { lat: null, lng: -58 }), null);
  assert.equal(geo.distanciaKm(undefined, congreso), null);
});
caso('mismo punto = 0', () => assert.equal(geo.distanciaMetros(obelisco, obelisco), 0));

if (fallas) {
  console.error(`\n${fallas} caso(s) fallaron`);
  process.exit(1);
}
console.log('\nTodo OK');
