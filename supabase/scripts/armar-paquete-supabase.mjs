#!/usr/bin/env node
// armar-paquete-supabase.mjs — Genera supabase/APLICAR_EN_SUPABASE.sql: el
// archivo ÚNICO para pegar en el SQL Editor del proyecto Supabase que YA
// existe (con datos). Contiene sólo lo nuevo de la refactorización (051–063),
// precedido por un chequeo de prerrequisitos, todo dentro de UNA transacción.
//
//   node supabase/scripts/armar-paquete-supabase.mjs
//
// Para un proyecto VACÍO se usa supabase/schema.sql (armar-esquema.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { DIR_MIGRACIONES, DIR_SUPABASE, listarMigraciones } from './migraciones.mjs';

const DESDE = '051';
const incluidas = listarMigraciones().filter((m) => m >= DESDE);

const cabecera = `-- =============================================================================
-- APLICAR_EN_SUPABASE.sql — GENERADO por supabase/scripts/armar-paquete-supabase.mjs
-- NO EDITAR A MANO. Pegar ENTERO en Supabase → SQL Editor → Run.
-- =============================================================================
-- Qué hace: aplica sobre la base que ya existe (con datos) todo lo de la
-- refactorización: ${incluidas.join(', ')}.
--   · Identidad con Supabase Auth (060), RLS por usuario (061), reglas de
--     negocio en la base (062), Storage con límites (063) y objetos que
--     sólo existían en el dashboard (054).
--
-- ANTES de correrlo:
--   1. Desplegar las Edge Functions (si no, las cuentas viejas no pueden
--      entrar después de este script):
--        supabase functions deploy migrar-cuenta --no-verify-jwt
--        supabase secrets set GROQ_API_KEY=...
--        supabase functions deploy zoonivet-chat
--   2. Authentication → Providers → Email habilitado (ver README).
--
-- Seguridad del script:
--   · Todo corre en UNA transacción: si algo falla, no queda nada a medias.
--   · Es idempotente: se puede volver a correr.
--   · Primero verifica que la base tenga las migraciones anteriores (000–050);
--     si falta algo, frena con un mensaje que dice qué falta.
--   · No borra datos de usuarios. Sí reemplaza TODAS las políticas RLS y de
--     Storage por las de 061/063.
-- =============================================================================

BEGIN;

-- ─── Prerrequisitos (migraciones 000–050) ───────────────────────────────────
DO $prerrequisitos$
DECLARE
  faltan TEXT[] := '{}';
  t TEXT[];
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ARRAY['User', 'NombreUsuario', '025'],
    ARRAY['Mascota', 'VisibleEnMatch', '023b'],
    ARRAY['user_credentials', 'hash', '021'],
    ARRAY['consultas_veterinarias', 'mascota_id', '016'],
    ARRAY['historial_peso', 'mascota_id', '016'],
    ARRAY['eventos_calendario', 'mascota_id', '010'],
    ARRAY['paseador_perfil', 'servicios', '040'],
    ARRAY['Paseo', 'PrecioPactado', '045'],
    ARRAY['Paseo', 'Comision', '045'],
    ARRAY['Paseo', 'ResenaAspectos', '042'],
    ARRAY['Paseo', 'MedioPago', '044'],
    ARRAY['paseo_pagos', 'monto', '044'],
    ARRAY['negocio_perfil', 'datos', '046'],
    ARRAY['negocio_items', 'precios', '046'],
    ARRAY['negocio_turnos', 'informe', '046'],
    ARRAY['negocio_pedidos', 'items', '046'],
    ARRAY['paseador_opiniones', 'id_autor', '048'],
    ARRAY['mascota_fotos', 'url', '028'],
    ARRAY['usuarios_bloqueados', 'bloqueado_id', '029']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = t[1] AND column_name = t[2]) THEN
      faltan := faltan || format('%s.%s (migración %s)', t[1], t[2], t[3]);
    END IF;
  END LOOP;
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ARRAY['_email_social', '043'],
    ARRAY['login_social', '043'],
    ARRAY['registrar_social_con_mascota', '043'],
    ARRAY['registrar_paseador_social', '043'],
    ARRAY['activar_paseador_social', '043'],
    ARRAY['_upsert_negocio', '046'],
    ARRAY['_upsert_paseador_perfil', '040']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.proname = t[1]) THEN
      faltan := faltan || format('función %s (migración %s)', t[1], t[2]);
    END IF;
  END LOOP;
  IF array_length(faltan, 1) > 0 THEN
    RAISE EXCEPTION 'A esta base le faltan migraciones anteriores: %. Corré primero supabase/schema.sql (es idempotente) y después este archivo.',
      array_to_string(faltan, '; ');
  END IF;
END
$prerrequisitos$;
`;

const partes = [cabecera];
for (const archivo of incluidas) {
  const sql = fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8').replace(/\r\n/g, '\n');
  partes.push(`\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> ${archivo} <<<<<<<<<<<<<<<<<<<<<<<<<<<<\n`, sql.trimEnd(), '');
}
partes.push(`
-- ─── Verificación final ─────────────────────────────────────────────────────
DO $verificacion$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND qual = 'true'
             AND policyname NOT IN ('catalogo_lectura', 'mascota_ver', 'mascota_fotos_ver', 'publicacion_ver',
               'comentario_ver', 'carteles_ver', 'paseador_perfil_ver', 'paseador_opiniones_ver', 'negocio_ver',
               'servicios_ver', 'items_ver', 'roles_ver')) THEN
    RAISE EXCEPTION 'Quedó una política USING true inesperada: revisá pg_policies';
  END IF;
  RAISE NOTICE 'Zooni: cambios aplicados. Políticas RLS: %', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
END
$verificacion$;

COMMIT;
`);

const destino = path.join(DIR_SUPABASE, 'APLICAR_EN_SUPABASE.sql');
fs.writeFileSync(destino, partes.join('\n'));
console.log(`✓ ${path.relative(process.cwd(), destino)} (${incluidas.join(', ')})`);
