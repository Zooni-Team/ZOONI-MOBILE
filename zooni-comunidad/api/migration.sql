-- ============================================================
-- Zooni — Migración módulo Comunidad
-- Ejecutar en la BD Zooni antes de arrancar la API
-- ============================================================
USE [Zooni]
GO

-- ─── Tabla Servicio ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Servicio]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[Servicio] (
        [Id_Servicio]   INT IDENTITY(1,1) NOT NULL,
        [Tipo]          NVARCHAR(30)  NOT NULL,
        [Nombre]        NVARCHAR(150) NOT NULL,
        [Direccion]     NVARCHAR(255) NULL,
        [Telefono]      NVARCHAR(30)  NULL,
        [Descripcion]   NVARCHAR(500) NULL,
        [Lat]           FLOAT         NOT NULL,
        [Lng]           FLOAT         NOT NULL,
        [GoogleMapsUrl] NVARCHAR(500) NULL,
        [Verified]      BIT           NOT NULL DEFAULT 1,
        CONSTRAINT [PK_Servicio] PRIMARY KEY CLUSTERED ([Id_Servicio] ASC)
    );
    CREATE INDEX [IX_Servicio_Lat_Lng] ON [dbo].[Servicio] ([Lat], [Lng]);
    PRINT 'Tabla Servicio creada';
END
GO

-- ─── Tabla Cartel ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Cartel]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[Cartel] (
        [Id_Cartel]        INT IDENTITY(1,1) NOT NULL,
        [Id_User]          INT           NOT NULL,
        [Id_Mascota]       INT           NULL,
        [Tipo]             NVARCHAR(20)  NOT NULL,
        [Descripcion]      NVARCHAR(500) NULL,
        [TelefonoContacto] NVARCHAR(30)  NOT NULL,
        [FotoUrl]          NVARCHAR(500) NULL,
        [Lat]              FLOAT         NOT NULL,
        [Lng]              FLOAT         NOT NULL,
        [Activo]           BIT           NOT NULL DEFAULT 1,
        [CreatedAt]        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Cartel]      PRIMARY KEY CLUSTERED ([Id_Cartel] ASC),
        CONSTRAINT [FK_Cartel_User] FOREIGN KEY ([Id_User])    REFERENCES [dbo].[User]    ([Id_User]),
        CONSTRAINT [FK_Cartel_Masc] FOREIGN KEY ([Id_Mascota]) REFERENCES [dbo].[Mascota] ([Id_Mascota])
    );
    CREATE INDEX [IX_Cartel_Lat_Lng] ON [dbo].[Cartel] ([Lat], [Lng]);
    CREATE INDEX [IX_Cartel_User]    ON [dbo].[Cartel] ([Id_User]);
    PRINT 'Tabla Cartel creada';
END
GO

-- ─── Tabla Amistad ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Amistad]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[Amistad] (
        [Id_Amistad]  INT IDENTITY(1,1) NOT NULL,
        [Id_User_A]   INT          NOT NULL,
        [Id_User_B]   INT          NOT NULL,
        [Estado]      NVARCHAR(15) NOT NULL DEFAULT 'pendiente',
        [CreatedAt]   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt]   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Amistad]       PRIMARY KEY CLUSTERED ([Id_Amistad] ASC),
        CONSTRAINT [FK_Amistad_UserA] FOREIGN KEY ([Id_User_A]) REFERENCES [dbo].[User] ([Id_User]),
        CONSTRAINT [FK_Amistad_UserB] FOREIGN KEY ([Id_User_B]) REFERENCES [dbo].[User] ([Id_User]),
        CONSTRAINT [UQ_Amistad_Pair]  UNIQUE ([Id_User_A], [Id_User_B])
    );
    CREATE INDEX [IX_Amistad_UserA] ON [dbo].[Amistad] ([Id_User_A]);
    CREATE INDEX [IX_Amistad_UserB] ON [dbo].[Amistad] ([Id_User_B]);
    PRINT 'Tabla Amistad creada';
END
GO

-- ─── Tabla UbicacionUsuario ──────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UbicacionUsuario]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[UbicacionUsuario] (
        [Id_User]            INT       NOT NULL,
        [Lat]                FLOAT     NOT NULL,
        [Lng]                FLOAT     NOT NULL,
        [UpdatedAt]          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [CompartirUbicacion] BIT       NOT NULL DEFAULT 1,
        CONSTRAINT [PK_UbicacionUsuario]      PRIMARY KEY CLUSTERED ([Id_User] ASC),
        CONSTRAINT [FK_UbicacionUsuario_User] FOREIGN KEY ([Id_User]) REFERENCES [dbo].[User] ([Id_User])
    );
    CREATE INDEX [IX_Ubicacion_Lat_Lng] ON [dbo].[UbicacionUsuario] ([Lat], [Lng]);
    PRINT 'Tabla UbicacionUsuario creada';
END
GO

-- ─── Datos de ejemplo — Servicios ────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM [dbo].[Servicio])
BEGIN
    INSERT INTO [dbo].[Servicio] (Tipo, Nombre, Direccion, Telefono, Descripcion, Lat, Lng, GoogleMapsUrl) VALUES
    ('veterinaria', 'Clínica Neurológica Veterinaria', 'Av. Pueyrredón 3456, CABA',  '+54 11 4789-4567', 'Neurología y Neurocirugía',         -34.5983, -58.4071, 'https://maps.google.com/?q=-34.5983,-58.4071'),
    ('veterinaria', 'Veterinaria San Telmo',           'Defensa 890, CABA',           '+54 11 4300-1122', 'Clínica general y urgencias',       -34.6218, -58.3731, 'https://maps.google.com/?q=-34.6218,-58.3731'),
    ('paseador',    'Paseadores Zooni Belgrano',        'Cabildo 1500, Belgrano',      '+54 9 11 2345-6789','Paseos grupales e individuales',   -34.5609, -58.4570, 'https://maps.google.com/?q=-34.5609,-58.4570'),
    ('petshop',     'PetShop La Patita',                'Corrientes 4321, CABA',       '+54 11 4867-3344', 'Alimentos, juguetes y accesorios', -34.6035, -58.4125, 'https://maps.google.com/?q=-34.6035,-58.4125'),
    ('peluqueria',  'Peluquería Canina Fluffy',         'Thames 777, Palermo',         '+54 11 4776-5566', 'Baño, corte y spa canino',          -34.5862, -58.4327, 'https://maps.google.com/?q=-34.5862,-58.4327');
    PRINT 'Servicios de ejemplo insertados';
END
GO

PRINT '✅ Migración Comunidad completada';
GO
