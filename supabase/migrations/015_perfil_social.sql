-- =============================================================================
-- Migración 015: Perfil social — @usuario y bio
-- =============================================================================
-- PerfilScreen.jsx permite editar un @nombre_usuario y una bio que todavía no
-- existían en "User" (la tabla real solo tenía Nombre/Apellido/Ubicacion/
-- FotoPerfil). Sin esto, PerfilScreen no tenía ninguna columna real donde
-- guardar esos campos y mostraba datos de demo hardcodeados. Idempotente.
-- =============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "NombreUsuario" VARCHAR(30);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "Bio" VARCHAR(150);
