-- ============================================================
-- Migration 007 — Perfil, Publicaciones y Seguidores
-- Base de datos: SQL Server (Zooni)
-- Ejecutar una sola vez contra la base de datos Zooni.
-- Todas las sentencias son idempotentes (IF NOT EXISTS).
-- ============================================================

-- ── 1. AGREGAR COLUMNAS FALTANTES EN [User] ──────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'Apellido'
)
  ALTER TABLE [User] ADD Apellido NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'NombreUsuario'
)
  ALTER TABLE [User] ADD NombreUsuario NVARCHAR(50) NULL;

-- Índice único en NombreUsuario (solo si la columna ya existe y no tiene índice)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_User_NombreUsuario' AND object_id = OBJECT_ID('[User]')
)
  CREATE UNIQUE INDEX UQ_User_NombreUsuario
    ON [User](NombreUsuario)
    WHERE NombreUsuario IS NOT NULL;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'Bio'
)
  ALTER TABLE [User] ADD Bio NVARCHAR(MAX) NULL;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'Ubicacion'
)
  ALTER TABLE [User] ADD Ubicacion NVARCHAR(100) NULL;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'FotoPerfil'
)
  ALTER TABLE [User] ADD FotoPerfil NVARCHAR(500) NULL;

-- ── 2. TABLA Publicaciones ────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'Publicaciones'
)
BEGIN
  CREATE TABLE Publicaciones (
    Id_Publicacion  INT           IDENTITY(1,1) PRIMARY KEY,
    Id_User         INT           NOT NULL
                                  REFERENCES [User](Id_User) ON DELETE CASCADE,
    ImagenUrl       NVARCHAR(500) NOT NULL,
    Descripcion     NVARCHAR(MAX) NULL,
    CreadoEn        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_Publicaciones_User
    ON Publicaciones (Id_User);

  CREATE INDEX IX_Publicaciones_Fecha
    ON Publicaciones (CreadoEn DESC);
END;

-- ── 3. TABLA Seguidores ───────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'Seguidores'
)
BEGIN
  CREATE TABLE Seguidores (
    Id_Seguidor     INT       IDENTITY(1,1) PRIMARY KEY,
    Seguidor_Id     INT       NOT NULL REFERENCES [User](Id_User) ON DELETE NO ACTION,
    Seguido_Id      INT       NOT NULL REFERENCES [User](Id_User) ON DELETE NO ACTION,
    CreadoEn        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Seguidores UNIQUE (Seguidor_Id, Seguido_Id)
  );
END;
