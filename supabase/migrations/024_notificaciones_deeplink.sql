-- ============================================================================
-- 024_notificaciones_deeplink.sql — Datos de navegación en las notificaciones
--
-- Agrega "DataExtra" (jsonb) a "Notificacion" para que el toque pueda llevar
-- a un destino específico (ej: el chat del match con { chatId, nombre,
-- fotoPerfilUrl }) en vez de a una pantalla genérica.
-- Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE "Notificacion" ADD COLUMN IF NOT EXISTS "DataExtra" JSONB;
