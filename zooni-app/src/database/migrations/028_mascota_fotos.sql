-- ============================================================================
-- 028_mascota_fotos.sql — Galería de fotos por mascota (varias fotos en Match)
--
-- "Mascota".Foto sigue siendo la foto principal (portada, obligatoria).
-- Esta tabla guarda las fotos ADICIONALES; en Match se muestran todas en un
-- carrusel deslizable. Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mascota_fotos (
  id          BIGSERIAL PRIMARY KEY,
  id_mascota  INTEGER NOT NULL,
  url         TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mascota_fotos_mascota
  ON mascota_fotos (id_mascota, orden);

ALTER TABLE mascota_fotos DISABLE ROW LEVEL SECURITY;

-- El cliente gestiona las fotos de sus mascotas (sin Auth todavía; el filtro
-- por dueño lo hace la app). Permisos incluyendo la secuencia del BIGSERIAL.
GRANT SELECT, INSERT, UPDATE, DELETE ON mascota_fotos TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE mascota_fotos_id_seq TO anon, authenticated;
