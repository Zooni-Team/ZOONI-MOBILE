-- Migration 006: Closet de Avatares

-- 1. Agregar columna imagen_asset a la tabla mascotas (si no existe)
ALTER TABLE mascotas
  ADD COLUMN IF NOT EXISTS imagen_asset VARCHAR(100) DEFAULT 'perro_default';

-- 2. Crear tabla de catálogo de avatares
CREATE TABLE IF NOT EXISTS avatares_catalogo (
  id         SERIAL PRIMARY KEY,
  especie    VARCHAR(50)  NOT NULL,
  asset_name VARCHAR(100) NOT NULL,
  nombre     VARCHAR(100) NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  orden      INTEGER      NOT NULL DEFAULT 0,
  creado_en  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatares_especie ON avatares_catalogo(especie);

-- 3. Seeds iniciales
INSERT INTO avatares_catalogo (especie, asset_name, nombre, orden)
SELECT * FROM (VALUES
  ('perro', 'perro_default',         'Clásico',     1),
  ('perro', 'perro_labrador_gorro',  'Con gorrito',  2),
  ('perro', 'perro_labrador_lentes', 'Con lentes',   3),
  ('perro', 'perro_golden_corbata',  'Elegante',     4),
  ('perro', 'perro_bombero',         'Bombero',      5),
  ('perro', 'perro_astronauta',      'Astronauta',   6),
  ('gato',  'gato_default',          'Clásico',      1),
  ('gato',  'gato_lentes',           'Con lentes',   2),
  ('gato',  'gato_corona',           'Con corona',   3)
) AS v(especie, asset_name, nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM avatares_catalogo LIMIT 1);
