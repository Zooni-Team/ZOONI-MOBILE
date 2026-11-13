-- =============================================================================
-- MIGRACION_066_RLS_REAPLICAR.sql — Pegar ENTERO en Supabase → SQL Editor → Run.
-- Idempotente: se puede correr las veces que haga falta. Va DESPUÉS de 064 y 065.
-- Además de la seguridad (abajo), trae las reglas de la sección 066 de
-- SUPABASE_PEGAR_TODO.sql: veterinarias inventadas fuera del SOS, paseos
-- vencidos, paseos superpuestos o en el pasado, historial de peso y nadie
-- opina de sí mismo.
-- =============================================================================
-- PROBLEMA (verificado en producción el 12/11/2026): con una sesión cualquiera
-- se leían 44 filas de "User" (mail, teléfono, ubicación), 106 notificaciones,
-- 31 mensajes y 21 paseos ajenos. Los PERMISOS de tabla de 061 estaban bien
-- (user_credentials y zoonivet_uso daban 403), pero quedaba viva alguna
-- política abierta (USING true, creada a mano o por un SQL viejo) o RLS
-- apagado en alguna tabla. En Postgres las políticas se suman con OR: con una
-- sola abierta, las cerradas no sirven de nada.
--
-- ESTA MIGRACIÓN:
--   1. Borra TODAS las políticas del esquema public.
--   2. Prende RLS en todas las tablas de public.
--   3. Vuelve a crear exactamente las políticas de 061 (+ la de 062).
--   4. Verifica: con la sesión de un usuario real, "User" devuelve 1 fila y
--      las otras tablas sensibles sólo filas propias. Si algo falla, ROLLBACK
--      automático y no cambia nada.
-- No toca Storage. Datos: desactiva 7 veterinarias de ejemplo, marca como
-- 'vencido' los paseos que ya no se pueden hacer y completa el historial de
-- peso. Requiere 060–065 aplicadas.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.usuario_actual()') IS NULL
     OR to_regprocedure('public.es_mi_mascota(integer)') IS NULL THEN
    RAISE EXCEPTION 'Faltan 060/061 (usuario_actual, es_mi_mascota). Pegá SUPABASE_PEGAR_TODO.sql entero.';
  END IF;
END $$;

-- ─── 1. Fuera TODAS las políticas de public ─────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─── 2. RLS prendido en todas las tablas ────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- anon (sin sesión) no escribe nada en ninguna tabla
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- ─── 3. Políticas de 061 (copiadas tal cual de SUPABASE_PEGAR_TODO.sql) ─────
-- ─── 3. Catálogos: lectura pública (también anon: el registro usa razas) ────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Clinica', 'Role', 'Vacuna', 'Veterinario', 'avatares_catalogo', 'consejos_catalogo',
    'tratamientos_catalogo', 'razas', 'emergency_lines', 'veterinary_clinics',
    'organizadores_verificados', 'eventos'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('CREATE POLICY catalogo_lectura ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- ─── 4. "User": sólo mi fila. Lo de los demás, por perfil_publico ───────────
CREATE POLICY user_mi_fila_ver ON "User" FOR SELECT TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY user_mi_fila_editar ON "User" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual())
  WITH CHECK ("Id_User" = usuario_actual());
-- Altas y bajas de cuentas: sólo por RPC (060). Tampoco se puede tocar el
-- vínculo con Auth, el id ni el mail (el mail lo administra Supabase Auth:
-- si cambiara sólo acá, el login dejaría de encontrar la cuenta).
-- Ojo: en Postgres revocar UNA columna no le gana a un permiso de tabla, por
-- eso se revoca UPDATE entero y se da columna por columna.
REVOKE INSERT, UPDATE, DELETE ON "User" FROM authenticated;
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User'
      AND column_name NOT IN ('Id_User', 'auth_id', 'Mail')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON "User" TO authenticated', c);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW perfil_publico AS
SELECT
  u."Id_User",
  u."Nombre",
  u."Apellido",
  u."NombreUsuario",
  u."FotoPerfil",
  u."Bio",
  u."Ubicacion",
  u."Ciudad",
  u."Provincia",
  u."Pais",
  u."Genero",
  u."Intereses",
  u."UltimaConexion",
  u."Estado",
  -- Edad en años en vez de la fecha exacta de nacimiento
  CASE WHEN u."FechaNacimiento" IS NOT NULL
       THEN date_part('year', age(u."FechaNacimiento"))::INTEGER END AS "Edad",
  -- ~1,1 km de precisión: alcanza para "a 3 km" y no ubica la casa
  round(u."Lat", 2) AS "Lat",
  round(u."Lng", 2) AS "Lng",
  CASE WHEN tengo_trato_con(u."Id_User") THEN u."Telefono" END AS "Telefono"
FROM "User" u
WHERE usuario_actual() IS NOT NULL;

REVOKE ALL ON perfil_publico FROM anon, public;
GRANT SELECT ON perfil_publico TO authenticated;

-- ─── 5. Mascotas ────────────────────────────────────────────────────────────
-- Las mascotas se ven entre usuarios (Match, Comunidad, perfiles). Escribir:
-- sólo las propias.
CREATE POLICY mascota_ver ON "Mascota" FOR SELECT TO authenticated USING (true);
CREATE POLICY mascota_alta ON "Mascota" FOR INSERT TO authenticated
  WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY mascota_editar ON "Mascota" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY mascota_borrar ON "Mascota" FOR DELETE TO authenticated
  USING ("Id_User" = usuario_actual());

CREATE POLICY mascota_fotos_ver ON mascota_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY mascota_fotos_escribir ON mascota_fotos FOR ALL TO authenticated
  USING (es_mi_mascota(id_mascota)) WITH CHECK (es_mi_mascota(id_mascota));

-- ─── 6. Datos de salud: SOLO el dueño de la mascota ─────────────────────────
DO $$
DECLARE par TEXT[];
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ARRAY['MascotaVacuna', 'Id_Mascota'],
    ARRAY['Tratamiento', 'Id_Mascota'],
    ARRAY['HistorialEvento', 'Id_Mascota'],
    ARRAY['historial_peso', 'mascota_id'],
    ARRAY['consultas_veterinarias', 'mascota_id'],
    ARRAY['eventos_calendario', 'mascota_id'],
    ARRAY['mascota_estado_historial', 'id_mascota']
  ] LOOP
    EXECUTE format(
      'CREATE POLICY salud_solo_dueno ON public.%I FOR ALL TO authenticated USING (es_mi_mascota(%I)) WITH CHECK (es_mi_mascota(%I))',
      par[1], par[2], par[2]);
  END LOOP;
END $$;

-- ─── 7. Tablas "mías" (una columna dice de quién es la fila) ────────────────
DO $$
DECLARE par TEXT[];
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ARRAY['emergency_contacts', 'user_id'],
    ARRAY['sos_events', 'user_id'],
    ARRAY['usuarios_bloqueados', 'usuario_id'],
    ARRAY['user_settings', 'user_id'],
    ARRAY['blocked_users', 'user_id'],
    ARRAY['muted_users', 'user_id'],
    ARRAY['user_sessions', 'user_id'],
    ARRAY['app_usage_daily', 'user_id'],
    ARRAY['deletion_requests', 'user_id'],
    ARRAY['data_export_requests', 'user_id'],
    ARRAY['subscriptions', 'user_id']
  ] LOOP
    IF to_regclass('public.' || quote_ident(par[1])) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY solo_mias ON public.%I FOR ALL TO authenticated USING (%I = usuario_actual()) WITH CHECK (%I = usuario_actual())',
        par[1], par[2], par[2]);
    END IF;
  END LOOP;
END $$;

-- Registros que se escriben pero no se releen desde la app
CREATE POLICY sos_llamadas_alta ON sos_call_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = usuario_actual());
CREATE POLICY sos_llamadas_ver ON sos_call_logs FOR SELECT TO authenticated
  USING (user_id = usuario_actual());
CREATE POLICY reportes_alta ON reportes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = usuario_actual());

-- ─── 8. Notificaciones ──────────────────────────────────────────────────────
-- Las crea quien genera el evento (el paseador avisa al dueño, etc.): se
-- puede insertar para otro, pero sólo el destinatario las lee y las marca.
CREATE POLICY notif_ver ON "Notificacion" FOR SELECT TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY notif_marcar ON "Notificacion" FOR UPDATE TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());
CREATE POLICY notif_borrar ON "Notificacion" FOR DELETE TO authenticated
  USING ("Id_User" = usuario_actual());
CREATE POLICY notif_crear ON "Notificacion" FOR INSERT TO authenticated
  WITH CHECK (usuario_actual() IS NOT NULL);

-- ─── 9. Social: publicaciones, comentarios, carteles, amistades, ubicación ──
CREATE POLICY publicacion_ver ON "Publicacion" FOR SELECT TO authenticated USING (true);
CREATE POLICY publicacion_mias ON "Publicacion" FOR ALL TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());

CREATE POLICY comentario_ver ON "Comentario" FOR SELECT TO authenticated USING (true);
CREATE POLICY comentario_mios ON "Comentario" FOR ALL TO authenticated
  USING ("Id_User" = usuario_actual()) WITH CHECK ("Id_User" = usuario_actual());

CREATE POLICY carteles_ver ON carteles FOR SELECT TO authenticated USING (true);
CREATE POLICY carteles_mios ON carteles FOR ALL TO authenticated
  USING (usuario_id = usuario_actual()) WITH CHECK (usuario_id = usuario_actual());

CREATE POLICY amistades_participantes ON amistades FOR SELECT TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id));
CREATE POLICY amistades_pedir ON amistades FOR INSERT TO authenticated
  WITH CHECK (usuario_a_id = usuario_actual() AND usuario_b_id <> usuario_actual());
CREATE POLICY amistades_responder ON amistades FOR UPDATE TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id))
  WITH CHECK (usuario_actual() IN (usuario_a_id, usuario_b_id));
CREATE POLICY amistades_borrar ON amistades FOR DELETE TO authenticated
  USING (usuario_actual() IN (usuario_a_id, usuario_b_id));

-- La ubicación exacta sólo la ven mis amigos, y sólo si elegí compartirla.
CREATE POLICY ubicacion_ver ON ubicaciones_usuarios FOR SELECT TO authenticated
  USING (usuario_id = usuario_actual() OR (compartir_ubicacion AND son_amigos(usuario_id)));
CREATE POLICY ubicacion_mia ON ubicaciones_usuarios FOR ALL TO authenticated
  USING (usuario_id = usuario_actual()) WITH CHECK (usuario_id = usuario_actual());

-- ─── 10. Match, votos y mensajes ────────────────────────────────────────────
CREATE POLICY voto_ver ON "Voto" FOR SELECT TO authenticated
  USING (es_mi_mascota("idMascotaOrigen") OR es_mi_mascota("idMascotaDestino"));
CREATE POLICY voto_mio ON "Voto" FOR INSERT TO authenticated
  WITH CHECK (es_mi_mascota("idMascotaOrigen"));
CREATE POLICY voto_borrar ON "Voto" FOR DELETE TO authenticated
  USING (es_mi_mascota("idMascotaOrigen"));

-- Los Match los crea SOLO la base (votar_mascota en 062), nunca el cliente.
CREATE POLICY match_ver ON "Match" FOR SELECT TO authenticated
  USING (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"));
CREATE POLICY match_desactivar ON "Match" FOR UPDATE TO authenticated
  USING (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"))
  WITH CHECK (usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"));
REVOKE INSERT, DELETE ON "Match" FROM authenticated;

-- Mensaje: chat de un Match, o chat cliente ↔ negocio (idServicio).
-- En el chat de negocio, "idUsuario" es SIEMPRE el cliente y deNegocio dice
-- quién escribió.
CREATE POLICY mensaje_ver ON "Mensaje" FOR SELECT TO authenticated USING (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch"))
  OR ("idServicio" IS NOT NULL AND ("idUsuario" = usuario_actual() OR soy_dueno_servicio("idServicio")))
);
CREATE POLICY mensaje_enviar ON "Mensaje" FOR INSERT TO authenticated WITH CHECK (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch") AND "idUsuario" = usuario_actual())
  OR ("idServicio" IS NOT NULL AND (
        ("idUsuario" = usuario_actual() AND NOT "deNegocio")
        OR ("deNegocio" AND soy_dueno_servicio("idServicio"))))
);
CREATE POLICY mensaje_marcar_leido ON "Mensaje" FOR UPDATE TO authenticated USING (
  ("idMatch" IS NOT NULL AND participo_en_match("idMatch"))
  OR ("idServicio" IS NOT NULL AND ("idUsuario" = usuario_actual() OR soy_dueno_servicio("idServicio")))
);

-- ─── 11. Paseos ─────────────────────────────────────────────────────────────
CREATE POLICY paseador_perfil_ver ON paseador_perfil FOR SELECT TO authenticated USING (true);
CREATE POLICY paseador_perfil_mio ON paseador_perfil FOR ALL TO authenticated
  USING (id_user = usuario_actual()) WITH CHECK (id_user = usuario_actual());

CREATE POLICY paseador_opiniones_ver ON paseador_opiniones FOR SELECT TO authenticated USING (true);
-- Nadie opina de sí mismo (066).
CREATE POLICY paseador_opiniones_mias ON paseador_opiniones FOR ALL TO authenticated
  USING (id_autor = usuario_actual())
  WITH CHECK (id_autor = usuario_actual() AND id_walker <> usuario_actual());

-- Un paseo lo ven el dueño y el paseador. Las solicitudes ABIERTAS (sin
-- paseador asignado) las ven los paseadores, para poder tomarlas.
CREATE POLICY paseo_ver ON "Paseo" FOR SELECT TO authenticated USING (
  usuario_actual() IN ("Id_Dueno", "Id_Walker")
  OR ("Id_Walker" IS NULL AND "Estado" = 'pendiente' AND soy_paseador())
);
CREATE POLICY paseo_pedir ON "Paseo" FOR INSERT TO authenticated
  WITH CHECK ("Id_Dueno" = usuario_actual() AND es_mi_mascota("Id_Mascota"));
-- Qué transición puede hacer cada uno lo controla el trigger de 062.
CREATE POLICY paseo_actualizar ON "Paseo" FOR UPDATE TO authenticated
  USING (usuario_actual() IN ("Id_Dueno", "Id_Walker"))
  WITH CHECK (usuario_actual() IN ("Id_Dueno", "Id_Walker"));
REVOKE DELETE ON "Paseo" FROM authenticated;

CREATE POLICY track_ver ON "PaseoTrack" FOR SELECT TO authenticated
  USING (participo_en_paseo("Id_Paseo"));
CREATE POLICY track_registrar ON "PaseoTrack" FOR INSERT TO authenticated
  WITH CHECK (soy_walker_de_paseo("Id_Paseo"));

CREATE POLICY paseo_mensajes_ver ON paseo_mensajes FOR SELECT TO authenticated
  USING (participo_en_paseo(id_paseo));
CREATE POLICY paseo_mensajes_enviar ON paseo_mensajes FOR INSERT TO authenticated
  WITH CHECK (id_user = usuario_actual() AND participo_en_paseo(id_paseo));
CREATE POLICY paseo_mensajes_leer ON paseo_mensajes FOR UPDATE TO authenticated
  USING (participo_en_paseo(id_paseo)) WITH CHECK (participo_en_paseo(id_paseo));

CREATE POLICY paseo_rechazos_mios ON paseo_rechazos FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

CREATE POLICY pagos_ver ON paseo_pagos FOR SELECT TO authenticated
  USING (usuario_actual() IN (id_walker, id_dueno));
CREATE POLICY pagos_registra_paseador ON paseo_pagos FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

CREATE POLICY cuenta_config_ver ON paseo_cuenta_config FOR SELECT TO authenticated
  USING (usuario_actual() IN (id_walker, id_dueno));
CREATE POLICY cuenta_config_paseador ON paseo_cuenta_config FOR ALL TO authenticated
  USING (id_walker = usuario_actual()) WITH CHECK (id_walker = usuario_actual());

-- ─── 12. Negocios ───────────────────────────────────────────────────────────
CREATE POLICY negocio_ver ON negocio_perfil FOR SELECT TO authenticated USING (true);
CREATE POLICY negocio_mio ON negocio_perfil FOR UPDATE TO authenticated
  USING (id_user = usuario_actual()) WITH CHECK (id_user = usuario_actual());

CREATE POLICY servicios_ver ON servicios FOR SELECT TO authenticated USING (true);
CREATE POLICY servicios_de_mi_negocio ON servicios FOR UPDATE TO authenticated
  USING (soy_dueno_negocio(id_negocio)) WITH CHECK (soy_dueno_negocio(id_negocio));

CREATE POLICY items_ver ON negocio_items FOR SELECT TO authenticated USING (true);
CREATE POLICY items_de_mi_negocio ON negocio_items FOR ALL TO authenticated
  USING (soy_dueno_negocio(id_negocio)) WITH CHECK (soy_dueno_negocio(id_negocio));

-- Turnos y pedidos: los ven el cliente y el negocio. Precio, total y stock los
-- calcula la base (triggers de 062): lo que mande el cliente se recalcula.
CREATE POLICY turnos_ver ON negocio_turnos FOR SELECT TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
CREATE POLICY turnos_pedir ON negocio_turnos FOR INSERT TO authenticated
  WITH CHECK (id_dueno = usuario_actual()
              AND (id_mascota IS NULL OR es_mi_mascota(id_mascota)));
CREATE POLICY turnos_actualizar ON negocio_turnos FOR UPDATE TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio))
  WITH CHECK (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));

CREATE POLICY pedidos_ver ON negocio_pedidos FOR SELECT TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
CREATE POLICY pedidos_hacer ON negocio_pedidos FOR INSERT TO authenticated
  WITH CHECK (id_dueno = usuario_actual());
CREATE POLICY pedidos_actualizar ON negocio_pedidos FOR UPDATE TO authenticated
  USING (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio))
  WITH CHECK (id_dueno = usuario_actual() OR soy_dueno_negocio(id_negocio));
REVOKE DELETE ON negocio_turnos, negocio_pedidos FROM authenticated;

-- ─── 13. Roles ──────────────────────────────────────────────────────────────
-- Se pueden leer (la app decide a qué pantalla ir), nunca escribir desde el
-- cliente: los asignan las RPC de alta.
CREATE POLICY roles_ver ON "UserRole" FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON "UserRole" FROM authenticated;

-- De 062: el catálogo de transiciones de paseo
CREATE POLICY catalogo_lectura ON paseo_transiciones FOR SELECT TO authenticated USING (true);

-- ─── 066 · Datos inventados fuera de la pantalla de emergencias ─────────────
-- Las 7 veterinarias de ejemplo (teléfonos, ratings y horarios inventados)
-- dejan de mostrarse. Alguien con una urgencia real podía llamar a un número
-- falso. Las reales se cargan con datos verificados.
UPDATE veterinary_clinics SET is_active = FALSE
WHERE is_active AND (name, phone) IN (
  ('Clínica Veterinaria del Centro', '011-4901-2233'),
  ('Veterinaria San Roque 24 hs',    '011-4902-8800'),
  ('Hospital Veterinario Belgrano',  '011-4788-1144'),
  ('Veterinaria Patitas',            '011-4632-5511'),
  ('Centro Veterinario Flores',      '011-4611-7788'),
  ('Clínica Felina Miau',            '011-4855-9090'),
  ('Veterinaria Zooni a Domicilio',  '011-15-6044-2211'));

-- ─── 066 · Paseos: nuevo estado 'vencido' ───────────────────────────────────
-- Un paseo que nadie hizo a tiempo quedaba "Esperando respuesta" (o con
-- "Iniciar paseo") para siempre. Misma regla que estadoVigente() en
-- zooni-app/src/domain/paseos.js:
--   · pendiente: vence 1 hora después de la hora pedida
--   · aceptado:  vence 2 horas después de la hora en que debía terminar
ALTER TABLE "Paseo" DROP CONSTRAINT IF EXISTS paseo_estado_check;
ALTER TABLE "Paseo" ADD CONSTRAINT paseo_estado_check CHECK (
  "Estado" IN ('pendiente','aceptado','en_curso','finalizado','rechazado','cancelado','vencido')
) NOT VALID;

CREATE OR REPLACE FUNCTION paseo_esta_vencido(p_estado TEXT, p_fecha TIMESTAMPTZ, p_duracion INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_fecha IS NULL THEN FALSE
    WHEN p_estado = 'pendiente' THEN p_fecha + interval '1 hour' < now()
    WHEN p_estado = 'aceptado'  THEN p_fecha + make_interval(mins => coalesce(p_duracion, 30)) + interval '2 hours' < now()
    ELSE FALSE
  END
$$;

-- Marca como 'vencido' lo que ya no se puede cumplir. La llama la app al
-- cargar paseos (cualquiera con sesión: sólo toca filas vencidas) y pg_cron
-- cada 15 minutos si está instalado. Devuelve cuántos venció.
CREATE OR REPLACE FUNCTION vencer_paseos()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n INTEGER;
  v_claims TEXT := current_setting('request.jwt.claims', true);
  v_sub TEXT := current_setting('request.jwt.claim.sub', true);
BEGIN
  -- Es la base la que vence el paseo, no el que llamó: sin JWT, el trigger de
  -- 062 no aplica reglas de rol (las transiciones del dueño/paseador).
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  UPDATE "Paseo" SET "Estado" = 'vencido'
  WHERE "Estado" IN ('pendiente', 'aceptado')
    AND paseo_esta_vencido("Estado", "FechaProgramada", "DuracionMin");
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION vencer_paseos() FROM public, anon;
GRANT EXECUTE ON FUNCTION vencer_paseos() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'zooni_vencer_paseos';
    PERFORM cron.schedule('zooni_vencer_paseos', '*/15 * * * *', 'SELECT public.vencer_paseos()');
  END IF;
END $$;

-- Al pedir un paseo: no en el pasado, con dirección, y la misma mascota no
-- puede tener dos paseos que se pisen (pasaba: dos a las 12:00 del 2/11).
CREATE OR REPLACE FUNCTION _paseo_validar_alta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF usuario_actual() IS NULL THEN RETURN NEW; END IF; -- mantenimiento desde el SQL Editor
  IF NEW."FechaProgramada" IS NULL OR NEW."FechaProgramada" < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'fecha_pasada';
  END IF;
  IF NEW."Direccion" IS NULL OR length(btrim(NEW."Direccion")) < 5
     OR NEW."Direccion" !~* '[a-záéíóúñ]{3}' THEN
    RAISE EXCEPTION 'direccion_invalida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Paseo" p
    WHERE p."Id_Mascota" = NEW."Id_Mascota"
      AND p."Estado" IN ('pendiente', 'aceptado', 'en_curso')
      AND NOT paseo_esta_vencido(p."Estado", p."FechaProgramada", p."DuracionMin")
      AND tstzrange(p."FechaProgramada", p."FechaProgramada" + make_interval(mins => coalesce(p."DuracionMin", 30)))
       && tstzrange(NEW."FechaProgramada", NEW."FechaProgramada" + make_interval(mins => coalesce(NEW."DuracionMin", 30)))
  ) THEN
    RAISE EXCEPTION 'paseo_superpuesto';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseo_validar_alta ON "Paseo";
CREATE TRIGGER trg_paseo_validar_alta BEFORE INSERT ON "Paseo"
  FOR EACH ROW EXECUTE FUNCTION _paseo_validar_alta();

-- Un paseo vencido no se acepta ni se inicia (aunque la app vieja lo ofrezca).
CREATE OR REPLACE FUNCTION _paseo_validar_cambio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF usuario_actual() IS NOT NULL
     AND NEW."Estado" IN ('aceptado', 'en_curso') AND NEW."Estado" IS DISTINCT FROM OLD."Estado"
     AND paseo_esta_vencido(OLD."Estado", OLD."FechaProgramada", OLD."DuracionMin") THEN
    RAISE EXCEPTION 'paseo_vencido';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paseo_validar_cambio ON "Paseo";
CREATE TRIGGER trg_paseo_validar_cambio BEFORE UPDATE ON "Paseo"
  FOR EACH ROW EXECUTE FUNCTION _paseo_validar_cambio();

-- Los que ya estaban vencidos, al toque
SELECT vencer_paseos();

-- ─── 066 · Historial de peso: lo registra la base ──────────────────────────
-- Antes lo insertaba la app aparte, sólo desde Ficha Médica y tragándose el
-- error: el peso de "volcho" era 12 kg y el historial sólo tenía "1 kg".
-- Ahora todo cambio de "Mascota"."Peso" (de cualquier pantalla) deja su punto.
CREATE OR REPLACE FUNCTION _mascota_registrar_peso()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."Peso" IS NOT NULL AND NEW."Peso" > 0
     AND (TG_OP = 'INSERT' OR NEW."Peso" IS DISTINCT FROM OLD."Peso") THEN
    INSERT INTO historial_peso (mascota_id, peso_kg) VALUES (NEW."Id_Mascota", NEW."Peso");
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mascota_registrar_peso ON "Mascota";
CREATE TRIGGER trg_mascota_registrar_peso AFTER INSERT OR UPDATE OF "Peso" ON "Mascota"
  FOR EACH ROW EXECUTE FUNCTION _mascota_registrar_peso();

-- Mascotas cuyo último punto no es el peso actual: se agrega el actual
INSERT INTO historial_peso (mascota_id, peso_kg)
SELECT m."Id_Mascota", m."Peso" FROM "Mascota" m
WHERE m."Peso" IS NOT NULL AND m."Peso" > 0
  AND m."Peso" IS DISTINCT FROM (
    SELECT h.peso_kg FROM historial_peso h WHERE h.mascota_id = m."Id_Mascota"
    ORDER BY h.fecha DESC, h.id DESC LIMIT 1);

-- ─── 4. Verificación (si falla, se deshace TODO) ────────────────────────────
DO $$
DECLARE
  sensibles TEXT[] := ARRAY['User', 'Notificacion', 'Mensaje', 'Paseo', 'Voto', 'Match',
    'MascotaVacuna', 'Tratamiento', 'HistorialEvento', 'historial_peso',
    'consultas_veterinarias', 'eventos_calendario', 'paseo_mensajes', 'PaseoTrack',
    'paseo_pagos', 'negocio_turnos', 'negocio_pedidos', 'ubicaciones_usuarios', 'amistades'];
  t TEXT; abierta TEXT; sub UUID; yo INTEGER; n INTEGER; ajenas INTEGER;
BEGIN
  -- a) RLS prendido en todas
  SELECT string_agg(c.relname, ', ') INTO abierta
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  ASSERT abierta IS NULL, 'Tablas sin RLS: ' || abierta;

  -- b) Ninguna tabla sensible tiene una política "USING (true)"
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO abierta
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = ANY (sensibles)
    AND (qual IS NULL OR qual = 'true') AND cmd IN ('SELECT', 'ALL', 'UPDATE', 'DELETE');
  ASSERT abierta IS NULL, 'Políticas abiertas en tablas sensibles: ' || abierta;

  -- c) Con la sesión de un usuario real: sólo lo suyo
  SELECT auth_id, "Id_User" INTO sub, yo FROM "User" WHERE auth_id IS NOT NULL ORDER BY "Id_User" LIMIT 1;
  IF sub IS NULL THEN
    RAISE NOTICE 'No hay usuarios con auth_id todavía: se saltea la prueba con sesión.';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::TEXT, TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO n FROM "User";
  ASSERT n = 1, format('"User" devuelve %s filas con una sesión (tiene que ser 1)', n);
  SELECT count(*) INTO ajenas FROM "Notificacion" WHERE "Id_User" <> yo;
  ASSERT ajenas = 0, 'Se ven notificaciones ajenas';
  SELECT count(*) INTO ajenas FROM "Paseo"
  WHERE yo NOT IN ("Id_Dueno", coalesce("Id_Walker", -1))
    AND NOT ("Id_Walker" IS NULL AND "Estado" = 'pendiente');
  ASSERT ajenas = 0, 'Se ven paseos ajenos';
  SELECT count(*) INTO ajenas FROM "Mensaje" m
  WHERE NOT (("idMatch" IS NOT NULL AND EXISTS (SELECT 1 FROM "Match" x WHERE x.id = m."idMatch"
                AND yo IN (x."idUsuarioUno", x."idUsuarioDos")))
          OR "idServicio" IS NOT NULL);
  ASSERT ajenas = 0, 'Se ven mensajes ajenos';
  SELECT count(*) INTO ajenas FROM "MascotaVacuna" v
  WHERE NOT EXISTS (SELECT 1 FROM "Mascota" m WHERE m."Id_Mascota" = v."Id_Mascota" AND m."Id_User" = yo);
  ASSERT ajenas = 0, 'Se ven vacunas de mascotas ajenas';

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', NULL, TRUE);
  RAISE NOTICE '066 OK: probado con la sesión del usuario %', yo;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Resultado: cuántas políticas quedó cada tabla sensible (todas > 0, ninguna "true").
SELECT tablename, count(*) AS politicas,
       bool_or(qual = 'true') AS alguna_abierta
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Notificacion', 'Mensaje', 'Paseo', 'MascotaVacuna', 'Match', 'Voto')
GROUP BY tablename ORDER BY tablename;
