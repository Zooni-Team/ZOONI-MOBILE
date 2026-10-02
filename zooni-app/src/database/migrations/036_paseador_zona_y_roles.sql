-- =============================================================================
-- Migración 036: zona de atención en el mapa + cuentas con rol sin perfil
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035.
-- =============================================================================
-- 1. El registro de paseador ahora elige su zona arrastrando un círculo en el
--    mapa: _upsert_paseador_perfil guarda también lat / lng (las columnas ya
--    existían en paseador_perfil desde la 035, pero no se llenaban).
--
-- 2. completar_perfil_paseador: una cuenta que YA tiene el rol WALKER
--    (UserRole 2, por ejemplo asignado a mano en la base) pero no tiene fila en
--    paseador_perfil, caía en "Esta cuenta no tiene perfil de paseador". Ahora
--    la app le pide completar el perfil y esta RPC lo guarda — sin pedir
--    contraseña, porque sólo funciona si el servidor confirma que el rol existe.
-- =============================================================================

CREATE OR REPLACE FUNCTION _upsert_paseador_perfil(p_id INTEGER, p_perfil JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO paseador_perfil (
    id_user, bio, zona, lat, lng, radio_km, precio_30, precio_60,
    max_perros, tamanos, experiencia_anios, horarios
  ) VALUES (
    p_id,
    left(trim(p_perfil->>'bio'), 500),
    left(trim(p_perfil->>'zona'), 150),
    NULLIF(p_perfil->>'lat', '')::NUMERIC,
    NULLIF(p_perfil->>'lng', '')::NUMERIC,
    COALESCE(NULLIF(p_perfil->>'radioKm', '')::NUMERIC, 3),
    COALESCE(NULLIF(p_perfil->>'precio30', '')::NUMERIC, 0),
    COALESCE(NULLIF(p_perfil->>'precio60', '')::NUMERIC, 0),
    COALESCE(NULLIF(p_perfil->>'maxPerros', '')::INTEGER, 3),
    COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_perfil->'tamanos') x),
      '{chico,mediano,grande}'
    ),
    COALESCE(NULLIF(p_perfil->>'experienciaAnios', '')::INTEGER, 0),
    COALESCE(p_perfil->'horarios', '{}'::jsonb)
  )
  ON CONFLICT (id_user) DO UPDATE SET
    bio = EXCLUDED.bio, zona = EXCLUDED.zona, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    radio_km = EXCLUDED.radio_km, precio_30 = EXCLUDED.precio_30, precio_60 = EXCLUDED.precio_60,
    max_perros = EXCLUDED.max_perros, tamanos = EXCLUDED.tamanos,
    experiencia_anios = EXCLUDED.experiencia_anios, actualizado_en = now();

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (p_id, 2)
  ON CONFLICT DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION _upsert_paseador_perfil(INTEGER, JSONB) FROM anon, public;


CREATE OR REPLACE FUNCTION completar_perfil_paseador(p_id_user INTEGER, p_perfil JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "UserRole" WHERE "Id_User" = p_id_user AND "Id_Role" = 2
  ) THEN
    RAISE EXCEPTION 'no_es_paseador';
  END IF;

  PERFORM _upsert_paseador_perfil(p_id_user, p_perfil);
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION completar_perfil_paseador(INTEGER, JSONB) TO anon;
