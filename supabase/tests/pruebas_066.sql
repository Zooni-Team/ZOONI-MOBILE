-- ⚠ NO PEGAR EN SUPABASE. Archivo de pruebas para un Postgres LOCAL (lo corre
--   supabase/scripts/probar-esquema.mjs). Crea usuarios de prueba.
-- pruebas_066.sql — Pruebas de la sección 066 (correr DESPUÉS de pruebas_rls.sql,
-- que crea los helpers pg_temp.como / pg_temp.salir).
--
--   · Pedir un paseo en el pasado, sin dirección o superpuesto: se rechaza.
--   · vencer_paseos() marca 'vencido' lo que nadie hizo a tiempo, y un
--     vencido no se puede aceptar.
--   · Cambiar el peso deja un punto en historial_peso.
--   · Un paseador no puede opinar de sí mismo.
--   · Las veterinarias de ejemplo no están activas.

DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  duena_auth UUID := gen_random_uuid();
  pas_auth UUID := gen_random_uuid();
  duena INTEGER; pas INTEGER; mascota INTEGER; paseo INTEGER;
  r JSONB; fallo BOOLEAN; n INTEGER; estado TEXT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (duena_auth, 'duena066.' || sufijo || '@prueba.test'),
    (pas_auth, 'pas066.' || sufijo || '@prueba.test');

  PERFORM pg_temp.como(duena_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Dora', 'apellido', 'Paseos'),
    jsonb_build_object('nombre', 'Volcho', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 12));
  duena := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();
  PERFORM pg_temp.como(pas_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Pablo', 'apellido', 'Paseador'),
    jsonb_build_object('nombre', 'Rex', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 20));
  pas := (r->>'id')::INTEGER;
  PERFORM pg_temp.salir();
  SELECT "Id_Mascota" INTO mascota FROM "Mascota" WHERE "Id_User" = duena;
  INSERT INTO paseador_perfil (id_user, servicios) VALUES (pas, '[{"minutos": 30, "precio": 5000}]'::JSONB)
  ON CONFLICT (id_user) DO UPDATE SET servicios = EXCLUDED.servicios;

  -- ── Alta de paseos ──────────────────────────────────────────────────────
  PERFORM pg_temp.como(duena_auth);
  fallo := FALSE;
  BEGIN
    INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Id_Walker", "FechaProgramada", "DuracionMin", "Precio", "Direccion")
    VALUES (mascota, duena, pas, now() - interval '2 days', 30, 1, 'Av. Cabildo 2250');
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'fecha_pasada';
  END;
  ASSERT fallo, 'un paseo en el pasado se rechaza';

  fallo := FALSE;
  BEGIN
    INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Id_Walker", "FechaProgramada", "DuracionMin", "Precio", "Direccion")
    VALUES (mascota, duena, pas, now() + interval '1 day', 30, 1, '77');
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'direccion_invalida';
  END;
  ASSERT fallo, 'sin una dirección de verdad se rechaza';

  INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Id_Walker", "FechaProgramada", "DuracionMin", "Precio", "Direccion")
  VALUES (mascota, duena, pas, date_trunc('hour', now()) + interval '2 days', 30, 1, 'Av. Cabildo 2250')
  RETURNING "Id_Paseo" INTO paseo;
  fallo := FALSE;
  BEGIN
    INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "Id_Walker", "FechaProgramada", "DuracionMin", "Precio", "Direccion")
    VALUES (mascota, duena, pas, date_trunc('hour', now()) + interval '2 days 15 minutes', 30, 1, 'Av. Cabildo 2250');
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'paseo_superpuesto';
  END;
  ASSERT fallo, 'la misma mascota no puede tener dos paseos que se pisan';
  PERFORM pg_temp.salir();

  -- ── Vencidos ───────────────────────────────────────────────────────────
  -- (como superusuario: simula un pedido viejo que nadie tomó)
  UPDATE "Paseo" SET "FechaProgramada" = now() - interval '10 days' WHERE "Id_Paseo" = paseo;
  PERFORM pg_temp.como(pas_auth);
  fallo := FALSE;
  BEGIN
    PERFORM aceptar_solicitud_paseo(paseo, NULL);
  EXCEPTION WHEN raise_exception THEN fallo := SQLERRM = 'paseo_vencido';
  END;
  ASSERT fallo, 'un paseo vencido no se acepta';
  n := vencer_paseos();   -- cualquiera con sesión la puede llamar
  PERFORM pg_temp.salir();
  ASSERT n >= 1, 'vencer_paseos vence el pedido viejo';
  SELECT "Estado" INTO estado FROM "Paseo" WHERE "Id_Paseo" = paseo;
  ASSERT estado = 'vencido', 'el pedido viejo queda vencido';

  -- ── Peso ───────────────────────────────────────────────────────────────
  PERFORM pg_temp.como(duena_auth);
  UPDATE "Mascota" SET "Peso" = 12.5 WHERE "Id_Mascota" = mascota;
  PERFORM pg_temp.salir();
  ASSERT (SELECT peso_kg FROM historial_peso WHERE mascota_id = mascota ORDER BY fecha DESC, id DESC LIMIT 1) = 12.5,
         'cambiar el peso deja el punto en el historial';

  -- ── Opinar de uno mismo ────────────────────────────────────────────────
  PERFORM pg_temp.como(pas_auth);
  fallo := FALSE;
  BEGIN
    INSERT INTO paseador_opiniones (id_walker, id_autor, rating) VALUES (pas, pas, 5);
  EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE;
  END;
  ASSERT fallo, 'un paseador no opina de sí mismo';
  PERFORM pg_temp.salir();

  -- ── SOS ────────────────────────────────────────────────────────────────
  ASSERT NOT EXISTS (SELECT 1 FROM veterinary_clinics WHERE is_active AND phone = '011-15-6044-2211'),
         'las veterinarias inventadas no se muestran';

  RAISE NOTICE 'pruebas_066: OK';
END $$;
