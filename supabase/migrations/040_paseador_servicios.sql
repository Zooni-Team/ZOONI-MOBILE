-- =============================================================================
-- Migración 040: tiempos de paseo configurables por el paseador
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035 y la 036.
-- =============================================================================
-- Antes cada paseador tenía sí o sí un paseo de 30 y uno de 60 minutos
-- (precio_30 / precio_60). Ahora arma su propia lista de "servicios": cuántos
-- minutos dura cada paseo y cuánto cobra, por ejemplo
--   [{"minutos": 20, "precio": 4000}, {"minutos": 45, "precio": 7500}]
-- (de 1 a 4 paseos, entre 10 y 240 minutos cada uno).
--
-- · Columna nueva paseador_perfil.servicios (JSONB).
-- · Los paseadores que ya existían pasan sus precios de 30 y 60 a la lista.
-- · _upsert_paseador_perfil (registro / activar / completar) guarda la lista.
-- · precio_30 / precio_60 quedan sin uso (no se borran para no romper nada
--   que todavía los lea).
--
-- Sin esta migración el registro de un paseador nuevo guarda el perfil SIN
-- precios y los dueños no van a poder contratarlo.
-- =============================================================================

ALTER TABLE paseador_perfil ADD COLUMN IF NOT EXISTS servicios JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'paseador_perfil' AND constraint_name = 'paseador_servicios_ok'
  ) THEN
    ALTER TABLE paseador_perfil ADD CONSTRAINT paseador_servicios_ok
      CHECK (jsonb_typeof(servicios) = 'array' AND jsonb_array_length(servicios) <= 4);
  END IF;
END $$;

-- Perfiles viejos: 30 y 60 minutos con los precios que ya tenían
UPDATE paseador_perfil
SET servicios = (
  SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'minutos')::INT), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object('minutos', 30, 'precio', precio_30) AS s WHERE precio_30 > 0
    UNION ALL
    SELECT jsonb_build_object('minutos', 60, 'precio', precio_60) WHERE precio_60 > 0
  ) x
)
WHERE servicios = '[]'::jsonb AND (precio_30 > 0 OR precio_60 > 0);


-- Sólo se guardan los servicios válidos: minutos 10–240, precio > 0, sin
-- minutos repetidos, máximo 4, ordenados de menor a mayor duración.
CREATE OR REPLACE FUNCTION _servicios_validos(p JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('minutos', minutos, 'precio', precio) ORDER BY minutos), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (minutos) minutos, precio
    FROM (
      SELECT (e->>'minutos')::INT AS minutos, (e->>'precio')::NUMERIC(10,2) AS precio
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END) e
      WHERE (e->>'minutos') ~ '^\d+$' AND (e->>'precio') ~ '^\d+(\.\d+)?$'
    ) x
    WHERE minutos BETWEEN 10 AND 240 AND precio > 0
    ORDER BY minutos
    LIMIT 4
  ) y
$$;


CREATE OR REPLACE FUNCTION _upsert_paseador_perfil(p_id INTEGER, p_perfil JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servicios JSONB := _servicios_validos(p_perfil->'servicios');
BEGIN
  IF jsonb_array_length(v_servicios) = 0 THEN
    RAISE EXCEPTION 'servicios_invalidos';
  END IF;

  INSERT INTO paseador_perfil (
    id_user, bio, zona, lat, lng, radio_km, servicios,
    max_perros, tamanos, experiencia_anios, horarios
  ) VALUES (
    p_id,
    left(trim(p_perfil->>'bio'), 500),
    left(trim(p_perfil->>'zona'), 150),
    NULLIF(p_perfil->>'lat', '')::NUMERIC,
    NULLIF(p_perfil->>'lng', '')::NUMERIC,
    COALESCE(NULLIF(p_perfil->>'radioKm', '')::NUMERIC, 3),
    v_servicios,
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
    radio_km = EXCLUDED.radio_km, servicios = EXCLUDED.servicios,
    max_perros = EXCLUDED.max_perros, tamanos = EXCLUDED.tamanos,
    experiencia_anios = EXCLUDED.experiencia_anios, actualizado_en = now();

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (p_id, 2)
  ON CONFLICT DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION _upsert_paseador_perfil(INTEGER, JSONB) FROM anon, public;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT id_user, servicios, precio_30, precio_60 FROM paseador_perfil;
