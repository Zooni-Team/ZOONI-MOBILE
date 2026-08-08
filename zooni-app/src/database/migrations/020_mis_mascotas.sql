-- ============================================================================
-- 020_mis_mascotas.sql — Ciclo de vida de mascotas (Instruction-MisMascotas §7)
--
-- Idempotente. Agrega a "Mascota" el estado del ciclo de vida:
--   active → archived → active   (archivar / recuperar, reversible)
--   active|archived → memorial   (motivo 'deceased')
--   cualquiera → deleted         (borrado lógico, 30 días de gracia)
--
-- "EsActiva" se mantiene con su significado actual: mascota PRINCIPAL del
-- usuario (la que muestra Home). No confundir con Estado='active'.
-- Correr en Supabase → SQL Editor después del 010.
-- ============================================================================

ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "ArchivadaEn" TIMESTAMPTZ;
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "MotivoArchivo" VARCHAR(30);
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "MotivoArchivoTexto" VARCHAR(60);
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "FechaFallecimiento" DATE;
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "EliminadaEn" TIMESTAMPTZ;
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "PurgarDespues" TIMESTAMPTZ;

-- Campos del alta/edición que la tabla todavía no tiene (§5)
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Tamano" VARCHAR(10);          -- small|medium|large
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Castrado" BOOLEAN;            -- null = "no sé"
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Microchip" VARCHAR(15);
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "Descripcion" VARCHAR(150);
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "VisibleEnMatch" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "Mascota" ADD COLUMN IF NOT EXISTS "SenasParticulares" VARCHAR(200);

-- Estados válidos
DO $$ BEGIN
  ALTER TABLE "Mascota" ADD CONSTRAINT chk_mascota_estado
    CHECK ("Estado" IN ('active','archived','memorial','deleted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Microchip único global (nunca se revela de quién es al chocar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mascota_microchip
  ON "Mascota" ("Microchip") WHERE "Microchip" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mascota_user_estado
  ON "Mascota" ("Id_User", "Estado");

-- Solo una principal activa por usuario, garantizado por la base
CREATE UNIQUE INDEX IF NOT EXISTS idx_mascota_una_principal
  ON "Mascota" ("Id_User") WHERE "EsActiva" = TRUE AND "Estado" = 'active';

-- Backfill: todo lo existente queda como activo
UPDATE "Mascota" SET "Estado" = 'active' WHERE "Estado" IS NULL;

-- Auditoría del ciclo de vida (§7.1 pet_status_history)
CREATE TABLE IF NOT EXISTS mascota_estado_historial (
  id          BIGSERIAL PRIMARY KEY,
  id_mascota  INTEGER NOT NULL,
  desde       VARCHAR(20),
  hasta       VARCHAR(20) NOT NULL,
  motivo      VARCHAR(60),
  cambiado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cambiado_por INTEGER
);

CREATE INDEX IF NOT EXISTS idx_estado_historial_mascota
  ON mascota_estado_historial (id_mascota);

ALTER TABLE mascota_estado_historial DISABLE ROW LEVEL SECURITY;
