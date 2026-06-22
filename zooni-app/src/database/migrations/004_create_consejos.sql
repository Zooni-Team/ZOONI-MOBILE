-- ============================================================
-- Migración 004: Tabla Consejos
-- Base de datos: SQL Server (T-SQL)
-- Descripción: Consejos y curiosidades por especie/raza.
--              Contenido administrado por el equipo de Zooni.
--              Los usuarios NO pueden crear, editar ni eliminar.
-- ============================================================

-- Crear tabla si no existe
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'Consejos'
)
BEGIN
  CREATE TABLE Consejos (
    Id_Consejo    INT           IDENTITY(1,1) PRIMARY KEY,
    -- 'perro', 'gato', 'conejo', etc. (minúsculas, sin acentos)
    Especie       NVARCHAR(50)  NOT NULL,
    -- NULL = aplica a toda la especie; valor = raza específica
    Raza          NVARCHAR(100) NULL,
    -- 'general' | 'salud' | 'alimentacion' | 'ejercicio' | 'comportamiento' | 'cuidado'
    Categoria     NVARCHAR(50)  NOT NULL,
    -- Texto del consejo (1–4 oraciones)
    Contenido     NVARCHAR(MAX) NOT NULL,
    -- 1 = activo (visible), 0 = oculto
    Activo        BIT           NOT NULL DEFAULT 1,
    -- Controla el orden de aparición dentro de cada especie/raza
    Orden         INT           NOT NULL DEFAULT 0,
    CreadoEn      DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

  PRINT 'Tabla Consejos creada exitosamente.';
END
ELSE
BEGIN
  PRINT 'Tabla Consejos ya existe — sin cambios.';
END
GO

-- ── ÍNDICES ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_consejos_especie' AND object_id = OBJECT_ID('Consejos')
)
  CREATE INDEX idx_consejos_especie ON Consejos(Especie);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_consejos_especie_raza' AND object_id = OBJECT_ID('Consejos')
)
  CREATE INDEX idx_consejos_especie_raza ON Consejos(Especie, Raza);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_consejos_categoria' AND object_id = OBJECT_ID('Consejos')
)
  CREATE INDEX idx_consejos_categoria ON Consejos(Categoria);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_consejos_activo' AND object_id = OBJECT_ID('Consejos')
)
  CREATE INDEX idx_consejos_activo ON Consejos(Activo);

PRINT 'Índices de Consejos verificados/creados.';
GO
