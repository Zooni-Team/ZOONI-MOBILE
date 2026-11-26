#!/usr/bin/env node
// probar-esquema.mjs — ¿El esquema se puede reconstruir desde cero?
//
// Crea una base vacía en un Postgres LOCAL, carga tests/shim_supabase.sql (lo
// mínimo de Supabase: roles, auth.uid(), storage) y corre la secuencia real:
// SUPABASE_PEGAR_TODO.sql y después MIGRACION_064…, en orden. Después la corre
// OTRA VEZ: si la segunda pasada falla, algo no es idempotente. Al final, las
// pruebas de tests/. Sale con código != 0 ante cualquier error.
//
// Uso:
//   PGHOST=localhost PGPORT=5432 PGUSER=postgres node supabase/scripts/probar-esquema.mjs
//   (necesita `psql` en el PATH, o PSQL=/ruta/a/psql)
//
// No toca la base de Supabase: trabaja sobre una base temporal `zooni_prueba`.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_SUPABASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// La base y las migraciones, en el orden en que se pegan en Supabase.
const SECUENCIA = [
  'SUPABASE_PEGAR_TODO.sql',
  ...readdirSync(DIR_SUPABASE).filter((f) => /^MIGRACION_\d{3}_.*\.sql$/.test(f)).sort(),
].map((f) => path.join(DIR_SUPABASE, f));

const PSQL = process.env.PSQL ?? 'psql';
const BASE = process.env.ZOONI_BASE_PRUEBA ?? 'zooni_prueba';

function psql(args, { base = 'postgres' } = {}) {
  const r = spawnSync(PSQL, ['-v', 'ON_ERROR_STOP=1', '-q', '-X', '-d', base, ...args], {
    encoding: 'utf8',
  });
  return { ok: r.status === 0, salida: (r.stderr || '') + (r.stdout || '') };
}

function correrArchivo(archivo) {
  const r = psql(['-1', '-f', archivo], { base: BASE });
  if (!r.ok) {
    console.error(`\n✗ ${path.basename(archivo)}\n${r.salida}`);
    process.exit(1);
  }
}

psql(['-c', `DROP DATABASE IF EXISTS ${BASE}`]);
const creada = psql(['-c', `CREATE DATABASE ${BASE}`]);
if (!creada.ok) {
  console.error(`No pude crear la base de prueba:\n${creada.salida}`);
  process.exit(1);
}

correrArchivo(path.join(DIR_SUPABASE, 'tests', 'shim_supabase.sql'));

for (const pasada of [1, 2]) {
  SECUENCIA.forEach(correrArchivo);
  console.log(`✓ pasada ${pasada}: ${SECUENCIA.map((f) => path.basename(f)).join(' → ')}`);
}

// pruebas_rls crea los helpers pg_temp.como / salir que usa pruebas_064: van
// juntas en la misma sesión de psql.
const pruebas = ['pruebas_rls.sql', 'pruebas_064.sql', 'pruebas_065.sql', 'pruebas_066.sql', 'pruebas_067.sql', 'pruebas_068.sql', 'pruebas_070.sql', 'pruebas_071.sql', 'pruebas_072.sql'].map((f) => path.join(DIR_SUPABASE, 'tests', f));
const r = psql(['-1', ...pruebas.flatMap((f) => ['-f', f])], { base: BASE });
if (!r.ok) {
  console.error(`\n✗ pruebas\n${r.salida}`);
  process.exit(1);
}
console.log('✓ pruebas de RLS, reglas de negocio, 064 (purga, cupo, bucket privado) 065 (login de cuentas viejas) 066 (paseos vencidos, peso, opiniones) 067 (funciones cerradas) 068 (archivos huérfanos), 070 (mascota_publica, notificaciones, anti-trampa de paseos), 071 (anti-trampa con ancla fija, límite de mascotas, principal atómica) y 072 (baja de cuenta, search_path)');
