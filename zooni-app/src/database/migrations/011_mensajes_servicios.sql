-- =============================================================================
-- Migración 011: Chat con servicios (veterinarias, paseadores, etc.)
-- =============================================================================
-- La tabla "Mensaje" solo servía para chats de Match (idMatch NOT NULL).
-- Para poder escribirle a una veterinaria/paseador/petshop/peluquería desde
-- Comunidad o desde Mensajes, agregamos "idServicio" y dejamos "idMatch"
-- opcional: cada fila pertenece a un Match O a un servicio, nunca a los dos.
-- Idempotente: se puede correr más de una vez.
-- =============================================================================

ALTER TABLE "Mensaje" ALTER COLUMN "idMatch" DROP NOT NULL;
ALTER TABLE "Mensaje" ADD COLUMN IF NOT EXISTS "idServicio" INTEGER REFERENCES servicios(id);
CREATE INDEX IF NOT EXISTS idx_mensaje_servicio ON "Mensaje"("idServicio");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Mensaje' AND constraint_name = 'mensaje_destino_check'
  ) THEN
    ALTER TABLE "Mensaje" ADD CONSTRAINT mensaje_destino_check CHECK (
      ("idMatch" IS NOT NULL AND "idServicio" IS NULL)
      OR ("idMatch" IS NULL AND "idServicio" IS NOT NULL)
    );
  END IF;
END $$;
