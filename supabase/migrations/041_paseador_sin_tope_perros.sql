-- =============================================================================
-- Migración 041: sin tope de perros por paseo
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035.
-- =============================================================================
-- La 035 limitaba paseador_perfil.max_perros a 1–10 (y la app a 6). Ahora el
-- paseador elige la cantidad que quiera: sólo se exige que sea al menos 1.
-- =============================================================================

ALTER TABLE paseador_perfil DROP CONSTRAINT IF EXISTS paseador_perros_ok;
ALTER TABLE paseador_perfil ADD CONSTRAINT paseador_perros_ok CHECK (max_perros >= 1);

NOTIFY pgrst, 'reload schema';
