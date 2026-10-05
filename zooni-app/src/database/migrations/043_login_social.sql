-- =============================================================================
-- Migración 043: entrar / registrarse con Google, Facebook y Apple
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 021, la 035 y la 039 (y la 040 para el alta de paseador).
-- =============================================================================
-- La app NO usa Supabase Auth para su sesión (usa "User" + user_credentials,
-- ver 021). Para el login social sí se usa Supabase Auth, pero SÓLO para que
-- Google / Facebook / Apple confirmen quién es la persona:
--
--   1. La app abre el login del proveedor (supabase.auth.signInWithOAuth).
--   2. Al volver, el cliente "social" de la app queda con una sesión de
--      Supabase Auth (rol authenticated).
--   3. Con esa sesión llama a estas RPCs. Acá el mail NO lo manda el cliente:
--      se lee de auth.users con auth.uid(), o sea, el que verificó el
--      proveedor. Nadie puede entrar a la cuenta de otro mandando su mail.
--
--   login_social()                          → cuenta existente con ese mail
--                                             (o "nuevo" + datos para el alta)
--   registrar_social_con_mascota(usuario, mascota)  → alta de dueño sin contraseña
--   registrar_paseador_social(usuario, perfil)      → alta de paseador sin contraseña
--   activar_paseador_social(perfil)                 → dueño existente que se suma
--                                                     como paseador
--
-- Las cuentas creadas así no tienen contraseña (no hay fila en
-- user_credentials): entran siempre con su proveedor.
--
-- ANTES DE USARLO hay que activar cada proveedor en Supabase
-- (Authentication → Providers) y cargar la URL de la app en
-- Authentication → URL Configuration → Redirect URLs.
-- =============================================================================


-- Mail VERIFICADO de la sesión social actual (o error)
CREATE OR REPLACE FUNCTION _email_social()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT;
  v_confirmado TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sin_sesion_social';
  END IF;
  SELECT lower(trim(u.email)), u.email_confirmed_at INTO v_mail, v_confirmado
  FROM auth.users u WHERE u.id = auth.uid();
  IF v_mail IS NULL OR v_mail = '' THEN
    RAISE EXCEPTION 'sin_email';
  END IF;
  IF v_confirmado IS NULL THEN
    RAISE EXCEPTION 'email_no_verificado';
  END IF;
  RETURN v_mail;
END $$;

REVOKE ALL ON FUNCTION _email_social() FROM anon, public;


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
BEGIN
  SELECT * INTO v_user FROM "User" WHERE lower("Mail") = v_mail;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'nuevo',      FALSE,
      'id',         v_user."Id_User",
      'nombre',     v_user."Nombre",
      'apellido',   v_user."Apellido",
      'email',      v_user."Mail",
      'fotoPerfil', v_user."FotoPerfil"
    );
  END IF;

  -- Cuenta nueva: devolver lo que dio el proveedor para precargar el alta
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


-- Foto del proveedor: sólo si es una URL https
CREATE OR REPLACE FUNCTION _foto_social(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN p ~ '^https://' THEN left(p, 500) END $$;


CREATE OR REPLACE FUNCTION registrar_social_con_mascota(p_usuario JSONB, p_mascota JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;

  INSERT INTO "User" (
    "Nombre", "Apellido", "Mail", "Telefono", "CodigoTelefono",
    "Pais", "PaisCodigo", "Provincia", "Ciudad", "Ubicacion", "FotoPerfil"
  ) VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    left(p_usuario->>'telefono', 30),
    left(p_usuario->>'codigoTelefono', 10),
    left(p_usuario->>'pais', 100),
    left(p_usuario->>'paisCodigo', 5),
    left(p_usuario->>'provincia', 100),
    left(p_usuario->>'ciudad', 100),
    left(p_usuario->>'ubicacion', 200),
    _foto_social(p_usuario->>'fotoPerfil')
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO "Mascota" (
    "Id_User", "Nombre", "Especie", "Sexo", "Raza", "Peso",
    "FechaNacimiento", "ImagenAsset", "EsActiva"
  ) VALUES (
    v_id,
    left(trim(p_mascota->>'nombre'), 30),
    left(p_mascota->>'especie', 50),
    left(p_mascota->>'sexo', 10),
    left(p_mascota->>'raza', 100),
    NULLIF(p_mascota->>'peso', '')::NUMERIC,
    NULLIF(p_mascota->>'fechaNacimiento', '')::DATE,
    COALESCE(left(p_mascota->>'imagenAsset', 100), 'perro_default'),
    TRUE
  );

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (v_id, 1);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);
END $$;


CREATE OR REPLACE FUNCTION registrar_paseador_social(p_usuario JSONB, p_perfil JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_genero TEXT := NULLIF(trim(p_usuario->>'genero'), '');
  v_nacimiento DATE := NULLIF(p_usuario->>'fechaNacimiento', '')::DATE;
  v_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;
  IF v_genero IS NULL OR v_genero NOT IN ('masculino', 'femenino', 'prefiero_no_decir') THEN
    RAISE EXCEPTION 'genero_invalido';
  END IF;
  IF v_nacimiento IS NULL
     OR v_nacimiento > (current_date - INTERVAL '18 years')
     OR v_nacimiento < (current_date - INTERVAL '100 years') THEN
    RAISE EXCEPTION 'edad_invalida';
  END IF;

  INSERT INTO "User" ("Nombre", "Apellido", "Mail", "Telefono", "Ubicacion", "Genero", "FechaNacimiento", "FotoPerfil")
  VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    left(p_usuario->>'telefono', 30),
    left(trim(p_perfil->>'zona'), 200),
    v_genero,
    v_nacimiento,
    _foto_social(p_usuario->>'fotoPerfil')
  ) RETURNING "Id_User" INTO v_id;

  PERFORM _upsert_paseador_perfil(v_id, p_perfil);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);
END $$;


CREATE OR REPLACE FUNCTION activar_paseador_social(p_perfil JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_id INTEGER;
BEGIN
  SELECT "Id_User" INTO v_id FROM "User" WHERE lower("Mail") = v_mail;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'sin_cuenta';
  END IF;
  PERFORM _upsert_paseador_perfil(v_id, p_perfil);
  RETURN jsonb_build_object('id', v_id, 'email', v_mail);
END $$;


-- Sólo con sesión social (rol authenticated): anon no tiene auth.uid()
REVOKE ALL ON FUNCTION login_social() FROM anon, public;
REVOKE ALL ON FUNCTION registrar_social_con_mascota(JSONB, JSONB) FROM anon, public;
REVOKE ALL ON FUNCTION registrar_paseador_social(JSONB, JSONB) FROM anon, public;
REVOKE ALL ON FUNCTION activar_paseador_social(JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION login_social() TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_social_con_mascota(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_paseador_social(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION activar_paseador_social(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
