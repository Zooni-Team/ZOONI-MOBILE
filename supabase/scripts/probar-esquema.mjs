#!/usr/bin/env node
// probar-esquema.mjs — ¿El esquema se puede reconstruir desde cero?
//
// Crea una base vacía en un Postgres LOCAL, carga tests/shim_supabase.sql (lo
// mínimo de Supabase: roles, auth.uid(), storage) y corre todas las
// migraciones en orden. Después las corre OTRA VEZ: si la segunda pasada falla,
// alguna migración no es idempotente. Sale con código != 0 ante cualquier error.
//
// Uso:
//   PGHOST=localhost PGPORT=5432 PGUSER=postgres node supabase/scripts/probar-esquema.mjs
//   (necesita `psql` en el PATH, o PSQL=/ruta/a/psql)
//
// No toca la base de Supabase: trabaja sobre una base temporal `zooni_prueba`.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { DIR_MIGRACIONES, DIR_SUPABASE, listarMigraciones } from './migraciones.mjs';

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

const migraciones = listarMigraciones();
for (const pasada of [1, 2]) {
  for (const m of migraciones) correrArchivo(path.join(DIR_MIGRACIONES, m));
  console.log(`✓ pasada ${pasada}: ${migraciones.length} migraciones sin errores`);
}

const pruebas = path.join(DIR_SUPABASE, 'tests', 'pruebas_rls.sql');
correrArchivo(pruebas);
console.log('✓ pruebas de RLS y reglas de negocio');
