// migraciones.mjs — Orden ÚNICO y explícito del esquema de Zooni.
//
// El orden es el del nombre de archivo (000, 010, 011, … 023, 023b, …). Este
// módulo lo exponen los dos scripts de abajo para que nadie lo tenga que
// recordar:
//   - armar-esquema.mjs  → concatena todo en supabase/schema.sql (para pegar
//                          en el SQL Editor de un proyecto Supabase vacío).
//   - probar-esquema.mjs → lo corre dos veces contra un Postgres local para
//                          comprobar que arranca de cero y que es idempotente.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const DIR_SUPABASE = path.resolve(aqui, '..');
export const DIR_MIGRACIONES = path.join(DIR_SUPABASE, 'migrations');

export function listarMigraciones() {
  return fs
    .readdirSync(DIR_MIGRACIONES)
    .filter((f) => /^\d{3}[a-z]?_.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));
}
