-- ============================================================================
-- 027_publicaciones.sql — Borrado lógico de publicaciones del perfil
--
-- El 021 revocó DELETE para el rol anon en "Publicacion" (y otras). Para que
-- el usuario pueda borrar sus publicaciones sin DELETE físico, se agrega
-- "Activo": eliminar = UPDATE Activo = FALSE (permitido). Las publicaciones
-- inactivas no se muestran.
-- Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE "Publicacion" ADD COLUMN IF NOT EXISTS "Activo" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_publicacion_user_activo
  ON "Publicacion" ("Id_User", "Activo");
