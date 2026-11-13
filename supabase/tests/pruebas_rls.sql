-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_rls.sql — Pruebas de seguridad y reglas de negocio del esquema.
--
-- Las corre `node supabase/scripts/probar-esquema.mjs` contra un Postgres
-- LOCAL (nunca contra Supabase). Simula dos personas, Ana y Beto, cada una
-- con su JWT, y comprueba lo que la devolución preguntaba:
--   · ¿Puede Beto leer la ficha médica de la mascota de Ana?        → no
--   · ¿Ve Beto el mail o la ubicación exacta de Ana?                → no
--   · ¿Puede un anónimo leer mascotas?                               → no
--   · ¿Se puede mandar un pedido con un total inventado?             → se recalcula
--   · ¿Dos pedidos por el último producto?                           → uno falla
--   · ¿Dos turnos en el mismo horario?                               → uno falla
--   · ¿Un paseo con precio inventado o finalizado por el dueño?      → no
--   · ¿Dos "me gusta" cruzados?                                      → un solo Match
-- Cualquier ASSERT que falle corta la ejecución con error.

-- Helpers: "entrar" como alguien (lo que hace PostgREST con cada pedido)
CREATE OR REPLACE FUNCTION pg_temp.como(p_sub UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::TEXT, TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION pg_temp.como_anonimo() RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', TRUE);
  EXECUTE 'SET LOCAL ROLE anon';
END $$;

CREATE OR REPLACE FUNCTION pg_temp.salir() RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', TRUE);
END $$;

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  ana_auth UUID := gen_random_uuid();
  beto_auth UUID := gen_random_uuid();
  ana INTEGER; beto INTEGER;
  mascota_ana INTEGER; mascota_beto INTEGER;
  negocio INTEGER; item INTEGER; servicio_item INTEGER;
  pedido INTEGER; paseo INTEGER;
  n INTEGER; v NUMERIC; r JSONB; t TEXT;
  fallo BOOLEAN;
BEGIN
  -- ── Cuentas (como las crea la app: sesión de Auth + RPC de alta) ──────────
  INSERT INTO auth.users (id, email) VALUES
    (ana_auth, 'ana.' || sufijo || '@prueba.test'),
    (beto_auth, 'beto.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(ana_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Ana', 'apellido', 'Prueba', 'telefono', '1111'),
    jsonb_build_object('nombre', 'Toby', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 10));
  ana := (r->>'id')::INTEGER;
  ASSERT usuario_actual() = ana, 'el alta tiene que quedar vinculada a la sesión de Ana';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(beto_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Beto', 'apellido', 'Prueba'),
    jsonb_build_object('nombre', 'Mishi', 'especie', 'gato', 'sexo', 'hembra', 'raza', 'Siamés', 'peso', 4));
  beto := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();

  SELECT "Id_Mascota" INTO mascota_ana FROM "Mascota" WHERE "Id_User" = ana;
  SELECT "Id_Mascota" INTO mascota_beto FROM "Mascota" WHERE "Id_User" = beto;
  UPDATE "User" SET "Lat" = -34.6037123, "Lng" = -58.3815456, "FechaNacimiento" = '1990-05-01' WHERE "Id_User" = ana;
  INSERT INTO "MascotaVacuna" ("Id_Mascota", "NombreLibre", "FechaAplicacion") VALUES (mascota_ana, 'Antirrábica', current_date);

  -- ── Identidad y ficha médica ──────────────────────────────────────────────
  PERFORM pg_temp.como(beto_auth);
  SELECT count(*) INTO n FROM "MascotaVacuna" WHERE "Id_Mascota" = mascota_ana;
  ASSERT n = 0, 'Beto NO puede leer las vacunas de la mascota de Ana';
  fallo := FALSE;
  BEGIN
    INSERT INTO "MascotaVacuna" ("Id_Mascota", "NombreLibre") VALUES (mascota_ana, 'falsa');
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'Beto NO puede escribir en la ficha médica de Ana';

  SELECT count(*) INTO n FROM "User";
  ASSERT n = 1, '"User" devuelve sólo la fila propia';
  SELECT "Telefono", "Lat" INTO t, v FROM perfil_publico WHERE "Id_User" = ana;
  ASSERT t IS NULL, 'sin trato en común, el teléfono de Ana no se ve';
  ASSERT v = -34.60, 'la ubicación de otros se ve redondeada (~1 km)';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'perfil_publico' AND column_name IN ('Mail', 'FechaNacimiento')),
         'perfil_publico no expone mail ni fecha de nacimiento';

  UPDATE "Mascota" SET "Nombre" = 'Hackeado' WHERE "Id_Mascota" = mascota_ana;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'Beto NO puede editar la mascota de Ana';

  fallo := FALSE;
  BEGIN
    INSERT INTO "Match" ("idMascotaUno", "idMascotaDos", "idUsuarioUno", "idUsuarioDos")
    VALUES (mascota_ana, mascota_beto, ana, beto);
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'un Match no se puede crear a mano desde el cliente';
  PERFORM pg_temp.salir();

  -- ── Anónimo (sólo la clave pública del bundle) ────────────────────────────
  PERFORM pg_temp.como_anonimo();
  fallo := FALSE;
  BEGIN
    PERFORM 1 FROM "Mascota" LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'anon NO puede leer mascotas';
  PERFORM 1 FROM razas LIMIT 1;  -- catálogo: sí
  r := disponibilidad_registro('ana.' || sufijo || '@prueba.test', NULL);
  ASSERT (r->>'mailTomado')::BOOLEAN, 'disponibilidad_registro avisa que el mail está tomado';
  PERFORM pg_temp.salir();

  -- ── Match: dos "me gusta" cruzados, un solo Match ─────────────────────────
  PERFORM pg_temp.como(ana_auth);
  r := votar_mascota(mascota_ana, mascota_beto, TRUE);
  ASSERT NOT (r->>'match')::BOOLEAN, 'primer like: todavía no hay match';
  PERFORM pg_temp.salir();
  PERFORM pg_temp.como(beto_auth);
  r := votar_mascota(mascota_beto, mascota_ana, TRUE);
  ASSERT (r->>'match')::BOOLEAN, 'like recíproco: hay match';
  r := votar_mascota(mascota_beto, mascota_ana, TRUE);
  PERFORM pg_temp.salir();
  SELECT count(*) INTO n FROM "Match"
  WHERE least("idMascotaUno", "idMascotaDos") = least(mascota_ana, mascota_beto)
    AND greatest("idMascotaUno", "idMascotaDos") = greatest(mascota_ana, mascota_beto);
  ASSERT n = 1, 'votar dos veces no duplica el Match';

  -- ── Pedidos: total y stock los decide la base ─────────────────────────────
  PERFORM pg_temp.como(ana_auth);
  r := activar_negocio_sesion(jsonb_build_object(
    'tipo', 'petshop', 'nombre', 'Pet ' || sufijo, 'direccion', 'Calle 123',
    'lat', -34.6, 'lng', -58.4, 'horarios', '{}'::JSONB,
    'datos', jsonb_build_object('envios', TRUE, 'envioCosto', 500)));
  PERFORM pg_temp.salir();
  SELECT id INTO negocio FROM negocio_perfil WHERE id_user = ana AND tipo = 'petshop';
  INSERT INTO negocio_items (id_negocio, clase, nombre, precio, stock, activo)
  VALUES (negocio, 'producto', 'Alimento', 1000, 1, TRUE) RETURNING id INTO item;

  PERFORM pg_temp.como(beto_auth);
  INSERT INTO negocio_pedidos (id_negocio, id_dueno, items, subtotal, envio, total, entrega)
  VALUES (negocio, beto, jsonb_build_array(jsonb_build_object('idItem', item, 'precio', 1, 'cantidad', 1)),
          1, 0, 1, 'envio')
  RETURNING id INTO pedido;
  SELECT total INTO v FROM negocio_pedidos WHERE id = pedido;
  ASSERT v = 1500, format('el total lo calcula la base (1000 + 500 de envío), no el cliente: dio %s', v);

  fallo := FALSE;
  BEGIN
    INSERT INTO negocio_pedidos (id_negocio, id_dueno, items, subtotal, envio, total, entrega)
    VALUES (negocio, beto, jsonb_build_array(jsonb_build_object('idItem', item, 'cantidad', 1)), 0, 0, 0, 'retiro');
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'sin_stock';
  END;
  ASSERT fallo, 'el segundo pedido del último producto se rechaza (sin_stock)';

  fallo := FALSE;
  BEGIN
    UPDATE negocio_pedidos SET estado = 'entregado' WHERE id = pedido;
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'transicion_invalida';
  END;
  ASSERT fallo, 'el cliente no puede marcar su pedido como entregado';

  UPDATE negocio_pedidos SET estado = 'cancelado' WHERE id = pedido;
  PERFORM pg_temp.salir();
  SELECT stock INTO n FROM negocio_items WHERE id = item;
  ASSERT n = 1, 'al cancelar, el stock reservado vuelve';

  -- ── Turnos: sin superposición, precio del catálogo ────────────────────────
  PERFORM pg_temp.como(ana_auth);
  r := activar_negocio_sesion(jsonb_build_object(
    'tipo', 'veterinaria', 'nombre', 'Vet ' || sufijo, 'direccion', 'Calle 456',
    'lat', -34.6, 'lng', -58.4, 'horarios', '{}'::JSONB, 'datos', '{}'::JSONB));
  PERFORM pg_temp.salir();
  SELECT id INTO negocio FROM negocio_perfil WHERE id_user = ana AND tipo = 'veterinaria';
  INSERT INTO negocio_items (id_negocio, clase, nombre, precio, duracion_min, activo)
  VALUES (negocio, 'servicio', 'Consulta', 8000, 30, TRUE) RETURNING id INTO servicio_item;

  PERFORM pg_temp.como(beto_auth);
  fallo := FALSE;
  BEGIN
    INSERT INTO negocio_turnos (id_negocio, id_dueno, id_mascota, id_item, servicio, fecha, duracion_min, precio)
    VALUES (negocio, beto, mascota_beto, servicio_item, 'x', '2030-01-01 10:00-03', 30, 1);
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'precio_invalido';
  END;
  ASSERT fallo, 'un turno con precio inventado se rechaza';

  INSERT INTO negocio_turnos (id_negocio, id_dueno, id_mascota, id_item, servicio, fecha, duracion_min, precio)
  VALUES (negocio, beto, mascota_beto, servicio_item, 'x', '2030-01-01 10:00-03', 30, 8000);
  fallo := FALSE;
  BEGIN
    INSERT INTO negocio_turnos (id_negocio, id_dueno, id_mascota, id_item, servicio, fecha, duracion_min, precio)
    VALUES (negocio, beto, mascota_beto, servicio_item, 'x', '2030-01-01 10:15-03', 30, 8000);
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'horario_ocupado';
  END;
  ASSERT fallo, 'dos turnos superpuestos: el segundo se rechaza';
  PERFORM pg_temp.salir();

  -- ── Paseos: precio del perfil y transiciones por rol ──────────────────────
  INSERT INTO paseador_perfil (id_user, servicios)
  VALUES (ana, '[{"minutos": 30, "precio": 5000}]'::JSONB)
  ON CONFLICT (id_user) DO UPDATE SET servicios = EXCLUDED.servicios;

  PERFORM pg_temp.como(beto_auth);
  INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Id_Walker", "FechaProgramada", "DuracionMin", "Precio")
  VALUES (mascota_beto, beto, ana, now() + interval '1 day', 30, 1)
  RETURNING "Id_Paseo" INTO paseo;
  SELECT "Precio" INTO v FROM "Paseo" WHERE "Id_Paseo" = paseo;
  ASSERT v = 5000, 'el precio del paseo sale del perfil del paseador';

  fallo := FALSE;
  BEGIN
    UPDATE "Paseo" SET "Estado" = 'finalizado' WHERE "Id_Paseo" = paseo;
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'transicion_invalida';
  END;
  ASSERT fallo, 'el dueño no puede finalizar un paseo';
  PERFORM pg_temp.salir();

  PERFORM pg_temp.como(ana_auth);
  ASSERT aceptar_solicitud_paseo(paseo, NULL), 'el paseador acepta';
  UPDATE "Paseo" SET "Estado" = 'en_curso' WHERE "Id_Paseo" = paseo;
  UPDATE "Paseo" SET "Estado" = 'finalizado', "Precio" = 999999 WHERE "Id_Paseo" = paseo;
  SELECT "Precio" INTO v FROM "Paseo" WHERE "Id_Paseo" = paseo;
  ASSERT v = 5000, 'al finalizar se cobra lo pactado, no lo que mande el cliente';
  UPDATE "Paseo" SET "Estado" = 'finalizado', "Precio" = 1 WHERE "Id_Paseo" = paseo;
  SELECT "Precio" INTO v FROM "Paseo" WHERE "Id_Paseo" = paseo;
  ASSERT v = 5000, 'finalizar dos veces no recalcula nada';
  PERFORM pg_temp.salir();

  -- Con un paseo en común, ahora Beto sí ve el teléfono de Ana
  PERFORM pg_temp.como(beto_auth);
  SELECT "Telefono" INTO t FROM perfil_publico WHERE "Id_User" = ana;
  ASSERT t = '1111', 'con un paseo en común se ve el teléfono';
  PERFORM pg_temp.salir();

  -- ── Cuenta vieja: un signUp con su mail NO se queda con ella ──────────────
  INSERT INTO "User" ("Nombre", "Mail") VALUES ('Vieja', 'vieja.' || sufijo || '@prueba.test')
  RETURNING "Id_User" INTO n;
  INSERT INTO user_credentials (id_user, hash) VALUES (n, repeat('a', 64));
  INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'vieja.' || sufijo || '@prueba.test')
  RETURNING id INTO ana_auth;
  PERFORM pg_temp.como(ana_auth);
  fallo := FALSE;
  BEGIN
    PERFORM login_social();
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'cuenta_sin_migrar';
  END;
  ASSERT fallo, 'una sesión de contraseña no se vincula a una cuenta vieja sin migrar';
  PERFORM pg_temp.salir();

  -- ── Cambio de mail: lo confirma Auth y se copia a "User" ───────────────────
  UPDATE auth.users SET email = 'beto.nuevo.' || sufijo || '@prueba.test' WHERE id = beto_auth;
  SELECT "Mail" INTO t FROM "User" WHERE "Id_User" = beto;
  ASSERT t = 'beto.nuevo.' || sufijo || '@prueba.test', 'el mail confirmado en Auth se copia a "User"';

  RAISE NOTICE 'pruebas_rls: todo OK';
END $$;
