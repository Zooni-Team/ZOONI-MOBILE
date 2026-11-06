// Utilidades puras: fechas, edades, texto, validación, distancias, paleta.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diasEntre, diasHasta, formatearFecha, parseFechaLocal, toISODateLocal } from '../src/utils/fechaLocal.js';
import { calcularEdad, calcularEdadAnios, calcularEdadMeses, calcularEdadPartes, edadResumida } from '../src/utils/calcularEdad.js';
import { capitalizar, claveComparable, incluyeTexto, normalizarBusqueda } from '../src/utils/texto.js';
import { EMAIL_REGEX, PASSWORD_MIN, esEmailValido, esPasswordValida } from '../src/utils/validacion.js';
import { distanciaKm, distanciaMetros } from '../src/utils/geo.js';
import { sanitizarDecimal, sanitizarDigitos, sanitizarTexto } from '../src/utils/sanitizar.js';
import { etiquetaDia, horaCorta, mismoDia, tiempoRelativo } from '../src/utils/tiempoRelativo.js';
import { colores, COLOR_POR_HEX } from '../src/theme/colores.js';

const HOY = new Date(2026, 10, 6); // 6 de noviembre de 2026

test('parseFechaLocal: "YYYY-MM-DD" es ese día en hora local (no el anterior por UTC)', () => {
  const d = parseFechaLocal('2026-08-14');
  assert.equal(d.getDate(), 14);
  assert.equal(d.getMonth(), 7);
  assert.equal(parseFechaLocal(''), null);
  assert.equal(parseFechaLocal('no es fecha'), null);
  assert.equal(parseFechaLocal(new Date('x')), null);
});

test('toISODateLocal usa el día local', () => {
  assert.equal(toISODateLocal(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
  assert.equal(toISODateLocal(null), null);
});

test('formatearFecha: estilos con nombre', () => {
  assert.equal(formatearFecha('2026-08-04'), '4/8/2026');
  assert.equal(formatearFecha('2026-08-04', 'numericaCeros'), '04/08/2026');
  assert.match(formatearFecha('2026-08-04', 'larga'), /4 de agosto de 2026/);
  assert.equal(formatearFecha(null), null);
  assert.equal(formatearFecha(null, 'numerica', { vacio: '—' }), '—');
  assert.throws(() => formatearFecha('2026-08-04', 'inventado'), /estilo desconocido/);
});

test('diasHasta / diasEntre en días calendario', () => {
  assert.equal(diasHasta('2026-11-06', HOY), 0);
  assert.equal(diasHasta('2026-11-16', HOY), 10);
  assert.equal(diasHasta('2026-11-01', HOY), -5);
  assert.equal(diasHasta(null, HOY), null);
  assert.equal(diasEntre('2026-01-01', '2026-01-31'), 30);
});

test('calcularEdad: mira el día del mes', () => {
  assert.deepEqual(calcularEdadPartes('2022-11-07', HOY), { anios: 3, meses: 11 });
  assert.deepEqual(calcularEdadPartes('2022-11-06', HOY), { anios: 4, meses: 0 });
  assert.equal(calcularEdad('2022-02-15', { hoy: HOY }), '4 años y 8 meses');
  assert.equal(calcularEdad('2026-05-01', { hoy: HOY }), '6 meses');
  assert.equal(calcularEdad(null), 'Edad desconocida');
  assert.equal(calcularEdad('2030-01-01', { hoy: HOY, vacio: 'No registrada' }), 'No registrada');
  assert.equal(calcularEdadMeses('2026-10-20', HOY), 0);
  assert.equal(calcularEdadAnios('1990-11-07', HOY), 35);
  assert.equal(edadResumida('2026-10-20', HOY), 'Menos de 1 mes');
  assert.equal(edadResumida('2021-01-01', HOY), '5 años');
});

test('texto: búsqueda sin tildes ni mayúsculas', () => {
  assert.equal(normalizarBusqueda('Veterinaría ÑANDÚ'), 'veterinaria nandu');
  assert.equal(normalizarBusqueda(null), '');
  assert.equal(claveComparable('Pet-Shop Ñandú 2'), 'petshopnandu2');
  assert.ok(incluyeTexto('Clínica del Parque', 'clinica'));
  assert.ok(incluyeTexto('lo que sea', '   '));
  assert.ok(!incluyeTexto('Parque', 'plaza'));
  assert.equal(capitalizar('perro'), 'Perro');
  assert.equal(capitalizar(''), '');
});

test('validacion: mail y contraseña', () => {
  assert.ok(esEmailValido(' ana@zooni.app '));
  assert.ok(!esEmailValido('ana@zooni'));
  assert.ok(EMAIL_REGEX.test('a@b.co'));
  assert.equal(PASSWORD_MIN, 7);
  assert.ok(esPasswordValida('1234567'));
  assert.ok(!esPasswordValida('123456'));
  assert.ok(!esPasswordValida(undefined));
});

test('geo: una sola fórmula, null si falta un dato', () => {
  const obelisco = { lat: -34.6037, lng: -58.3816 };
  assert.equal(distanciaKm(obelisco, { lat: -34.6098, lng: -58.3925 }), 1.2);
  assert.equal(distanciaMetros(obelisco, { lat: null, lng: 1 }), null);
  assert.equal(distanciaMetros(obelisco, obelisco), 0);
});

test('sanitizar: control chars, dígitos y decimales', () => {
  assert.equal(sanitizarTexto('  hola\u0007 mundo  '), 'hola mundo');
  assert.equal(sanitizarTexto('   '), null);
  assert.equal(sanitizarTexto('abcdef', 3), 'abc');
  assert.equal(sanitizarDigitos('11-4567 89a'), '114567 89'.replace(' ', ''));
  assert.equal(sanitizarDecimal('12a,5x'), '12,5');
  assert.equal(sanitizarDecimal('1.2.3'), '1.23');
});

test('tiempoRelativo: horas, mismo día y etiquetas', () => {
  const ahora = new Date(2026, 10, 6, 15, 0);
  assert.equal(horaCorta(new Date(2026, 10, 6, 9, 5)), '09:05');
  assert.ok(mismoDia(new Date(2026, 10, 6, 1), new Date(2026, 10, 6, 23)));
  assert.equal(etiquetaDia(new Date(2026, 10, 6, 10), ahora), 'Hoy');
  assert.equal(etiquetaDia(new Date(2026, 10, 5, 10), ahora), 'Ayer');
  assert.equal(typeof tiempoRelativo(new Date(2026, 10, 6, 14, 55), ahora), 'string');
});

test('paleta: sin valores repetidos y con el color de marca', () => {
  const hex = Object.values(colores);
  assert.equal(new Set(hex).size, hex.length, 'dos nombres con el mismo color');
  assert.equal(colores.verde, '#2DBD72');
  assert.equal(COLOR_POR_HEX['#2DBD72'], 'verde');
  assert.ok(Object.isFrozen(colores));
});
