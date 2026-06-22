-- Migration 006: Closet de Avatares
-- Crea la tabla de catálogo de avatares y agrega la columna ImagenAsset en Mascota.

-- 1. Agregar columna ImagenAsset a la tabla Mascota (si no existe)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Mascota' AND COLUMN_NAME = 'ImagenAsset'
)
BEGIN
  ALTER TABLE Mascota ADD ImagenAsset NVARCHAR(100) NULL DEFAULT 'perro_default';
END
GO

-- 2. Crear tabla de catálogo de avatares
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'avatares_catalogo')
BEGIN
  CREATE TABLE avatares_catalogo (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    especie    NVARCHAR(50)  NOT NULL,
    asset_name NVARCHAR(100) NOT NULL,
    nombre     NVARCHAR(100) NOT NULL,
    activo     BIT           NOT NULL DEFAULT 1,
    orden      INT           NOT NULL DEFAULT 0,
    creado_en  DATETIME      NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX idx_avatares_especie ON avatares_catalogo(especie);
END
GO

-- 3. Seeds iniciales
IF NOT EXISTS (SELECT 1 FROM avatares_catalogo)
BEGIN
  INSERT INTO avatares_catalogo (especie, asset_name, nombre, orden) VALUES
    ('perro', 'perro_default',          'Clásico',        1),
    ('perro', 'perro_labrador_gorro',   'Con gorrito',    2),
    ('perro', 'perro_labrador_lentes',  'Con lentes',     3),
    ('perro', 'perro_golden_corbata',   'Elegante',       4),
    ('perro', 'perro_bombero',          'Bombero',        5),
    ('perro', 'perro_astronauta',       'Astronauta',     6),
    ('gato',  'gato_default',           'Clásico',        1),
    ('gato',  'gato_lentes',            'Con lentes',     2),
    ('gato',  'gato_corona',            'Con corona',     3);
END
GO
