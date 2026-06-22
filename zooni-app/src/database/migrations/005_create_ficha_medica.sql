-- ============================================================
-- Migración 005: Tablas de Ficha Médica
-- Base de datos: SQL Server (T-SQL)
-- Tablas: Vacuna, Tratamiento
-- (La tabla Mascota ya existe en el proyecto)
-- ============================================================

-- ── Columna Peso en Mascota (si no existe) ────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Mascota') AND name = 'Peso'
)
BEGIN
  ALTER TABLE Mascota ADD Peso DECIMAL(5,2) NULL;
  PRINT 'Columna Peso agregada a Mascota.';
END

-- ── Columna UpdatedAt en Mascota (si no existe) ───────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Mascota') AND name = 'UpdatedAt'
)
BEGIN
  ALTER TABLE Mascota ADD UpdatedAt DATETIME2 NULL DEFAULT GETUTCDATE();
  PRINT 'Columna UpdatedAt agregada a Mascota.';
END
GO

-- ── Tabla Vacuna ──────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Vacuna'
)
BEGIN
  CREATE TABLE Vacuna (
    Id_Vacuna        INT           IDENTITY(1,1) PRIMARY KEY,
    Id_Mascota       INT           NOT NULL
      REFERENCES Mascota(Id_Mascota) ON DELETE CASCADE,
    Nombre           NVARCHAR(100) NOT NULL,
    FechaAplicacion  DATE          NULL,
    ProximoRefuerzo  DATE          NULL,
    CreadoEn         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX idx_vacuna_mascota ON Vacuna(Id_Mascota);
  PRINT 'Tabla Vacuna creada.';
END
ELSE PRINT 'Tabla Vacuna ya existe.';
GO

-- ── Tabla Tratamiento ─────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tratamiento'
)
BEGIN
  CREATE TABLE Tratamiento (
    Id_Tratamiento INT           IDENTITY(1,1) PRIMARY KEY,
    Id_Mascota     INT           NOT NULL
      REFERENCES Mascota(Id_Mascota) ON DELETE CASCADE,
    Nombre         NVARCHAR(100) NOT NULL,
    Dosis          NVARCHAR(100) NULL,
    Frecuencia     NVARCHAR(100) NULL,
    Activo         BIT           NOT NULL DEFAULT 1,
    CreadoEn       DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX idx_tratamiento_mascota ON Tratamiento(Id_Mascota);
  CREATE INDEX idx_tratamiento_activo  ON Tratamiento(Id_Mascota, Activo);
  PRINT 'Tabla Tratamiento creada.';
END
ELSE PRINT 'Tabla Tratamiento ya existe.';
GO
