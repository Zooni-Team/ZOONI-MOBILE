-- =============================================================================
-- Migración 032: un mail = una cuenta (y teléfono opcional)
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- SÍNTOMA:
--   Se podían crear DOS usuarios con el mismo mail.
--
-- CAUSA:
--   El único control era el chequeo previo de la app / de la RPC
--   (SELECT ... WHERE lower(Mail) = ... antes del INSERT). Eso no alcanza:
--     · es case-sensitive según cómo se guardó el mail (Ana@x.com vs ana@x.com);
--     · entre el SELECT y el INSERT puede colarse otro registro (dos toques
--       seguidos en "Continuar" ya bastan);
--     · el UNIQUE del esquema original se perdió en las bases creadas a partir
--       de las migraciones.
--   La garantía tiene que estar en la base, no en el cliente.
--
-- Además: el teléfono es OPCIONAL en el registro. Acá se afloja cualquier
-- NOT NULL que haya quedado sobre las columnas de teléfono.
-- =============================================================================

-- ── 1. Limpiar duplicados existentes antes de crear el índice ────────────────
--    Se conserva la cuenta MÁS VIEJA de cada mail (la que tiene los datos) y a
--    las repetidas se les marca el mail para que el índice pueda crearse sin
--    borrar nada: ningún dato se pierde y quedan visibles para revisarlas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT "Id_User", "Mail"
    FROM (
      SELECT "Id_User", "Mail",
             ROW_NUMBER() OVER (PARTITION BY lower(trim("Mail")) ORDER BY "Id_User") AS n
      FROM "User"
      WHERE "Mail" IS NOT NULL
    ) t
    WHERE t.n > 1
  LOOP
    UPDATE "User"
    SET "Mail" = 'duplicado+' || r."Id_User" || '_' || r."Mail"
    WHERE "Id_User" = r."Id_User";
    RAISE NOTICE 'Mail duplicado renombrado en Id_User=%: %', r."Id_User", r."Mail";
  END LOOP;
END $$;

-- ── 2. LA garantía: índice único sobre el mail normalizado ───────────────────
--    Case-insensitive y sin espacios: ANA@x.com y  ana@x.com  son el mismo mail.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mail_unico
  ON "User" (lower(trim("Mail")));

-- ── 3. El teléfono es opcional ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'User' AND column_name = 'Telefono'
               AND is_nullable = 'NO') THEN
    ALTER TABLE "User" ALTER COLUMN "Telefono" DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'User' AND column_name = 'CodigoTelefono'
               AND is_nullable = 'NO') THEN
    ALTER TABLE "User" ALTER COLUMN "CodigoTelefono" DROP NOT NULL;
  END IF;
END $$;

-- Las columnas de teléfono existen (por si la base viene del esquema original)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Telefono" VARCHAR(30);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "CodigoTelefono" VARCHAR(10);

-- ── 4. La RPC de registro traduce el choque del índice a 'email_existente' ────
--     Sin esto, el segundo registro simultáneo devolvía un error crudo de
--     Postgres ("duplicate key value...") y la app mostraba "Error genérico".
CREATE OR REPLACE FUNCTION registrar_usuario_con_mascota(
  p_usuario JSONB, p_hash TEXT, p_mascota JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mail TEXT := lower(trim(p_usuario->>'email'));
  v_id INTEGER;
BEGIN
  IF v_mail IS NULL OR v_mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE lower(trim("Mail")) = v_mail) THEN
    RAISE EXCEPTION 'email_existente';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 32 THEN
    RAISE EXCEPTION 'hash_invalido';
  END IF;

  INSERT INTO "User" (
    "Nombre", "Apellido", "Mail", "Telefono", "CodigoTelefono",
    "Pais", "PaisCodigo", "Provincia", "Ciudad", "Ubicacion"
  ) VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    NULLIF(left(p_usuario->>'telefono', 30), ''),        -- opcional
    NULLIF(left(p_usuario->>'codigoTelefono', 10), ''),  -- opcional
    left(p_usuario->>'pais', 100),
    left(p_usuario->>'paisCodigo', 5),
    left(p_usuario->>'provincia', 100),
    left(p_usuario->>'ciudad', 100),
    left(p_usuario->>'ubicacion', 200)
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);

  INSERT INTO "Mascota" (
    "Id_User", "Nombre", "Especie", "Sexo", "Raza", "Peso",
    "FechaNacimiento", "ImagenAsset", "EsActiva"
  ) VALUES (
    v_id,
    left(trim(p_mascota->>'nombre'), 30),
    left(p_mascota->>'especie', 50),
    left(p_mascota->>'sexo', 10),
    left(p_mascota->>'raza', 100),
    NULLIF(p_mascota->>'peso', '')::NUMERIC,
    NULLIF(p_mascota->>'fechaNacimiento', '')::DATE,
    COALESCE(left(p_mascota->>'imagenAsset', 100), 'perro_default'),
    TRUE
  );

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (v_id, 1);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);

EXCEPTION
  -- Carrera perdida contra otro registro con el mismo mail: el índice único
  -- lo frena y acá se traduce al mismo error que ya entiende la app.
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%idx_user_mail_unico%' OR SQLERRM LIKE '%Mail%' THEN
      RAISE EXCEPTION 'email_existente';
    END IF;
    RAISE;
END $$;

GRANT EXECUTE ON FUNCTION registrar_usuario_con_mascota(JSONB, TEXT, JSONB) TO anon;

NOTIFY pgrst, 'reload schema';

-- ── 5. Verificación (opcional) ───────────────────────────────────────────────
--   SELECT indexname FROM pg_indexes WHERE tablename = 'User';  -- idx_user_mail_unico
--   SELECT lower(trim("Mail")), COUNT(*) FROM "User"
--     GROUP BY 1 HAVING COUNT(*) > 1;                            -- 0 filas
