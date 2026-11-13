-- =============================================================================
-- MIGRACION_065_LOGIN_CUENTAS_VIEJAS.sql — Arregla el login de cuentas viejas.
-- Pegar ENTERO en Supabase → SQL Editor → Run. Idempotente. Una transacción.
-- No borra datos de usuarios.
--
-- Síntoma que arregla: al entrar con una cuenta vieja, la consola muestra
--   CORS ... functions/v1/migrar-cuenta ... preflight ... not HTTP ok
--   rpc/login_user 401
-- porque la Edge Function migrar-cuenta no está desplegada. Con esto la
-- migración de la cuenta la hace la base y no hace falta desplegar nada.
-- Requiere la app con el commit que llama a rpc('migrar_cuenta_legada').
-- =============================================================================

BEGIN;

DO $requisitos$
BEGIN
  IF to_regprocedure('public.usuario_actual()') IS NULL OR to_regclass('public.user_credentials') IS NULL THEN
    RAISE EXCEPTION 'Falta 060 (Auth): corré SUPABASE_PEGAR_TODO.sql completo en vez de este archivo';
  END IF;
END
$requisitos$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> 065_migrar_cuenta_sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- =============================================================================
-- 065 — Migrar cuentas viejas a Supabase Auth DESDE LA BASE, sin Edge Function.
-- Idempotente. Requiere 060.
-- =============================================================================
-- ANTES: la primera vez que una cuenta vieja entraba, la app llamaba a la Edge
-- Function migrar-cuenta. Si la función no estaba desplegada (o se desplegó
-- sin --no-verify-jwt), el navegador cortaba con CORS y NADIE con cuenta
-- vieja podía entrar.
--
-- AHORA la misma lógica vive en migrar_cuenta_legada(mail, contraseña), una
-- función de Postgres que la app llama con la clave pública (rpc):
--   1. Busca la cuenta vieja por mail (user_credentials). Si no hay, o ya
--      está migrada → FALSE.
--   2. Compara sha256(contraseña) con el hash viejo. Si no coincide → FALSE.
--      (Mismo FALSE en los dos casos: no revela si el mail existe.)
--   3. Si ya había un usuario de Auth con ese mail SIN vincular (alguien hizo
--      signUp con un mail ajeno), lo borra: sus sesiones dejan de servir.
--   4. Crea el usuario de Auth con ESA contraseña (bcrypt, como Supabase) y
--      su identidad 'email', ya confirmado.
--   5. Vincula "User".auth_id y BORRA el hash viejo.
-- Después la app hace signInWithPassword normal.
--
-- La Edge Function migrar-cuenta sigue en el repo y la app la usa sólo si esta
-- función no existe (base sin 065). Ya no hace falta desplegarla.
-- =============================================================================

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
BEGIN
  IF position('@' IN v_mail) = 0 OR length(coalesce(p_password, '')) NOT BETWEEN 1 AND 200 THEN
    RETURN FALSE;
  END IF;

  SELECT u."Id_User", c.hash, u.auth_id INTO v_id_user, v_hash, v_auth_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(trim(u."Mail")) = v_mail
  LIMIT 1;

  IF v_id_user IS NULL OR v_auth_id IS NOT NULL THEN RETURN FALSE; END IF;
  IF lower(v_hash) <> encode(digest(p_password, 'sha256'), 'hex') THEN RETURN FALSE; END IF;

  -- Un usuario de Auth con ese mail que NO es esta cuenta: fuera
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

  UPDATE "User" SET auth_id = v_nuevo WHERE "Id_User" = v_id_user;
  DELETE FROM user_credentials WHERE id_user = v_id_user;
  RETURN TRUE;
END $$;

-- La llama la pantalla de login, SIN sesión todavía: por eso anon.
REVOKE ALL ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

DO $verificacion$
BEGIN
  IF to_regprocedure('public.migrar_cuenta_legada(text,text)') IS NULL THEN
    RAISE EXCEPTION '065 no quedó creada';
  END IF;
  RAISE NOTICE 'Zooni: 065 aplicada. Cuentas viejas sin migrar: %', (SELECT count(*) FROM user_credentials);
END
$verificacion$;

COMMIT;
