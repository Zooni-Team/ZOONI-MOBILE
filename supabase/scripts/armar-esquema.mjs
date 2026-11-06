#!/usr/bin/env node
// armar-esquema.mjs — Junta supabase/migrations/*.sql, en orden, en
// supabase/schema.sql: un único archivo para pegar en el SQL Editor de un
// proyecto Supabase VACÍO y dejarlo igual al de Zooni.
//
//   node supabase/scripts/armar-esquema.mjs
//
// schema.sql es un archivo GENERADO: no se edita a mano. Si hay que cambiar
// algo de la base, se agrega una migración nueva y se vuelve a correr esto.

import fs from 'node:fs';
import path from 'node:path';
import { DIR_MIGRACIONES, DIR_SUPABASE, listarMigraciones } from './migraciones.mjs';

const partes = [
  '-- =============================================================================',
  '-- schema.sql — GENERADO por supabase/scripts/armar-esquema.mjs. NO EDITAR.',
  '-- Esquema completo de Zooni para un proyecto Supabase vacío. Idempotente.',
  '-- Fuente: supabase/migrations/ (en este mismo orden).',
  '-- =============================================================================',
  '',
];

for (const archivo of listarMigraciones()) {
  const sql = fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8').replace(/\r\n/g, '\n');
  partes.push(`-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> ${archivo} <<<<<<<<<<<<<<<<<<<<<<<<<<<<`, sql.trimEnd(), '');
}

const destino = path.join(DIR_SUPABASE, 'schema.sql');
fs.writeFileSync(destino, partes.join('\n'));
console.log(`✓ ${path.relative(process.cwd(), destino)} (${listarMigraciones().length} migraciones)`);
