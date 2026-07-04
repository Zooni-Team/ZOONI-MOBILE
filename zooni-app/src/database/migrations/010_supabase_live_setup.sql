-- =============================================================================
-- Migración 010: Puesta en marcha real de Supabase para Zooni
-- =============================================================================
-- Este es el ÚNICO script que corresponde al proyecto Supabase que está
-- actualmente conectado (nvbddhfdkbhgxrpxdoez). Las migraciones 001 y 005
-- (MySQL / SQL Server) son diseños viejos de otra sesión y NUNCA se aplicaron
-- acá — ignéralas, quedan como referencia histórica nada más.
--
-- Qué hace este script (todo es idempotente, se puede correr más de una vez):
--   1. Desactiva RLS en las 18 tablas ya existentes (User, Mascota, etc.) para
--      que la app pueda leer/escribir con la key pública mientras no hay login
--      real todavía. VER NOTA DE SEGURIDAD al final del archivo.
--   2. Agrega columnas nuevas necesarias para Match, Vacunas, Closet.
--   3. Crea las tablas que faltaban: avatares_catalogo, eventos,
--      eventos_calendario, organizadores_verificados, consejos_catalogo,
--      tratamientos_catalogo y las 4 tablas del módulo Comunidad.
--   4. Siembra datos iniciales (usuario demo, catálogos) para que la app
--      tenga algo real para mostrar apenas conectás.
--
-- Cómo correrlo: Supabase Dashboard → SQL Editor → pegar todo → Run.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DESACTIVAR RLS EN TABLAS EXISTENTES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "User"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Mascota"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Clinica"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Role"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Vacuna"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "MascotaVacuna"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Publicacion"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Comentario"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE "HistorialEvento"  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Tratamiento"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Veterinario"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notificacion"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Paseo"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PaseoTrack"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Match"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Mensaje"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Voto"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole"         DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Mascota: avatar ilustrado (Closet) — de la migración 006
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "ImagenAsset" VARCHAR(100) DEFAULT 'perro_default';

-- 2a-bis. Mascota: cuál es la mascota activa de cada usuario (para el selector en Home)
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "EsActiva" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2b. User: geolocalización, género, fecha de nacimiento e intereses — para Match
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Lat" DECIMAL(10,7);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Lng" DECIMAL(10,7);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Genero" VARCHAR(20);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "FechaNacimiento" DATE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Intereses" TEXT[];

-- 2b-bis. User: ubicación estructurada del Registro Paso 4 (Ubicacion queda como
-- string de display "Ciudad, Provincia" para las pantallas que ya lo usan)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Pais" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "PaisCodigo" VARCHAR(5);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Provincia" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Ciudad" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "CodigoTelefono" VARCHAR(10);

-- 2b-ter. Mascota: sexo (del Registro Paso 2)
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Sexo" VARCHAR(10);

-- 2c. Vacuna: catálogo con especie + descripción de frecuencia (para "sugeridas")
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "Especie" VARCHAR(50);
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "FrecuenciaDescripcion" VARCHAR(200);

-- 2d. MascotaVacuna: registro genérico de "aplicadas" en VacunasScreen (no todas
-- vienen del catálogo — el botón "Añadir" permite cargar nombre libre y otros
-- tipos como Desparasitación/Tratamiento/Otro, no solo vacunas del catálogo).
ALTER TABLE "MascotaVacuna" ALTER COLUMN "Id_Vacuna" DROP NOT NULL;
ALTER TABLE "MascotaVacuna" ADD COLUMN IF NOT EXISTS "NombreLibre" VARCHAR(150);
ALTER TABLE "MascotaVacuna" ADD COLUMN IF NOT EXISTS "Tipo" VARCHAR(50) DEFAULT 'Vacuna';
ALTER TABLE "MascotaVacuna" ADD COLUMN IF NOT EXISTS "Descripcion" VARCHAR(500);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLAS NUEVAS — Avatares (Closet), de la migración 006
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS avatares_catalogo (
  id         SERIAL PRIMARY KEY,
  especie    VARCHAR(50)  NOT NULL,
  asset_name VARCHAR(100) NOT NULL,
  nombre     VARCHAR(100) NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  orden      INTEGER      NOT NULL DEFAULT 0,
  creado_en  TIMESTAMP    NOT NULL DEFAULT NOW()
);
ALTER TABLE avatares_catalogo DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_avatares_especie ON avatares_catalogo(especie);

INSERT INTO avatares_catalogo (especie, asset_name, nombre, orden)
SELECT * FROM (VALUES
  ('perro', 'perro_default',         'Clásico',     1),
  ('perro', 'perro_labrador_gorro',  'Con gorrito', 2),
  ('perro', 'perro_labrador_lentes', 'Con lentes',  3),
  ('perro', 'perro_golden_corbata',  'Elegante',    4),
  ('perro', 'perro_bombero',         'Bombero',     5),
  ('perro', 'perro_astronauta',      'Astronauta',  6),
  ('gato',  'gato_default',          'Clásico',     1),
  ('gato',  'gato_lentes',           'Con lentes',  2),
  ('gato',  'gato_corona',           'Con corona',  3)
) AS v(especie, asset_name, nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM avatares_catalogo LIMIT 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLAS NUEVAS — Eventos públicos + calendario de cuidados, de la migración 009
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizadores_verificados (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  logo_url     VARCHAR(255),
  es_oficial   BOOLEAN DEFAULT FALSE,
  activo       BOOLEAN DEFAULT TRUE,
  creado_en    TIMESTAMP DEFAULT NOW()
);
ALTER TABLE organizadores_verificados DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS eventos (
  id                 SERIAL PRIMARY KEY,
  organizador_id     INTEGER NOT NULL REFERENCES organizadores_verificados(id),
  titulo             VARCHAR(200) NOT NULL,
  descripcion        TEXT,
  imagen_url         VARCHAR(255),
  fecha_hora         TIMESTAMP NOT NULL,
  ubicacion_nombre   VARCHAR(255) NOT NULL,
  lat                DECIMAL(10, 7),
  lng                DECIMAL(10, 7),
  ciudad             VARCHAR(100) NOT NULL,
  provincia          VARCHAR(100),
  pais               VARCHAR(100) DEFAULT 'Argentina',
  categoria_tag      VARCHAR(100),
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMP DEFAULT NOW()
);
ALTER TABLE eventos DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_eventos_ciudad ON eventos(ciudad);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_eventos_activo ON eventos(activo);

CREATE TABLE IF NOT EXISTS eventos_calendario (
  id             SERIAL PRIMARY KEY,
  mascota_id     INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  titulo         VARCHAR(150) NOT NULL,
  descripcion    TEXT,
  fecha_hora     TIMESTAMP NOT NULL,
  tipo           VARCHAR(80) NOT NULL DEFAULT 'Otro',
  emoji          VARCHAR(10),
  color          VARCHAR(20),
  origen         VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'eventos' (agregado desde EventosScreen)
  origen_evento_id INTEGER REFERENCES eventos(id),
  creado_en      TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);
ALTER TABLE eventos_calendario DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_mascota ON eventos_calendario(mascota_id);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_fecha ON eventos_calendario(fecha_hora);

INSERT INTO organizadores_verificados (nombre, es_oficial)
SELECT * FROM (VALUES
  ('Gobierno Ciudad Autónoma de Buenos Aires', TRUE),
  ('Municipalidad de Córdoba', TRUE),
  ('Zooni Oficial', FALSE)
) AS v(nombre, es_oficial)
WHERE NOT EXISTS (SELECT 1 FROM organizadores_verificados LIMIT 1);

INSERT INTO eventos (
  organizador_id, titulo, descripcion, imagen_url, fecha_hora,
  ubicacion_nombre, lat, lng, ciudad, provincia, categoria_tag
)
SELECT
  1,
  'Jornada de Vacunación Gratuita para Golden Retrievers',
  'El Gobierno de la Ciudad Autónoma de Buenos Aires organiza una jornada de vacunación gratuita para Golden Retrievers. Se aplicarán vacunas antirrábicas, séxtuple y contra la leptospirosis. Traé el carnet sanitario de tu mascota.',
  'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?w=800&q=80',
  '2026-04-15 09:00:00',
  'Parque Centenario, Av. Díaz Vélez 4900, CABA',
  -34.6063, -58.4345,
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires',
  'GOLDEN RETRIEVER'
WHERE NOT EXISTS (SELECT 1 FROM eventos LIMIT 1);

INSERT INTO eventos (
  organizador_id, titulo, descripcion, imagen_url, fecha_hora,
  ubicacion_nombre, lat, lng, ciudad, provincia, categoria_tag
)
SELECT
  3,
  'Expo Mascotas Buenos Aires 2026',
  'La feria de mascotas más grande del año. Más de 200 expositores, concursos de razas, shows de entrenamiento y adopciones responsables.',
  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
  '2026-06-10 10:00:00',
  'La Rural, Av. Sarmiento 2704, Palermo, CABA',
  -34.5765, -58.4101,
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires',
  'TODAS LAS MASCOTAS'
WHERE (SELECT COUNT(*) FROM eventos) < 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLAS NUEVAS — Catálogos de Consejos y Tratamientos sugeridos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consejos_catalogo (
  id          SERIAL PRIMARY KEY,
  especie     VARCHAR(50) NOT NULL,
  categoria   VARCHAR(50) NOT NULL, -- coincide con las keys de constants/categoriasConsejos.js
  contenido   TEXT NOT NULL,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT NOW()
);
ALTER TABLE consejos_catalogo DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consejos_especie ON consejos_catalogo(especie);

INSERT INTO consejos_catalogo (especie, categoria, contenido)
SELECT * FROM (VALUES
  ('perro', 'salud',          'Llevá a tu perro al veterinario al menos una vez al año para un chequeo general, incluso si parece sano.'),
  ('perro', 'salud',          'Revisá las orejas de tu perro semanalmente para detectar signos de infección u olor inusual.'),
  ('perro', 'alimentacion',   'Evitá darle chocolate, uvas, cebolla y ajo: son tóxicos para los perros.'),
  ('perro', 'alimentacion',   'Dividí la porción diaria en 2 comidas para evitar la dilatación gástrica en razas grandes.'),
  ('perro', 'ejercicio',      'Los perros adultos necesitan al menos 30-60 minutos de actividad física por día.'),
  ('perro', 'ejercicio',      'El juego mental (buscar objetos, snuffle mats) cansa tanto como el ejercicio físico.'),
  ('perro', 'comportamiento', 'La socialización temprana con otros perros y personas reduce la ansiedad y el miedo en la adultez.'),
  ('perro', 'comportamiento', 'Usá refuerzo positivo (premios, elogios) en vez de castigos para entrenar.'),
  ('perro', 'cuidado',        'Cepillá el pelaje de tu perro al menos 2 veces por semana para evitar nudos y reducir la caída de pelo.'),
  ('perro', 'cuidado',        'Cortá las uñas cada 3-4 semanas si no se desgastan solas caminando.'),
  ('perro', 'general',        'Mantené al día el calendario de vacunas y desparasitaciones.'),
  ('perro', 'general',        'Identificá a tu mascota con chip y una chapita con tu teléfono actualizado.'),
  ('gato',  'salud',          'Los gatos ocultan el dolor: cualquier cambio de conducta puede ser señal de un problema de salud.'),
  ('gato',  'alimentacion',   'El agua fresca y abundante es clave para prevenir problemas renales en gatos.'),
  ('gato',  'ejercicio',      'Los rascadores y torres para trepar ayudan a canalizar la energía y las ganas de marcar territorio.'),
  ('gato',  'comportamiento', 'Los gatos necesitan al menos una caja de arena por gato, más una extra, en lugares tranquilos.'),
  ('gato',  'cuidado',        'Cepillá a tu gato regularmente, sobre todo en épocas de muda, para reducir bolas de pelo.'),
  ('gato',  'general',        'Esterilizar a tu gato reduce riesgos de salud y comportamientos territoriales.')
) AS v(especie, categoria, contenido)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo LIMIT 1);

CREATE TABLE IF NOT EXISTS tratamientos_catalogo (
  id                     SERIAL PRIMARY KEY,
  especie                VARCHAR(50) NOT NULL,
  nombre                 VARCHAR(150) NOT NULL,
  frecuencia_descripcion VARCHAR(200),
  activo                 BOOLEAN DEFAULT TRUE
);
ALTER TABLE tratamientos_catalogo DISABLE ROW LEVEL SECURITY;

INSERT INTO tratamientos_catalogo (especie, nombre, frecuencia_descripcion)
SELECT * FROM (VALUES
  ('perro', 'Antiparasitario externo (pipeta/collar)', 'Cada 30 días'),
  ('perro', 'Antiparasitario interno (comprimido)',     'Cada 3 meses'),
  ('perro', 'Control dental',                           'Cada 6 meses'),
  ('gato',  'Antiparasitario externo (pipeta)',         'Cada 30 días'),
  ('gato',  'Antiparasitario interno (comprimido)',     'Cada 3 meses'),
  ('gato',  'Control dental',                           'Cada 6 meses')
) AS v(especie, nombre, frecuencia_descripcion)
WHERE NOT EXISTS (SELECT 1 FROM tratamientos_catalogo LIMIT 1);

-- Seeds del catálogo de vacunas (tabla "Vacuna" ya existía, ahora con Especie/FrecuenciaDescripcion)
INSERT INTO "Vacuna" ("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion")
SELECT * FROM (VALUES
  ('Antirrábica',        'Única + refuerzo anual', 'perro', 'Refuerzo anual'),
  ('Séxtuple/Óctuple',   '3 dosis + refuerzo anual', 'perro', 'Refuerzo anual'),
  ('Leptospirosis',      'Incluida en polivalente', 'perro', 'Refuerzo anual'),
  ('Antirrábica',        'Única + refuerzo anual', 'gato', 'Refuerzo anual'),
  ('Triple Felina',      '2 dosis + refuerzo anual', 'gato', 'Refuerzo anual'),
  ('Leucemia Felina',    '2 dosis + refuerzo anual', 'gato', 'Refuerzo anual')
) AS v("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion")
WHERE NOT EXISTS (SELECT 1 FROM "Vacuna" LIMIT 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5-bis. TABLA NUEVA — Catálogo de razas por especie (Registro Paso 2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS razas (
  id        SERIAL PRIMARY KEY,
  especie   VARCHAR(50) NOT NULL,  -- 'perro','gato','conejo','ave','reptil','pez','hamster','raton'
  nombre    VARCHAR(100) NOT NULL,
  activo    BOOLEAN DEFAULT TRUE,
  orden     INTEGER DEFAULT 0
);
ALTER TABLE razas DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_razas_especie ON razas(especie);

INSERT INTO razas (especie, nombre, orden)
SELECT * FROM (VALUES
  -- Perros
  ('perro', 'Labrador Retriever', 1),
  ('perro', 'Golden Retriever', 2),
  ('perro', 'Bulldog Francés', 3),
  ('perro', 'Poodle', 4),
  ('perro', 'Beagle', 5),
  ('perro', 'Pastor Alemán', 6),
  ('perro', 'Husky Siberiano', 7),
  ('perro', 'Yorkshire Terrier', 8),
  ('perro', 'Chihuahua', 9),
  ('perro', 'Dálmata', 10),
  ('perro', 'Rottweiler', 11),
  ('perro', 'Doberman', 12),
  ('perro', 'Boxer', 13),
  ('perro', 'Shih Tzu', 14),
  ('perro', 'Pomerania', 15),
  ('perro', 'Border Collie', 16),
  ('perro', 'Cocker Spaniel', 17),
  ('perro', 'Dachshund (Salchicha)', 18),
  ('perro', 'Schnauzer', 19),
  ('perro', 'Pitbull', 20),
  ('perro', 'Mestizo / Sin raza definida', 99),
  -- Gatos
  ('gato', 'Doméstico común', 1),
  ('gato', 'Siamés', 2),
  ('gato', 'Persa', 3),
  ('gato', 'Maine Coon', 4),
  ('gato', 'Bengalí', 5),
  ('gato', 'Ragdoll', 6),
  ('gato', 'Mestizo / Sin raza definida', 99),
  -- Conejos
  ('conejo', 'Cabeza de León', 1),
  ('conejo', 'Belier (orejas caídas)', 2),
  ('conejo', 'Rex', 3),
  ('conejo', 'Angora', 4),
  ('conejo', 'Común / Sin raza definida', 99),
  -- Aves
  ('ave', 'Canario', 1),
  ('ave', 'Periquito', 2),
  ('ave', 'Cotorra', 3),
  ('ave', 'Loro', 4),
  ('ave', 'Cacatúa', 5),
  ('ave', 'Otra / Sin especificar', 99),
  -- Reptiles
  ('reptil', 'Tortuga de tierra', 1),
  ('reptil', 'Tortuga de agua', 2),
  ('reptil', 'Iguana', 3),
  ('reptil', 'Gecko', 4),
  ('reptil', 'Otro / Sin especificar', 99),
  -- Peces
  ('pez', 'Goldfish', 1),
  ('pez', 'Betta', 2),
  ('pez', 'Guppy', 3),
  ('pez', 'Tetra', 4),
  ('pez', 'Otro / Sin especificar', 99),
  -- Hamsters
  ('hamster', 'Sirio (dorado)', 1),
  ('hamster', 'Ruso', 2),
  ('hamster', 'Roborowski', 3),
  ('hamster', 'Otro / Sin especificar', 99),
  -- Ratones
  ('raton', 'Doméstico común', 1),
  ('raton', 'Otro / Sin especificar', 99)
) AS v(especie, nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM razas LIMIT 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABLAS NUEVAS — Módulo Comunidad (no existían en ningún schema Postgres)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carteles (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER      NOT NULL REFERENCES "User"("Id_User"),
  mascota_id        INTEGER      REFERENCES "Mascota"("Id_Mascota"),
  tipo              VARCHAR(20)  NOT NULL CHECK (tipo IN ('perdida','encontrada','adopcion','aviso_general')),
  descripcion       VARCHAR(300),
  telefono_contacto VARCHAR(30)  NOT NULL,
  foto_url          VARCHAR(500),
  lat               DECIMAL(10,7) NOT NULL,
  lng               DECIMAL(10,7) NOT NULL,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);
ALTER TABLE carteles DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_carteles_usuario ON carteles(usuario_id);
CREATE INDEX IF NOT EXISTS idx_carteles_activo ON carteles(activo);

CREATE TABLE IF NOT EXISTS servicios (
  id              SERIAL PRIMARY KEY,
  tipo            VARCHAR(20)  NOT NULL CHECK (tipo IN ('veterinaria','paseador','petshop','peluqueria')),
  nombre          VARCHAR(200) NOT NULL,
  direccion       VARCHAR(300) NOT NULL,
  telefono        VARCHAR(30),
  descripcion     TEXT,
  lat             DECIMAL(10,7) NOT NULL,
  lng             DECIMAL(10,7) NOT NULL,
  google_maps_url VARCHAR(500),
  verified        BOOLEAN      NOT NULL DEFAULT FALSE
);
ALTER TABLE servicios DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS amistades (
  id            SERIAL PRIMARY KEY,
  usuario_a_id  INTEGER      NOT NULL REFERENCES "User"("Id_User"),
  usuario_b_id  INTEGER      NOT NULL REFERENCES "User"("Id_User"),
  estado        VARCHAR(20)  NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada')),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_a_id, usuario_b_id)
);
ALTER TABLE amistades DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_amistades_b ON amistades(usuario_b_id);
CREATE INDEX IF NOT EXISTS idx_amistades_estado ON amistades(estado);

CREATE TABLE IF NOT EXISTS ubicaciones_usuarios (
  usuario_id          INTEGER PRIMARY KEY REFERENCES "User"("Id_User"),
  lat                 DECIMAL(10,7) NOT NULL,
  lng                 DECIMAL(10,7) NOT NULL,
  compartir_ubicacion BOOLEAN   NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE ubicaciones_usuarios DISABLE ROW LEVEL SECURITY;

-- Seeds de servicios de Comunidad (Caballito/CABA, cerca del usuario demo) ────
-- (Los seeds de ubicaciones_usuarios y amistades están en la sección 7, DESPUÉS
--  de crear los usuarios demo — referencian sus FKs.)
INSERT INTO servicios (tipo, nombre, direccion, telefono, descripcion, lat, lng, verified)
SELECT * FROM (VALUES
  ('veterinaria', 'Veterinaria San Martín',        'Av. Díaz Vélez 3820',    '011 4855-2290', 'Atención general y urgencias las 24 hs.',      -34.6075::DECIMAL, -58.4305::DECIMAL, TRUE),
  ('paseador',    'Paseadores Crespo',              'Jerónimo Salguero 2145', '11 6234-5678',  'Paseos grupales e individuales en Caballito.', -34.6100, -58.4350, FALSE),
  ('petshop',     'Pet Shop El Hueso',              'Av. Díaz Vélez 3650',    '011 4854-9900', 'Alimentos, accesorios y ropa para mascotas.',  -34.6060, -58.4340, FALSE),
  ('peluqueria',  'Peluquería Canina Mimados',      'Jerónimo Salguero 2230', '11 5567-4321',  'Baño, corte y estética canina.',               -34.6110, -58.4300, FALSE),
  ('veterinaria', 'Clínica Veterinaria del Parque', 'Av. Rivadavia 4855',     '011 4901-1122', 'Especialistas en dermatología y oncología.',   -34.6050, -58.4318, TRUE)
) AS v(tipo, nombre, direccion, telefono, descripcion, lat, lng, verified)
WHERE NOT EXISTS (SELECT 1 FROM servicios LIMIT 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SEED — Usuario y mascota demo (para que la app tenga datos reales id=1)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "User" ("Id_User", "Nombre", "Apellido", "Mail", "Contrasena", "Ubicacion", "Lat", "Lng", "Genero", "FechaNacimiento")
SELECT 1, 'Sofía', 'García', 'sofia.demo@zooni.app', 'demo-sin-login', 'Caballito, CABA', -34.6190, -58.4413, 'femenino', '1996-03-10'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "Id_User" = 1);
SELECT setval(pg_get_serial_sequence('"User"', 'Id_User'), GREATEST((SELECT MAX("Id_User") FROM "User"), 1));

INSERT INTO "Mascota" ("Id_Mascota", "Id_User", "Nombre", "Especie", "Raza", "FechaNacimiento", "Peso", "ImagenAsset", "EsActiva")
SELECT 1, 1, 'Titán', 'perro', 'Labrador Retriever', '2022-02-15', 20.40, 'perro_default', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = 1);
SELECT setval(pg_get_serial_sequence('"Mascota"', 'Id_Mascota'), GREATEST((SELECT MAX("Id_Mascota") FROM "Mascota"), 1));

-- Segundo usuario + mascota, útil para probar Match/Chat/Comunidad con más de un perfil
INSERT INTO "User" ("Id_User", "Nombre", "Apellido", "Mail", "Contrasena", "Ubicacion", "Lat", "Lng", "Genero", "FechaNacimiento")
SELECT 2, 'Carlos', 'Beni', 'carlos.demo@zooni.app', 'demo-sin-login', 'Villa Crespo, CABA', -34.5997, -58.4372, 'masculino', '1994-07-22'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "Id_User" = 2);

INSERT INTO "Mascota" ("Id_Mascota", "Id_User", "Nombre", "Especie", "Raza", "FechaNacimiento", "Peso", "ImagenAsset", "EsActiva")
SELECT 2, 2, 'Luna', 'gato', 'Siamés', '2021-11-01', 4.10, 'gato_default', TRUE
WHERE NOT EXISTS (SELECT 1 FROM "Mascota" WHERE "Id_Mascota" = 2);
SELECT setval(pg_get_serial_sequence('"Mascota"', 'Id_Mascota'), GREATEST((SELECT MAX("Id_Mascota") FROM "Mascota"), 1));
SELECT setval(pg_get_serial_sequence('"User"', 'Id_User'), GREATEST((SELECT MAX("Id_User") FROM "User"), 1));

-- Seeds de Comunidad que dependen de los usuarios demo recién creados ─────────
INSERT INTO ubicaciones_usuarios (usuario_id, lat, lng)
SELECT 1, -34.6190, -58.4413
WHERE NOT EXISTS (SELECT 1 FROM ubicaciones_usuarios WHERE usuario_id = 1);

INSERT INTO ubicaciones_usuarios (usuario_id, lat, lng)
SELECT 2, -34.5997, -58.4372
WHERE NOT EXISTS (SELECT 1 FROM ubicaciones_usuarios WHERE usuario_id = 2);

INSERT INTO amistades (usuario_a_id, usuario_b_id, estado)
SELECT 1, 2, 'aceptada'
WHERE NOT EXISTS (SELECT 1 FROM amistades LIMIT 1);

-- =============================================================================
-- NOTA DE SEGURIDAD IMPORTANTE
-- =============================================================================
-- RLS quedó DESACTIVADO en todas las tablas. Esto significa que CUALQUIERA con
-- la key pública (sb_publishable_...) puede leer y escribir TODO. Es aceptable
-- solo mientras la app no tiene login real ni datos de usuarios reales.
--
-- Antes de llevar esto a producción con usuarios reales:
--   1. Migrar el login de la columna "Contrasena" a Supabase Auth.
--   2. Volver a activar RLS: ALTER TABLE "..." ENABLE ROW LEVEL SECURITY;
--   3. Escribir políticas basadas en auth.uid() (ej: un usuario solo puede
--      escribir sus propias Mascotas, Publicaciones, Mensajes, etc.)
-- Ver /prompts/ para instrucciones detalladas para el próximo agente.
-- =============================================================================
