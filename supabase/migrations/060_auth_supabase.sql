-- =============================================================================
-- 060_auth_supabase.sql — La identidad pasa a ser un JWT de Supabase Auth.
-- Idempotente. Requiere 021, 043, 046.
-- =============================================================================
-- ANTES: la app guardaba en el dispositivo el número "Id_User" y lo mandaba en
-- cada consulta como si fuera la prueba de quién es. La base no tenía forma de
-- verificarlo: cualquiera con la clave pública podía decir "soy el 7".
-- Y la contraseña viajaba como SHA-256 sin sal: ese hash ERA la contraseña
-- (quien lo veía pasar podía reusarlo tal cual).
--
-- AHORA:
--   · El login es supabase.auth.signInWithPassword: Supabase Auth guarda la
--     contraseña con bcrypt (sal + costo) y devuelve un JWT firmado.
--   · "User".auth_id une la fila de Zooni con el usuario de Supabase Auth.
--   · usuario_actual() traduce el JWT (auth.uid()) al Id_User. Es lo ÚNICO
--     en lo que se apoyan las políticas de 061: nada que mande el cliente.
--
-- Cuentas viejas (con hash en user_credentials): la primera vez que entran,
-- la Edge Function `migrar-cuenta` comprueba el hash viejo, crea su usuario de
-- Supabase Auth con la MISMA contraseña y borra el hash viejo. Ver
-- supabase/functions/migrar-cuenta/index.ts.
--
-- Las RPC "_social" de la 043 (login_social, registrar_social_con_mascota,
-- registrar_paseador_social, activar_paseador_social) ya leían el mail desde
-- auth.users con auth.uid(): sirven igual para una sesión de contraseña. El
-- nombre quedó de cuando sólo se usaban con Google/Facebook.
-- =============================================================================

-- ─── 1. Vínculo User ↔ auth.users ───────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS auth_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_auth_id_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT user_auth_id_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_id ON "User"(auth_id) WHERE auth_id IS NOT NULL;

-- ─── 2. ¿Quién es el que pregunta? ──────────────────────────────────────────
-- SECURITY DEFINER: así las políticas de "User" pueden llamarla sin recursión.
CREATE OR REPLACE FUNCTION usuario_actual()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "Id_User" FROM "User" WHERE auth_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION usuario_actual() FROM public;
GRANT EXECUTE ON FUNCTION usuario_actual() TO anon, authenticated, service_role;

-- ─── 3. Toda alta hecha con sesión queda vinculada a esa sesión ─────────────
-- Las RPC de alta (registrar_social_con_mascota, registrar_paseador_social,
-- registrar_negocio_sesion…) insertan en "User" con SECURITY DEFINER; auth.uid()
-- sigue siendo el del JWT del pedido. Sólo se vincula si el mail coincide con
-- el de la sesión: nadie puede "adueñarse" de una fila con otro mail.
CREATE OR REPLACE FUNCTION _vincular_auth_en_alta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_mail TEXT;
BEGIN
  IF NEW.auth_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT lower(email) INTO v_mail FROM auth.users WHERE id = auth.uid();
    IF v_mail IS NOT NULL AND v_mail = lower(trim(NEW."Mail")) THEN
      NEW.auth_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_vincular_auth ON "User";
CREATE TRIGGER trg_user_vincular_auth
  BEFORE INSERT ON "User"
  FOR EACH ROW EXECUTE FUNCTION _vincular_auth_en_alta();

-- ─── 3b. El mail lo administra Supabase Auth ────────────────────────────────
-- Cambiar de mail = supabase.auth.updateUser({ email }) (con confirmación).
-- Cuando Auth confirma el cambio, se copia acá. La app ya no escribe
-- "User".Mail (061 le saca ese permiso).
CREATE OR REPLACE FUNCTION _sincronizar_mail_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE "User" SET "Mail" = lower(NEW.email) WHERE auth_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zooni_sincronizar_mail ON auth.users;
CREATE TRIGGER trg_zooni_sincronizar_mail
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION _sincronizar_mail_auth();

-- ─── 4. login_social(): ahora también vincula la cuenta existente ───────────
-- Misma respuesta que en la 043; lo nuevo es el UPDATE de auth_id para
-- cuentas creadas antes de esta migración que entran por primera vez con un
-- proveedor (Google/Facebook) o ya migradas por `migrar-cuenta`.
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
    IF v_user.auth_id IS NULL THEN
      -- Cuenta vieja con contraseña sin migrar: NO se vincula a una sesión de
      -- contraseña cualquiera. Si no, alguien podría hacer signUp con el mail
      -- de otra persona y quedarse con su cuenta. Primero tiene que pasar por
      -- migrar-cuenta (que comprueba la contraseña vieja). Con Google /
      -- Facebook sí se vincula: el proveedor verificó que el mail es suyo.
      IF EXISTS (SELECT 1 FROM user_credentials WHERE id_user = v_user."Id_User")
         AND NOT EXISTS (SELECT 1 FROM auth.identities
                         WHERE user_id = auth.uid() AND provider <> 'email') THEN
        RAISE EXCEPTION 'cuenta_sin_migrar';
      END IF;
      UPDATE "User" SET auth_id = auth.uid() WHERE "Id_User" = v_user."Id_User";
    ELSIF v_user.auth_id <> auth.uid() THEN
      RAISE EXCEPTION 'cuenta_vinculada_a_otra_sesion';
    END IF;
    RETURN jsonb_build_object(
      'nuevo',      FALSE,
      'id',         v_user."Id_User",
      'nombre',     v_user."Nombre",
      'apellido',   v_user."Apellido",
      'email',      v_user."Mail",
      'fotoPerfil', v_user."FotoPerfil"
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

-- ─── 5. Negocios con sesión (equivalentes "_social" que faltaban) ───────────
-- registrar_negocio / activar_negocio de la 046 recibían mail + hash. Estas
-- toman el mail de la sesión, igual que las de paseador de la 043.
CREATE OR REPLACE FUNCTION registrar_negocio_sesion(p_usuario JSONB, p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_mail TEXT := _email_social();
  v_id INTEGER;
  v_negocio INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;

  INSERT INTO "User" ("Nombre", "Apellido", "Mail", "Telefono", "Ubicacion")
  VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    NULLIF(left(trim(p_usuario->>'telefono'), 30), ''),
    left(trim(p_negocio->>'direccion'), 300)
  )
  RETURNING "Id_User" INTO v_id;

  v_negocio := _upsert_negocio(v_id, p_negocio);
  RETURN jsonb_build_object('id', v_id, 'email', v_mail, 'idNegocio', v_negocio);
END $$;

CREATE OR REPLACE FUNCTION activar_negocio_sesion(p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_id INTEGER := usuario_actual();
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'sin_cuenta'; END IF;
  PERFORM _upsert_negocio(v_id, p_negocio);
  RETURN jsonb_build_object('id', v_id);
END $$;

REVOKE ALL ON FUNCTION registrar_negocio_sesion(JSONB, JSONB) FROM anon, public;
REVOKE ALL ON FUNCTION activar_negocio_sesion(JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION registrar_negocio_sesion(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION activar_negocio_sesion(JSONB) TO authenticated;

-- ─── 6. Disponibilidad de mail / @usuario para el registro ──────────────────
-- Con RLS (061) un anónimo ya no puede leer "User" para chequear si un mail
-- está tomado. Esta función responde sólo sí/no, sin devolver filas.
CREATE OR REPLACE FUNCTION disponibilidad_registro(p_mail TEXT, p_usuario TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'mailTomado', p_mail IS NOT NULL AND EXISTS (
      SELECT 1 FROM "User" WHERE lower(trim("Mail")) = lower(trim(p_mail))),
    'usuarioTomado', NULLIF(trim(p_usuario), '') IS NOT NULL AND EXISTS (
      SELECT 1 FROM "User" WHERE lower("NombreUsuario") = lower(trim(both '@' from trim(p_usuario))))
  )
$$;

GRANT EXECUTE ON FUNCTION disponibilidad_registro(TEXT, TEXT) TO anon, authenticated;

-- ─── 7. Soporte para la Edge Function migrar-cuenta (sólo service_role) ─────
CREATE OR REPLACE FUNCTION _credencial_legada(p_mail TEXT)
RETURNS TABLE (id_user INTEGER, hash TEXT, auth_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."Id_User", c.hash, u.auth_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(trim(u."Mail")) = lower(trim(p_mail))
$$;

CREATE OR REPLACE FUNCTION _auth_id_por_mail(p_mail TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_mail)) LIMIT 1
$$;

-- Termina la migración de una cuenta: vincula y borra el hash viejo (la
-- contraseña ahora vive en Supabase Auth, con bcrypt).
CREATE OR REPLACE FUNCTION _completar_migracion_cuenta(p_id_user INTEGER, p_auth_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "User" SET auth_id = p_auth_id WHERE "Id_User" = p_id_user;
  DELETE FROM user_credentials WHERE id_user = p_id_user;
END $$;

REVOKE ALL ON FUNCTION _credencial_legada(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION _auth_id_por_mail(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION _completar_migracion_cuenta(INTEGER, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION _credencial_legada(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION _auth_id_por_mail(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION _completar_migracion_cuenta(INTEGER, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
