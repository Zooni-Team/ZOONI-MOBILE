-- =============================================================================
-- MIGRACION_071_INTEGRIDAD.sql — Pegar ENTERO en Supabase → SQL Editor → Run.
-- Va DESPUÉS de la 070. Idempotente: volver a pegarla no rompe nada.
-- Si algo no queda como debe, la verificación del final hace ROLLBACK.
-- =============================================================================
-- Correcciones del informe de errores de nov-2026 (informe-errores-zooni.md):
--
--   #1  Anti-trampa del paseo: el margen ya no se acumula update a update.
--   #8  Límite de 10 mascotas activas por cuenta, en la base (antes sólo en la app).
--   #15 marcar_mascota_principal(): baja la principal anterior y sube la nueva
--       en UNA transacción (antes, dos UPDATE sueltos desde la app).
--   #22 La fecha de un mensaje la pone la base, no el reloj del teléfono.
--
-- La app nueva funciona también SIN esta migración (marcar principal cae al
-- camino viejo si la RPC no existe), así que el orden "deploy de la app →
-- pegar la 071" no rompe nada. Lo que no hay hasta pegarla son las garantías.
-- =============================================================================

BEGIN;

DO $guarda$
BEGIN
  IF to_regclass('public.mascota_publica') IS NULL THEN
    RAISE EXCEPTION 'Falta la 070: pegá primero MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql';
  END IF;
END $guarda$;

-- ─── 1. Paseos: anti-trampa con ancla fija (#1) ─────────────────────────────
-- Misma función que la 070, cambia SOLO el bloque del walker (y v_tramo).
CREATE OR REPLACE FUNCTION _paseo_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_rol TEXT;
  v_tramo INTEGER;
BEGIN
  NEW."Id_Dueno" := OLD."Id_Dueno";
  -- Excepción (064): al purgar la mascota la FK pone Id_Mascota en NULL para
  -- que el paseo (y lo que cobró el paseador) no se borre. Sólo se acepta el
  -- NULL si la mascota ya no existe; si no, se pisaría a mano.
  IF NEW."Id_Mascota" IS NULL
     AND NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = OLD."Id_Mascota") THEN
    NEW."Id_Mascota" := NULL;
  ELSE
    NEW."Id_Mascota" := OLD."Id_Mascota";
  END IF;
  NEW."PrecioPactado" := COALESCE(OLD."PrecioPactado", OLD."Precio");

  -- Una vez que alguien tomó el pedido, los datos del encargo quedan fijos:
  -- ya se aceptó sobre esa duración/dirección (#17). Mientras sigue
  -- 'pendiente' (nadie lo tomó todavía) el dueño puede seguir ajustándolo.
  IF OLD."Estado" <> 'pendiente' THEN
    NEW."DuracionMin" := OLD."DuracionMin";
    NEW."FechaProgramada" := OLD."FechaProgramada";
    NEW."Direccion" := OLD."Direccion";
    NEW."Lat" := OLD."Lat";
    NEW."Lng" := OLD."Lng";
    NEW."Notas" := OLD."Notas";
  END IF;

  -- Sin JWT (service_role / mantenimiento desde el SQL Editor): sin reglas de rol
  IF v_yo IS NOT NULL THEN
    v_rol := CASE
      WHEN v_yo = OLD."Id_Dueno" THEN 'dueno'
      WHEN v_yo = OLD."Id_Walker" OR (OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = v_yo) THEN 'walker'
    END;
    IF v_rol IS NULL THEN RAISE EXCEPTION 'sin_permiso'; END IF;

    -- Un paseador no puede aceptar su propio pedido (#64: sería dueño y walker a la vez)
    IF v_rol = 'walker' AND OLD."Id_Walker" IS NULL AND NEW."Id_Walker" = OLD."Id_Dueno" THEN
      RAISE EXCEPTION 'no_podes_aceptar_tu_propio_paseo';
    END IF;

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
      -- La reseña (#61): sólo si el paseo YA está finalizado. Si todavía no
      -- lo está, lo que mande el dueño en esos campos se descarta.
      IF NEW."Estado" <> 'finalizado' OR OLD."Estado" <> 'finalizado' THEN
        IF NEW."Rating" IS DISTINCT FROM OLD."Rating"
           OR NEW."Resena" IS DISTINCT FROM OLD."Resena" THEN
          RAISE EXCEPTION 'paseo_no_finalizado';
        END IF;
      END IF;
    END IF;

    -- El walker reporta su propio progreso: nunca puede retroceder ni "saltar"
    -- más rápido que el reloj real (#17 — alimentan el cobro proporcional).
    -- El margen (+30 s, y 15 m/s de tope) cubre el teléfono que estuvo sin
    -- señal y manda todo junto al reconectar; si en la prueba real resulta
    -- demasiado estricto, es acá donde se afloja.
    IF v_rol = 'walker' THEN
      -- 071: el margen se calcula desde un ancla FIJA y no desde OLD. Antes el
      -- tope era OLD + (now - ReanudadoEn) + 30 s en cada UPDATE: como OLD
      -- crecía con cada update, mandando muchos seguidos (o estando en pausa,
      -- con ReanudadoEn NULL) se podía inflar el tiempo y la distancia sin
      -- límite, y con eso el cobro proporcional.
      --
      -- Y el ancla la pone el reloj del SERVIDOR: la app manda ReanudadoEn con
      -- la hora del teléfono. Con un reloj adelantado, al pausar el tramo que
      -- calcula la base quedaba corto y se rechazaba un paseo legítimo; con
      -- uno "atrasado a propósito" se inflaba el tramo. Lo que la app guarda
      -- localmente sigue siendo su hora: sólo mide duraciones, que coinciden.
      IF NEW."ReanudadoEn" IS NOT NULL AND NEW."ReanudadoEn" IS DISTINCT FROM OLD."ReanudadoEn" THEN
        NEW."ReanudadoEn" := now();
      END IF;
      v_tramo := CASE WHEN OLD."ReanudadoEn" IS NULL THEN 0
                      ELSE GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD."ReanudadoEn"))::INTEGER) END;

      -- Los segundos sólo suben al CERRAR el tramo en curso (pausar o
      -- finalizar: ReanudadoEn pasa a NULL), y como mucho lo que duró el tramo.
      IF NEW."SegundosAcumulados" < OLD."SegundosAcumulados" THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;
      IF NEW."SegundosAcumulados" > OLD."SegundosAcumulados" AND (
           OLD."ReanudadoEn" IS NULL
           OR NEW."ReanudadoEn" IS NOT NULL
           OR NEW."SegundosAcumulados" > OLD."SegundosAcumulados" + v_tramo + 30) THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;

      -- La distancia total nunca puede superar lo que se puede caminar en el
      -- tiempo total del paseo (15 m/s de tope): no se acumula update a update.
      IF NEW."DistanciaMetros" < OLD."DistanciaMetros"
         OR NEW."DistanciaMetros" > (OLD."SegundosAcumulados" + v_tramo + 30) * 15 THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;
      IF OLD."HoraInicio" IS NOT NULL THEN
        NEW."HoraInicio" := OLD."HoraInicio"; -- una vez fijada, no se vuelve a tocar
      ELSIF NEW."HoraInicio" IS NOT NULL
            AND abs(EXTRACT(EPOCH FROM (NEW."HoraInicio" - now()))) > 300 THEN
        RAISE EXCEPTION 'hora_invalida'; -- no se puede "adelantar/atrasar" el inicio
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
-- (El trigger trg_paseo_al_actualizar ya apunta a esta función.)

-- ─── 2. Límite de mascotas activas (#8) ─────────────────────────────────────
-- Antes lo contaba sólo la app (petsApi.LIMITE_ACTIVAS), con un "contar y
-- después insertar" que además admitía carreras. El candado por usuario
-- serializa dos altas simultáneas de la misma cuenta.
CREATE OR REPLACE FUNCTION _mascota_limite_activas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_activas INTEGER;
BEGIN
  IF NEW."Estado" IS DISTINCT FROM 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD."Estado" = 'active' AND OLD."Id_User" = NEW."Id_User" THEN
    RETURN NEW; -- ya contaba como activa
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

-- ─── 3. Mascota principal en una transacción (#15) ─────────────────────────
-- El índice único "una principal por usuario" obliga a bajar la anterior
-- antes de subir la nueva; hecho desde la app en dos UPDATE, si el segundo
-- fallaba la cuenta quedaba sin principal.
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

-- ─── 4. La fecha de cada mensaje la pone la base (#22) ─────────────────────
-- Con el reloj del teléfono desfasado, los mensajes salían desordenados.
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

-- ─── Verificación final ─────────────────────────────────────────────────────
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
