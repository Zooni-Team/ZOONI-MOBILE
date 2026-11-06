-- ============================================================================
-- 023_perfil_match_mascota.sql — Perfil de Match POR MASCOTA
--
-- Hasta ahora el perfil de Match era solo del usuario (foto, género,
-- intereses) y cualquier mascota activa votaba sin setup propio. Con varias
-- mascotas por usuario, cada una necesita su propio perfil de Match:
-- la app detecta cuáles no lo tienen y ofrece crearlo.
--
-- Idempotente. Correr en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "PerfilMatchCreado" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: las mascotas que YA participaron en Match (votaron o tienen un
-- match) se consideran con perfil creado — así el perro que el usuario venía
-- usando no pide setup de nuevo.
UPDATE "Mascota" SET "PerfilMatchCreado" = TRUE
WHERE "PerfilMatchCreado" = FALSE
  AND (
    "Id_Mascota" IN (SELECT DISTINCT "idMascotaOrigen" FROM "Voto")
    OR "Id_Mascota" IN (SELECT "idMascotaUno" FROM "Match")
    OR "Id_Mascota" IN (SELECT "idMascotaDos" FROM "Match")
  );
