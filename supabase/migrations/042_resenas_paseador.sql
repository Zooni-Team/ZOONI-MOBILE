-- =============================================================================
-- Migración 042: reseñas de paseadores "estilo Google Maps"
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035.
-- =============================================================================
-- Hasta ahora la reseña era sólo "Paseo"."Rating" (1–5) + "Resena" (texto).
-- El dueño ahora también puede:
--   · puntuar aspectos (puntualidad, trato con la mascota, comunicación)
--   · responder preguntas cortas (¿mandó fotos?, ¿volvió contenta?, ¿lo
--     volverías a contratar?)
--   · adjuntar fotos y videos
-- y cualquier dueño puede ver todas las reseñas de un paseador antes de
-- contratarlo.
--
-- · Columnas nuevas en "Paseo" (la reseña sigue siendo del paseo: un paseo,
--   una reseña, y sólo de paseos finalizados).
-- · Bucket de Storage "resenas" (público, imágenes y videos hasta 50 MB) con
--   permisos para subir y leer desde la app (key pública, como public-images).
-- =============================================================================

ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "ResenaAspectos"   JSONB;        -- {"puntualidad":5,"trato":4,"comunicacion":5}
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "ResenaRespuestas" JSONB;        -- {"fotos":true,"contenta":true,"repetiria":true}
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "ResenaMedia"      JSONB NOT NULL DEFAULT '[]'::jsonb; -- [{"url":"…","tipo":"imagen"|"video"}]
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "ResenaFecha"      TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Paseo' AND constraint_name = 'paseo_resena_media_ok'
  ) THEN
    ALTER TABLE "Paseo" ADD CONSTRAINT paseo_resena_media_ok
      CHECK (jsonb_typeof("ResenaMedia") = 'array' AND jsonb_array_length("ResenaMedia") <= 6);
  END IF;
END $$;

-- Reseñas de un paseador, de la más nueva a la más vieja
CREATE INDEX IF NOT EXISTS idx_paseo_walker_rating ON "Paseo"("Id_Walker", "ResenaFecha" DESC)
  WHERE "Rating" IS NOT NULL;


-- ── Storage: bucket "resenas" ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resenas', 'resenas', TRUE, 52428800, ARRAY['image/*', 'video/*'])
ON CONFLICT (id) DO UPDATE SET
  public = TRUE, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'resenas_leer') THEN
    CREATE POLICY resenas_leer ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'resenas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'resenas_subir') THEN
    CREATE POLICY resenas_subir ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'resenas');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT "Id_Paseo", "Rating", "ResenaAspectos", "ResenaRespuestas", "ResenaMedia"
--   FROM "Paseo" WHERE "Rating" IS NOT NULL ORDER BY "ResenaFecha" DESC NULLS LAST LIMIT 5;
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'resenas';
