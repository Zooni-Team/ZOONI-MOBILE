-- =============================================================================
-- Migración 048: opiniones de un paseador sin paseo de por medio
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 042 (bucket "resenas" para las fotos y videos).
-- =============================================================================
-- Hasta ahora una reseña sólo podía ir atada a un paseo terminado y sin
-- calificar ("Paseo"."Rating"): sin eso, "Escribir una opinión" no aparecía.
-- Ahora cualquiera puede opinar sobre un paseador cuando quiera y las veces
-- que quiera (también el propio paseador). Estas opiniones van en una tabla
-- aparte y se suman a las de los paseos en el promedio, las barras, los
-- aspectos, las preguntas y las fotos/videos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS paseador_opiniones (
  id         BIGSERIAL PRIMARY KEY,
  id_walker  INTEGER NOT NULL REFERENCES "User"("Id_User"),
  id_autor   INTEGER NOT NULL REFERENCES "User"("Id_User"),
  rating     SMALLINT NOT NULL,
  resena     VARCHAR(1000),
  aspectos   JSONB,                                  -- {"puntualidad":5,"trato":4,"comunicacion":5}
  respuestas JSONB,                                  -- {"fotos":true,"contenta":true,"repetiria":true}
  media      JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{"url":"…","tipo":"imagen"|"video"}]
  fecha      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paseador_opiniones_rating_ok CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT paseador_opiniones_media_ok CHECK (jsonb_typeof(media) = 'array' AND jsonb_array_length(media) <= 6)
);

CREATE INDEX IF NOT EXISTS idx_paseador_opiniones_walker ON paseador_opiniones(id_walker, fecha DESC);

-- Como el resto de las tablas de paseadores (ver 038 / 047): sin Supabase Auth
-- todavía no hay políticas por usuario.
ALTER TABLE paseador_opiniones DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON paseador_opiniones TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE paseador_opiniones_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT id, id_walker, id_autor, rating, resena, fecha FROM paseador_opiniones ORDER BY fecha DESC LIMIT 5;
