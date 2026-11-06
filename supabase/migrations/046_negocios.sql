-- =============================================================================
-- Migración 046: Zooni Negocios — veterinarias, peluquerías y pet shops
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 011 (chat con servicios), la 021 (user_credentials) y la 035.
-- =============================================================================
-- Hasta ahora sólo los paseadores podían registrarse como proveedores; las
-- veterinarias, peluquerías y pet shops de Comunidad eran filas cargadas a mano
-- en "servicios", sin cuenta: nadie leía sus mensajes. Con esta migración cada
-- negocio tiene su cuenta y su app:
--
--   negocio_perfil   un negocio por cuenta y tipo (una persona puede tener una
--                    veterinaria Y un pet shop). `datos` guarda lo propio de
--                    cada tipo (matrícula, envíos, tamaños, galería…).
--   servicios        el pin del negocio en el mapa de Comunidad; ahora apunta a
--                    su negocio (id_negocio) y se mantiene sincronizado.
--   negocio_items    lo que ofrece: servicios con precio (veterinaria,
--                    peluquería — con precio por tamaño) o productos con stock
--                    (pet shop).
--   negocio_turnos   turnos que piden los dueños (veterinaria / peluquería);
--                    `informe` es la consulta (diagnóstico, tratamiento…) o la
--                    nota del trabajo de peluquería.
--   negocio_pedidos  pedidos al pet shop (retiro o envío).
--   "Mensaje"        "deNegocio" = la respuesta la escribió el negocio. El hilo
--                    sigue identificado por (idServicio, idUsuario = el dueño).
--
-- RPCs (SECURITY DEFINER, como las de paseadores):
--   registrar_negocio(p_usuario, p_hash, p_negocio)  cuenta nueva + negocio
--   activar_negocio(p_mail, p_hash, p_negocio)       cuenta existente + negocio
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NEGOCIO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS negocio_perfil (
  id             SERIAL PRIMARY KEY,
  id_user        INTEGER NOT NULL REFERENCES "User"("Id_User"),
  tipo           VARCHAR(20) NOT NULL,
  nombre         VARCHAR(150) NOT NULL,
  descripcion    VARCHAR(600),
  direccion      VARCHAR(300) NOT NULL,
  barrio         VARCHAR(150),
  lat            NUMERIC(10,7) NOT NULL,
  lng            NUMERIC(10,7) NOT NULL,
  telefono       VARCHAR(30),
  logo           TEXT,
  horarios       JSONB NOT NULL DEFAULT '{}'::jsonb,
  abierto        BOOLEAN NOT NULL DEFAULT TRUE,   -- recibe turnos / pedidos
  datos          JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT negocio_tipo_ok CHECK (tipo IN ('veterinaria', 'peluqueria', 'petshop')),
  CONSTRAINT negocio_uno_por_tipo UNIQUE (id_user, tipo)
);
CREATE INDEX IF NOT EXISTS idx_negocio_user ON negocio_perfil(id_user);

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS id_negocio INTEGER REFERENCES negocio_perfil(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicios_negocio ON servicios(id_negocio) WHERE id_negocio IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LO QUE OFRECE (servicios con precio / productos)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS negocio_items (
  id           SERIAL PRIMARY KEY,
  id_negocio   INTEGER NOT NULL REFERENCES negocio_perfil(id) ON DELETE CASCADE,
  clase        VARCHAR(10) NOT NULL,
  nombre       VARCHAR(120) NOT NULL,
  descripcion  VARCHAR(400),
  categoria    VARCHAR(40),
  precio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  precios      JSONB,           -- peluquería: { chico, mediano, grande }
  duracion_min INTEGER,         -- servicios
  stock        INTEGER,         -- productos (NULL = no lleva stock)
  foto         TEXT,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  orden        INTEGER NOT NULL DEFAULT 0,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT negocio_item_clase_ok CHECK (clase IN ('servicio', 'producto')),
  CONSTRAINT negocio_item_precio_ok CHECK (precio >= 0),
  CONSTRAINT negocio_item_duracion_ok CHECK (duracion_min IS NULL OR duracion_min BETWEEN 5 AND 600),
  CONSTRAINT negocio_item_stock_ok CHECK (stock IS NULL OR stock >= 0)
);
CREATE INDEX IF NOT EXISTS idx_negocio_items ON negocio_items(id_negocio, activo);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TURNOS (veterinaria / peluquería)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS negocio_turnos (
  id             SERIAL PRIMARY KEY,
  id_negocio     INTEGER NOT NULL REFERENCES negocio_perfil(id) ON DELETE CASCADE,
  id_dueno       INTEGER NOT NULL REFERENCES "User"("Id_User"),
  id_mascota     INTEGER REFERENCES "Mascota"("Id_Mascota"),
  id_item        INTEGER REFERENCES negocio_items(id) ON DELETE SET NULL,
  servicio       VARCHAR(120) NOT NULL,      -- nombre copiado: si se borra el item, el turno se entiende igual
  fecha          TIMESTAMPTZ NOT NULL,
  duracion_min   INTEGER NOT NULL DEFAULT 30,
  precio         NUMERIC(10,2) NOT NULL DEFAULT 0,
  urgencia       BOOLEAN NOT NULL DEFAULT FALSE,
  a_domicilio    BOOLEAN NOT NULL DEFAULT FALSE,
  direccion      VARCHAR(300),
  estado         VARCHAR(12) NOT NULL DEFAULT 'pendiente',
  notas_dueno    VARCHAR(500),
  informe        JSONB,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT negocio_turno_estado_ok CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'cancelado', 'completado', 'ausente'))
);
CREATE INDEX IF NOT EXISTS idx_turnos_negocio ON negocio_turnos(id_negocio, fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_dueno ON negocio_turnos(id_dueno, fecha);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PEDIDOS (pet shop)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS negocio_pedidos (
  id             SERIAL PRIMARY KEY,
  id_negocio     INTEGER NOT NULL REFERENCES negocio_perfil(id) ON DELETE CASCADE,
  id_dueno       INTEGER NOT NULL REFERENCES "User"("Id_User"),
  items          JSONB NOT NULL,             -- [{ idItem, nombre, precio, cantidad }]
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  envio          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  entrega        VARCHAR(10) NOT NULL DEFAULT 'retiro',
  direccion      VARCHAR(300),
  medio_pago     VARCHAR(20),
  notas          VARCHAR(500),
  estado         VARCHAR(12) NOT NULL DEFAULT 'nuevo',
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT negocio_pedido_entrega_ok CHECK (entrega IN ('retiro', 'envio')),
  CONSTRAINT negocio_pedido_estado_ok CHECK (estado IN ('nuevo', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado'))
);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio ON negocio_pedidos(id_negocio, creado_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_dueno ON negocio_pedidos(id_dueno, creado_en);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CHAT: el negocio ahora contesta
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Mensaje" ADD COLUMN IF NOT EXISTS "deNegocio" BOOLEAN NOT NULL DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPCs DE ALTA
-- ─────────────────────────────────────────────────────────────────────────────

-- Crea o actualiza el negocio de una cuenta y su pin en Comunidad. Devuelve el id.
CREATE OR REPLACE FUNCTION _upsert_negocio(p_id_user INTEGER, p_negocio JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT := p_negocio->>'tipo';
  v_id INTEGER;
  v_nombre TEXT := left(trim(p_negocio->>'nombre'), 150);
  v_direccion TEXT := left(trim(p_negocio->>'direccion'), 300);
  v_lat NUMERIC := NULLIF(p_negocio->>'lat', '')::NUMERIC;
  v_lng NUMERIC := NULLIF(p_negocio->>'lng', '')::NUMERIC;
BEGIN
  IF v_tipo IS NULL OR v_tipo NOT IN ('veterinaria', 'peluqueria', 'petshop') THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;
  IF v_nombre IS NULL OR length(v_nombre) < 2 THEN
    RAISE EXCEPTION 'nombre_invalido';
  END IF;
  IF v_direccion IS NULL OR length(v_direccion) < 3 OR v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'ubicacion_invalida';
  END IF;

  INSERT INTO negocio_perfil (
    id_user, tipo, nombre, descripcion, direccion, barrio, lat, lng, telefono, logo, horarios, datos
  ) VALUES (
    p_id_user, v_tipo, v_nombre,
    left(trim(p_negocio->>'descripcion'), 600),
    v_direccion,
    left(trim(p_negocio->>'barrio'), 150),
    v_lat, v_lng,
    left(trim(p_negocio->>'telefono'), 30),
    NULLIF(p_negocio->>'logo', ''),
    COALESCE(p_negocio->'horarios', '{}'::jsonb),
    COALESCE(p_negocio->'datos', '{}'::jsonb)
  )
  ON CONFLICT (id_user, tipo) DO UPDATE SET
    nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, direccion = EXCLUDED.direccion,
    barrio = EXCLUDED.barrio, lat = EXCLUDED.lat, lng = EXCLUDED.lng, telefono = EXCLUDED.telefono,
    horarios = EXCLUDED.horarios, datos = EXCLUDED.datos, actualizado_en = now()
  RETURNING id INTO v_id;

  -- El pin en Comunidad (tabla de la 001/010)
  IF EXISTS (SELECT 1 FROM servicios WHERE id_negocio = v_id) THEN
    UPDATE servicios SET nombre = v_nombre, direccion = v_direccion, lat = v_lat, lng = v_lng,
      telefono = left(trim(p_negocio->>'telefono'), 30),
      descripcion = left(trim(p_negocio->>'descripcion'), 600)
    WHERE id_negocio = v_id;
  ELSE
    INSERT INTO servicios (tipo, nombre, direccion, telefono, descripcion, lat, lng, verified, id_negocio)
    VALUES (v_tipo, v_nombre, v_direccion, left(trim(p_negocio->>'telefono'), 30),
      left(trim(p_negocio->>'descripcion'), 600), v_lat, v_lng, FALSE, v_id);
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION _upsert_negocio(INTEGER, JSONB) FROM anon, public;


-- Cuenta nueva (mail + contraseña) con su negocio. Entra directo a trabajar.
CREATE OR REPLACE FUNCTION registrar_negocio(p_usuario JSONB, p_hash TEXT, p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mail TEXT := lower(trim(p_usuario->>'email'));
  v_id INTEGER;
  v_negocio INTEGER;
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
    left(trim(p_negocio->>'direccion'), 300)
  ) RETURNING "Id_User" INTO v_id;

  INSERT INTO user_credentials (id_user, hash) VALUES (v_id, p_hash);
  v_negocio := _upsert_negocio(v_id, p_negocio);

  RETURN jsonb_build_object('id', v_id, 'email', v_mail, 'idNegocio', v_negocio);
END $$;

GRANT EXECUTE ON FUNCTION registrar_negocio(JSONB, TEXT, JSONB) TO anon, authenticated;


-- Cuenta que ya existe (dueño, paseador u otro negocio) y suma este negocio.
-- Pide la contraseña: el hash lo verifica el servidor.
CREATE OR REPLACE FUNCTION activar_negocio(p_mail TEXT, p_hash TEXT, p_negocio JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INTEGER;
  v_negocio INTEGER;
BEGIN
  SELECT u."Id_User" INTO v_id
  FROM "User" u
  JOIN user_credentials c ON c.id_user = u."Id_User"
  WHERE lower(u."Mail") = lower(trim(p_mail)) AND c.hash = p_hash;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'credenciales';
  END IF;

  v_negocio := _upsert_negocio(v_id, p_negocio);
  RETURN jsonb_build_object('id', v_id, 'idNegocio', v_negocio);
END $$;

GRANT EXECUTE ON FUNCTION activar_negocio(TEXT, TEXT, JSONB) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PERMISOS (igual que las tablas de paseadores, ver 038: sin Supabase Auth
--    todavía no hay políticas por usuario)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['negocio_perfil', 'negocio_items', 'negocio_turnos', 'negocio_pedidos', 'servicios'] LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT n.id, n.tipo, n.nombre, s.id AS pin FROM negocio_perfil n LEFT JOIN servicios s ON s.id_negocio = n.id;
--   SELECT * FROM negocio_turnos ORDER BY fecha DESC LIMIT 10;
--   SELECT * FROM negocio_pedidos ORDER BY creado_en DESC LIMIT 10;
