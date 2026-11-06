-- =============================================================================
-- 061_rls_por_usuario.sql — Row Level Security de verdad. Idempotente.
-- Requiere 060 (usuario_actual()).
-- =============================================================================
-- ANTES: RLS estaba "activado" pero las políticas (zooni_app_acceso) decían
-- USING true / WITH CHECK true para anon y authenticated. O sea: cualquiera
-- que copiara la URL y la clave pública del bundle web podía leer y escribir
-- todo — fichas médicas, ubicaciones, chats, contraseñas viejas incluidas.
--
-- AHORA, el principio es mínimo privilegio:
--   · anon (sin sesión) sólo lee catálogos (razas, vacunas, líneas de
--     emergencia…). Todo lo demás pide un JWT de Supabase Auth.
--   · Cada fila se decide con usuario_actual(), que sale del JWT firmado.
--     Ningún dato que mande el cliente ("soy el 7") cuenta como identidad.
--   · Datos de salud (vacunas, tratamientos, consultas, peso, eventos): sólo
--     el dueño de la mascota.
--   · "User": cada uno ve SU fila completa. De los demás sólo se ve la vista
--     perfil_publico (sin mail, sin fecha de nacimiento exacta, ubicación
--     redondeada a ~1 km y teléfono sólo si hay un paseo/turno/pedido en común).
--
-- Cómo leer una política:   USING  = qué filas puedo VER / tocar
--                           WITH CHECK = qué filas puedo DEJAR escritas
-- Si para una operación no hay política, está prohibida.
-- =============================================================================

-- ─── 0. Helpers (SECURITY DEFINER: no disparan RLS dentro de RLS) ───────────

CREATE OR REPLACE FUNCTION es_mi_mascota(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = p_id AND "Id_User" = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_dueno_negocio(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM negocio_perfil WHERE id = p_id AND id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_dueno_servicio(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM servicios s JOIN negocio_perfil n ON n.id = s.id_negocio
    WHERE s.id = p_id AND n.id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION participo_en_match(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Match" WHERE id = p_id
      AND usuario_actual() IN ("idUsuarioUno", "idUsuarioDos"))
$$;

CREATE OR REPLACE FUNCTION participo_en_paseo(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = p_id
      AND usuario_actual() IN ("Id_Dueno", "Id_Walker"))
$$;

CREATE OR REPLACE FUNCTION soy_walker_de_paseo(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = p_id AND "Id_Walker" = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION soy_paseador()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = usuario_actual())
$$;

CREATE OR REPLACE FUNCTION son_amigos(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM amistades WHERE estado = 'aceptada' AND (
      (usuario_a_id = usuario_actual() AND usuario_b_id = p_otro) OR
      (usuario_b_id = usuario_actual() AND usuario_a_id = p_otro)))
$$;

-- ¿Tengo un trato concreto con esta persona? (paseo, turno o pedido en común)
-- Es lo que habilita ver su teléfono.
CREATE OR REPLACE FUNCTION tengo_trato_con(p_otro INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_otro = usuario_actual()
    OR EXISTS (SELECT 1 FROM "Paseo" WHERE
         ("Id_Dueno" = usuario_actual() AND "Id_Walker" = p_otro) OR
         ("Id_Walker" = usuario_actual() AND "Id_Dueno" = p_otro))
    OR EXISTS (SELECT 1 FROM negocio_turnos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         (t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
         (n.id_user = usuario_actual() AND t.id_dueno = p_otro))
    OR EXISTS (SELECT 1 FROM negocio_pedidos t JOIN negocio_perfil n ON n.id = t.id_negocio WHERE
         (t.id_dueno = usuario_actual() AND n.id_user = p_otro) OR
         (n.id_user = usuario_actual() AND t.id_dueno = p_otro))
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'es_mi_mascota(integer)', 'soy_dueno_negocio(integer)', 'soy_dueno_servicio(integer)',
    'participo_en_match(integer)', 'participo_en_paseo(integer)', 'soy_walker_de_paseo(integer)',
    'soy_paseador()', 'son_amigos(integer)', 'tengo_trato_con(integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─── 1. Borrar TODAS las políticas viejas y empezar de cero ─────────────────
-- (zooni_app_acceso, zooni_catalogo_lectura, zooni_alta_*, y las que se hayan
-- creado a mano en el dashboard). Lo que no esté escrito acá, no existe.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─── 2. RLS prendido en todas las tablas, permisos base ─────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    -- authenticated tiene permiso de tabla; QUÉ filas, lo deciden las políticas.
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Tablas internas: nadie desde el cliente (sólo funciones SECURITY DEFINER).
REVOKE ALL ON user_credentials, "__MigrationLog", zooni_politica_tablas FROM authenticated;

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
CREATE POLICY paseador_opiniones_mias ON paseador_opiniones FOR ALL TO authenticated
  USING (id_autor = usuario_actual()) WITH CHECK (id_autor = usuario_actual());

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

-- ─── 14. Las RPC viejas de contraseña quedan sólo para el servidor ──────────
-- login_user / registrar_* con p_hash comparaban un SHA-256 sin sal que
-- mandaba el cliente. Con Supabase Auth ya no hacen falta; se dejan de
-- exponer (la Edge Function migrar-cuenta no las usa).
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
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      NULL; -- esa versión de la función no existe en esta base
    END;
  END LOOP;
END $$;

-- Documentación viva de qué es cada tabla (la consulta el README)
INSERT INTO zooni_politica_tablas (tabla, categoria, motivo) VALUES
  ('razas', 'catalogo', 'Lectura pública: lo usa el registro antes de tener sesión'),
  ('User', 'privada', 'Sólo la fila propia; lo de otros, por la vista perfil_publico'),
  ('Mascota', 'social', 'Se ven entre usuarios; sólo el dueño escribe'),
  ('MascotaVacuna', 'salud', 'Sólo el dueño de la mascota'),
  ('consultas_veterinarias', 'salud', 'Sólo el dueño de la mascota'),
  ('Paseo', 'compartida', 'Dueño y paseador; transiciones validadas por trigger'),
  ('negocio_pedidos', 'compartida', 'Cliente y negocio; total y stock los calcula la base'),
  ('user_credentials', 'interna', 'Hashes viejos; se vacía a medida que se migra a Supabase Auth')
ON CONFLICT (tabla) DO UPDATE SET categoria = EXCLUDED.categoria, motivo = EXCLUDED.motivo;

NOTIFY pgrst, 'reload schema';

-- ─── 15. Contexto médico de ZooniVet: sólo para la Edge Function ────────────
-- get_pet_chat_context (051) es SECURITY DEFINER y recibe un petId: si la
-- pudiera llamar cualquiera, cualquiera leería el contexto médico de cualquier
-- mascota. La usa únicamente zoonivet-chat (con service_role), DESPUÉS de
-- comprobar con el JWT que la mascota es de quien pregunta.
REVOKE ALL ON FUNCTION get_pet_chat_context(BIGINT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pet_chat_context(BIGINT) TO service_role;

NOTIFY pgrst, 'reload schema';
