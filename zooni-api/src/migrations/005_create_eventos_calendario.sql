-- ============================================================
-- Migración 005: Tabla Eventos_Calendario
-- Zooni — Calendario de Cuidados
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'Eventos_Calendario'
)
BEGIN
  CREATE TABLE Eventos_Calendario (
    Id              INT           IDENTITY(1,1) PRIMARY KEY,
    Mascota_Id      INT           NOT NULL
                                  REFERENCES Mascota(Id_Mascota) ON DELETE CASCADE,
    Titulo          NVARCHAR(150) NOT NULL,
    Descripcion     NVARCHAR(MAX) NULL,
    Fecha_Hora      DATETIME2     NOT NULL,
    Tipo            NVARCHAR(80)  NOT NULL DEFAULT 'Otro'
                    CONSTRAINT CK_Eventos_Tipo CHECK (
                      Tipo IN (
                        'Vacuna', 'Turno Veterinario', 'Desparasitación',
                        'Peluquería', 'Paseo', 'Medicación', 'Control', 'Otro'
                      )
                    ),
    Creado_En       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    Actualizado_En  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  -- Índice por mascota (más frecuente)
  CREATE INDEX IX_Eventos_Mascota
    ON Eventos_Calendario(Mascota_Id);

  -- Índice por fecha (para ordenar / filtrar)
  CREATE INDEX IX_Eventos_Fecha
    ON Eventos_Calendario(Fecha_Hora);

  -- Índice compuesto mascota + fecha
  CREATE INDEX IX_Eventos_Mascota_Fecha
    ON Eventos_Calendario(Mascota_Id, Fecha_Hora);

  PRINT '✅ Tabla Eventos_Calendario creada correctamente.';
END
ELSE
BEGIN
  PRINT 'ℹ️  Tabla Eventos_Calendario ya existía, sin cambios.';
END
