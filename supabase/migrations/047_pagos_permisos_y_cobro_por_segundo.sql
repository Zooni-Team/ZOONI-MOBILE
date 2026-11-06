-- =============================================================================
-- Migración 047: permisos de la cuenta corriente y cobro por segundo
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 044 y la 045.
-- =============================================================================
-- EL BUG ("Registrar pago" → "No se pudo guardar"):
--   La cuenta corriente se LEE bien pero el pago no se GUARDA. Es el mismo
--   caso que la 038: si paseo_pagos quedó con RLS activo (Supabase lo prende
--   solo en tablas nuevas) o sin GRANT para anon, el SELECT vuelve vacío sin
--   error y el INSERT falla con "row-level security" / "permission denied".
--   Se vuelven a aplicar los permisos de la 044 / 045, sin depender de que
--   se hayan corrido completas.
--
-- COBRO POR SEGUNDO:
--   Antes cada minuto empezado contaba entero (31 s se cobraban como 1 min).
--   Ahora se cobra el tiempo exacto, con tope en el precio pactado:
--     cobrado = PrecioPactado × SegundosAcumulados / (DuracionMin × 60)
--   Ej: $20.000 por 120 min → 31 s $86,11 · 1 min $166,66 · 2 min $333,33.
--   Misma cuenta que precioPorTiempo en paseadorApi.js.
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['paseo_pagos', 'paseo_cuenta_config'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
    ELSE
      RAISE NOTICE 'No existe %, ¿falta correr la 044 / 045?', t;
    END IF;
  END LOOP;
END $$;

-- paseo_pagos.id es BIGSERIAL: sin USAGE en la secuencia el INSERT falla con
-- "permission denied for sequence"
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Paseos que ya se cobraron proporcionales (cortados antes de tiempo):
-- recalcularlos por segundo. Los completos (Precio = PrecioPactado) no se tocan.
UPDATE "Paseo" SET "Precio" = LEAST(
    "PrecioPactado",
    FLOOR("PrecioPactado" * "SegundosAcumulados" * 100 / ("DuracionMin" * 60)) / 100)
  WHERE "Estado" = 'finalizado'
    AND "PrecioPactado" IS NOT NULL
    AND "Precio" < "PrecioPactado"
    AND "SegundosAcumulados" > 0
    AND "DuracionMin" > 0;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('paseo_pagos', 'paseo_cuenta_config');
--     (relrowsecurity tiene que dar false)
--   SELECT "Id_Paseo", "SegundosAcumulados", "DuracionMin", "PrecioPactado", "Precio"
--     FROM "Paseo" WHERE "Estado" = 'finalizado' ORDER BY "Id_Paseo" DESC LIMIT 10;
