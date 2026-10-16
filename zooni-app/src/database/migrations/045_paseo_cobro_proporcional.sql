-- =============================================================================
-- Migración 045: Cobro proporcional al tiempo, comisión Zooni y cobro por período
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035 y la 044.
-- =============================================================================
-- · Al FINALIZAR un paseo se cobra según el tiempo real (como Uber / DiDi):
--     minutos  = minutos empezados (30 s cuentan como 1 minuto)
--     cobrado  = PrecioPactado × minutos / DuracionMin   (tope: PrecioPactado)
--   "Precio" pasa a guardar lo COBRADO, así ganancias, cuenta corriente e
--   historial lo usan sin cambios. Lo que se había pactado queda en
--   "PrecioPactado".
-- · "Comision": lo que cobra Zooni por ESE paseo. Se fija al tocar Finalizar,
--   pague el dueño en el momento, a fin de mes o nunca.
-- · paseo_cuenta_config: cada cuánto le cobra el paseador a cada dueño
--   ('por_paseo', 'semanal' o 'mensual'). Al cerrarse el período, si el dueño
--   debe plata, al paseador le llega un recordatorio. ultimo_recordatorio
--   evita avisar dos veces por el mismo período.
-- =============================================================================

ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "PrecioPactado" NUMERIC(10,2);
ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "Comision"      NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Los paseos ya finalizados se cobraron completos
UPDATE "Paseo" SET "PrecioPactado" = "Precio" WHERE "PrecioPactado" IS NULL AND "Estado" = 'finalizado';


CREATE TABLE IF NOT EXISTS paseo_cuenta_config (
  id_walker           INTEGER NOT NULL REFERENCES "User"("Id_User"),
  id_dueno            INTEGER NOT NULL REFERENCES "User"("Id_User"),
  modalidad           VARCHAR(12) NOT NULL DEFAULT 'por_paseo',
  ultimo_recordatorio DATE,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_walker, id_dueno),
  CONSTRAINT paseo_cuenta_modalidad_ok CHECK (modalidad IN ('por_paseo', 'semanal', 'mensual'))
);

-- Como el resto de las tablas de paseadores (ver 038): sin Supabase Auth
-- todavía no hay políticas por usuario.
ALTER TABLE paseo_cuenta_config DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON paseo_cuenta_config TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- OPCIONAL — recalcular por tiempo los paseos que ya se finalizaron antes de
-- esta migración (ej. pruebas que se cortaron al minuto y quedaron con el
-- precio completo). Misma cuenta que precioPorTiempo en paseadorApi.js:
--
--   UPDATE "Paseo" SET "Precio" = LEAST(
--     "PrecioPactado",
--     FLOOR("PrecioPactado" * CEIL("SegundosAcumulados" / 60.0) * 100 / "DuracionMin") / 100)
--   WHERE "Estado" = 'finalizado' AND "DuracionMin" > 0;

-- Verificación:
--   SELECT "Id_Paseo", "PrecioPactado", "Precio", "Comision" FROM "Paseo" WHERE "Estado" = 'finalizado';
--   SELECT * FROM paseo_cuenta_config;
