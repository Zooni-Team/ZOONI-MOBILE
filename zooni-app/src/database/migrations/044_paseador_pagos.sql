-- =============================================================================
-- Migración 044: Pagos — cuenta corriente del paseador con cada dueño
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035.
-- =============================================================================
-- · "Paseo"."MedioPago": cómo dice el dueño que va a pagar (lo elige al pedir
--   el paseo). El paseador lo ve en su sección Pagos.
-- · paseo_pagos: cada pago que el paseador anota (total o parcial), con medio,
--   fecha y nota. Se pueden corregir o borrar.
--
-- La cuenta corriente NO se guarda: se calcula en la app.
--   debe   = suma de los paseos FINALIZADOS con ese dueño ("Paseo"."Precio")
--   pagado = suma de paseo_pagos de ese dueño
--   saldo  = debe - pagado   (> 0 te debe · 0 al día · < 0 a favor del dueño)
-- Los pagos se imputan a los paseos más viejos primero (así cada paseo
-- figura como pagado, parcial o pendiente).
-- =============================================================================

ALTER TABLE "Paseo" ADD COLUMN IF NOT EXISTS "MedioPago" VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Paseo' AND constraint_name = 'paseo_medio_pago_ok'
  ) THEN
    ALTER TABLE "Paseo" ADD CONSTRAINT paseo_medio_pago_ok
      CHECK ("MedioPago" IS NULL OR "MedioPago" IN ('efectivo', 'transferencia', 'mercadopago', 'otro'));
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS paseo_pagos (
  id             BIGSERIAL PRIMARY KEY,
  id_walker      INTEGER NOT NULL REFERENCES "User"("Id_User"),
  id_dueno       INTEGER NOT NULL REFERENCES "User"("Id_User"),
  monto          NUMERIC(10,2) NOT NULL,
  medio          VARCHAR(20) NOT NULL DEFAULT 'efectivo',
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now(),
  nota           VARCHAR(300),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paseo_pagos_monto_ok CHECK (monto > 0),
  CONSTRAINT paseo_pagos_medio_ok CHECK (medio IN ('efectivo', 'transferencia', 'mercadopago', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_paseo_pagos_cuenta ON paseo_pagos(id_walker, id_dueno, fecha);

-- Como el resto de las tablas de paseadores (ver 038): sin Supabase Auth
-- todavía no hay políticas por usuario.
ALTER TABLE paseo_pagos DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON paseo_pagos TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE paseo_pagos_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT id_dueno, sum(monto) FROM paseo_pagos GROUP BY id_dueno;
