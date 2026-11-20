-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_071.sql — correr DESPUÉS de pruebas_rls.sql (helpers pg_temp.como / salir).
--   · #1  El margen anti-trampa del paseo no se acumula update a update.
--   · #8  No se puede tener más de 10 mascotas activas.
--   · #15 marcar_mascota_principal deja exactamente una principal.
-- Ojo: todo corre en UNA transacción, así que now() no avanza: el "tramo"
-- transcurrido es 0 y el margen es de 30 s / 450 m.

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  duena_auth UUID := gen_random_uuid();
  pas_auth UUID := gen_random_uuid();
  duena INTEGER; pas INTEGER; r JSONB;
  mascota INTEGER; paseo INTEGER; segunda INTEGER;
  fallo BOOLEAN; i INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (duena_auth, 'due071.' || sufijo || '@prueba.test');
  INSERT INTO auth.users (id, email) VALUES (pas_auth, 'pas071.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(duena_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Dora', 'apellido', 'Dueña'),
    jsonb_build_object('nombre', 'Coco', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 9));
  duena := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(pas_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Pedro', 'apellido', 'Paseador'),
    jsonb_build_object('nombre', 'Lola', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 7));
  pas := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (pas, 2) ON CONFLICT DO NOTHING;
  SELECT "Id_Mascota" INTO mascota FROM "Mascota" WHERE "Id_User" = duena;

  INSERT INTO "Paseo" ("Id_Dueno", "Id_Mascota", "Estado", "Precio", "PrecioPactado", "DuracionMin")
  VALUES (duena, mascota, 'pendiente', 1000, 1000, 30)
  RETURNING "Id_Paseo" INTO paseo;

  -- ── #1: el margen no se acumula ────────────────────────────────────────────
  PERFORM pg_temp.como(pas_auth);
  UPDATE "Paseo" SET "Estado" = 'aceptado', "Id_Walker" = pas WHERE "Id_Paseo" = paseo;
  UPDATE "Paseo" SET "Estado" = 'en_curso', "HoraInicio" = now(), "ReanudadoEn" = now()
  WHERE "Id_Paseo" = paseo;

  -- Con el tramo abierto, los segundos no se pueden subir sin cerrarlo
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "SegundosAcumulados" = 20 WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'los segundos sólo suben al pausar o finalizar (#1)';

  -- La distancia: 400 m entra en el margen (30 s × 15 m/s = 450 m)…
  UPDATE "Paseo" SET "DistanciaMetros" = 400 WHERE "Id_Paseo" = paseo;
  -- …pero repetir el update no suma otros 450 m (antes sí: 400 + 450 = 850 pasaba)
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "DistanciaMetros" = 800 WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'la distancia no puede crecer más que el tiempo del paseo (#1)';

  -- Pausar cierra el tramo (dentro del margen)
  UPDATE "Paseo" SET "SegundosAcumulados" = 25, "ReanudadoEn" = NULL WHERE "Id_Paseo" = paseo;

  -- En pausa, nada sube
  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "SegundosAcumulados" = 50 WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'en pausa no se pueden sumar segundos (#1)';
  PERFORM pg_temp.salir();

  -- ── #15: una sola principal ────────────────────────────────────────────────
  PERFORM pg_temp.como(duena_auth);
  INSERT INTO "Mascota" ("Id_User", "Nombre", "Especie", "Estado", "EsActiva")
  VALUES (duena, 'Segunda', 'gato', 'active', FALSE)
  RETURNING "Id_Mascota" INTO segunda;

  PERFORM marcar_mascota_principal(segunda);
  ASSERT (SELECT count(*) FROM "Mascota" WHERE "Id_User" = duena AND "EsActiva") = 1,
    'tiene que quedar exactamente una principal (#15)';
  ASSERT (SELECT "EsActiva" FROM "Mascota" WHERE "Id_Mascota" = segunda),
    'la elegida tiene que quedar como principal (#15)';

  fallo := FALSE;
  BEGIN
    PERFORM marcar_mascota_principal((SELECT "Id_Mascota" FROM "Mascota" WHERE "Id_User" = pas LIMIT 1));
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'no se puede marcar como principal una mascota ajena (#15)';

  -- ── #8: límite de 10 activas ───────────────────────────────────────────────
  -- Ya tiene 2; se completan hasta 10.
  FOR i IN 3..10 LOOP
    INSERT INTO "Mascota" ("Id_User", "Nombre", "Especie", "Estado", "EsActiva")
    VALUES (duena, 'Extra ' || i, 'gato', 'active', FALSE);
  END LOOP;
  fallo := FALSE;
  BEGIN
    INSERT INTO "Mascota" ("Id_User", "Nombre", "Especie", "Estado", "EsActiva")
    VALUES (duena, 'Once', 'gato', 'active', FALSE);
  EXCEPTION WHEN OTHERS THEN fallo := TRUE;
  END;
  ASSERT fallo, 'no se puede tener una 11.ª mascota activa (#8)';

  -- Archivada sí se puede (no cuenta)
  INSERT INTO "Mascota" ("Id_User", "Nombre", "Especie", "Estado", "EsActiva")
  VALUES (duena, 'Archivada', 'gato', 'archived', FALSE);
  PERFORM pg_temp.salir();

  RAISE NOTICE '071 OK';
END $$;
