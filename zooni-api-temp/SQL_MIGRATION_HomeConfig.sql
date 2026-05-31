-- Add HomeConfig table to store user's customized Home button layout
-- Run this against the Zooni database after deploying the backend

USE [Zooni]
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HomeConfig]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[HomeConfig](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [Id_User] [int] NOT NULL,
        [ConfigJson] [nvarchar](max) NULL,
        [UpdatedAt] [datetime2](7) NULL DEFAULT (sysutcdatetime()),
    PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_HomeConfig_User] FOREIGN KEY([Id_User]) REFERENCES [dbo].[User] ([Id_User])
    )
END
GO
