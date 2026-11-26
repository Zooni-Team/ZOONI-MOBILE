DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  ana_auth UUID := gen_random_uuid();
  beto_auth UUID := gen_random_uuid();
  ana INTEGER; beto INTEGER; r JSONB;
  mascota_ana INTEGER; mascota_beto INTEGER;
  fallo BOOLEAN; n INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ana_auth, 'ana070.' || sufijo || '@prueba.test');
  INSERT INTO auth.users (id, email) VALUES (beto_auth, 'beto070.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(ana_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Ana', 'apellido', 'Endurecida'),
    jsonb_build_object('nombre', 'Firulais', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 10));
  ana := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Beto', 'apellido', 'Endurecido'),
    jsonb_build_object('nombre', 'Luna', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 8));
  beto := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  SELECT "Id_Mascota" INTO mascota_ana FROM "Mascota" WHERE "Id_User" = ana;
  SELECT "Id_Mascota" INTO mascota_beto FROM "Mascota" WHERE "Id_User" = beto;

  PERFORM pg_temp.como(ana_auth);

  ASSERT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = mascota_ana),
    'Ana tiene que seguir viendo su propia mascota';
  ASSERT NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = mascota_beto),
    '"Mascota" no puede devolver la mascota de otra persona (#12)';

  ASSERT EXISTS (SELECT 1 FROM mascota_publica WHERE "Id_Mascota" = mascota_beto),
    'mascota_publica tiene que mostrar la mascota ajena';
  ASSERT (SELECT "Nombre" FROM mascota_publica WHERE "Id_Mascota" = mascota_beto) = 'Luna',
    'mascota_publica tiene que traer el nombre';

  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mascota_publica'
      AND column_name IN ('EstadoSalud', 'ChipId', 'Microchip', 'SenasParticulares',
                          'FechaNacimiento', 'Peso', 'PurgarDespues', 'EliminadaEn')
  ), 'mascota_publica expone columnas sensibles (#12)';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mascota_publica' AND column_name = 'EdadAnios'
  ), 'mascota_publica tiene que exponer EdadAnios en lugar de FechaNacimiento';

  fallo := FALSE;
  BEGIN
    INSERT INTO "Notificacion" ("Id_User", "Tipo", "Titulo") VALUES (beto, 'match', 'falsa');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN fallo := TRUE;
  END;
  ASSERT fallo, 'no se puede insertar una notificación directo en la tabla (#5)';

  ASSERT NOT has_table_privilege('authenticated', 'subscriptions', 'INSERT'),
    'subscriptions sigue escribible desde la app (#11)';

  PERFORM pg_temp.salir();

  ASSERT NOT has_function_privilege('anon', 'completar_perfil_paseador(integer, jsonb)', 'EXECUTE'),
    'completar_perfil_paseador sigue otorgada a anon (#1)';

  ASSERT has_function_privilege('anon', 'migrar_cuenta_legada(text, text)', 'EXECUTE'),
    'el login de cuentas viejas (065) tiene que seguir andando';
  ASSERT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'consultas-privadas' AND NOT public),
    'el bucket privado de consultas (064) tiene que seguir privado';
  ASSERT to_regclass('public.archivos_por_borrar') IS NOT NULL,
    'la cola de archivos de la 068 tiene que seguir existiendo';
  ASSERT to_regprocedure('login_user(text, text)') IS NULL,
    'la 068 borró el login con hash: la 070 no lo puede revivir';

  RAISE NOTICE '070 (mascotas, notificaciones, permisos) OK';
END $$;

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  duena_auth UUID := gen_random_uuid();
  pas_auth UUID := gen_random_uuid();
  duena INTEGER; pas INTEGER; r JSONB;
  mascota INTEGER; paseo INTEGER;
  fallo BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (duena_auth, 'due070.' || sufijo || '@prueba.test');
  INSERT INTO auth.users (id, email) VALUES (pas_auth, 'pas070.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(duena_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Delia', 'apellido', 'Dueña'),
    jsonb_build_object('nombre', 'Toby', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 9));
  duena := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(pas_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Pablo', 'apellido', 'Paseador'),
    jsonb_build_object('nombre', 'Nube', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 7));
  pas := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (pas, 2) ON CONFLICT DO NOTHING;
  SELECT "Id_Mascota" INTO mascota FROM "Mascota" WHERE "Id_User" = duena;

  INSERT INTO "Paseo" ("Id_Dueno", "Id_Mascota", "Estado", "Precio", "PrecioPactado", "DuracionMin")
  VALUES (duena, mascota, 'pendiente', 1000, 1000, 30)
  RETURNING "Id_Paseo" INTO paseo;

  PERFORM pg_temp.como(duena_auth);
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "Estado" = 'aceptado', "Id_Walker" = duena WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'nadie puede aceptar su propio paseo (#64)';
  PERFORM pg_temp.salir();

  UPDATE "Paseo" SET "Estado" = 'aceptado', "Id_Walker" = pas WHERE "Id_Paseo" = paseo;

  PERFORM pg_temp.como(pas_auth);
  UPDATE "Paseo" SET "Estado" = 'en_curso', "HoraInicio" = now(), "ReanudadoEn" = now()
  WHERE "Id_Paseo" = paseo;
  ASSERT (SELECT "Estado" FROM "Paseo" WHERE "Id_Paseo" = paseo) = 'en_curso',
    'el paseador arranca su paseo (si no, lo de abajo no prueba nada)';

  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "SegundosAcumulados" = 99999 WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'el paseador no puede inflar SegundosAcumulados (#17)';

  UPDATE "Paseo" SET "DistanciaMetros" = 100 WHERE "Id_Paseo" = paseo;
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "DistanciaMetros" = 50 WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'la distancia no puede retroceder (#17)';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(duena_auth);
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "Rating" = 5, "Resena" = 'genial' WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'no se puede reseñar un paseo que no terminó (#61)';
  PERFORM pg_temp.salir();

  RAISE NOTICE '070 (paseos) OK';
END $$;
