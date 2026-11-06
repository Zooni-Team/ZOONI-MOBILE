-- =============================================================================
-- Migración 032: Mascota.MostrarFoto — elegir entre la foto real y el avatar
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- PROBLEMA:
--   resolveMascotaVisual() da prioridad absoluta a la foto: apenas la mascota
--   tiene una cargada (Mascota.Foto), la app deja de mostrar el avatar en el
--   Home, la Ficha Médica y Mis Mascotas. El look que el usuario arma en el
--   Closet queda invisible salvo que borre la foto — y la foto NO se puede
--   borrar, porque Match la exige para poder aparecer en el pool.
--
--   O sea: cargar la foto para Match apagaba el Closet en toda la app.
--
-- SOLUCIÓN:
--   Una preferencia por mascota. TRUE (el default) mantiene exactamente el
--   comportamiento actual, así que ninguna mascota existente cambia de aspecto
--   al correr esto. En FALSE, la app usa el avatar del Closet.
--
--   Match queda AFUERA de esta preferencia a propósito: ahí siempre se muestra
--   la foto real (es el requisito de la sección). Se logra sin nada especial en
--   SQL — el mapeo de perfiles de Match no lee esta columna.
-- =============================================================================

ALTER TABLE "Mascota"
  ADD COLUMN IF NOT EXISTS "MostrarFoto" BOOLEAN NOT NULL DEFAULT TRUE;

-- La app usa la anon key con RLS deshabilitado (ver 021 y 030).
GRANT SELECT, INSERT, UPDATE, DELETE ON "Mascota" TO anon;

-- ── Verificación rápida (opcional, correr después) ───────────────────────────
--   · ¿Existe la columna?
--       SELECT column_name, column_default FROM information_schema.columns
--       WHERE table_name = 'Mascota' AND column_name = 'MostrarFoto';
--   · ¿Alguna mascota quedó sin valor? (debe devolver 0)
--       SELECT COUNT(*) FROM "Mascota" WHERE "MostrarFoto" IS NULL;
