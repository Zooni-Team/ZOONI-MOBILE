-- =============================================================================
-- Migración 050: permisos de paseador_opiniones (arregla "no se pudo enviar")
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 048.
-- =============================================================================
-- Las fotos de las opiniones se suben bien al bucket "resenas", pero el
-- INSERT en paseador_opiniones falla y la tabla queda vacía. La causa más
-- probable es que la tabla tenga RLS activado sin políticas (Supabase lo
-- activa solo en tablas nuevas según la configuración del proyecto, o la 048
-- se corrió a medias): con RLS y sin políticas, el SELECT devuelve vacío sin
-- error y el INSERT se rechaza. Esto vuelve a dejar la tabla como la pensó
-- la 048 (igual que el resto de las tablas de paseadores, ver 038 / 047).
-- =============================================================================

ALTER TABLE paseador_opiniones DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON paseador_opiniones TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE paseador_opiniones_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación (rls_activado tiene que dar false):
--   SELECT relrowsecurity AS rls_activado FROM pg_class WHERE relname = 'paseador_opiniones';
