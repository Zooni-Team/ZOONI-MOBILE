-- =============================================================================
-- MIGRACION_067_CERRAR_FUNCIONES.sql — Pegar ENTERO en Supabase → SQL Editor → Run.
-- Va DESPUÉS de la 066. Idempotente. No toca datos.
-- Si algo no queda como debe, la verificación del final hace ROLLBACK y no
-- cambia nada.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.vencer_paseos()') IS NULL THEN
    RAISE EXCEPTION 'Falta la 066: pegá primero MIGRACION_066_RLS_REAPLICAR.sql';
  END IF;
END $$;

-- =============================================================================
-- 067 — Funciones cerradas por lista blanca, intentos de login viejo con
-- límite y "verificado" sólo lo pone Zooni. Idempotente. Requiere 060–066.
-- =============================================================================
-- PROBLEMA (verificado en producción el 13/11/2026):
--   · Supabase le da EXECUTE a anon y authenticated en TODA función nueva del
--     esquema public (privilegios por defecto), no sólo a través de PUBLIC.
--     Varias funciones internas tenían "REVOKE … FROM anon, public" y seguían
--     abiertas para cualquier usuario logueado. Entre ellas:
--       _upsert_paseador_perfil(id, perfil) → reescribir el perfil de
--         CUALQUIER paseador (precio, zona, horarios…).
--       _upsert_negocio(id_user, negocio)  → lo mismo con cualquier negocio.
--     Y _devolver_stock(items) no tenía ningún REVOKE: hasta sin sesión se
--     podía subir el stock de cualquier producto.
--   · migrar_cuenta_legada (sin sesión) no tenía límite de intentos: se podía
--     probar contraseñas contra las cuentas viejas (sha256 sin sal) sin freno.
--   · Un paseador podía marcarse verificado = true a sí mismo (su política es
--     FOR ALL sobre su fila), y un negocio, verified = true en sus servicios.
--
-- AHORA:
--   1. Lista blanca: de las funciones SECURITY DEFINER de public, sólo las de
--      abajo se pueden llamar desde la app. Todas las demás: sólo el dueño de
--      la base y service_role. Las que se creen en el futuro arrancan cerradas
--      para anon (hay que darle GRANT a propósito).
--   2. migrar_cuenta_legada: 5 intentos fallidos por mail cada 15 minutos.
--   3. verificado / verified sólo cambian sin sesión (SQL Editor, service_role).
-- =============================================================================

-- ─── 1. Funciones: lista blanca ─────────────────────────────────────────────
DO $$
DECLARE
  -- Sin sesión (pantallas de login y registro)
  para_anon TEXT[] := ARRAY['disponibilidad_registro', 'migrar_cuenta_legada'];
  -- Con sesión: las RPC que llama la app + los helpers que usan las políticas
  para_usuarios TEXT[] := ARRAY[
    'usuario_actual', 'es_mi_mascota', 'soy_dueno_negocio', 'soy_dueno_servicio',
    'participo_en_match', 'participo_en_paseo', 'soy_walker_de_paseo', 'soy_paseador',
    'son_amigos', 'tengo_trato_con',
    'disponibilidad_registro', 'login_social', 'registrar_social_con_mascota',
    'registrar_paseador_social', 'activar_paseador_social', 'completar_perfil_paseador',
    'registrar_negocio_sesion', 'activar_negocio_sesion',
    'aceptar_solicitud_paseo', 'votar_mascota', 'vencer_paseos'];
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma, p.proname AS nombre
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f.firma);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.firma);
    IF f.nombre = ANY (para_usuarios) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.firma);
    END IF;
    IF f.nombre = ANY (para_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.firma);
    END IF;
  END LOOP;
END $$;

-- Funciones que se creen de acá en adelante: cerradas para anon y PUBLIC.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, public;

-- ─── 2. Login de cuentas viejas: límite de intentos ─────────────────────────
CREATE TABLE IF NOT EXISTS migracion_intentos (
  mail     TEXT PRIMARY KEY,
  fallos   INTEGER NOT NULL DEFAULT 0,
  ultimo   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE migracion_intentos ENABLE ROW LEVEL SECURITY;   -- sin políticas: nadie desde la app
REVOKE ALL ON migracion_intentos FROM anon, authenticated;

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

  -- 5 fallos en 15 minutos → ese mail queda frenado hasta que pasen (067).
  -- Mismo FALSE que una contraseña mala: no revela nada.
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
  DELETE FROM migracion_intentos WHERE mail = v_mail;
  RETURN TRUE;
END $$;

REVOKE ALL ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION migrar_cuenta_legada(TEXT, TEXT) TO anon, authenticated, service_role;

-- ─── 3. "Verificado" lo pone Zooni, no el interesado ────────────────────────
CREATE OR REPLACE FUNCTION _sin_autoverificarse()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF usuario_actual() IS NULL THEN RETURN NEW; END IF;  -- SQL Editor / service_role
  IF TG_TABLE_NAME = 'paseador_perfil' THEN
    NEW.verificado := CASE WHEN TG_OP = 'INSERT' THEN FALSE ELSE OLD.verificado END;
  ELSE
    NEW.verified := CASE WHEN TG_OP = 'INSERT' THEN FALSE ELSE OLD.verified END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION _sin_autoverificarse() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_paseador_sin_autoverificarse ON paseador_perfil;
CREATE TRIGGER trg_paseador_sin_autoverificarse BEFORE INSERT OR UPDATE ON paseador_perfil
  FOR EACH ROW EXECUTE FUNCTION _sin_autoverificarse();
DROP TRIGGER IF EXISTS trg_servicio_sin_autoverificarse ON servicios;
CREATE TRIGGER trg_servicio_sin_autoverificarse BEFORE INSERT OR UPDATE ON servicios
  FOR EACH ROW EXECUTE FUNCTION _sin_autoverificarse();

-- ─── 4. Verificación (si falla, se deshace todo) ────────────────────────────
DO $$
BEGIN
  ASSERT NOT has_function_privilege('authenticated', '_upsert_paseador_perfil(integer, jsonb)', 'EXECUTE'),
    'un usuario todavía puede reescribir perfiles de paseador';
  ASSERT NOT has_function_privilege('authenticated', '_upsert_negocio(integer, jsonb)', 'EXECUTE'),
    'un usuario todavía puede reescribir negocios';
  ASSERT NOT has_function_privilege('anon', '_devolver_stock(jsonb)', 'EXECUTE'),
    'sin sesión todavía se puede tocar el stock';
  ASSERT NOT has_function_privilege('anon', 'get_pet_chat_context(bigint)', 'EXECUTE'),
    'el contexto médico de ZooniVet quedó abierto';
  ASSERT has_function_privilege('anon', 'migrar_cuenta_legada(text, text)', 'EXECUTE'),
    'el login de cuentas viejas tiene que seguir andando sin sesión';
  ASSERT has_function_privilege('authenticated', 'es_mi_mascota(integer)', 'EXECUTE'),
    'las políticas necesitan es_mi_mascota';
  ASSERT has_function_privilege('authenticated', 'registrar_social_con_mascota(jsonb, jsonb)', 'EXECUTE'),
    'el registro tiene que seguir andando';
  RAISE NOTICE '067 OK';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
