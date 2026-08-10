-- =============================================================================
-- Migración 030: Arreglar consultas_veterinarias (insertar) + adjuntar imagen
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- PROBLEMA 1 (bug del 401):
--   Al crear una consulta desde la app, el POST daba
--   401 "new row violates row-level security policy for table consultas_veterinarias".
--   La tabla tenía RLS ACTIVADO (con lectura permitida pero sin política de
--   escritura), a diferencia del resto del proyecto que corre con la anon key y
--   RLS deshabilitado (ver 016 y el límite explicado en 021). La lectura andaba
--   pero el insert quedaba bloqueado.
--
-- PROBLEMA 2 (nueva feature):
--   Las consultas ahora pueden llevar una imagen adjunta (estudio, receta, foto).
--   Se guarda la URL pública en la columna imagen_url. El archivo va al bucket
--   de Storage "public-images" (el mismo que usan perfil y publicaciones).
-- =============================================================================

-- ── 1. Columna para la imagen adjunta (URL pública de Storage) ────────────────
ALTER TABLE consultas_veterinarias
  ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ── 2. Volver a dejar la tabla como el resto: sin RLS (la app usa la anon key) ─
--    Esto habilita insertar/editar/borrar consultas desde el cliente.
ALTER TABLE consultas_veterinarias DISABLE ROW LEVEL SECURITY;

-- Asegurar los privilegios del rol anon sobre la tabla (por si algún cambio
-- previo los revocó). No incluye nada peligroso: son las consultas de la propia
-- ficha médica, igual que MascotaVacuna o Tratamiento.
GRANT SELECT, INSERT, UPDATE, DELETE ON consultas_veterinarias TO anon;

-- ── 3. Verificación rápida (opcional, correr después) ─────────────────────────
--   · ¿RLS quedó apagado?
--       SELECT relrowsecurity FROM pg_class WHERE relname = 'consultas_veterinarias';  -- debe ser false
--   · ¿Existe la columna?
--       SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'consultas_veterinarias' AND column_name = 'imagen_url';     -- 1 fila
