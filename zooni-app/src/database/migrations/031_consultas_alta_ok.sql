-- =============================================================================
-- Migración 031: dejar andando el alta de consultas veterinarias
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- SÍNTOMA:
--   POST /rest/v1/consultas_veterinarias  →  400 (Bad Request)
--   "No se pudo guardar la consulta" en la pantalla de Consultas.
--
-- CAUSA:
--   La base tiene la tabla de la migración 016 pero NO la 030, así que le falta
--   la columna imagen_url. PostgREST rechaza el insert entero con 400 PGRST204
--   ("Could not find the 'imagen_url' column ... in the schema cache").
--   Otras variantes del mismo 400/401: RLS prendido, o el rol anon sin permiso
--   sobre la tabla o sobre la secuencia del id.
--
-- Esta migración deja las cuatro cosas en orden de una sola vez. La app además
-- ahora reintenta sin imagen si la columna no está (fichaMedicaApi.crearConsulta),
-- así que el alta no se pierde — pero para adjuntar imágenes hay que correr esto.
-- =============================================================================

-- ── 0. Por si la base es vieja y ni siquiera tiene la tabla (016) ─────────────
CREATE TABLE IF NOT EXISTS consultas_veterinarias (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  motivo      VARCHAR(150) NOT NULL,
  notas       TEXT,
  veterinario VARCHAR(120),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- ── 1. Columna de la imagen adjunta (URL pública de Storage) ──────────────────
ALTER TABLE consultas_veterinarias ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ── 2. Sin RLS, igual que el resto del proyecto (la app usa la anon key) ──────
ALTER TABLE consultas_veterinarias DISABLE ROW LEVEL SECURITY;

-- ── 3. Permisos del rol anon: tabla + secuencia del id ────────────────────────
--     Sin USAGE en la secuencia, el DEFAULT nextval() falla y el insert también.
GRANT SELECT, INSERT, UPDATE, DELETE ON consultas_veterinarias TO anon;
DO $$
DECLARE v_seq TEXT := pg_get_serial_sequence('consultas_veterinarias', 'id');
BEGIN
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon', v_seq);
  END IF;
END $$;

-- ── 4. Refrescar el cache de esquema de PostgREST ─────────────────────────────
--     Sin esto la API puede seguir devolviendo PGRST204 unos segundos más.
NOTIFY pgrst, 'reload schema';

-- ── 5. Verificación (opcional, correr después) ────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'consultas_veterinarias';            -- debe incluir imagen_url
--   SELECT relrowsecurity FROM pg_class
--   WHERE relname = 'consultas_veterinarias';               -- debe ser false
