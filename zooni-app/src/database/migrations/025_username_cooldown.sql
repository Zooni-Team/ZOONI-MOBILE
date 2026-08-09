-- ============================================================================
-- 025_username_cooldown.sql — Bloqueo de cambio de @usuario por 30 días
--
-- Guarda cuándo se cambió por última vez el nombre de usuario, para que no se
-- pueda volver a cambiar hasta que pase un mes. El nombre y apellido no tienen
-- este límite. Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "NombreUsuarioCambiadoEn" TIMESTAMPTZ;

-- El @usuario ya era único a nivel de app; lo garantizamos también en la base
-- (case-insensitive, ignorando los NULL de cuentas sin usuario elegido).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_nombreusuario
  ON "User" (lower("NombreUsuario")) WHERE "NombreUsuario" IS NOT NULL;
