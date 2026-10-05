-- =============================================================================
-- Migración 039: género y fecha de nacimiento en el alta de paseador
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035 (y la 010, que creó "User"."Genero" / "FechaNacimiento").
-- =============================================================================
-- El registro de paseador nuevo ahora pide género (masculino / femenino /
-- prefiero no decir) y la fecha de nacimiento. Se guarda la FECHA y no la edad
-- (como en mascotas): la edad se calcula sola y no queda vieja.
--
-- Van a las mismas columnas de "User" que usa Match, así no hay dos géneros
-- distintos para la misma persona. registrar_paseador las valida en el
-- servidor: género dentro de la lista y mayor de 18 años.
--
-- Si esta migración no se corrió, el registro igual funciona (la RPC vieja
-- ignora las claves nuevas del JSON), pero género y nacimiento no se guardan.
-- =============================================================================

CREATE OR REPLACE FUNCTION registrar_paseador(
  p_usuario JSONB, p_hash TEXT, p_perfil JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mail TEXT := lower(trim(p_usuario->>'email'));
  v_genero TEXT := NULLIF(trim(p_usuario->>'genero'), '');
  v_nacimiento DATE := NULLIF(p_usuario->>'fechaNacimiento', '')::DATE;
  v_id INTEGER;
BEGIN
  IF v_mail IS NULL OR v_mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE lower("Mail") = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 32 THEN
    RAISE EXCEPTION 'hash_invalido';
  END IF;
  IF v_genero IS NULL OR v_genero NOT IN ('masculino', 'femenino', 'prefiero_no_decir') THEN
    RAISE EXCEPTION 'genero_invalido';
  END IF;
  IF v_nacimiento IS NULL
     OR v_nacimiento > (current_date - INTERVAL '18 years')
     OR v_nacimiento < (current_date - INTERVAL '100 years') THEN
    RAISE EXCEPTION 'edad_invalida';
  END IF;

  INSERT INTO "User" ("Nombre", "Apellido", "Mail", "Telefono", "Ubicacion", "Genero", "FechaNacimiento")
  VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    left(p_usuario->>'telefono', 30),
    left(trim(p_perfil->>'zona'), 200),
    v_genero,
    v_nacimiento
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);
  PERFORM _upsert_paseador_perfil(v_id, p_perfil);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);
END $$;

GRANT EXECUTE ON FUNCTION registrar_paseador(JSONB, TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT "Id_User", "Genero", "FechaNacimiento" FROM "User"
--   WHERE "Id_User" IN (SELECT id_user FROM paseador_perfil) ORDER BY 1 DESC LIMIT 5;
