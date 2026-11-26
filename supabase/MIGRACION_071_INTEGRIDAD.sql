BEGIN;

DO $guarda$
BEGIN
  IF to_regclass('public.mascota_publica') IS NULL THEN
    RAISE EXCEPTION 'Falta la 070: pegá primero MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql';
  END IF;
END $guarda$;

CREATE OR REPLACE FUNCTION _paseo_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_rol TEXT;
  v_tramo INTEGER;
BEGIN
  NEW."Id_Dueno" := OLD."Id_Dueno";
  IF NEW."Id_Mascota" IS NULL
     AND NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = OLD."Id_Mascota") THEN
    NEW."Id_Mascota" := NULL;
  ELSE
    NEW."Id_Mascota" := OLD."Id_Mascota";
  END IF;
  NEW."PrecioPactado" := COALESCE(OLD."PrecioPactado", OLD."Precio");

  IF OLD."Estado" <> 'pendiente' THEN
    NEW."DuracionMin" := OLD."DuracionMin";
    NEW."FechaProgramada" := OLD."FechaProgramada";
    NEW."Direccion" := OLD."Direccion";
    NEW."Lat" := OLD."Lat";
    NEW."Lng" := OLD."Lng";
    NEW."Notas" := OLD."Notas";
  END IF;

  IF v_yo IS NOT NULL THEN
    v_rol := CASE
      WHEN v_yo = OLD."Id_Dueno" THEN 'dueno'
      WHEN v_yo = OLD."Id_Walker" OR (OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = v_yo) THEN 'walker'
    END;
    IF v_rol IS NULL THEN RAISE EXCEPTION 'sin_permiso'; END IF;

    IF v_rol = 'walker' AND OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = OLD."Id_Dueno" THEN
      RAISE EXCEPTION 'no_podes_aceptar_tu_propio_paseo';
    END IF;

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
      IF NEW."Estado" <> 'finalizado' OR OLD."Estado" <> 'finalizado' THEN
        IF NEW."Rating" IS DISTINCT FROM OLD."Rating"
           OR NEW."Resena" IS DISTINCT FROM OLD."Resena" THEN
          RAISE EXCEPTION 'paseo_no_finalizado';
        END IF;
      END IF;
    END IF;

    IF v_rol = 'walker' THEN
      IF NEW."ReanudadoEn" IS NOT NULL AND NEW."ReanudadoEn" IS DISTINCT FROM OLD."ReanudadoEn" THEN
        NEW."ReanudadoEn" := now();
      END IF;
      v_tramo := CASE WHEN OLD."ReanudadoEn" IS NULL THEN 0
                      ELSE GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD."ReanudadoEn"))::INTEGER) END;

      IF NEW."SegundosAcumulados" < OLD."SegundosAcumulados" THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;
      IF NEW."SegundosAcumulados" > OLD."SegundosAcumulados" AND (
           OLD."ReanudadoEn" IS NULL
           OR NEW."ReanudadoEn" IS NOT NULL
           OR NEW."SegundosAcumulados" > OLD."SegundosAcumulados" + v_tramo + 30) THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;

      IF NEW."DistanciaMetros" < OLD."DistanciaMetros"
         OR NEW."DistanciaMetros" > (OLD."SegundosAcumulados" + v_tramo + 30) * 15 THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;
      IF OLD."HoraInicio" IS NOT NULL THEN
        NEW."HoraInicio" := OLD."HoraInicio";
      ELSIF NEW."HoraInicio" IS NOT NULL
            AND abs(EXTRACT(EPOCH FROM (NEW."HoraInicio" - now()))) > 300 THEN
        RAISE EXCEPTION 'hora_invalida';
      END IF;
    END IF;
  END IF;

  IF NEW."Estado" = 'finalizado' AND OLD."Estado" IS DISTINCT FROM 'finalizado' THEN
    NEW."Precio" := NEW."PrecioPactado";
    NEW."Comision" := round(NEW."Precio" * comision_zooni(), 2);
    NEW."HoraFin" := now();
  ELSIF NEW."Estado" = 'finalizado' THEN
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

CREATE OR REPLACE FUNCTION _mascota_limite_activas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_activas INTEGER;
BEGIN
  IF NEW."Estado" IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD."Estado" = 'active' AND OLD."Id_User" = NEW."Id_User" THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('zooni_mascotas_activas'), NEW."Id_User");
  SELECT count(*) INTO v_activas FROM "Mascota"
  WHERE "Id_User" = NEW."Id_User" AND "Estado" = 'active'
    AND "Id_Mascota" IS DISTINCT FROM NEW."Id_Mascota";
  IF v_activas >= 10 THEN
    RAISE EXCEPTION 'limite_mascotas_activas' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION _mascota_limite_activas() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mascota_limite_activas ON "Mascota";
CREATE TRIGGER trg_mascota_limite_activas
  BEFORE INSERT OR UPDATE OF "Estado", "Id_User" ON "Mascota"
  FOR EACH ROW EXECUTE FUNCTION _mascota_limite_activas();

CREATE OR REPLACE FUNCTION marcar_mascota_principal(p_id_mascota INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
BEGIN
  IF v_yo IS NULL THEN RAISE EXCEPTION 'sin_sesion'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = p_id_mascota
                 AND "Id_User" = v_yo AND "Estado" = 'active') THEN
    RAISE EXCEPTION 'mascota_no_disponible';
  END IF;
  UPDATE "Mascota" SET "EsActiva" = FALSE
  WHERE "Id_User" = v_yo AND "EsActiva" = TRUE AND "Id_Mascota" <> p_id_mascota;
  UPDATE "Mascota" SET "EsActiva" = TRUE WHERE "Id_Mascota" = p_id_mascota;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION marcar_mascota_principal(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marcar_mascota_principal(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION _mensaje_fecha_servidor()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."fecha" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION _mensaje_fecha_servidor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mensaje_fecha_servidor ON "Mensaje";
CREATE TRIGGER trg_mensaje_fecha_servidor
  BEFORE INSERT ON "Mensaje"
  FOR EACH ROW EXECUTE FUNCTION _mensaje_fecha_servidor();

DO $verificacion$
BEGIN
  ASSERT to_regprocedure('public.marcar_mascota_principal(integer)') IS NOT NULL,
    'falta marcar_mascota_principal (#15)';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mascota_limite_activas'),
    'falta el trigger del límite de mascotas (#8)';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mensaje_fecha_servidor'),
    'falta el trigger de fecha de mensajes (#22)';
  ASSERT NOT has_function_privilege('anon', 'marcar_mascota_principal(integer)', 'EXECUTE'),
    'marcar_mascota_principal no es para anon';
  RAISE NOTICE '071 OK';
END $verificacion$;

NOTIFY pgrst, 'reload schema';

COMMIT;
