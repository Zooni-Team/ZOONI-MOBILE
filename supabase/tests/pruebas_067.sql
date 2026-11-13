-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_067.sql — correr DESPUÉS de pruebas_rls.sql (helpers pg_temp.como / salir).
--   · Un usuario no puede llamar las funciones internas (_upsert_*, _devolver_stock).
--   · Un paseador no se marca verificado a sí mismo.
--   · migrar_cuenta_legada frena después de 5 fallos.

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  yo_auth UUID := gen_random_uuid();
  yo INTEGER; r JSONB; fallo BOOLEAN; i INTEGER; v BOOLEAN;
  v_mail TEXT := 'nadie067.' || sufijo || '@prueba.test';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (yo_auth, 'pas067.' || sufijo || '@prueba.test');
  PERFORM pg_temp.como(yo_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Paula', 'apellido', 'Seguridad'),
    jsonb_build_object('nombre', 'Toby', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 9));
  yo := (r->>'id')::INTEGER;

  fallo := FALSE;
  BEGIN
    PERFORM _upsert_paseador_perfil(1, '{}'::JSONB);
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'un usuario no puede reescribir perfiles de paseador ajenos';

  fallo := FALSE;
  BEGIN
    PERFORM _devolver_stock('[]'::JSONB);
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'un usuario no puede tocar el stock';

  INSERT INTO paseador_perfil (id_user, servicios, verificado)
  VALUES (yo, '[{"minutos": 30, "precio": 5000}]'::JSONB, TRUE);
  SELECT verificado INTO v FROM paseador_perfil WHERE id_user = yo;
  ASSERT NOT v, 'al darse de alta no puede venir verificado';
  UPDATE paseador_perfil SET verificado = TRUE WHERE id_user = yo;
  SELECT verificado INTO v FROM paseador_perfil WHERE id_user = yo;
  ASSERT NOT v, 'un paseador no se verifica a sí mismo';
  PERFORM pg_temp.salir();

  FOR i IN 1..7 LOOP
    PERFORM migrar_cuenta_legada(v_mail, 'mala' || i);
  END LOOP;
  ASSERT (SELECT fallos FROM migracion_intentos WHERE migracion_intentos.mail = lower(v_mail)) = 5,
         'después de 5 fallos, los intentos siguientes ni se prueban';

  RAISE NOTICE 'pruebas_067: OK';
END $$;
