BEGIN;

DO $guarda$
BEGIN
  IF to_regprocedure('public.marcar_mascota_principal(integer)') IS NULL THEN
    RAISE EXCEPTION 'Falta la 071: pegá primero MIGRACION_071_INTEGRIDAD.sql';
  END IF;
END $guarda$;

DO $search_path$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.firma);
  END LOOP;
END $search_path$;

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solo_mias ON deletion_requests;
DROP POLICY IF EXISTS baja_ver ON deletion_requests;
CREATE POLICY baja_ver ON deletion_requests FOR SELECT TO authenticated
  USING (user_id = usuario_actual());
REVOKE INSERT, UPDATE, DELETE ON deletion_requests FROM anon, authenticated;
REVOKE ALL ON SEQUENCE deletion_requests_id_seq FROM anon, authenticated;

UPDATE deletion_requests d SET cancelled_at = now()
WHERE d.cancelled_at IS NULL AND d.completed_at IS NULL
  AND EXISTS (SELECT 1 FROM deletion_requests o
              WHERE o.user_id = d.user_id AND o.id > d.id
                AND o.cancelled_at IS NULL AND o.completed_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_requests_una_viva
  ON deletion_requests (user_id) WHERE cancelled_at IS NULL AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION cuenta_dada_de_baja(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM deletion_requests
                 WHERE user_id = p_id AND cancelled_at IS NULL);
$$;
REVOKE ALL ON FUNCTION cuenta_dada_de_baja(INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION cuenta_dada_de_baja(INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION solicitar_eliminacion_cuenta(p_motivo TEXT DEFAULT NULL, p_motivo_texto TEXT DEFAULT NULL)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo INTEGER := usuario_actual();
  v_fecha TIMESTAMPTZ;
BEGIN
  IF v_yo IS NULL THEN RAISE EXCEPTION 'sin_sesion'; END IF;

  SELECT scheduled_for INTO v_fecha FROM deletion_requests
  WHERE user_id = v_yo AND cancelled_at IS NULL AND completed_at IS NULL;
  IF FOUND THEN RETURN v_fecha; END IF;

  INSERT INTO deletion_requests (user_id, reason, reason_text, requested_at, scheduled_for)
  VALUES (v_yo,
          CASE WHEN p_motivo IN ('no_uso', 'otra_app', 'privacidad', 'otro') THEN p_motivo END,
          NULLIF(left(trim(coalesce(p_motivo_texto, '')), 500), ''),
          now(), now() + interval '30 days')
  RETURNING scheduled_for INTO v_fecha;
  RETURN v_fecha;
END $$;
REVOKE ALL ON FUNCTION solicitar_eliminacion_cuenta(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION solicitar_eliminacion_cuenta(TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION _cancelar_eliminacion_cuenta(p_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE deletion_requests SET cancelled_at = now()
  WHERE user_id = p_id AND cancelled_at IS NULL AND completed_at IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION _cancelar_eliminacion_cuenta(INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION _cancelar_eliminacion_cuenta(INTEGER) TO service_role;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "DebeCambiarContrasena" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION login_social()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_meta JSONB;
  v_user RECORD;
  v_completo TEXT;
  v_cancelada BOOLEAN;
BEGIN
  SELECT * INTO v_user FROM "User" WHERE lower("Mail") = v_mail;
  IF FOUND THEN
    IF v_user.auth_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM user_credentials WHERE id_user = v_user."Id_User")
         AND NOT EXISTS (SELECT 1 FROM auth.identities
                         WHERE user_id = auth.uid() AND provider <> 'email') THEN
        RAISE EXCEPTION 'cuenta_sin_migrar';
      END IF;
      UPDATE "User" SET auth_id = auth.uid() WHERE "Id_User" = v_user."Id_User";
    ELSIF v_user.auth_id <> auth.uid() THEN
      RAISE EXCEPTION 'cuenta_vinculada_a_otra_sesion';
    END IF;
    v_cancelada := _cancelar_eliminacion_cuenta(v_user."Id_User");
    RETURN jsonb_build_object(
      'nuevo',         FALSE,
      'id',            v_user."Id_User",
      'nombre',        v_user."Nombre",
      'apellido',      v_user."Apellido",
      'email',         v_user."Mail",
      'fotoPerfil',    v_user."FotoPerfil",
      'bajaCancelada', v_cancelada,
      'debeCambiarContrasena', v_user."DebeCambiarContrasena"
    );
  END IF;

  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = auth.uid();
  v_completo := trim(COALESCE(v_meta->>'full_name', v_meta->>'name', ''));
  RETURN jsonb_build_object(
    'nuevo',    TRUE,
    'email',    v_mail,
    'nombre',   COALESCE(NULLIF(v_meta->>'given_name', ''), NULLIF(split_part(v_completo, ' ', 1), '')),
    'apellido', COALESCE(NULLIF(v_meta->>'family_name', ''), NULLIF(regexp_replace(v_completo, '^\S+\s*', ''), '')),
    'foto',     COALESCE(v_meta->>'avatar_url', v_meta->>'picture')
  );
END $$;
REVOKE ALL ON FUNCTION login_social() FROM anon, public;
GRANT EXECUTE ON FUNCTION login_social() TO authenticated;

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
WHERE usuario_actual() IS NOT NULL AND NOT esta_bloqueado(u."Id_User")
  AND NOT cuenta_dada_de_baja(u."Id_User");
REVOKE ALL ON perfil_publico FROM anon, public;
GRANT SELECT ON perfil_publico TO authenticated;

CREATE OR REPLACE VIEW mascota_publica AS
SELECT
  m."Id_Mascota", m."Id_User", m."Nombre", m."Especie", m."Raza", m."Foto",
  m."ImagenAsset", m."Sexo", m."Tamano", m."Castrado", m."Descripcion",
  m."VisibleEnMatch", m."MostrarFoto", m."EsActiva",
  CASE WHEN m."FechaNacimiento" IS NOT NULL
       THEN date_part('year', age(m."FechaNacimiento"))::INTEGER END AS "EdadAnios"
FROM "Mascota" m
WHERE m."Estado" = 'active' AND NOT esta_bloqueado(m."Id_User")
  AND NOT cuenta_dada_de_baja(m."Id_User");
REVOKE ALL ON mascota_publica FROM anon, public;
GRANT SELECT ON mascota_publica TO authenticated;

CREATE OR REPLACE FUNCTION purgar_cuentas_eliminadas()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  r RECORD;
  v_auth UUID;
  v_hechas INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, user_id::INTEGER AS u FROM deletion_requests
    WHERE cancelled_at IS NULL AND completed_at IS NULL AND scheduled_for < now()
    ORDER BY scheduled_for
  LOOP
    BEGIN
      SELECT auth_id INTO v_auth FROM "User" WHERE "Id_User" = r.u;

      IF v_auth IS NOT NULL THEN
        PERFORM _anotar_archivo(o.bucket_id, o.name, 'cuenta eliminada')
        FROM storage.objects o WHERE o.name LIKE v_auth::TEXT || '/%';
      END IF;

      DELETE FROM "Comentario" WHERE "Id_User" = r.u
         OR "Id_Publicacion" IN (SELECT "Id_Publicacion" FROM "Publicacion" WHERE "Id_User" = r.u);
      DELETE FROM "Publicacion" WHERE "Id_User" = r.u;
      DELETE FROM "Match" WHERE r.u IN ("idUsuarioUno", "idUsuarioDos");
      DELETE FROM "Mascota" WHERE "Id_User" = r.u;
      DELETE FROM amistades WHERE r.u IN (usuario_a_id, usuario_b_id);
      DELETE FROM usuarios_bloqueados WHERE r.u IN (usuario_id, bloqueado_id);
      DELETE FROM carteles WHERE usuario_id = r.u;
      DELETE FROM "Notificacion" WHERE "Id_User" = r.u;
      DELETE FROM ubicaciones_usuarios WHERE usuario_id = r.u;
      DELETE FROM emergency_contacts WHERE user_id = r.u;
      DELETE FROM sos_call_logs WHERE user_id = r.u;
      DELETE FROM sos_events WHERE user_id = r.u;
      DELETE FROM paseador_perfil WHERE id_user = r.u;
      DELETE FROM "UserRole" WHERE "Id_User" = r.u;
      DELETE FROM user_credentials WHERE id_user = r.u;
      DELETE FROM zoonivet_uso WHERE id_user = r.u;
      DELETE FROM user_settings WHERE user_id = r.u;
      DELETE FROM user_sessions WHERE user_id = r.u;
      DELETE FROM app_usage_daily WHERE user_id = r.u;
      DELETE FROM data_export_requests WHERE user_id = r.u;
      DELETE FROM blocked_users WHERE user_id = r.u;
      DELETE FROM muted_users WHERE user_id = r.u;
      UPDATE negocio_perfil SET abierto = FALSE, telefono = NULL, logo = NULL WHERE id_user = r.u;

      UPDATE "User" SET
        "Nombre" = 'Cuenta', "Apellido" = 'eliminada',
        "Mail" = format('eliminada-%s@zooni.invalid', r.u),
        "NombreUsuario" = NULL, "FotoPerfil" = NULL, "Bio" = NULL,
        "Telefono" = NULL, "CodigoTelefono" = NULL, "Ubicacion" = NULL,
        "Ciudad" = NULL, "Provincia" = NULL, "Pais" = NULL, "PaisCodigo" = NULL,
        "Lat" = NULL, "Lng" = NULL, "Genero" = NULL, "FechaNacimiento" = NULL,
        "Intereses" = NULL, auth_id = NULL
      WHERE "Id_User" = r.u;

      IF v_auth IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = v_auth;
      END IF;

      UPDATE deletion_requests SET completed_at = now() WHERE id = r.id;
      v_hechas := v_hechas + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo purgar la cuenta % (pedido %): % — queda para la próxima vuelta.',
        r.u, r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_hechas;
END $$;
REVOKE ALL ON FUNCTION purgar_cuentas_eliminadas() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION purgar_cuentas_eliminadas() TO service_role;

CREATE OR REPLACE FUNCTION _purgar_datos_antiguos()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM "PaseoTrack" WHERE "Timestamp" < now() - interval '1 year';
  DELETE FROM sos_call_logs WHERE created_at < now() - interval '2 years';
  PERFORM purgar_mascotas_eliminadas();
  PERFORM purgar_cuentas_eliminadas();
END $$;
REVOKE ALL ON FUNCTION _purgar_datos_antiguos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION _purgar_datos_antiguos() TO service_role;

CREATE OR REPLACE FUNCTION migrar_cuenta_legada(p_mail TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_mail TEXT := lower(trim(coalesce(p_mail, '')));
  v_id_user INTEGER;
  v_hash TEXT;
  v_auth_id UUID;
  v_nuevo UUID := gen_random_uuid();
  v_ahora TIMESTAMPTZ := now();
  v_fallos INTEGER;
BEGIN
  IF position('@' IN v_mail) = 0 OR length(coalesce(p_password, '')) NOT BETWEEN 1 AND 200 THEN
    RETURN FALSE;
  END IF;

  SELECT CASE WHEN ultimo > v_ahora - interval '15 minutes' THEN fallos ELSE 0 END
  INTO v_fallos FROM migracion_intentos WHERE mail = v_mail;
  IF coalesce(v_fallos, 0) >= 5 THEN RETURN FALSE; END IF;

  SELECT u."Id_User", c.hash, u.auth_id INTO v_id_user, v_hash, v_auth_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(trim(u."Mail")) = v_mail
  LIMIT 1;

  IF v_id_user IS NULL OR v_auth_id IS NOT NULL
     OR lower(v_hash) <> encode(digest(p_password, 'sha256'), 'hex') THEN
    INSERT INTO migracion_intentos (mail, fallos, ultimo) VALUES (v_mail, 1, v_ahora)
    ON CONFLICT (mail) DO UPDATE SET
      fallos = CASE WHEN migracion_intentos.ultimo > v_ahora - interval '15 minutes'
                    THEN migracion_intentos.fallos + 1 ELSE 1 END,
      ultimo = v_ahora;
    RETURN FALSE;
  END IF;

  DELETE FROM auth.users a
  WHERE lower(a.email) = v_mail
    AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.auth_id = a.id);

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_nuevo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_mail, crypt(p_password, gen_salt('bf')),
    v_ahora, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    v_ahora, v_ahora,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_nuevo, v_nuevo::TEXT, 'email',
    jsonb_build_object('sub', v_nuevo::TEXT, 'email', v_mail, 'email_verified', TRUE),
    v_ahora, v_ahora, v_ahora
  );

  UPDATE "User" SET auth_id = v_nuevo, "DebeCambiarContrasena" = (length(p_password) < 8)
  WHERE "Id_User" = v_id_user;
  DELETE FROM user_credentials WHERE id_user = v_id_user;
  DELETE FROM migracion_intentos WHERE mail = v_mail;
  RETURN TRUE;
END $$;

REVOKE ALL ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW mascota_de_cliente AS
SELECT m."Id_Mascota", m."Peso", m."FechaNacimiento"
FROM "Mascota" m
WHERE usuario_actual() IS NOT NULL
  AND m."Estado" = 'active'
  AND NOT esta_bloqueado(m."Id_User")
  AND NOT cuenta_dada_de_baja(m."Id_User")
  AND (EXISTS (SELECT 1 FROM "Paseo" p
               WHERE p."Id_Mascota" = m."Id_Mascota" AND p."Id_Walker" = usuario_actual()
                 AND p."Estado" IN ('aceptado', 'en_curso'))
       OR EXISTS (SELECT 1 FROM negocio_turnos t JOIN negocio_perfil n ON n.id = t.id_negocio
                  WHERE t.id_mascota = m."Id_Mascota" AND n.id_user = usuario_actual()
                    AND t.estado IN ('pendiente', 'confirmado', 'completado')));
REVOKE ALL ON mascota_de_cliente FROM anon, public;
GRANT SELECT ON mascota_de_cliente TO authenticated;

DO $verificacion$
BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')),
    'quedó una función de public sin search_path (#100)';
  ASSERT to_regclass('public.mascota_de_cliente') IS NOT NULL, 'falta la vista mascota_de_cliente';
  ASSERT has_function_privilege('authenticated', 'solicitar_eliminacion_cuenta(text, text)', 'EXECUTE'),
    'la app tiene que poder pedir la baja (#22)';
  ASSERT NOT has_function_privilege('authenticated', 'purgar_cuentas_eliminadas()', 'EXECUTE'),
    'la purga de cuentas no puede quedar abierta a la app';
  ASSERT NOT has_table_privilege('authenticated', 'deletion_requests', 'INSERT'),
    'deletion_requests no puede ser escribible desde la app (se saltearían los 30 días)';
  ASSERT has_function_privilege('anon', 'migrar_cuenta_legada(text, text)', 'EXECUTE'),
    'el login de cuentas viejas (065) tiene que seguir andando';
  RAISE NOTICE '072 OK';
END $verificacion$;

NOTIFY pgrst, 'reload schema';

COMMIT;
