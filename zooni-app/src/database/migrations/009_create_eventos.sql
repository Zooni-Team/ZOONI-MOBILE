-- Migration 009: Eventos públicos y calendario de cuidados

-- Organizadores verificados por el equipo de Zooni
CREATE TABLE IF NOT EXISTS organizadores_verificados (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  logo_url     VARCHAR(255),
  es_oficial   BOOLEAN DEFAULT FALSE,
  activo       BOOLEAN DEFAULT TRUE,
  creado_en    TIMESTAMP DEFAULT NOW()
);

-- Eventos creados por organizadores verificados
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

CREATE INDEX IF NOT EXISTS idx_eventos_ciudad ON eventos(ciudad);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_eventos_ciudad_fecha ON eventos(ciudad, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_eventos_activo ON eventos(activo);

-- Eventos del calendario de cuidados por mascota
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id             SERIAL PRIMARY KEY,
  mascota_id     INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  titulo         VARCHAR(150) NOT NULL,
  descripcion    TEXT,
  fecha_hora     TIMESTAMP NOT NULL,
  tipo           VARCHAR(80) NOT NULL DEFAULT 'Otro',
  creado_en      TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_calendario_mascota ON eventos_calendario(mascota_id);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_fecha ON eventos_calendario(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_mascota_fecha ON eventos_calendario(mascota_id, fecha_hora);

-- Seeds iniciales
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
