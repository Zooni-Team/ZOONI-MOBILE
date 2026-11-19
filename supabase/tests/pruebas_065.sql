-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_065.sql — Migración de una cuenta vieja a Supabase Auth desde la base.
-- Correr después de pruebas_rls.sql (usa pg_temp.como_anonimo / salir).

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  v_mail TEXT := 'vieja.' || sufijo || '@prueba.test';
  v_user INTEGER;
  v_auth UUID;
  v_intruso UUID := gen_random_uuid();
  ok BOOLEAN;
BEGIN
  -- Una cuenta de antes de 060: hash sha256 en user_credentials, sin auth_id
  INSERT INTO "User" ("Nombre", "Apellido", "Mail") VALUES ('Vieja', 'Cuenta', v_mail)
  RETURNING "Id_User" INTO v_user;
  INSERT INTO user_credentials (id_user, hash)
  VALUES (v_user, encode(sha256(convert_to('clave-vieja', 'UTF8')), 'hex'));
  -- Alguien hizo signUp con ese mail antes de que la dueña entrara
  INSERT INTO auth.users (id, email) VALUES (v_intruso, v_mail);

  PERFORM pg_temp.como_anonimo();
  ok := migrar_cuenta_legada(v_mail, 'otra-clave');
  ASSERT NOT ok, 'contraseña mala: no migra';
  ok := migrar_cuenta_legada('nadie.' || sufijo || '@prueba.test', 'clave-vieja');
  ASSERT NOT ok, 'mail inexistente: mismo FALSE';
  ok := migrar_cuenta_legada(upper(v_mail), 'clave-vieja');
  ASSERT ok, 'contraseña correcta (mail en mayúsculas): migra';
  ok := migrar_cuenta_legada(v_mail, 'clave-vieja');
  ASSERT NOT ok, 'ya migrada: no se vuelve a migrar';
  PERFORM pg_temp.salir();

  SELECT auth_id INTO v_auth FROM "User" WHERE "Id_User" = v_user;
  ASSERT v_auth IS NOT NULL, 'la cuenta queda vinculada a Auth';
  ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_intruso), 'el usuario de Auth intruso se borra';
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = v_auth AND email = v_mail
                 AND aud = 'authenticated' AND email_confirmed_at IS NOT NULL
                 AND encrypted_password IS NOT NULL AND confirmation_token = ''),
         'usuario de Auth creado y confirmado';
  ASSERT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_auth AND provider = 'email'
                 AND provider_id = v_auth::TEXT), 'identidad email creada';
  ASSERT NOT EXISTS (SELECT 1 FROM user_credentials WHERE id_user = v_user), 'el hash viejo se borra';

  RAISE NOTICE 'pruebas_065: OK';
END $$;
