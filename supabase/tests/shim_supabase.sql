-- shim_supabase.sql — SOLO PARA PROBAR EL ESQUEMA EN UN POSTGRES LOCAL.
--
-- NO se corre en Supabase (allá todo esto ya existe). Imita lo mínimo que las
-- migraciones dan por sentado: los roles anon / authenticated / service_role,
-- auth.uid() leyendo el JWT, auth.users e identities, y storage.buckets /
-- storage.objects. Con esto `node scripts/probar-esquema.mjs` puede verificar
-- que supabase/migrations corre sobre una base vacía y que se puede volver a
-- correr sin romperse.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Mismas columnas que usa 065 al crear un usuario (las de Supabase Auth)
CREATE TABLE IF NOT EXISTS auth.users (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id            uuid,
  aud                    varchar(255),
  role                   varchar(255),
  email                  text,
  encrypted_password     text,
  email_confirmed_at     timestamptz DEFAULT now(),
  raw_app_meta_data      jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data     jsonb DEFAULT '{}'::jsonb,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  confirmation_token     varchar(255),
  recovery_token         varchar(255),
  email_change_token_new varchar(255),
  email_change           varchar(255)
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id     text,
  provider        text,
  identity_data   jsonb,
  last_sign_in_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- En Supabase, auth.uid() sale del claim `sub` del JWT del pedido. Acá se
-- simula con la variable de sesión request.jwt.claims (igual que PostgREST).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT auth.jwt() ->> 'role' $$;

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text REFERENCES storage.buckets(id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT SELECT ON storage.buckets TO anon, authenticated;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(reverse(split_part(reverse(name), '.', 1)))
$$;

-- PostgREST escucha este canal para recargar el esquema; acá no hace nada.
-- (NOTIFY sobre un canal sin oyentes es inofensivo.)

-- Supabase deja `extensions` en el search_path (ahí viven digest, crypt, …).
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path = "$user", public, extensions', current_database());
  EXECUTE format('ALTER DATABASE %I SET lc_messages = %L', current_database(), 'C');
END $$;
