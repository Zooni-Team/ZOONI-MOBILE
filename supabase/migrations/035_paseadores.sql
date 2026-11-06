-- =============================================================================
-- Migración 035: Zooni Paseadores
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- QUÉ AGREGA:
--   1. paseador_perfil   → datos profesionales del paseador (precio, zona,
--                          disponibilidad, horarios). Una fila por usuario con
--                          rol WALKER (Id_Role = 2).
--   2. "Paseo" ampliado  → la tabla ya existía (vacía, sin uso). Ahora es el
--                          ciclo de vida completo de un paseo:
--                            pendiente → aceptado → en_curso → finalizado
--                                      ↘ rechazado / cancelado
--                          Una solicitud ES un Paseo en estado 'pendiente'.
--   3. paseo_rechazos    → una solicitud ABIERTA (sin paseador asignado) la ven
--                          todos los paseadores disponibles; si uno la rechaza
--                          se le oculta sólo a él.
--   4. paseo_mensajes    → chat paseador ↔ dueño de cada paseo.
--   5. RPCs:
--        registrar_paseador          → cuenta nueva + rol WALKER + perfil
--        activar_paseador            → una cuenta de dueño existente suma el
--                                      rol de paseador (pide la contraseña)
--        aceptar_solicitud_paseo     → toma la solicitud de forma atómica
--                                      (dos paseadores no pueden quedarse con
--                                      la misma)
--
-- Las RPCs existen porque desde la 021 el cliente (rol anon) no puede tocar
-- "UserRole" ni user_credentials: sólo funciones SECURITY DEFINER.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PERFIL DEL PASEADOR
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paseador_perfil (
  id_user            INTEGER PRIMARY KEY REFERENCES "User"("Id_User"),
  bio                VARCHAR(500),
  zona               VARCHAR(150),            -- barrio principal ("Caballito")
  zonas              TEXT[] NOT NULL DEFAULT '{}',  -- barrios extra donde trabaja
  lat                NUMERIC(10,7),
  lng                NUMERIC(10,7),
  radio_km           NUMERIC(4,1) NOT NULL DEFAULT 3,
  precio_30          NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_60          NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_perros         INTEGER NOT NULL DEFAULT 3,
  tamanos            TEXT[] NOT NULL DEFAULT '{chico,mediano,grande}',
  experiencia_anios  INTEGER NOT NULL DEFAULT 0,
  disponible         BOOLEAN NOT NULL DEFAULT FALSE,
  -- {"lun":{"activo":true,"desde":"08:00","hasta":"18:00"}, "mar":{...}, ...}
  horarios           JSONB NOT NULL DEFAULT '{}'::jsonb,
  verificado         BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paseador_precio_ok   CHECK (precio_30 >= 0 AND precio_60 >= 0),
  CONSTRAINT paseador_perros_ok   CHECK (max_perros BETWEEN 1 AND 10),
  CONSTRAINT paseador_radio_ok    CHECK (radio_km BETWEEN 0.5 AND 30),
  CONSTRAINT paseador_exp_ok      CHECK (experiencia_anios BETWEEN 0 AND 60)
);

CREATE INDEX IF NOT EXISTS idx_paseador_disponible ON paseador_perfil(disponible);
ALTER TABLE paseador_perfil DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. "Paseo": de tabla vacía a ciclo de vida completo
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Id_Dueno"          INTEGER REFERENCES "User"("Id_User");
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "FechaProgramada"   TIMESTAMPTZ;
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "DuracionMin"       INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Precio"            NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Direccion"         VARCHAR(300);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Lat"               NUMERIC(10,7);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Lng"               NUMERIC(10,7);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Notas"             VARCHAR(500);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "DistanciaMetros"   INTEGER NOT NULL DEFAULT 0;
-- Timer con pausa: segundos ya caminados + desde cuándo corre el tramo actual
-- (NULL = pausado). Tiempo total = SegundosAcumulados + (now - ReanudadoEn).
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "SegundosAcumulados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "ReanudadoEn"       TIMESTAMPTZ;
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Resena"            VARCHAR(500);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "CreadoEn"          TIMESTAMPTZ NOT NULL DEFAULT now();

-- La walker puede ser NULL: solicitud abierta a cualquier paseador de la zona.
ALTER TABLE "Paseo" ALTER COLUMN "Id_Walker" DROP NOT NULL;

-- Mismo bug que arregló la 034: TIMESTAMP sin zona corre las horas 3h.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'Paseo' AND column_name = 'HoraInicio') = 'timestamp without time zone' THEN
    ALTER TABLE "Paseo"
      ALTER COLUMN "HoraInicio" TYPE TIMESTAMPTZ USING "HoraInicio" AT TIME ZONE 'UTC',
      ALTER COLUMN "HoraFin"    TYPE TIMESTAMPTZ USING "HoraFin"    AT TIME ZONE 'UTC';
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'PaseoTrack' AND column_name = 'Timestamp') = 'timestamp without time zone' THEN
    ALTER TABLE "PaseoTrack"
      ALTER COLUMN "Timestamp" TYPE TIMESTAMPTZ USING "Timestamp" AT TIME ZONE 'UTC';
  END IF;
END $$;

ALTER TABLE "PaseoTrack" ALTER COLUMN "Timestamp" SET DEFAULT now();

-- Estados válidos. NOT VALID: no revisa filas viejas (si hubiera alguna con
-- otro texto, no rompe la migración), pero sí todo lo que se escriba de acá
-- en adelante.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Paseo' AND constraint_name = 'paseo_estado_check'
  ) THEN
    ALTER TABLE "Paseo" ADD CONSTRAINT paseo_estado_check CHECK (
      "Estado" IN ('pendiente','aceptado','en_curso','finalizado','rechazado','cancelado')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Paseo' AND constraint_name = 'paseo_rating_check'
  ) THEN
    ALTER TABLE "Paseo" ADD CONSTRAINT paseo_rating_check CHECK (
      "Rating" IS NULL OR "Rating" BETWEEN 1 AND 5
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE "Paseo" ALTER COLUMN "Estado" SET DEFAULT 'pendiente';

CREATE INDEX IF NOT EXISTS idx_paseo_walker_estado ON "Paseo"("Id_Walker", "Estado");
CREATE INDEX IF NOT EXISTS idx_paseo_estado        ON "Paseo"("Estado");
CREATE INDEX IF NOT EXISTS idx_paseotrack_paseo    ON "PaseoTrack"("Id_Paseo", "Timestamp");


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RECHAZOS DE SOLICITUDES ABIERTAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paseo_rechazos (
  id_paseo   INTEGER NOT NULL REFERENCES "Paseo"("Id_Paseo"),
  id_walker  INTEGER NOT NULL REFERENCES "User"("Id_User"),
  fecha      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_paseo, id_walker)
);
ALTER TABLE paseo_rechazos DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CHAT DEL PASEO (paseador ↔ dueño)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla propia en vez de otra columna en "Mensaje": ese chat ya tiene un CHECK
-- de "Match O servicio" (011) y un paseo no es ninguna de las dos cosas.

CREATE TABLE IF NOT EXISTS paseo_mensajes (
  id        INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  id_paseo  INTEGER NOT NULL REFERENCES "Paseo"("Id_Paseo"),
  id_user   INTEGER NOT NULL REFERENCES "User"("Id_User"),
  texto     VARCHAR(1000) NOT NULL,
  fecha     TIMESTAMPTZ NOT NULL DEFAULT now(),
  leido     BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT paseo_mensaje_no_vacio CHECK (length(trim(texto)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_paseo_mensajes ON paseo_mensajes(id_paseo, fecha);
ALTER TABLE paseo_mensajes DISABLE ROW LEVEL SECURITY;
REVOKE DELETE ON paseo_mensajes FROM anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Inserta (o actualiza) el perfil a partir del JSON que manda la app.
CREATE OR REPLACE FUNCTION _upsert_paseador_perfil(p_id INTEGER, p_perfil JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO paseador_perfil (
    id_user, bio, zona, radio_km, precio_30, precio_60,
    max_perros, tamanos, experiencia_anios, horarios
  ) VALUES (
    p_id,
    left(trim(p_perfil->>'bio'), 500),
    left(trim(p_perfil->>'zona'), 150),
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
    bio = EXCLUDED.bio, zona = EXCLUDED.zona, radio_km = EXCLUDED.radio_km,
    precio_30 = EXCLUDED.precio_30, precio_60 = EXCLUDED.precio_60,
    max_perros = EXCLUDED.max_perros, tamanos = EXCLUDED.tamanos,
    experiencia_anios = EXCLUDED.experiencia_anios, actualizado_en = now();

  INSERT INTO "UserRole" ("Id_User", "Id_Role") VALUES (p_id, 2)
  ON CONFLICT DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION _upsert_paseador_perfil(INTEGER, JSONB) FROM anon, public;


-- Cuenta NUEVA de paseador: usuario + credencial + rol WALKER + perfil, todo
-- en una transacción. No crea mascota (un paseador puede no tener).
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

  INSERT INTO "User" ("Nombre", "Apellido", "Mail", "Telefono", "Ubicacion")
  VALUES (
    left(trim(p_usuario->>'nombre'), 100),
    left(trim(p_usuario->>'apellido'), 100),
    v_mail,
    left(p_usuario->>'telefono', 30),
    left(trim(p_perfil->>'zona'), 200)
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);
  PERFORM _upsert_paseador_perfil(v_id, p_perfil);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail);
END $$;

GRANT EXECUTE ON FUNCTION registrar_paseador(JSONB, TEXT, JSONB) TO anon;


-- Cuenta EXISTENTE (dueño) que se suma como paseador. Exige mail + contraseña
-- para que nadie le active el rol a otro con sólo saber su id.
CREATE OR REPLACE FUNCTION activar_paseador(
  p_mail TEXT, p_hash TEXT, p_perfil JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INTEGER;
BEGIN
  SELECT u."Id_User" INTO v_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(u."Mail") = lower(trim(p_mail)) AND c.hash = p_hash;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'credenciales';
  END IF;

  PERFORM _upsert_paseador_perfil(v_id, p_perfil);
  RETURN jsonb_build_object('id', v_id);
END $$;

GRANT EXECUTE ON FUNCTION activar_paseador(TEXT, TEXT, JSONB) TO anon;


-- Tomar una solicitud. El UPDATE con la condición de estado es la "cerradura":
-- si dos paseadores aceptan a la vez, sólo a uno le actualiza la fila.
CREATE OR REPLACE FUNCTION aceptar_solicitud_paseo(p_id_paseo INTEGER, p_id_walker INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filas INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM paseador_perfil WHERE id_user = p_id_walker) THEN
    RAISE EXCEPTION 'no_es_paseador';
  END IF;

  UPDATE "Paseo"
  SET "Estado" = 'aceptado', "Id_Walker" = p_id_walker
  WHERE "Id_Paseo" = p_id_paseo
    AND "Estado" = 'pendiente'
    AND ("Id_Walker" IS NULL OR "Id_Walker" = p_id_walker);

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas = 1;
END $$;

GRANT EXECUTE ON FUNCTION aceptar_solicitud_paseo(INTEGER, INTEGER) TO anon;


-- =============================================================================
-- PARA PROBAR SIN LA APP DE DUEÑOS
-- =============================================================================
-- Mientras el lado dueño no tenga el botón "Pedir paseador", se puede crear una
-- solicitud abierta a mano (cambiá 1 por el Id_Mascota de alguna mascota real):
--
--   INSERT INTO "Paseo" ("Id_Mascota", "Id_Dueno", "FechaProgramada",
--                        "DuracionMin", "Precio", "Direccion", "Lat", "Lng",
--                        "Notas", "Estado")
--   SELECT m."Id_Mascota", m."Id_User", now() + interval '2 hours',
--          60, 9000, 'Av. Rivadavia 5200, Caballito', -34.6187, -58.4370,
--          'Tira un poco de la correa. Llaves con el portero.', 'pendiente'
--   FROM "Mascota" m WHERE m."Id_Mascota" = 1;
-- =============================================================================
