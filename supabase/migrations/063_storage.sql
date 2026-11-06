-- =============================================================================
-- 063_storage.sql — Buckets de Storage y sus reglas, escritos en el repo.
-- Idempotente. Requiere 060.
-- =============================================================================
-- ANTES: los buckets se habían creado a mano en el dashboard y la subida
-- confiaba en lo que el cliente decía: el contentType y el tamaño los ponía
-- la app, y cualquiera con la clave pública podía subir a cualquier ruta.
--
-- AHORA:
--   · Tamaño máximo y tipos permitidos los aplica el SERVIDOR de Storage
--     (file_size_limit / allowed_mime_types): un archivo de 200 MB o un .exe
--     con contentType "image/png" se rechazan aunque la app no lo frene.
--   · Sólo se sube con sesión y SÓLO dentro de la carpeta propia:
--     <auth.uid()>/<uso>/<archivo>. Nadie puede pisar ni borrar lo de otro.
--   · Extensión del nombre en lista blanca (el nombre lo arma la app, pero se
--     revisa acá).
--
-- Pendiente conocido (no se resuelve en esta migración): las imágenes de
-- consultas veterinarias van al bucket público. Lo correcto es un bucket
-- privado con URLs firmadas; queda anotado en el README.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('public-images', 'public-images', TRUE, 5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']),
  ('resenas', 'resenas', TRUE, 50 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Empezar de cero también acá: las políticas hechas a mano no quedan.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY zooni_lectura ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('public-images', 'resenas'));

CREATE POLICY zooni_subir_a_mi_carpeta ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('public-images', 'resenas')
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND lower(storage.extension(name)) IN
        ('jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'mov', 'webm', '3gp', 'm4v')
  );

CREATE POLICY zooni_borrar_lo_mio ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('public-images', 'resenas')
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
