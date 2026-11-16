-- =============================================================================
-- MIGRACION_068_ARCHIVOS_HUERFANOS.sql — Pegar ENTERO en Supabase → SQL Editor → Run.
-- Va DESPUÉS de la 067. Idempotente. No borra ni mueve datos: sólo deja anotado
-- qué archivos sobran y prepara la mudanza de las imágenes viejas de consultas.
-- Si algo no queda como debe, la verificación del final hace ROLLBACK.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.migracion_intentos') IS NULL THEN
    RAISE EXCEPTION 'Falta la 067: pegá primero MIGRACION_067_CERRAR_FUNCIONES.sql';
  END IF;
END $$;

-- =============================================================================
-- 068 — Archivos de Storage que quedan sin dueño, e imágenes clínicas viejas
-- en el bucket público.
-- =============================================================================
-- PROBLEMA:
--   · Al borrar una mascota (o una foto suya, o una consulta) se borraban las
--     FILAS, pero el archivo seguía en Storage, público y para siempre. La
--     purga nocturna de mascotas eliminadas (064) tenía el mismo hueco.
--   · Las imágenes de consultas cargadas antes de la 064 viven en el bucket
--     PÚBLICO (columna imagen_url): estudios y recetas que se abren sin sesión.
--
-- POR QUÉ NO SE BORRAN DESDE SQL: Supabase no deja borrar archivos con un
--   DELETE sobre storage.objects (quedaría la fila borrada y el archivo en el
--   disco). Hay que usar la API de Storage. Por eso la base ANOTA y un script
--   con la clave service_role ejecuta:
--       node supabase/scripts/limpiar-storage.mjs
--
-- AHORA:
--   1. archivos_por_borrar: cola de archivos que quedaron sin uso. La llenan
--      triggers al borrar una mascota, una foto de mascota o una consulta, y al
--      reemplazar la foto principal. Nadie la lee desde la app.
--   2. archivos_para_borrar(limite): los de la cola que ya no usa NINGUNA fila
--      (la misma foto puede estar en Mascota.Foto y en mascota_fotos).
--   3. consultas_a_privatizar() + privatizar_imagen_consulta(id, ruta): para
--      que el script copie cada imagen vieja al bucket privado, apunte la
--      consulta a la copia y anote la pública para borrar.
--   Las tres funciones: sólo service_role.
--   4. Se BORRAN las RPC del login viejo (SHA-256 sin sal enviado por la app):
--      login_user, registrar_* / activar_* con p_hash, cambiar_contrasena y las
--      dos de la Edge Function migrar-cuenta, que se eliminó del repo (la
--      migración de cuentas viejas la hace migrar_cuenta_legada, 065 + 067).
--      Estaban revocadas, pero un GRANT equivocado las reactivaba.
-- =============================================================================

-- ─── 1. La cola ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos_por_borrar (
  id          BIGSERIAL PRIMARY KEY,
  bucket      TEXT NOT NULL,
  ruta        TEXT NOT NULL,
  motivo      TEXT NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  borrado_en  TIMESTAMPTZ,
  UNIQUE (bucket, ruta)
);
CREATE INDEX IF NOT EXISTS idx_archivos_por_borrar_pendientes
  ON archivos_por_borrar (creado_en) WHERE borrado_en IS NULL;
ALTER TABLE archivos_por_borrar ENABLE ROW LEVEL SECURITY;   -- sin políticas: nadie desde la app
REVOKE ALL ON archivos_por_borrar FROM anon, authenticated;
REVOKE ALL ON SEQUENCE archivos_por_borrar_id_seq FROM anon, authenticated;

/*
  URL pública o firmada de NUESTRO Storage → (bucket, ruta).
    https://x.supabase.co/storage/v1/object/public/public-images/<uid>/mascotas/a.jpg?t=1
      → ('public-images', '<uid>/mascotas/a.jpg')
  Cualquier otra URL (Google, Facebook, una imagen externa) → NULL: no es
  nuestra y no hay nada que borrar.
*/
CREATE OR REPLACE FUNCTION _archivo_de_url(p_url TEXT, OUT bucket TEXT, OUT ruta TEXT)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE m TEXT[];
BEGIN
  m := regexp_match(coalesce(p_url, ''), '/storage/v1/object/(?:public|sign|authenticated)/([^/?#]+)/([^?#]+)');
  IF m IS NOT NULL THEN
    bucket := m[1];
    ruta := m[2];
  END IF;
END $$;
REVOKE ALL ON FUNCTION _archivo_de_url(TEXT) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION _anotar_archivo(p_bucket TEXT, p_ruta TEXT, p_motivo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_bucket IS NULL OR p_ruta IS NULL OR p_ruta = '' THEN RETURN; END IF;
  INSERT INTO archivos_por_borrar (bucket, ruta, motivo) VALUES (p_bucket, p_ruta, p_motivo)
  ON CONFLICT (bucket, ruta) DO UPDATE SET borrado_en = NULL, motivo = EXCLUDED.motivo
    WHERE archivos_por_borrar.borrado_en IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION _anotar_archivo(TEXT, TEXT, TEXT) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION _anotar_url(p_url TEXT, p_motivo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a RECORD;
BEGIN
  a := _archivo_de_url(p_url);
  PERFORM _anotar_archivo(a.bucket, a.ruta, p_motivo);
END $$;
REVOKE ALL ON FUNCTION _anotar_url(TEXT, TEXT) FROM public, anon, authenticated;

-- ─── Triggers que llenan la cola ────────────────────────────────────────────
-- Las fotos de mascota_fotos y las consultas tienen ON DELETE CASCADE desde
-- Mascota (064): sus triggers también corren cuando se borra la mascota.

CREATE OR REPLACE FUNCTION _mascota_archivos_huerfanos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM _anotar_url(OLD."Foto", 'mascota borrada');
    RETURN OLD;
  END IF;
  IF OLD."Foto" IS DISTINCT FROM NEW."Foto" THEN
    PERFORM _anotar_url(OLD."Foto", 'foto reemplazada');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION _mascota_archivos_huerfanos() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_mascota_archivos_huerfanos ON "Mascota";
CREATE TRIGGER trg_mascota_archivos_huerfanos AFTER DELETE OR UPDATE OF "Foto" ON "Mascota"
  FOR EACH ROW EXECUTE FUNCTION _mascota_archivos_huerfanos();

CREATE OR REPLACE FUNCTION _mascota_foto_huerfana()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _anotar_url(OLD.url, 'foto de mascota borrada');
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION _mascota_foto_huerfana() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_mascota_foto_huerfana ON mascota_fotos;
CREATE TRIGGER trg_mascota_foto_huerfana AFTER DELETE ON mascota_fotos
  FOR EACH ROW EXECUTE FUNCTION _mascota_foto_huerfana();

CREATE OR REPLACE FUNCTION _consulta_imagen_huerfana()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM _anotar_url(OLD.imagen_url, 'consulta borrada');
    PERFORM _anotar_archivo('consultas-privadas', OLD.imagen_path, 'consulta borrada');
    RETURN OLD;
  END IF;
  IF OLD.imagen_url IS DISTINCT FROM NEW.imagen_url THEN
    PERFORM _anotar_url(OLD.imagen_url, 'imagen de consulta reemplazada');
  END IF;
  IF OLD.imagen_path IS DISTINCT FROM NEW.imagen_path THEN
    PERFORM _anotar_archivo('consultas-privadas', OLD.imagen_path, 'imagen de consulta reemplazada');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION _consulta_imagen_huerfana() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_consulta_imagen_huerfana ON consultas_veterinarias;
CREATE TRIGGER trg_consulta_imagen_huerfana AFTER DELETE OR UPDATE OF imagen_url, imagen_path
  ON consultas_veterinarias FOR EACH ROW EXECUTE FUNCTION _consulta_imagen_huerfana();

-- ─── 2. Lo que el script puede borrar ───────────────────────────────────────
/*
  Pendientes de la cola que ya no usa ninguna fila. Un archivo que se anotó
  pero volvió a usarse (la misma URL quedó en otra foto) no se ofrece.
*/
CREATE OR REPLACE FUNCTION archivos_para_borrar(p_limite INTEGER DEFAULT 200)
RETURNS TABLE (id BIGINT, bucket TEXT, ruta TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.bucket, a.ruta
  FROM archivos_por_borrar a
  WHERE a.borrado_en IS NULL
    AND NOT EXISTS (SELECT 1 FROM "Mascota" m, _archivo_de_url(m."Foto") u
                    WHERE u.bucket = a.bucket AND u.ruta = a.ruta)
    AND NOT EXISTS (SELECT 1 FROM mascota_fotos f, _archivo_de_url(f.url) u
                    WHERE u.bucket = a.bucket AND u.ruta = a.ruta)
    AND NOT EXISTS (SELECT 1 FROM consultas_veterinarias c, _archivo_de_url(c.imagen_url) u
                    WHERE u.bucket = a.bucket AND u.ruta = a.ruta)
    AND NOT EXISTS (SELECT 1 FROM consultas_veterinarias c
                    WHERE a.bucket = 'consultas-privadas' AND c.imagen_path = a.ruta)
  ORDER BY a.creado_en
  LIMIT greatest(1, least(coalesce(p_limite, 200), 1000))
$$;
REVOKE ALL ON FUNCTION archivos_para_borrar(INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION archivos_para_borrar(INTEGER) TO service_role;

-- ─── 3. Imágenes viejas de consultas → bucket privado ───────────────────────
/*
  Consultas con imagen en el bucket público y todavía sin copia privada, con
  la carpeta donde va la copia: consultas-privadas/<auth uid del dueño>/consultas/.
  Las de dueños sin cuenta de Auth (cuentas viejas sin migrar) no se pueden
  mudar todavía: la política del bucket privado es por auth uid.
*/
CREATE OR REPLACE FUNCTION consultas_a_privatizar()
RETURNS TABLE (id INTEGER, imagen_url TEXT, carpeta TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.imagen_url, u.auth_id::TEXT || '/consultas'
  FROM consultas_veterinarias c
  JOIN "Mascota" m ON m."Id_Mascota" = c.mascota_id
  JOIN "User" u ON u."Id_User" = m."Id_User"
  WHERE c.imagen_url IS NOT NULL AND c.imagen_path IS NULL AND u.auth_id IS NOT NULL
    AND (_archivo_de_url(c.imagen_url)).bucket IS NOT NULL
  ORDER BY c.id
$$;
REVOKE ALL ON FUNCTION consultas_a_privatizar() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION consultas_a_privatizar() TO service_role;

/*
  La consulta pasa a usar la copia privada. El trigger de arriba anota la
  imagen pública para borrar. Devuelve FALSE si la consulta ya no estaba como
  se esperaba (otro proceso la mudó, o la ruta no es de la carpeta del dueño).
*/
CREATE OR REPLACE FUNCTION privatizar_imagen_consulta(p_id INTEGER, p_ruta TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_carpeta TEXT; v_filas INTEGER;
BEGIN
  SELECT u.auth_id::TEXT || '/consultas/' INTO v_carpeta
  FROM consultas_veterinarias c
  JOIN "Mascota" m ON m."Id_Mascota" = c.mascota_id
  JOIN "User" u ON u."Id_User" = m."Id_User"
  WHERE c.id = p_id;
  IF v_carpeta IS NULL OR p_ruta IS NULL OR left(p_ruta, length(v_carpeta)) <> v_carpeta
     OR p_ruta LIKE '%..%' THEN
    RETURN FALSE;
  END IF;

  UPDATE consultas_veterinarias SET imagen_path = p_ruta, imagen_url = NULL
  WHERE id = p_id AND imagen_path IS NULL AND imagen_url IS NOT NULL;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas = 1;
END $$;
REVOKE ALL ON FUNCTION privatizar_imagen_consulta(INTEGER, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION privatizar_imagen_consulta(INTEGER, TEXT) TO service_role;

-- ─── 4. Fuera las RPC del login viejo ───────────────────────────────────────
-- (SUPABASE_PEGAR_TODO.sql las vuelve a crear: por eso esta migración va
-- siempre después de él, como todas.)
DROP FUNCTION IF EXISTS login_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS registrar_usuario_con_mascota(JSONB, TEXT, JSONB);
DROP FUNCTION IF EXISTS registrar_paseador(JSONB, TEXT, JSONB);
DROP FUNCTION IF EXISTS activar_paseador(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS registrar_negocio(JSONB, TEXT, JSONB);
DROP FUNCTION IF EXISTS activar_negocio(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS cambiar_contrasena(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS _credencial_legada(TEXT);
DROP FUNCTION IF EXISTS _completar_migracion_cuenta(INTEGER, UUID);

-- ─── 5. Verificación (si falla, se deshace todo) ────────────────────────────
DO $$
DECLARE a RECORD;
BEGIN
  a := _archivo_de_url('https://x.supabase.co/storage/v1/object/public/public-images/u1/mascotas/a.jpg?t=9');
  ASSERT a.bucket = 'public-images' AND a.ruta = 'u1/mascotas/a.jpg', 'no se reconoce una URL pública propia';
  a := _archivo_de_url('https://lh3.googleusercontent.com/a/foto.jpg');
  ASSERT a.bucket IS NULL, 'una URL externa no es nuestra';

  ASSERT NOT has_function_privilege('authenticated', 'archivos_para_borrar(integer)', 'EXECUTE'),
    'la lista de archivos para borrar no es para la app';
  ASSERT NOT has_function_privilege('authenticated', 'privatizar_imagen_consulta(integer, text)', 'EXECUTE'),
    'mudar imágenes de consultas no es para la app';
  ASSERT NOT has_function_privilege('anon', 'consultas_a_privatizar()', 'EXECUTE'),
    'la lista de consultas no es pública';
  ASSERT NOT has_table_privilege('authenticated', 'archivos_por_borrar', 'SELECT'),
    'la cola de archivos no se lee desde la app';
  ASSERT has_function_privilege('service_role', 'archivos_para_borrar(integer)', 'EXECUTE'),
    'el script de limpieza necesita archivos_para_borrar';
  ASSERT to_regprocedure('login_user(text, text)') IS NULL, 'sigue existiendo el login con hash';
  ASSERT to_regprocedure('cambiar_contrasena(text, text, text)') IS NULL, 'sigue existiendo el cambio de contraseña con hash';
  ASSERT has_function_privilege('anon', 'migrar_cuenta_legada(text, text)', 'EXECUTE'),
    'el login de cuentas viejas (065) tiene que seguir andando';
  RAISE NOTICE '068 OK';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
