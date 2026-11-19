// usoApp.test.mjs — Tiempo en la app: formato y lectura de la semana.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { fake } from './dobles/supabase.mjs';
import { setCurrentUserId } from '../src/config/session.js';
import { fetchUsoSemana, formatoDuracion } from '../src/services/usoApp.js';
import { toISODateLocal } from '../src/utils/fechaLocal.js';

beforeEach(() => fake.reiniciar());

test('formatoDuracion redondea a minutos', () => {
  assert.equal(formatoDuracion(0), '0 min');
  assert.equal(formatoDuracion(29), '0 min');
  assert.equal(formatoDuracion(8 * 60 + 20), '8 min');
  assert.equal(formatoDuracion(72 * 60), '1 h 12 min');
});

test('la semana son 7 días terminando hoy, con 0 donde no hay fila', async () => {
  await setCurrentUserId(5, 'a@x.com');
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  fake.responder(() => ({ data: [{ date: toISODateLocal(ayer), total_seconds: 600 }] }));
  const semana = await fetchUsoSemana();
  assert.equal(semana.length, 7);
  assert.equal(semana[6].fecha, toISODateLocal(new Date()));
  assert.equal(semana[5].segundos, 600);
  assert.equal(semana[0].segundos, 0);
  const [op] = fake.de('tabla');
  assert.equal(op.tabla, 'app_usage_daily');
  assert.deepEqual(op.filtros[0], ['eq', 'user_id', 5]);
});
