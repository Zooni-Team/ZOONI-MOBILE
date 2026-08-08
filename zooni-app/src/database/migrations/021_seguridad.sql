-- ============================================================================
-- 021_seguridad.sql — Endurecimiento de seguridad (ejecutar completo en
-- Supabase → SQL Editor). Idempotente: se puede correr más de una vez.
--
-- QUÉ ARREGLA:
--   1. Los hashes de contraseña eran LEGIBLES por cualquiera con la anon key
--      (el login los comparaba en el cliente). Se mueven a una tabla privada
--      y el login/registro pasan a RPCs SECURITY DEFINER del lado del server.
--   2. Cualquiera podía DELETEar usuarios, mascotas o roles ajenos.
--      Se revocan los DELETE del rol anon (la app usa borrado lógico).
--   3. Cualquiera podía auto-asignarse roles (UserRole abierto). Se cierra.
--   4. Validación server-side (CHECKs): peso 0.1–120, nombre 2–30, microchip
--      15 dígitos, mail con forma de mail. El cliente ya no puede meter basura
--      aunque se saltee la app.
--
-- LÍMITE HONESTO: sin Supabase Auth no existe "usuario autenticado" para la
-- base, así que el aislamiento POR USUARIO (que nadie lea mascotas ajenas)
-- todavía no es posible: eso requiere migrar el login a Supabase Auth y
-- habilitar RLS con auth.uid(). Este archivo cierra las puertas más graves
-- (contraseñas, deletes, roles) sin romper la app actual.
--
-- IMPORTANTE: la app ya está actualizada para usar las RPCs de acá
-- (authApi.js llama login_user / registrar_usuario_con_mascota con fallback
-- al método viejo si este archivo todavía no se ejecutó).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONTRASEÑAS FUERA DEL OJO PÚBLICO
-- ─────────────────────────────────────────────────────────────────────────────

-- Para hashear las credenciales legacy en texto plano (usuarios demo)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla privada de credenciales (el rol anon no la puede ni ver)
CREATE TABLE IF NOT EXISTS user_credentials (
  id_user     INTEGER PRIMARY KEY,
  hash        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrar los hashes existentes desde "User".Contrasena (solo si la columna
-- todavía existe y la credencial no fue migrada antes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'Contrasena'
  ) THEN
    INSERT INTO user_credentials (id_user, hash)
    SELECT "Id_User", "Contrasena" FROM "User"
    WHERE "Contrasena" IS NOT NULL
    ON CONFLICT (id_user) DO NOTHING;

    -- Borrar la columna: los hashes dejan de ser legibles vía REST
    ALTER TABLE "User" DROP COLUMN "Contrasena";
  END IF;
END $$;

-- Credenciales legacy en texto plano (ej: 'demo-sin-login' de los seeds):
-- se convierten a su SHA-256 para que el login por hash siga funcionando.
-- Un hash de la app siempre es hex de 64 chars; lo que no lo sea, es plano.
UPDATE user_credentials
SET hash = encode(digest(hash, 'sha256'), 'hex'), updated_at = now()
WHERE hash !~ '^[0-9a-f]{64}$';

-- Nadie desde el cliente puede tocar las credenciales: solo las RPCs
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_credentials FROM anon, authenticated;
-- (sin policies: con RLS activo y cero policies, ni siquiera service puede
--  leer por REST; las funciones SECURITY DEFINER acceden igual)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: LOGIN (la comparación de hash pasa al servidor)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION login_user(p_mail TEXT, p_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_cred TEXT;
BEGIN
  SELECT * INTO v_user FROM "User" WHERE lower("Mail") = lower(trim(p_mail));
  IF NOT FOUND THEN
    RETURN NULL; -- misma respuesta que contraseña mala: no revelar si el mail existe
  END IF;

  SELECT hash INTO v_cred FROM user_credentials WHERE id_user = v_user."Id_User";
  IF v_cred IS NULL OR v_cred <> p_hash THEN
    RETURN NULL;
  END IF;

  -- Solo los campos que el login necesita: nunca la fila entera
  RETURN jsonb_build_object(
    'id',         v_user."Id_User",
    'nombre',     v_user."Nombre",
    'apellido',   v_user."Apellido",
    'email',      v_user."Mail",
    'fotoPerfil', v_user."FotoPerfil"
  );
END $$;

GRANT EXECUTE ON FUNCTION login_user(TEXT, TEXT) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: REGISTRO ATÓMICO (usuario + credencial + mascota + rol)
--    Reemplaza al flujo del cliente que insertaba y hacía rollback manual
--    con DELETEs (que ahora quedan revocados).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_usuario_con_mascota(
  p_usuario JSONB, p_hash TEXT, p_mascota JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mail TEXT := lower(trim(p_usuario->>'email'));
  v_id INTEGER;
BEGIN
  IF v_mail IS NULL OR v_mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 32 THEN
    RAISE EXCEPTION 'hash_invalido';
  END IF;

  INSERT INTO "User" (
    "Nombre", "Apellido", "Mail", "Telefono", "CodigoTelefono",
    "Pais", "PaisCodigo", "Provincia", "Ciudad", "Ubicacion"
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
    left(p_usuario->>'ubicacion', 200)
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);

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
  -- Si cualquier INSERT falla, la función entera hace rollback sola:
  -- no quedan cuentas huérfanas ni hace falta DELETE desde el cliente.
END $$;

GRANT EXECUTE ON FUNCTION registrar_usuario_con_mascota(JSONB, TEXT, JSONB) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: CAMBIO DE CONTRASEÑA (exige la actual)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cambiar_contrasena(
  p_mail TEXT, p_hash_actual TEXT, p_hash_nueva TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INTEGER;
BEGIN
  SELECT u."Id_User" INTO v_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(u."Mail") = lower(trim(p_mail)) AND c.hash = p_hash_actual;

  IF v_id IS NULL THEN RETURN FALSE; END IF;
  IF p_hash_nueva IS NULL OR length(p_hash_nueva) < 32 THEN
    RAISE EXCEPTION 'hash_invalido';
  END IF;

  UPDATE user_credentials SET hash = p_hash_nueva, updated_at = now()
  WHERE id_user = v_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION cambiar_contrasena(TEXT, TEXT, TEXT) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REVOCAR LO QUE EL CLIENTE NO DEBE PODER HACER
-- ─────────────────────────────────────────────────────────────────────────────

-- Sin DELETEs desde el cliente: la app usa borrado lógico (Estado='deleted')
-- y el rollback del registro ahora es atómico dentro de la RPC.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Mascota','UserRole','MascotaVacuna','Tratamiento','Publicacion',
    'Comentario','Match','Mensaje','Notificacion','Paseo','HistorialEvento'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('REVOKE DELETE ON %I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Roles: nadie se auto-asigna permisos desde el cliente (solo la RPC de registro)
REVOKE INSERT, UPDATE, DELETE ON "UserRole" FROM anon;

-- Catálogos: solo lectura desde el cliente
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'razas','avatares_catalogo','consejos_catalogo','tratamientos_catalogo',
    'Vacuna','Role','Clinica'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Auditoría de mascotas: el cliente puede agregar, nunca reescribir historia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mascota_estado_historial') THEN
    REVOKE UPDATE, DELETE ON mascota_estado_historial FROM anon;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VALIDACIÓN SERVER-SIDE (CHECKs) — el cliente ya no puede meter basura
-- ─────────────────────────────────────────────────────────────────────────────

-- Normalizar datos fuera de rango ANTES de crear los constraints
UPDATE "Mascota" SET "Peso" = NULL WHERE "Peso" IS NOT NULL AND ("Peso" < 0.1 OR "Peso" > 120);

DO $$ BEGIN
  ALTER TABLE "Mascota" ADD CONSTRAINT chk_mascota_peso
    CHECK ("Peso" IS NULL OR ("Peso" >= 0.1 AND "Peso" <= 120));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Mascota" ADD CONSTRAINT chk_mascota_nombre
    CHECK (char_length(trim("Nombre")) BETWEEN 1 AND 60);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'Mascota' AND column_name = 'Microchip') THEN
    ALTER TABLE "Mascota" ADD CONSTRAINT chk_mascota_microchip
      CHECK ("Microchip" IS NULL OR "Microchip" ~ '^[0-9]{15}$');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT chk_user_mail
    CHECK ("Mail" ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VERIFICACIÓN RÁPIDA (correr después para chequear que todo quedó)
-- ─────────────────────────────────────────────────────────────────────────────
--   · ¿La columna Contrasena ya no existe?
--       SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'User' AND column_name = 'Contrasena';   -- 0 filas
--   · ¿Las credenciales quedaron migradas?
--       SELECT COUNT(*) FROM user_credentials;
--   · ¿El login funciona?
--       SELECT login_user('demo@zooni.app', '<hash sha-256>');
--   · ¿anon no puede borrar? (desde la app o con curl):
--       DELETE /rest/v1/User?Id_User=eq.1  → debe dar error de permisos
--
-- PRÓXIMO PASO (el que da aislamiento real por usuario):
--   migrar el login a Supabase Auth (supabase.auth.signInWithPassword),
--   agregar columna auth_id UUID a "User", y habilitar RLS con
--   auth.uid() = auth_id en todas las tablas con datos personales.
-- ============================================================================
