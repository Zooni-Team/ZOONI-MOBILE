DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  mail_ana TEXT := 'ana072.' || sufijo || '@prueba.test';
  ana_auth UUID := gen_random_uuid();
  beto_auth UUID := gen_random_uuid();
  nueva_auth UUID := gen_random_uuid();
  ana INTEGER; beto INTEGER; r JSONB;
  mascota_ana INTEGER; paseo INTEGER;
  fecha1 TIMESTAMPTZ; fecha2 TIMESTAMPTZ;
  fallo BOOLEAN; n INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ana_auth, mail_ana);
  INSERT INTO auth.users (id, email) VALUES (beto_auth, 'beto072.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(ana_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Ana', 'apellido', 'Baja'),
    jsonb_build_object('nombre', 'Toby', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 9));
  ana := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Beto', 'apellido', 'Paseador'),
    jsonb_build_object('nombre', 'Luna', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 7));
  beto := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  SELECT "Id_Mascota" INTO mascota_ana FROM "Mascota" WHERE "Id_User" = ana;

  INSERT INTO "Paseo" ("Id_Dueno", "Id_Mascota", "Estado", "Precio", "PrecioPactado", "DuracionMin")
  VALUES (ana, mascota_ana, 'pendiente', 1000, 1000, 30)
  RETURNING "Id_Paseo" INTO paseo;
  UPDATE "Paseo" SET "Estado" = 'aceptado', "Id_Walker" = beto WHERE "Id_Paseo" = paseo;

  INSERT INTO storage.buckets (id, name, public) VALUES ('public-images', 'public-images', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('public-images', ana_auth || '/perfiles/foto.jpg');

  PERFORM pg_temp.como(ana_auth);
  fallo := FALSE;
  BEGIN
    INSERT INTO deletion_requests (user_id, scheduled_for) VALUES (ana, now());
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'deletion_requests no se escribe desde la app: se saltearían los 30 días (#22)';

  fecha1 := solicitar_eliminacion_cuenta('privacidad', 'prueba');
  ASSERT fecha1 > now() + interval '29 days', 'la baja vence a los 30 días';
  fecha2 := solicitar_eliminacion_cuenta('otro', NULL);
  ASSERT fecha2 = fecha1, 'pedirla otra vez no corre el plazo';
  ASSERT (SELECT count(*) FROM deletion_requests WHERE user_id = ana) = 1,
    'Ana ve su propio pedido (y hay uno solo)';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  ASSERT NOT EXISTS (SELECT 1 FROM perfil_publico WHERE "Id_User" = ana),
    'el perfil de una cuenta dada de baja no se ve';
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_publica WHERE "Id_User" = ana),
    'las mascotas de una cuenta dada de baja no se ven';
  ASSERT EXISTS (SELECT 1 FROM perfil_publico WHERE "Id_User" = beto),
    'las demás cuentas se siguen viendo';
  ASSERT (SELECT count(*) FROM deletion_requests) = 0, 'Beto no ve pedidos ajenos';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(ana_auth);
  r := login_social();
  ASSERT (r->>'bajaCancelada')::BOOLEAN, 'entrar cancela la baja y lo avisa';
  r := login_social();
  ASSERT NOT (r->>'bajaCancelada')::BOOLEAN, 'la segunda vez no hay nada que cancelar';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  ASSERT EXISTS (SELECT 1 FROM perfil_publico WHERE "Id_User" = ana),
    'después de arrepentirse, el perfil vuelve a verse';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(ana_auth);
  PERFORM solicitar_eliminacion_cuenta(NULL, NULL);
  PERFORM pg_temp.salir();

  ASSERT purgar_cuentas_eliminadas() = 0, 'una baja que no venció no se purga';
  ASSERT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = mascota_ana);

  UPDATE deletion_requests SET scheduled_for = now() - interval '1 second'
  WHERE user_id = ana AND cancelled_at IS NULL;
  n := purgar_cuentas_eliminadas();
  ASSERT n = 1, format('la baja vencida se purga (purgó %s)', n);

  ASSERT NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_User" = ana), 'sus mascotas se borran';
  ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ana_auth), 'su usuario de Auth se borra';
  ASSERT (SELECT "Mail" FROM "User" WHERE "Id_User" = ana) = format('eliminada-%s@zooni.invalid', ana),
    'la fila de User queda anonimizada';
  ASSERT (SELECT "Nombre" || ' ' || "Apellido" FROM "User" WHERE "Id_User" = ana) = 'Cuenta eliminada';
  ASSERT (SELECT "Id_Dueno" FROM "Paseo" WHERE "Id_Paseo" = paseo) = ana,
    'el paseo (que también es de Beto) se conserva';
  ASSERT (SELECT completed_at IS NOT NULL FROM deletion_requests WHERE user_id = ana AND cancelled_at IS NULL),
    'el pedido queda completado';
  ASSERT EXISTS (SELECT 1 FROM archivos_por_borrar
                 WHERE bucket = 'public-images' AND ruta = ana_auth || '/perfiles/foto.jpg'),
    'lo que subió queda anotado para limpiar-storage';
  ASSERT purgar_cuentas_eliminadas() = 0, 'purgar otra vez no hace nada';

  PERFORM pg_temp.como(beto_auth);
  ASSERT NOT EXISTS (SELECT 1 FROM perfil_publico WHERE "Id_User" = ana),
    'la cuenta purgada no se ve nunca más';
  PERFORM pg_temp.salir();

  INSERT INTO auth.users (id, email) VALUES (nueva_auth, mail_ana);
  PERFORM pg_temp.como(nueva_auth);
  r := login_social();
  ASSERT (r->>'nuevo')::BOOLEAN, 'el mail de una cuenta purgada se puede volver a registrar';
  PERFORM pg_temp.salir();

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')),
    'ninguna función de public sin search_path (#100)';

  RAISE NOTICE 'pruebas_072 OK';
END $$;

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  mail_corta TEXT := 'corta072.' || sufijo || '@prueba.test';
  mail_larga TEXT := 'larga072.' || sufijo || '@prueba.test';
  u_corta INTEGER; u_larga INTEGER; a_corta UUID; r JSONB;
BEGIN
  INSERT INTO "User" ("Nombre", "Apellido", "Mail") VALUES ('Corta', 'Vieja', mail_corta) RETURNING "Id_User" INTO u_corta;
  INSERT INTO user_credentials (id_user, hash) VALUES (u_corta, encode(sha256(convert_to('1234', 'UTF8')), 'hex'));
  INSERT INTO "User" ("Nombre", "Apellido", "Mail") VALUES ('Larga', 'Vieja', mail_larga) RETURNING "Id_User" INTO u_larga;
  INSERT INTO user_credentials (id_user, hash) VALUES (u_larga, encode(sha256(convert_to('clave-larga-ok', 'UTF8')), 'hex'));

  PERFORM pg_temp.como_anonimo();
  ASSERT migrar_cuenta_legada(mail_corta, '1234'), 'la cuenta con contraseña corta migra igual';
  ASSERT migrar_cuenta_legada(mail_larga, 'clave-larga-ok');
  PERFORM pg_temp.salir();

  ASSERT (SELECT "DebeCambiarContrasena" FROM "User" WHERE "Id_User" = u_corta),
    'contraseña de menos de 8: queda marcada (#90)';
  ASSERT NOT (SELECT "DebeCambiarContrasena" FROM "User" WHERE "Id_User" = u_larga),
    'contraseña que cumple: sin marca';

  SELECT auth_id INTO a_corta FROM "User" WHERE "Id_User" = u_corta;
  PERFORM pg_temp.como(a_corta);
  r := login_social();
  ASSERT (r->>'debeCambiarContrasena')::BOOLEAN, 'login_social lo avisa en cada login';
  r := login_social();
  ASSERT (r->>'debeCambiarContrasena')::BOOLEAN, 'y lo sigue avisando (no es de una sola vez)';
  UPDATE "User" SET "DebeCambiarContrasena" = FALSE WHERE "Id_User" = u_corta;
  r := login_social();
  ASSERT NOT (r->>'debeCambiarContrasena')::BOOLEAN, 'cambiada la contraseña, deja de pedirse';
  PERFORM pg_temp.salir();

  RAISE NOTICE 'pruebas_072 (#90) OK';
END $$;

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  duena_auth UUID := gen_random_uuid();
  pas_auth UUID := gen_random_uuid();
  neg_auth UUID := gen_random_uuid();
  otro_auth UUID := gen_random_uuid();
  duena INTEGER; pas INTEGER; neg INTEGER; r JSONB;
  mascota INTEGER; paseo INTEGER; negocio INTEGER; item INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (duena_auth, 'due072b.' || sufijo || '@prueba.test'),
    (pas_auth,   'pas072b.' || sufijo || '@prueba.test'),
    (neg_auth,   'neg072b.' || sufijo || '@prueba.test'),
    (otro_auth,  'otr072b.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(duena_auth);
  r := registrar_social_con_mascota(jsonb_build_object('nombre', 'Dina', 'apellido', 'Dueña'),
    jsonb_build_object('nombre', 'Rex', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 12));
  duena := (r->>'id')::INTEGER;
  PERFORM pg_temp.como(pas_auth);
  r := registrar_social_con_mascota(jsonb_build_object('nombre', 'Pepe', 'apellido', 'Paseador'),
    jsonb_build_object('nombre', 'Kira', 'especie', 'perro', 'sexo', 'hembra', 'raza', 'Mestizo', 'peso', 5));
  pas := (r->>'id')::INTEGER;
  PERFORM pg_temp.como(neg_auth);
  r := registrar_social_con_mascota(jsonb_build_object('nombre', 'Nora', 'apellido', 'Vete'),
    jsonb_build_object('nombre', 'Mishi', 'especie', 'gato', 'sexo', 'hembra', 'raza', 'Común', 'peso', 4));
  neg := (r->>'id')::INTEGER;
  PERFORM pg_temp.como(otro_auth);
  PERFORM registrar_social_con_mascota(jsonb_build_object('nombre', 'Sol', 'apellido', 'Ajena'),
    jsonb_build_object('nombre', 'Bobi', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 8));
  PERFORM pg_temp.salir();

  SELECT "Id_Mascota" INTO mascota FROM "Mascota" WHERE "Id_User" = duena;

  PERFORM pg_temp.como(pas_auth);
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_de_cliente WHERE "Id_Mascota" = mascota),
    'sin paseo, el paseador no ve el peso';
  PERFORM pg_temp.salir();

  INSERT INTO "Paseo" ("Id_Dueno", "Id_Mascota", "Estado", "Precio", "PrecioPactado", "DuracionMin")
  VALUES (duena, mascota, 'pendiente', 1000, 1000, 30) RETURNING "Id_Paseo" INTO paseo;
  UPDATE "Paseo" SET "Estado" = 'aceptado', "Id_Walker" = pas WHERE "Id_Paseo" = paseo;

  INSERT INTO negocio_perfil (id_user, tipo, nombre, direccion, lat, lng)
  VALUES (neg, 'veterinaria', 'Vete Nora', 'Calle 1', -34.6, -58.4) RETURNING id INTO negocio;
  INSERT INTO negocio_items (id_negocio, clase, nombre, precio)
  VALUES (negocio, 'servicio', 'Consulta', 5000) RETURNING id INTO item;
  PERFORM pg_temp.como(duena_auth);
  INSERT INTO negocio_turnos (id_negocio, id_dueno, id_mascota, id_item, servicio, fecha, precio)
  VALUES (negocio, duena, mascota, item, 'Consulta', now() + interval '1 day', 5000);
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(pas_auth);
  ASSERT (SELECT "Peso" FROM mascota_de_cliente WHERE "Id_Mascota" = mascota) = 12,
    'el paseador del paseo aceptado ve el peso';
  PERFORM pg_temp.como(neg_auth);
  ASSERT (SELECT "Peso" FROM mascota_de_cliente WHERE "Id_Mascota" = mascota) = 12,
    'la veterinaria con turno ve el peso';
  PERFORM pg_temp.como(otro_auth);
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_de_cliente), 'alguien sin trato no ve nada';
  PERFORM pg_temp.salir();

  UPDATE "Paseo" SET "Estado" = 'cancelado' WHERE "Id_Paseo" = paseo;
  PERFORM pg_temp.como(pas_auth);
  ASSERT NOT EXISTS (SELECT 1 FROM mascota_de_cliente WHERE "Id_Mascota" = mascota),
    'terminado el trato, el paseador deja de verlo';
  PERFORM pg_temp.salir();

  RAISE NOTICE 'pruebas_072 (mascota_de_cliente) OK';
END $$;
