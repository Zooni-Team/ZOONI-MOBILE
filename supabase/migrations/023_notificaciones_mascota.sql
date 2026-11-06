-- ============================================================================
-- 023_notificaciones_mascota.sql — Notificaciones ligadas a una mascota
--
-- Agrega "Id_Mascota" a "Notificacion" para que cada notificación diga a QUÉ
-- mascota del usuario pertenece (ej: match hecho con el perfil del perro
-- mientras el usuario está parado en el perfil del gato).
-- Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE "Notificacion" ADD COLUMN IF NOT EXISTS "Id_Mascota" INTEGER;

CREATE INDEX IF NOT EXISTS idx_notificacion_mascota
  ON "Notificacion" ("Id_Mascota");
