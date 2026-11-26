BEGIN;

DO $guarda$
BEGIN
  IF to_regclass('public.archivos_por_borrar') IS NULL THEN
    RAISE EXCEPTION 'Falta la 068: pegá primero MIGRACION_068_ARCHIVOS_HUERFANOS.sql';
  END IF;
END $guarda$;
CREATE OR REPLACE FUNCTION esta_bloqueado(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_bloqueados WHERE
      (usuario_id = usuario_actual() AND bloqueado_id = p_otro) OR
      (usuario_id = p_otro AND bloqueado_id = usuario_actual()))
$$;
REVOKE ALL ON FUNCTION esta_bloqueado(INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION esta_bloqueado(INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION _upsert_paseador_perfil(INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _upsert_negocio(INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _devolver_stock(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION precio_paseo(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION completar_perfil_paseador(INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION completar_perfil_paseador(INTEGER, JSONB) TO authenticated;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'login_user(text, text)',
    'registrar_usuario_con_mascota(jsonb, text, jsonb)',
    'registrar_paseador(jsonb, text, jsonb)',
    'activar_paseador(text, text, jsonb)',
    'registrar_negocio(jsonb, text, jsonb)',
    'activar_negocio(text, text, jsonb)',
    'cambiar_contrasena(text, text, text)'
  ] LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %s', f);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo borrar % (sigue revocada de todos los roles, que es lo que importa): %', f, SQLERRM;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION _amistad_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_yo INTEGER := usuario_actual();
BEGIN
  NEW.usuario_a_id := OLD.usuario_a_id;
  NEW.usuario_b_id := OLD.usuario_b_id;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado <> 'pendiente' OR v_yo IS DISTINCT FROM OLD.usuario_b_id
       OR NEW.estado NOT IN ('aceptada', 'rechazada') THEN
      RAISE EXCEPTION 'transicion_invalida';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_amistad_al_actualizar ON amistades;
CREATE TRIGGER trg_amistad_al_actualizar BEFORE UPDATE ON amistades
  FOR EACH ROW EXECUTE FUNCTION _amistad_al_actualizar();

DROP POLICY IF EXISTS amistades_pedir ON amistades;
CREATE POLICY amistades_pedir ON amistades FOR INSERT TO authenticated
  WITH CHECK (usuario_a_id = usuario_actual() AND usuario_b_id <> usuario_actual()
              AND estado = 'pendiente' AND NOT esta_bloqueado(usuario_b_id));

DROP POLICY IF EXISTS amistades_responder ON amistades;
CREATE POLICY amistades_responder ON amistades FOR UPDATE TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id))
  WITH CHECK (usuario_actual() IN (usuario_a_id, usuario_b_id));

CREATE OR REPLACE FUNCTION _user_antes_de_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW."Estado" := OLD."Estado";
  NEW."FechaRegistro" := OLD."FechaRegistro";

  IF NEW."NombreUsuario" IS DISTINCT FROM OLD."NombreUsuario" THEN
    IF OLD."NombreUsuarioCambiadoEn" IS NOT NULL
       AND OLD."NombreUsuarioCambiadoEn" > now() - interval '30 days' THEN
      RAISE EXCEPTION 'usuario_en_cooldown';
    END IF;
    NEW."NombreUsuarioCambiadoEn" := now();
  ELSE
    NEW."NombreUsuarioCambiadoEn" := OLD."NombreUsuarioCambiadoEn";
  END IF;

  IF NEW."Lat" IS NOT NULL THEN NEW."Lat" := round(NEW."Lat", 2); END IF;
  IF NEW."Lng" IS NOT NULL THEN NEW."Lng" := round(NEW."Lng", 2); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_user_antes_de_actualizar ON "User";
CREATE TRIGGER trg_user_antes_de_actualizar BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION _user_antes_de_actualizar();

CREATE OR REPLACE VIEW perfil_publico AS
SELECT
  u."Id_User", u."Nombre", u."Apellido", u."NombreUsuario", u."FotoPerfil",
  u."Bio", u."Ubicacion", u."Ciudad", u."Provincia", u."Pais", u."Genero",
  u."Intereses", u."UltimaConexion", u."Estado",
  CASE WHEN u."FechaNacimiento" IS NOT NULL
       THEN date_part('year', age(u."FechaNacimiento"))::INTEGER END AS "Edad",
  round(u."Lat", 2) AS "Lat",
  round(u."Lng", 2) AS "Lng",
  CASE WHEN tengo_trato_con(u."Id_User") THEN u."Telefono" END AS "Telefono"
FROM "User" u
WHERE usuario_actual() IS NOT NULL AND NOT esta_bloqueado(u."Id_User");

DROP POLICY IF EXISTS mascota_ver ON "Mascota";
CREATE POLICY mascota_ver ON "Mascota" FOR SELECT TO authenticated
  USING ("Id_User" = usuario_actual());

CREATE OR REPLACE VIEW mascota_publica AS
SELECT
  m."Id_Mascota", m."Id_User", m."Nombre", m."Especie", m."Raza", m."Foto",
  m."ImagenAsset", m."Sexo", m."Tamano", m."Castrado", m."Descripcion",
  m."VisibleEnMatch", m."MostrarFoto", m."EsActiva",
  CASE WHEN m."FechaNacimiento" IS NOT NULL
       THEN date_part('year', age(m."FechaNacimiento"))::INTEGER END AS "EdadAnios"
FROM "Mascota" m
WHERE m."Estado" = 'active' AND NOT esta_bloqueado(m."Id_User");

REVOKE ALL ON mascota_publica FROM anon, public;
GRANT SELECT ON mascota_publica TO authenticated;

DROP POLICY IF EXISTS voto_ver ON "Voto";
CREATE POLICY voto_ver ON "Voto" FOR SELECT TO authenticated
  USING (es_mi_mascota("idMascotaOrigen"));

CREATE OR REPLACE FUNCTION _match_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW."idMascotaUno" := OLD."idMascotaUno";
  NEW."idMascotaDos" := OLD."idMascotaDos";
  NEW."idUsuarioUno" := OLD."idUsuarioUno";
  NEW."idUsuarioDos" := OLD."idUsuarioDos";
  NEW."fecha" := OLD."fecha";
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_match_al_actualizar ON "Match";
CREATE TRIGGER trg_match_al_actualizar BEFORE UPDATE ON "Match"
  FOR EACH ROW EXECUTE FUNCTION _match_al_actualizar();

CREATE OR REPLACE FUNCTION _mensaje_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW."idMatch" := OLD."idMatch";
  NEW."idUsuario" := OLD."idUsuario";
  NEW."texto" := OLD."texto";
  NEW."fecha" := OLD."fecha";
  NEW."idServicio" := OLD."idServicio";
  NEW."deNegocio" := OLD."deNegocio";
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mensaje_al_actualizar ON "Mensaje";
CREATE TRIGGER trg_mensaje_al_actualizar BEFORE UPDATE ON "Mensaje"
  FOR EACH ROW EXECUTE FUNCTION _mensaje_al_actualizar();

CREATE OR REPLACE FUNCTION _paseo_mensaje_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id_paseo := OLD.id_paseo;
  NEW.id_user := OLD.id_user;
  NEW.texto := OLD.texto;
  NEW.fecha := OLD.fecha;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseo_mensaje_al_actualizar ON paseo_mensajes;
CREATE TRIGGER trg_paseo_mensaje_al_actualizar BEFORE UPDATE ON paseo_mensajes
  FOR EACH ROW EXECUTE FUNCTION _paseo_mensaje_al_actualizar();

DROP POLICY IF EXISTS mensaje_enviar ON "Mensaje";
CREATE POLICY mensaje_enviar ON "Mensaje" FOR INSERT TO authenticated WITH CHECK (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch") AND "idUsuario" = usuario_actual()
    AND NOT EXISTS (
      SELECT 1 FROM "Match" mt WHERE mt.id = "idMatch" AND mt.activo = FALSE))
  OR ("idServicio" IS NOT NULL AND (
        ("idUsuario" = usuario_actual() AND NOT "deNegocio")
        OR ("deNegocio" AND soy_dueno_servicio("idServicio") AND (
              EXISTS (SELECT 1 FROM "Mensaje" m2
                      WHERE m2."idServicio" = "idServicio" AND m2."idUsuario" = "idUsuario" AND NOT m2."deNegocio")
              OR tengo_trato_con("idUsuario")))))
);

DROP POLICY IF EXISTS paseo_mensajes_enviar ON paseo_mensajes;
CREATE POLICY paseo_mensajes_enviar ON paseo_mensajes FOR INSERT TO authenticated
  WITH CHECK (
    id_user = usuario_actual() AND participo_en_paseo(id_paseo)
    AND NOT EXISTS (SELECT 1 FROM "Paseo" p WHERE p."Id_Paseo" = id_paseo AND p."Estado" IN ('rechazado', 'cancelado'))
  );

CREATE OR REPLACE FUNCTION _paseador_perfil_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.verificado := OLD.verificado;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseador_perfil_al_actualizar ON paseador_perfil;
CREATE TRIGGER trg_paseador_perfil_al_actualizar BEFORE UPDATE ON paseador_perfil
  FOR EACH ROW EXECUTE FUNCTION _paseador_perfil_al_actualizar();

CREATE OR REPLACE FUNCTION _servicio_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.verified := OLD.verified;
  NEW.tipo := OLD.tipo;
  NEW.google_maps_url := OLD.google_maps_url;
  NEW.id_negocio := OLD.id_negocio;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_servicio_al_actualizar ON servicios;
CREATE TRIGGER trg_servicio_al_actualizar BEFORE UPDATE ON servicios
  FOR EACH ROW EXECUTE FUNCTION _servicio_al_actualizar();

DROP POLICY IF EXISTS solo_mias ON subscriptions;
DROP POLICY IF EXISTS subscriptions_ver ON subscriptions;
CREATE POLICY subscriptions_ver ON subscriptions FOR SELECT TO authenticated
  USING (user_id = usuario_actual());
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM authenticated;

DROP POLICY IF EXISTS notif_crear ON "Notificacion";

CREATE OR REPLACE FUNCTION crear_notificacion(
  p_destino INTEGER, p_mascota INTEGER, p_titulo TEXT, p_mensaje TEXT,
  p_tipo TEXT, p_data_extra JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_yo INTEGER := usuario_actual(); v_id INTEGER;
BEGIN
  IF v_yo IS NULL THEN RAISE EXCEPTION 'sin_sesion'; END IF;
  IF p_destino = v_yo THEN RAISE EXCEPTION 'destino_invalido'; END IF;
  IF esta_bloqueado(p_destino) THEN RAISE EXCEPTION 'sin_permiso'; END IF;
  IF NOT (son_amigos(p_destino) OR tengo_trato_con(p_destino) OR EXISTS (
      SELECT 1 FROM "Match" WHERE activo AND v_yo IN ("idUsuarioUno", "idUsuarioDos")
        AND p_destino IN ("idUsuarioUno", "idUsuarioDos"))) THEN
    RAISE EXCEPTION 'sin_relacion';
  END IF;

  INSERT INTO "Notificacion" ("Id_User", "Id_Mascota", "Titulo", "Mensaje", "Tipo", "Leido", "Fecha", "DataExtra")
  VALUES (p_destino, p_mascota, left(p_titulo, 150), left(p_mensaje, 500), left(p_tipo, 30), FALSE, now(), p_data_extra)
  RETURNING "Id" INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION crear_notificacion(INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_notificacion(INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION tengo_trato_con(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_otro = usuario_actual()
    OR EXISTS (SELECT 1 FROM "Paseo" WHERE
         "Estado" IN ('aceptado', 'en_curso', 'finalizado')
         AND "CreadoEn" > now() - interval '180 days'
         AND (("Id_Dueno" = usuario_actual() AND "Id_Walker" = p_otro) OR
              ("Id_Walker" = usuario_actual() AND "Id_Dueno" = p_otro)))
    OR EXISTS (SELECT 1 FROM negocio_turnos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         t.estado IN ('confirmado', 'completado') AND t.creado_en > now() - interval '180 days'
         AND ((t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
              (n.id_user = usuario_actual() AND t.id_dueno = p_otro)))
    OR EXISTS (SELECT 1 FROM negocio_pedidos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         t.estado NOT IN ('cancelado', 'rechazado') AND t.creado_en > now() - interval '180 days'
         AND ((t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
              (n.id_user = usuario_actual() AND t.id_dueno = p_otro)))
$$;
REVOKE ALL ON FUNCTION tengo_trato_con(INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION tengo_trato_con(INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION _paseo_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_rol TEXT;
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
      IF NEW."SegundosAcumulados" < OLD."SegundosAcumulados"
         OR NEW."SegundosAcumulados" > OLD."SegundosAcumulados"
              + EXTRACT(EPOCH FROM (now() - COALESCE(OLD."ReanudadoEn", now())))::INTEGER + 30 THEN
        RAISE EXCEPTION 'progreso_invalido';
      END IF;
      IF NEW."DistanciaMetros" < OLD."DistanciaMetros"
         OR NEW."DistanciaMetros" > OLD."DistanciaMetros"
              + (EXTRACT(EPOCH FROM (now() - COALESCE(OLD."ReanudadoEn", now())))::INTEGER + 30) * 15 THEN
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

CREATE OR REPLACE FUNCTION aceptar_solicitud_paseo(p_id_paseo INTEGER, p_id_walker INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_walker INTEGER := usuario_actual();
  v_filas INTEGER;
BEGIN
  IF v_walker IS NULL THEN RAISE EXCEPTION 'sin_sesion'; END IF;
  IF p_id_walker IS NOT NULL AND p_id_walker <> v_walker THEN RAISE EXCEPTION 'sin_permiso'; END IF;
  IF NOT EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = v_walker) THEN
    RAISE EXCEPTION 'no_es_paseador';
  END IF;
  IF EXISTS (SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = p_id_paseo AND "Id_Dueno" = v_walker) THEN
    RAISE EXCEPTION 'no_podes_aceptar_tu_propio_paseo';
  END IF;

  UPDATE "Paseo"
  SET "Estado" = 'aceptado', "Id_Walker" = v_walker
  WHERE "Id_Paseo" = p_id_paseo
    AND "Estado" = 'pendiente'
    AND ("Id_Walker" IS NULL OR "Id_Walker" = v_walker);

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas = 1;
END $$;

DROP POLICY IF EXISTS paseo_ver ON "Paseo";
CREATE POLICY paseo_ver ON "Paseo" FOR SELECT TO authenticated USING (
  usuario_actual() IN ("Id_Dueno", "Id_Walker")
  OR ("Id_Walker" IS NULL AND "Estado" = 'pendiente' AND soy_paseador()
      AND EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = usuario_actual() AND verificado))
);

CREATE OR REPLACE FUNCTION _paseo_track_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = NEW."Id_Paseo" AND "Estado" = 'en_curso') THEN
    RAISE EXCEPTION 'paseo_no_en_curso';
  END IF;
  NEW."Timestamp" := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseo_track_al_crear ON "PaseoTrack";
CREATE TRIGGER trg_paseo_track_al_crear BEFORE INSERT ON "PaseoTrack"
  FOR EACH ROW EXECUTE FUNCTION _paseo_track_al_crear();

DROP POLICY IF EXISTS cuenta_config_paseador ON paseo_cuenta_config;
CREATE POLICY cuenta_config_paseador ON paseo_cuenta_config FOR ALL TO authenticated
  USING (id_walker = usuario_actual())
  WITH CHECK (id_walker = usuario_actual() AND tengo_trato_con(id_dueno));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paseador_opiniones_par_unico') THEN
    BEGIN
      ALTER TABLE paseador_opiniones ADD CONSTRAINT paseador_opiniones_par_unico UNIQUE (id_walker, id_autor);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'paseador_opiniones tiene pares (id_walker, id_autor) duplicados: no se agregó el UNIQUE. Hay que decidir a mano qué opinión de cada par se conserva antes de poder agregarlo.';
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION _paseador_opinion_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id_autor <> usuario_actual() THEN RAISE EXCEPTION 'sin_permiso'; END IF;
  IF NEW.id_autor = NEW.id_walker THEN RAISE EXCEPTION 'no_podes_opinar_de_vos_mismo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Paseo" WHERE "Estado" = 'finalizado'
      AND "Id_Dueno" = NEW.id_autor AND "Id_Walker" = NEW.id_walker
  ) THEN
    RAISE EXCEPTION 'sin_paseo_finalizado';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseador_opinion_al_crear ON paseador_opiniones;
CREATE TRIGGER trg_paseador_opinion_al_crear BEFORE INSERT ON paseador_opiniones
  FOR EACH ROW EXECUTE FUNCTION _paseador_opinion_al_crear();

DROP POLICY IF EXISTS paseador_opiniones_mias ON paseador_opiniones;
DROP POLICY IF EXISTS paseador_opiniones_ver ON paseador_opiniones;
DROP POLICY IF EXISTS paseador_opiniones_crear ON paseador_opiniones;
DROP POLICY IF EXISTS paseador_opiniones_editar ON paseador_opiniones;
DROP POLICY IF EXISTS paseador_opiniones_borrar ON paseador_opiniones;
CREATE POLICY paseador_opiniones_ver ON paseador_opiniones FOR SELECT TO authenticated USING (true);
CREATE POLICY paseador_opiniones_crear ON paseador_opiniones FOR INSERT TO authenticated
  WITH CHECK (id_autor = usuario_actual());
CREATE POLICY paseador_opiniones_editar ON paseador_opiniones FOR UPDATE TO authenticated
  USING (id_autor = usuario_actual()) WITH CHECK (id_autor = usuario_actual());
CREATE POLICY paseador_opiniones_borrar ON paseador_opiniones FOR DELETE TO authenticated
  USING (id_autor = usuario_actual());
REVOKE ALL ON paseador_opiniones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON paseador_opiniones TO authenticated;

CREATE OR REPLACE FUNCTION _turno_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg negocio_perfil%ROWTYPE;
  v_item negocio_items%ROWTYPE;
  v_recargo NUMERIC := 0;
  v_validos NUMERIC[];
  v_tamano TEXT;
  v_precio_tamano NUMERIC;
  v_pendientes INTEGER;
BEGIN
  SELECT * INTO v_neg FROM negocio_perfil WHERE id = NEW.id_negocio;
  IF NOT FOUND THEN RAISE EXCEPTION 'negocio_inexistente'; END IF;
  IF v_neg.abierto IS FALSE THEN RAISE EXCEPTION 'negocio_cerrado'; END IF;

  IF NEW.fecha <= now() THEN RAISE EXCEPTION 'fecha_invalida'; END IF;

  SELECT * INTO v_item FROM negocio_items
  WHERE id = NEW.id_item AND id_negocio = NEW.id_negocio AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'servicio_inexistente'; END IF;

  NEW.servicio := v_item.nombre;
  NEW.duracion_min := COALESCE(v_item.duracion_min, LEAST(GREATEST(NEW.duracion_min, 5), 240));
  NEW.estado := 'pendiente';
  NEW.informe := NULL;

  IF NEW.id_mascota IS NOT NULL AND NOT es_mi_mascota(NEW.id_mascota) THEN
    RAISE EXCEPTION 'mascota_invalida';
  END IF;

  SELECT count(*) INTO v_pendientes FROM negocio_turnos
  WHERE id_dueno = NEW.id_dueno AND id_negocio = NEW.id_negocio AND estado IN ('pendiente', 'confirmado');
  IF v_pendientes >= 10 THEN RAISE EXCEPTION 'demasiados_turnos_pendientes'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('zooni_turnos'), NEW.id_negocio);
  IF EXISTS (
    SELECT 1 FROM negocio_turnos t
    WHERE t.id_negocio = NEW.id_negocio
      AND t.estado IN ('pendiente', 'confirmado')
      AND tstzrange(t.fecha, t.fecha + make_interval(mins => t.duracion_min))
          && tstzrange(NEW.fecha, NEW.fecha + make_interval(mins => NEW.duracion_min))
  ) THEN
    RAISE EXCEPTION 'horario_ocupado';
  END IF;

  IF NEW.a_domicilio AND v_neg.tipo = 'peluqueria' THEN
    v_recargo := COALESCE(_num(v_neg.datos->'buscaYLlevaCosto'), 0);
  END IF;

  IF NEW.id_mascota IS NOT NULL AND jsonb_typeof(v_item.precios) = 'object' THEN
    SELECT "Tamano" INTO v_tamano FROM "Mascota" WHERE "Id_Mascota" = NEW.id_mascota;
    v_tamano := CASE v_tamano
      WHEN 'small' THEN 'chico' WHEN 'medium' THEN 'mediano' WHEN 'large' THEN 'grande'
      ELSE v_tamano END;
    IF v_tamano IS NOT NULL THEN
      v_precio_tamano := _num(v_item.precios -> v_tamano);
    END IF;
  END IF;

  IF v_precio_tamano > 0 THEN
    IF round(NEW.precio - v_recargo, 2) <> round(v_precio_tamano, 2) THEN
      RAISE EXCEPTION 'precio_invalido';
    END IF;
  ELSE
    v_validos := ARRAY[round(v_item.precio, 2)];
    IF jsonb_typeof(v_item.precios) = 'object' THEN
      v_validos := v_validos || ARRAY(
        SELECT round(_num(v), 2) FROM jsonb_each(v_item.precios) AS e(k, v) WHERE _num(v) > 0);
    END IF;
    IF NOT (round(NEW.precio - v_recargo, 2) = ANY (v_validos)) THEN
      RAISE EXCEPTION 'precio_invalido';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION _turno_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_negocio BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  NEW.precio := OLD.precio;
  NEW.id_dueno := OLD.id_dueno;
  NEW.id_negocio := OLD.id_negocio;
  NEW.id_item := OLD.id_item;

  IF OLD.estado <> 'pendiente' THEN
    NEW.direccion := OLD.direccion;
    NEW.notas_dueno := OLD.notas_dueno;
    NEW.a_domicilio := OLD.a_domicilio;
    NEW.fecha := OLD.fecha;
    NEW.duracion_min := OLD.duracion_min;
  END IF;

  v_negocio := v_yo IS NULL OR soy_dueno_negocio(OLD.id_negocio);
  IF NOT v_negocio THEN
    NEW.informe := OLD.informe;
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

  v_ok := CASE
    WHEN OLD.estado = 'pendiente'  AND NEW.estado IN ('confirmado', 'rechazado') THEN v_negocio
    WHEN OLD.estado = 'confirmado' AND NEW.estado IN ('completado', 'ausente')   THEN v_negocio
    WHEN OLD.estado IN ('pendiente', 'confirmado') AND NEW.estado = 'cancelado'
      THEN v_negocio OR v_yo = OLD.id_dueno
    ELSE FALSE
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'transicion_invalida'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION _pedido_al_crear()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg negocio_perfil%ROWTYPE;
  v_linea RECORD;
  v_it negocio_items%ROWTYPE;
  v_items JSONB := '[]'::JSONB;
  v_sub NUMERIC := 0;
  v_envio NUMERIC := 0;
  v_minimo NUMERIC;
  v_gratis NUMERIC;
  v_sin_stock TEXT[] := '{}';
  v_abiertos INTEGER;
BEGIN
  SELECT * INTO v_neg FROM negocio_perfil WHERE id = NEW.id_negocio;
  IF NOT FOUND THEN RAISE EXCEPTION 'negocio_inexistente'; END IF;
  IF v_neg.abierto IS FALSE THEN RAISE EXCEPTION 'negocio_cerrado'; END IF;
  IF jsonb_typeof(NEW.items) <> 'array' THEN RAISE EXCEPTION 'carrito_vacio'; END IF;

  SELECT count(*) INTO v_abiertos FROM negocio_pedidos
  WHERE id_dueno = NEW.id_dueno AND estado IN ('nuevo', 'preparando', 'listo', 'en_camino');
  IF v_abiertos >= 10 THEN RAISE EXCEPTION 'demasiados_pedidos_abiertos'; END IF;

  FOR v_linea IN
    SELECT (x->>'idItem')::INTEGER AS id, sum(_num(x->'cantidad'))::INTEGER AS cantidad
    FROM jsonb_array_elements(NEW.items) x
    GROUP BY 1 ORDER BY 1
  LOOP
    IF v_linea.cantidad IS NULL OR v_linea.cantidad <= 0 THEN CONTINUE; END IF;
    IF v_linea.cantidad > 50 THEN RAISE EXCEPTION 'cantidad_invalida'; END IF;

    SELECT * INTO v_it FROM negocio_items
    WHERE id = v_linea.id AND id_negocio = NEW.id_negocio
    FOR UPDATE;

    IF NOT FOUND OR NOT v_it.activo OR v_it.clase <> 'producto'
       OR (v_it.stock IS NOT NULL AND v_it.stock < v_linea.cantidad) THEN
      v_sin_stock := v_sin_stock || COALESCE(v_it.nombre, v_linea.id::TEXT);
      CONTINUE;
    END IF;

    IF v_it.stock IS NOT NULL THEN
      UPDATE negocio_items SET stock = stock - v_linea.cantidad WHERE id = v_it.id;
    END IF;

    v_items := v_items || jsonb_build_object(
      'idItem', v_it.id, 'nombre', v_it.nombre, 'precio', v_it.precio, 'cantidad', v_linea.cantidad);
    v_sub := v_sub + v_it.precio * v_linea.cantidad;
  END LOOP;

  IF array_length(v_sin_stock, 1) > 0 THEN
    RAISE EXCEPTION 'sin_stock' USING DETAIL = array_to_string(v_sin_stock, ', ');
  END IF;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'carrito_vacio'; END IF;

  v_minimo := COALESCE(_num(v_neg.datos->'pedidoMinimo'), 0);
  IF v_minimo > 0 AND v_sub < v_minimo THEN RAISE EXCEPTION 'pedido_minimo'; END IF;

  IF NEW.entrega = 'envio' THEN
    IF COALESCE((v_neg.datos->>'envios')::BOOLEAN, FALSE) IS FALSE THEN
      RAISE EXCEPTION 'sin_envios';
    END IF;
    v_gratis := COALESCE(_num(v_neg.datos->'envioGratisDesde'), 0);
    v_envio := CASE WHEN v_gratis > 0 AND v_sub >= v_gratis THEN 0
                    ELSE COALESCE(_num(v_neg.datos->'envioCosto'), 0) END;
  ELSE
    NEW.direccion := NULL;
  END IF;

  NEW.items := v_items;
  NEW.subtotal := round(v_sub, 2);
  NEW.envio := round(v_envio, 2);
  NEW.total := round(v_sub, 2) + round(v_envio, 2);
  NEW.estado := 'nuevo';
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION _pedido_al_actualizar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_negocio BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  NEW.items := OLD.items;
  NEW.subtotal := OLD.subtotal;
  NEW.envio := OLD.envio;
  NEW.total := OLD.total;
  NEW.id_dueno := OLD.id_dueno;
  NEW.id_negocio := OLD.id_negocio;
  NEW.entrega := OLD.entrega;
  IF OLD.estado <> 'nuevo' THEN
    NEW.direccion := OLD.direccion;
    NEW.notas := OLD.notas;
    NEW.medio_pago := OLD.medio_pago;
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;

  v_negocio := v_yo IS NULL OR soy_dueno_negocio(OLD.id_negocio);
  v_ok := CASE
    WHEN OLD.estado = 'nuevo'      AND NEW.estado IN ('preparando', 'rechazado') THEN v_negocio
    WHEN OLD.estado = 'nuevo'      AND NEW.estado = 'cancelado' THEN v_yo IS NULL OR v_yo = OLD.id_dueno
    WHEN OLD.estado = 'preparando' AND NEW.estado = 'en_camino' THEN v_negocio AND OLD.entrega = 'envio'
    WHEN OLD.estado = 'preparando' AND NEW.estado = 'listo'     THEN v_negocio AND OLD.entrega <> 'envio'
    WHEN OLD.estado IN ('preparando', 'listo') AND NEW.estado = 'cancelado' THEN v_negocio
    WHEN OLD.estado IN ('listo', 'en_camino')  AND NEW.estado = 'entregado' THEN v_negocio
    ELSE FALSE
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'transicion_invalida'; END IF;

  IF NEW.estado IN ('rechazado', 'cancelado') THEN
    PERFORM _devolver_stock(OLD.items);
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS publicacion_ver ON "Publicacion";
CREATE POLICY publicacion_ver ON "Publicacion" FOR SELECT TO authenticated
  USING ("Activo" OR "Id_User" = usuario_actual());

DROP POLICY IF EXISTS carteles_ver ON carteles;
CREATE POLICY carteles_ver ON carteles FOR SELECT TO authenticated
  USING (activo OR usuario_id = usuario_actual());

ALTER TABLE ubicaciones_usuarios ALTER COLUMN compartir_ubicacion SET DEFAULT FALSE;
DROP POLICY IF EXISTS ubicacion_ver ON ubicaciones_usuarios;
CREATE POLICY ubicacion_ver ON ubicaciones_usuarios FOR SELECT TO authenticated
  USING (usuario_id = usuario_actual()
         OR (compartir_ubicacion AND son_amigos(usuario_id) AND updated_at > now() - interval '15 minutes'));

CREATE OR REPLACE FUNCTION _purgar_datos_antiguos()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM "PaseoTrack" WHERE "Timestamp" < now() - interval '1 year';
  DELETE FROM sos_call_logs WHERE created_at < now() - interval '2 years';
END $$;
REVOKE ALL ON FUNCTION _purgar_datos_antiguos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION _purgar_datos_antiguos() TO service_role;

REVOKE SELECT ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION _storage_cuota_resenas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total BIGINT;
BEGIN
  IF NEW.bucket_id <> 'resenas' THEN RETURN NEW; END IF;
  SELECT coalesce(sum((metadata->>'size')::BIGINT), 0) INTO v_total
  FROM storage.objects
  WHERE bucket_id = 'resenas' AND (storage.foldername(name))[1] = (storage.foldername(NEW.name))[1];
  IF v_total + COALESCE((NEW.metadata->>'size')::BIGINT, 0) > 500 * 1024 * 1024 THEN
    RAISE EXCEPTION 'cuota_excedida';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_storage_cuota_resenas ON storage.objects;
  CREATE TRIGGER trg_storage_cuota_resenas BEFORE INSERT ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION _storage_cuota_resenas();
EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
  RAISE WARNING 'No se pudo crear el trigger de cuota de Storage (falta privilegio sobre storage.objects): %. La cuota del hallazgo #72 queda sin aplicar.', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS auditoria_acciones (
  id         BIGSERIAL PRIMARY KEY,
  id_user    INTEGER,
  accion     TEXT NOT NULL,
  detalle    JSONB,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE auditoria_acciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auditoria_acciones FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_auditoria_user ON auditoria_acciones(id_user, creado_en);

CREATE OR REPLACE FUNCTION _auditar(p_accion TEXT, p_detalle JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO auditoria_acciones (id_user, accion, detalle) VALUES (usuario_actual(), p_accion, p_detalle)
$$;
REVOKE ALL ON FUNCTION _auditar(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION _auditar(TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION _auditar_interno(p_accion TEXT, p_detalle JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO auditoria_acciones (id_user, accion, detalle) VALUES (usuario_actual(), p_accion, p_detalle)
$$;

CREATE OR REPLACE FUNCTION activar_negocio_sesion(p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id INTEGER := usuario_actual();
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'sin_cuenta'; END IF;
  PERFORM _upsert_negocio(v_id, p_negocio);
  PERFORM _auditar_interno('activar_negocio_sesion', jsonb_build_object('tipo', p_negocio->>'tipo'));
  RETURN jsonb_build_object('id', v_id);
END $$;

DO $verificacion_funciones$
DECLARE
  f TEXT;
  peligrosas TEXT[] := ARRAY[
    '_upsert_paseador_perfil(integer,jsonb)', '_upsert_negocio(integer,jsonb)',
    '_devolver_stock(jsonb)', 'precio_paseo(integer,integer)',
    '_credencial_legada(text)', '_auth_id_por_mail(text)',
    '_completar_migracion_cuenta(integer,uuid)', 'get_pet_chat_context(bigint)'
  ];
BEGIN
  FOREACH f IN ARRAY peligrosas LOOP
    BEGIN
      IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE') THEN
        RAISE WARNING 'Función interna % sigue ejecutable por anon/authenticated: revisar REVOKE a mano.', f;
      END IF;
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
  RAISE NOTICE 'Verificación de permisos de funciones: hecha (ver WARNINGs arriba, si hubo).';
END
$verificacion_funciones$;

NOTIFY pgrst, 'reload schema';

DO $verificacion$
BEGIN
  ASSERT to_regclass('public.mascota_publica') IS NOT NULL, 'falta la vista mascota_publica';
  ASSERT NOT has_function_privilege('anon', 'completar_perfil_paseador(integer, jsonb)', 'EXECUTE'),
    'completar_perfil_paseador sigue abierta a anon (#1)';
  ASSERT NOT has_table_privilege('authenticated', 'subscriptions', 'INSERT'),
    'subscriptions sigue escribible desde la app (#11)';
  ASSERT has_function_privilege('anon', 'migrar_cuenta_legada(text, text)', 'EXECUTE'),
    'el login de cuentas viejas (065) tiene que seguir andando';
  ASSERT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'consultas-privadas' AND NOT public),
    'el bucket privado de consultas (064) tiene que seguir privado';
  RAISE NOTICE '070 OK';
END $verificacion$;

NOTIFY pgrst, 'reload schema';

COMMIT;
