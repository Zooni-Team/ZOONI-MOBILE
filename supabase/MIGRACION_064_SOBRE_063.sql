-- =============================================================================
-- MIGRACION_064_SOBRE_063.sql — SOLO lo nuevo, para una base que YA tiene
-- aplicado SUPABASE_PEGAR_TODO.sql hasta la sección 063 (Auth, RLS, reglas de
-- negocio y Storage).
-- Pegar ENTERO en Supabase → SQL Editor → Run. Idempotente: se puede volver a
-- correr. Corre en UNA transacción: si algo falla, no queda nada a medias.
-- No borra datos de usuarios.
--
-- Qué hace:
--   0. Revisa que la base tenga 060–063 (si no, frena sin tocar nada).
--   1. Reemplaza el trigger _paseo_al_actualizar (062) para que acepte que la
--      mascota de un paseo quede en NULL cuando la mascota ya no existe.
--   2. Sección 064: cascadas al borrar mascota, purga de eliminadas, bucket
--      privado de consultas, Realtime para chats y cupo diario de ZooniVet.
--
-- ORDEN: primero este SQL, DESPUÉS desplegar la Edge Function zoonivet-chat
-- (la nueva versión llama a zoonivet_consumir_cupo, que crea este archivo).
-- =============================================================================

BEGIN;

-- ─── 0. Requisitos: 060–063 ya aplicadas ────────────────────────────────────
DO $requisitos$
BEGIN
  IF to_regprocedure('public.usuario_actual()') IS NULL THEN
    RAISE EXCEPTION 'Falta 060 (usuario_actual): corré SUPABASE_PEGAR_TODO.sql completo en vez de este archivo';
  END IF;
  IF to_regprocedure('public.comision_zooni()') IS NULL OR to_regclass('public.paseo_transiciones') IS NULL THEN
    RAISE EXCEPTION 'Falta 062 (reglas de negocio): corré SUPABASE_PEGAR_TODO.sql completo en vez de este archivo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'zooni_subir_a_mi_carpeta') THEN
    RAISE EXCEPTION 'Falta 063 (Storage): corré SUPABASE_PEGAR_TODO.sql completo en vez de este archivo';
  END IF;
END
$requisitos$;

-- ─── 1. Trigger de paseos (reemplaza el de 062) ─────────────────────────────
CREATE OR REPLACE FUNCTION _paseo_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_rol TEXT;
BEGIN
  -- Partes y precio pactado no se cambian por UPDATE (nunca)
  NEW."Id_Dueno" := OLD."Id_Dueno";
  -- Excepción: al purgar la mascota (064) la FK pone Id_Mascota en NULL para
  -- que el paseo (y lo que cobró el paseador) no se borre. Sólo se acepta el
  -- NULL si la mascota ya no existe; si no, se pisaría a mano.
  IF NEW."Id_Mascota" IS NULL
     AND NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = OLD."Id_Mascota") THEN
    NEW."Id_Mascota" := NULL;
  ELSE
    NEW."Id_Mascota" := OLD."Id_Mascota";
  END IF;
  NEW."PrecioPactado" := COALESCE(OLD."PrecioPactado", OLD."Precio");

  -- Sin JWT (service_role / mantenimiento desde el SQL Editor): sin reglas de rol
  IF v_yo IS NOT NULL THEN
    v_rol := CASE
      WHEN v_yo = OLD."Id_Dueno" THEN 'dueno'
      WHEN v_yo = OLD."Id_Walker" OR (OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = v_yo) THEN 'walker'
    END;
    IF v_rol IS NULL THEN RAISE EXCEPTION 'sin_permiso'; END IF;

    -- El paseador sólo cambia cuando alguien TOMA una solicitud
    IF NEW."Id_Walker" IS DISTINCT FROM OLD."Id_Walker"
       AND NOT (OLD."Estado" = 'pendiente' AND NEW."Estado" = 'aceptado' AND NEW."Id_Walker" = v_yo) THEN
      RAISE EXCEPTION 'transicion_invalida';
    END IF;

    IF NEW."Estado" IS DISTINCT FROM OLD."Estado" THEN
      IF NOT EXISTS (SELECT 1 FROM paseo_transiciones
                     WHERE desde = OLD."Estado" AND hasta = NEW."Estado" AND rol = v_rol) THEN
        RAISE EXCEPTION 'transicion_invalida';
      END IF;
      IF OLD."Estado" = 'finalizado'
         AND (OLD."HoraFin" IS NULL OR OLD."HoraFin" < now() - interval '15 minutes') THEN
        RAISE EXCEPTION 'ya_no_se_puede_retomar';
      END IF;
    END IF;

    -- La reseña la escribe sólo el dueño; el recorrido, sólo el paseador
    IF v_rol <> 'dueno' THEN
      NEW."Rating" := OLD."Rating";
      NEW."Resena" := OLD."Resena";
      NEW."ResenaAspectos" := OLD."ResenaAspectos";
      NEW."ResenaRespuestas" := OLD."ResenaRespuestas";
      NEW."ResenaMedia" := OLD."ResenaMedia";
      NEW."ResenaFecha" := OLD."ResenaFecha";
    ELSE
      NEW."HoraInicio" := OLD."HoraInicio";
      NEW."ReanudadoEn" := OLD."ReanudadoEn";
      NEW."SegundosAcumulados" := OLD."SegundosAcumulados";
      NEW."DistanciaMetros" := OLD."DistanciaMetros";
    END IF;
  END IF;

  -- Plata: se calcula acá, una sola vez, al pasar a 'finalizado'
  IF NEW."Estado" = 'finalizado' AND OLD."Estado" IS DISTINCT FROM 'finalizado' THEN
    NEW."Precio" := NEW."PrecioPactado";
    NEW."Comision" := round(NEW."Precio" * comision_zooni(), 2);
    NEW."HoraFin" := now();
  ELSIF NEW."Estado" = 'finalizado' THEN
    -- Ya estaba finalizado (ej. el dueño deja la reseña): nada de plata cambia
    NEW."Precio" := OLD."Precio";
    NEW."Comision" := OLD."Comision";
    NEW."HoraFin" := OLD."HoraFin";
  ELSE
    NEW."Precio" := NEW."PrecioPactado";
    NEW."Comision" := 0;
    IF OLD."Estado" = 'finalizado' THEN NEW."HoraFin" := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_paseo_al_actualizar ON "Paseo";
CREATE TRIGGER trg_paseo_al_actualizar BEFORE UPDATE ON "Paseo"
  FOR EACH ROW EXECUTE FUNCTION _paseo_al_actualizar();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 064_pendientes_base <<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- 064 — Deuda de base y seguridad que quedaba en faltaporhacer.md §4.
-- Idempotente. Requiere 060–063.
-- =============================================================================
--   1. Borrado de mascota parejo: qué se va con ella y qué queda.
--   2. Purga real de las mascotas eliminadas hace más de 30 días.
--   3. Imágenes de consultas veterinarias en un bucket PRIVADO (URLs firmadas).
--   4. Chats por Supabase Realtime en vez de consultar cada 4 segundos.
--   5. Cupo diario de mensajes a ZooniVet por usuario.
-- =============================================================================

-- ─── 1. Cascadas al borrar una mascota ──────────────────────────────────────
-- ANTES: eventos_calendario, historial_peso y consultas se iban con la
-- mascota (CASCADE) pero MascotaVacuna, Tratamiento, HistorialEvento, Voto y
-- Match no: el DELETE fallaba por FK y la mascota no se podía purgar nunca.
--
-- AHORA, una sola regla para TODA FK que apunte a "Mascota":
--   · columna NOT NULL (el dato no tiene sentido sin la mascota: salud, votos,
--     matches, fotos) → ON DELETE CASCADE.
--   · columna que admite NULL (el registro es también de OTRA persona:
--     publicaciones, carteles, SOS, turnos) → ON DELETE SET NULL.
--   · "Paseo" es la excepción: es NOT NULL pero guarda lo que cobró el
--     paseador. Se le saca el NOT NULL y queda SET NULL (ver 062: el trigger
--     acepta ese NULL sólo si la mascota ya no existe).
-- Y lo que cuelga de un Match (sus mensajes) se va con el Match.
ALTER TABLE "Paseo" ALTER COLUMN "Id_Mascota" DROP NOT NULL;

-- mascota_fotos y mascota_estado_historial guardaban id_mascota SIN FK.
-- NOT VALID: no revisa filas viejas (no borra nada que ya esté), pero desde
-- ahora la relación existe y la cascada funciona.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mascota_fotos_id_mascota_fkey') THEN
    ALTER TABLE mascota_fotos ADD CONSTRAINT mascota_fotos_id_mascota_fkey
      FOREIGN KEY (id_mascota) REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mascota_estado_historial_id_mascota_fkey') THEN
    ALTER TABLE mascota_estado_historial ADD CONSTRAINT mascota_estado_historial_id_mascota_fkey
      FOREIGN KEY (id_mascota) REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
  v_accion TEXT;
  v_codigo "char";
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tabla, c.confrelid::regclass AS ref,
           a.attname AS columna, ra.attname AS columna_ref, a.attnotnull AS no_nula,
           c.confdeltype, c.convalidated
    FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid  = c.conrelid  AND a.attnum  = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND c.confrelid IN ('public."Mascota"'::regclass, 'public."Match"'::regclass)
  LOOP
    IF r.ref = 'public."Match"'::regclass OR r.no_nula THEN
      v_accion := 'CASCADE';  v_codigo := 'c';
    ELSE
      v_accion := 'SET NULL'; v_codigo := 'n';
    END IF;
    CONTINUE WHEN r.confdeltype = v_codigo;   -- ya está bien: no tocar (idempotente)

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s%s',
                   r.tabla, r.conname, r.columna, r.ref, r.columna_ref, v_accion,
                   CASE WHEN r.convalidated THEN '' ELSE ' NOT VALID' END);
  END LOOP;
END $$;

-- ─── 2. Purga de mascotas eliminadas ────────────────────────────────────────
-- eliminarMascota (app) hace borrado lógico: Estado='deleted' y
-- PurgarDespues = +30 días. Nadie las borraba de verdad. Esta función lo hace
-- (las cascadas de arriba se llevan lo demás). Sólo service_role / pg_cron.
CREATE OR REPLACE FUNCTION purgar_mascotas_eliminadas()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cuantas INTEGER;
BEGIN
  DELETE FROM "Mascota"
  WHERE "Estado" = 'deleted' AND "PurgarDespues" IS NOT NULL AND "PurgarDespues" < now();
  GET DIAGNOSTICS v_cuantas = ROW_COUNT;
  RETURN v_cuantas;
END $$;
REVOKE ALL ON FUNCTION purgar_mascotas_eliminadas() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION purgar_mascotas_eliminadas() TO service_role;

-- Todas las noches a las 03:30 UTC, si pg_cron está habilitado
-- (Dashboard → Database → Extensions → pg_cron). Si no lo está, no pasa nada:
-- se puede correr a mano `select purgar_mascotas_eliminadas();`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'zooni_purgar_mascotas';
    PERFORM cron.schedule('zooni_purgar_mascotas', '30 3 * * *',
                          'SELECT public.purgar_mascotas_eliminadas()');
  END IF;
END $$;

-- ─── 3. Consultas veterinarias: bucket privado ──────────────────────────────
-- Estudios, recetas y fotos clínicas no pueden estar en una URL pública. El
-- bucket "consultas-privadas" no es público: sólo el dueño (carpeta
-- <auth.uid()>/...) puede subir, leer y borrar, y la app muestra la imagen con
-- una URL firmada que vence (createSignedUrl). En la tabla se guarda la RUTA
-- (imagen_path), no una URL. Las consultas viejas con imagen_url pública se
-- siguen mostrando como estaban.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('consultas-privadas', 'consultas-privadas', FALSE, 10 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS zooni_privado_leer ON storage.objects;
DROP POLICY IF EXISTS zooni_privado_subir ON storage.objects;
DROP POLICY IF EXISTS zooni_privado_borrar ON storage.objects;

CREATE POLICY zooni_privado_leer ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'consultas-privadas' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY zooni_privado_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consultas-privadas'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'heic')
  );

CREATE POLICY zooni_privado_borrar ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'consultas-privadas' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

ALTER TABLE consultas_veterinarias ADD COLUMN IF NOT EXISTS imagen_path TEXT;

-- ─── 4. Chats en tiempo real ────────────────────────────────────────────────
-- Las tablas entran a la publicación de Supabase Realtime. Realtime respeta
-- RLS: cada usuario recibe sólo los cambios de filas que puede ver
-- (mensaje_ver / paseo_mensajes_ver de 061).
DO $$
DECLARE t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;   -- Postgres local de prueba: no hay Realtime
  END IF;
  FOREACH t IN ARRAY ARRAY['Mensaje', 'paseo_mensajes'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─── 5. Cupo de ZooniVet ────────────────────────────────────────────────────
-- Cada mensaje a ZooniVet es una llamada paga a Groq. La Edge Function
-- zoonivet-chat llama a zoonivet_consumir_cupo ANTES de llamar a Groq; si
-- devuelve FALSE, responde 429 CUPO_AGOTADO. Contar acá (y no en memoria de la
-- función) hace que el límite valga aunque haya varias instancias corriendo.
CREATE TABLE IF NOT EXISTS zoonivet_uso (
  id_user  INTEGER NOT NULL REFERENCES "User"("Id_User") ON DELETE CASCADE,
  dia      DATE    NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id_user, dia)
);
ALTER TABLE zoonivet_uso ENABLE ROW LEVEL SECURITY;   -- sin políticas: sólo service_role
REVOKE ALL ON zoonivet_uso FROM anon, authenticated;
GRANT ALL ON zoonivet_uso TO service_role;

CREATE OR REPLACE FUNCTION zoonivet_consumir_cupo(p_id_user INTEGER, p_limite INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
  v_cantidad INTEGER;
BEGIN
  INSERT INTO zoonivet_uso (id_user, dia, cantidad) VALUES (p_id_user, v_dia, 1)
  ON CONFLICT (id_user, dia) DO UPDATE SET cantidad = zoonivet_uso.cantidad + 1
  RETURNING cantidad INTO v_cantidad;
  IF v_cantidad > p_limite THEN
    -- No sumar los intentos rechazados: el contador queda en el límite
    UPDATE zoonivet_uso SET cantidad = p_limite WHERE id_user = p_id_user AND dia = v_dia;
    RETURN FALSE;
  END IF;
  -- Los días viejos no sirven para nada: se limpian los de este usuario
  DELETE FROM zoonivet_uso WHERE id_user = p_id_user AND dia < v_dia - 7;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION zoonivet_consumir_cupo(INTEGER, INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION zoonivet_consumir_cupo(INTEGER, INTEGER) TO service_role;

INSERT INTO zooni_politica_tablas (tabla, categoria, motivo) VALUES
  ('zoonivet_uso', 'interna', 'Cupo diario de ZooniVet; sólo la Edge Function (service_role)')
ON CONFLICT (tabla) DO UPDATE SET categoria = EXCLUDED.categoria, motivo = EXCLUDED.motivo;

NOTIFY pgrst, 'reload schema';

-- ─── Verificación ───────────────────────────────────────────────────────────
DO $verificacion$
BEGIN
  IF to_regprocedure('public.zoonivet_consumir_cupo(integer,integer)') IS NULL
     OR to_regprocedure('public.purgar_mascotas_eliminadas()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'consultas-privadas' AND NOT public) THEN
    RAISE EXCEPTION '064 no quedó completa';
  END IF;
  RAISE NOTICE 'Zooni: 064 aplicada. Realtime en chats: %',
    (SELECT count(*) FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename IN ('Mensaje', 'paseo_mensajes'));
END
$verificacion$;

COMMIT;
