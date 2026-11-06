-- =============================================================================
-- Migración 031: eventos_calendario — columnas de origen + índice único
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- PROBLEMA 1 (el bug de los eventos duplicados):
--   Al entrar a Eventos y volver a Calendario, el mismo evento público aparecía
--   dos veces. La causa estaba en la app (un "sembrado inicial" que corría desde
--   la carga y desde el foco de pantalla, más el doble toque en "Agregar"), y ya
--   está resuelta en services/calendarioStore.js: agregarEventoCalendario()
--   comprueba antes de insertar.
--
--   Esa comprobación NO alcanza sola: entre el SELECT y el INSERT hay una
--   ventana en la que dos dispositivos —o dos toques rápidos— insertan igual.
--   El índice único de abajo es la garantía real, y es la que el store espera
--   cuando trata el error 23505 como "ya estaba agregado" en vez de como fallo.
--
-- PROBLEMA 2 (columnas faltantes según por dónde se creó la tabla):
--   La tabla se crea en dos migraciones distintas y NO con las mismas columnas:
--     · 009_create_eventos.sql       → sin emoji, color, origen ni origen_evento_id
--     · 010_supabase_live_setup.sql  → con las cuatro
--   En una base creada por el camino de 009, todo insert del calendario falla
--   ("column origen does not exist"). Se agregan acá con IF NOT EXISTS para que
--   las dos bases queden iguales.
-- =============================================================================

-- ── 1. Columnas que faltan si la tabla se creó con 009 ────────────────────────
ALTER TABLE eventos_calendario
  ADD COLUMN IF NOT EXISTS emoji            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS color            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS origen           VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origen_evento_id INTEGER REFERENCES eventos(id);

-- ── 2. Limpiar los duplicados que ya quedaron en la base ──────────────────────
-- El índice único no se puede crear con duplicados presentes. Se conserva la
-- fila más vieja de cada (mascota, evento público): es la que el usuario agregó
-- de verdad, las siguientes son las copias que metía el sembrado.
DELETE FROM eventos_calendario e
WHERE e.origen = 'eventos'
  AND e.origen_evento_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM eventos_calendario otro
    WHERE otro.origen           = 'eventos'
      AND otro.mascota_id       = e.mascota_id
      AND otro.origen_evento_id = e.origen_evento_id
      AND otro.id               < e.id
  );

-- ── 3. Índice único: un evento público, una sola vez por mascota ──────────────
-- Parcial (WHERE) a propósito: los eventos manuales no tienen origen_evento_id
-- y el usuario sí puede crear dos turnos iguales el mismo día si quiere.
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_calendario_unico
  ON eventos_calendario (mascota_id, origen_evento_id)
  WHERE origen = 'eventos' AND origen_evento_id IS NOT NULL;

-- ── 4. Privilegios del rol anon (la app usa la anon key, ver 021 y 030) ───────
ALTER TABLE eventos_calendario DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_calendario TO anon;

-- ── 5. Verificación rápida (opcional, correr después) ─────────────────────────
--   · ¿Existe el índice?
--       SELECT indexname FROM pg_indexes
--       WHERE tablename = 'eventos_calendario' AND indexname = 'idx_eventos_calendario_unico';
--   · ¿Quedó algún duplicado? (debe devolver 0 filas)
--       SELECT mascota_id, origen_evento_id, COUNT(*)
--       FROM eventos_calendario WHERE origen = 'eventos'
--       GROUP BY 1, 2 HAVING COUNT(*) > 1;
