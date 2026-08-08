-- ============================================================================
-- 022_fix_historial.sql — Arregla el 401 al insertar en mascota_estado_historial
--
-- El INSERT de auditoría desde la app devolvía 401 (Unauthorized): a la tabla
-- (o a su secuencia serial) le faltaban permisos para el rol anon. La app lo
-- ignora (la auditoría es best-effort), pero el registro no se guardaba.
-- Idempotente: correr completo en Supabase → SQL Editor.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'mascota_estado_historial') THEN
    ALTER TABLE mascota_estado_historial DISABLE ROW LEVEL SECURITY;

    -- Puede agregar filas y leerlas; nunca reescribir la historia
    GRANT SELECT, INSERT ON mascota_estado_historial TO anon, authenticated;
    REVOKE UPDATE, DELETE ON mascota_estado_historial FROM anon;

    -- El BIGSERIAL necesita permiso sobre su secuencia para insertar
    GRANT USAGE, SELECT ON SEQUENCE mascota_estado_historial_id_seq TO anon, authenticated;
  END IF;
END $$;
