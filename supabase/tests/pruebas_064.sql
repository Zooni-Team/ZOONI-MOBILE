-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_064.sql — Pruebas de la sección 064 (correr DESPUÉS de pruebas_rls.sql,
-- que crea los helpers pg_temp.como / pg_temp.salir).
--
--   · Purgar una mascota eliminada: se lleva su salud, votos, matches (y sus
--     mensajes) y fotos; el paseo queda (con la mascota en NULL) y su chat también.
--   · Una mascota sin vencer NO se purga.
--   · Cupo de ZooniVet: al llegar al límite devuelve FALSE y no sigue sumando.
--   · Bucket privado: nadie lee ni sube en la carpeta de otro.
-- Cualquier ASSERT que falle corta la ejecución con error.

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  ana_auth UUID := gen_random_uuid();
  beto_auth UUID := gen_random_uuid();
  ana INTEGER; beto INTEGER;
  mascota_ana INTEGER; mascota_beto INTEGER; mascota_viva INTEGER;
  match_id INTEGER; paseo INTEGER;
  n INTEGER; r JSONB; fallo BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (ana_auth, 'ana064.' || sufijo || '@prueba.test'),
    (beto_auth, 'beto064.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(ana_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Ana', 'apellido', 'Purga'),
    jsonb_build_object('nombre', 'Firulais', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 10));
  ana := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Beto', 'apellido', 'Purga'),
    jsonb_build_object('nombre', 'Luna', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 8));
  beto := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  SELECT "Id_Mascota" INTO mascota_ana FROM "Mascota" WHERE "Id_User" = ana;
  SELECT "Id_Mascota" INTO mascota_beto FROM "Mascota" WHERE "Id_User" = beto;
  INSERT INTO "Mascota" ("Id_User", "Nombre", "Estado") VALUES (ana, 'Viva', 'active')
  RETURNING "Id_Mascota" INTO mascota_viva;

  -- Todo lo que cuelga de la mascota de Ana
  INSERT INTO "MascotaVacuna" ("Id_Mascota", "NombreLibre") VALUES (mascota_ana, 'Antirrábica');
  INSERT INTO "Tratamiento" ("Id_Mascota", "Nombre") VALUES (mascota_ana, 'Antiparasitario');
  INSERT INTO "HistorialEvento" ("Id_Mascota", "Tipo") VALUES (mascota_ana, 'control');
  INSERT INTO historial_peso (mascota_id, peso_kg) VALUES (mascota_ana, 10);
  INSERT INTO mascota_fotos (id_mascota, url) VALUES (mascota_ana, 'https://x/y.jpg');
  INSERT INTO mascota_estado_historial (id_mascota, desde, hasta) VALUES (mascota_ana, 'active', 'deleted');

  PERFORM pg_temp.como(ana_auth);
  PERFORM votar_mascota(mascota_ana, mascota_beto, TRUE);
  PERFORM pg_temp.salir();
  PERFORM pg_temp.como(beto_auth);
  PERFORM votar_mascota(mascota_beto, mascota_ana, TRUE);
  PERFORM pg_temp.salir();
  SELECT id INTO match_id FROM "Match"
  WHERE mascota_ana IN ("idMascotaUno", "idMascotaDos") AND mascota_beto IN ("idMascotaUno", "idMascotaDos");
  ASSERT match_id IS NOT NULL, 'el like cruzado crea el Match';
  INSERT INTO "Mensaje" ("idMatch", "idUsuario", texto) VALUES (match_id, beto, 'hola');

  -- Un paseo de la mascota de Ana (como superusuario: sin reglas de rol)
  INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Precio", "DuracionMin")
  VALUES (mascota_ana, ana, 5000, 30) RETURNING "Id_Paseo" INTO paseo;
  INSERT INTO paseo_mensajes (id_paseo, id_user, texto) VALUES (paseo, ana, 'llego en 5');

  -- ── Purga ────────────────────────────────────────────────────────────────
  UPDATE "Mascota" SET "Estado" = 'deleted', "PurgarDespues" = now() - interval '1 day'
  WHERE "Id_Mascota" = mascota_ana;
  UPDATE "Mascota" SET "Estado" = 'deleted', "PurgarDespues" = now() + interval '10 days'
  WHERE "Id_Mascota" = mascota_viva;

  n := purgar_mascotas_eliminadas();
  ASSERT n >= 1, 'purgar_mascotas_eliminadas borra la vencida';
  ASSERT NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = mascota_ana), 'la mascota vencida no existe más';
  ASSERT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = mascota_viva), 'la que no venció NO se purga';
  ASSERT NOT EXISTS (SELECT 1 FROM "MascotaVacuna" WHERE "Id_Mascota" = mascota_ana), 'vacunas: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM "Tratamiento" WHERE "Id_Mascota" = mascota_ana), 'tratamientos: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM "HistorialEvento" WHERE "Id_Mascota" = mascota_ana), 'historial: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM historial_peso WHERE mascota_id = mascota_ana), 'peso: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_fotos WHERE id_mascota = mascota_ana), 'fotos: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_estado_historial WHERE id_mascota = mascota_ana), 'estados: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM "Voto" WHERE mascota_ana IN ("idMascotaOrigen", "idMascotaDestino")), 'votos: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM "Match" WHERE id = match_id), 'match: cascada';
  ASSERT NOT EXISTS (SELECT 1 FROM "Mensaje" WHERE "idMatch" = match_id), 'mensajes del match: cascada';
  ASSERT EXISTS (SELECT 1 FROM "Paseo" WHERE "Id_Paseo" = paseo AND "Id_Mascota" IS NULL),
         'el paseo queda (lo cobrado no se pierde) con la mascota en NULL';
  ASSERT EXISTS (SELECT 1 FROM paseo_mensajes WHERE id_paseo = paseo), 'el chat del paseo queda';

  -- El trigger NO deja poner la mascota en NULL a mano si la mascota existe
  INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Precio", "DuracionMin")
  VALUES (mascota_beto, beto, 5000, 30) RETURNING "Id_Paseo" INTO paseo;
  PERFORM pg_temp.como(beto_auth);
  UPDATE "Paseo" SET "Id_Mascota" = NULL WHERE "Id_Paseo" = paseo;
  PERFORM pg_temp.salir();
  ASSERT (SELECT "Id_Mascota" FROM "Paseo" WHERE "Id_Paseo" = paseo) = mascota_beto,
         'la mascota de un paseo no se puede borrar a mano';

  -- Nadie con sesión puede llamar a la purga
  PERFORM pg_temp.como(beto_auth);
  fallo := FALSE;
  BEGIN
    PERFORM purgar_mascotas_eliminadas();
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'la purga es sólo para service_role';
  PERFORM pg_temp.salir();

  -- ── Cupo de ZooniVet ─────────────────────────────────────────────────────
  ASSERT zoonivet_consumir_cupo(beto, 2), 'mensaje 1 de 2';
  ASSERT zoonivet_consumir_cupo(beto, 2), 'mensaje 2 de 2';
  ASSERT NOT zoonivet_consumir_cupo(beto, 2), 'el 3ro se rechaza';
  ASSERT NOT zoonivet_consumir_cupo(beto, 2), 'y el 4to también';
  SELECT cantidad INTO n FROM zoonivet_uso WHERE id_user = beto;
  ASSERT n = 2, 'los rechazados no suman';

  PERFORM pg_temp.como(beto_auth);
  fallo := FALSE;
  BEGIN
    PERFORM zoonivet_consumir_cupo(beto, 1000);
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'un usuario no puede tocar su propio cupo';
  PERFORM pg_temp.salir();

  -- ── Bucket privado de consultas ─────────────────────────────────────────
  ASSERT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'consultas-privadas' AND NOT public),
         'el bucket de consultas es privado';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('consultas-privadas', ana_auth || '/consultas/estudio.jpg');

  PERFORM pg_temp.como(beto_auth);
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'consultas-privadas';
  ASSERT n = 0, 'Beto NO ve los estudios de Ana';
  fallo := FALSE;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('consultas-privadas', ana_auth || '/consultas/falso.jpg');
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'Beto NO sube a la carpeta de Ana';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('consultas-privadas', beto_auth || '/consultas/mio.jpg');
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(ana_auth);
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'consultas-privadas';
  ASSERT n = 1, 'Ana ve sólo lo suyo';
  PERFORM pg_temp.salir();

  RAISE NOTICE 'pruebas_064: OK';
END $$;
