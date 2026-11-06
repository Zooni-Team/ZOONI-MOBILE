-- =============================================================================
-- Migración 038: permisos de las tablas de Zooni Paseadores
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 035 (y conviene la 036).
-- =============================================================================
-- EL BUG ("Empezar a pasear" no hace nada / vuelve al formulario):
--   El registro guarda el perfil con una RPC SECURITY DEFINER (pasa por encima
--   de RLS y de los permisos), así que el INSERT funciona. Pero después la app
--   LEE paseador_perfil con la key pública (rol anon), y si la tabla quedó con
--   RLS activo (Supabase puede activarlo solo en tablas nuevas) o sin GRANT
--   para anon, la lectura vuelve VACÍA sin error. La app concluía "tiene el rol
--   pero no el perfil" y mandaba de nuevo al formulario: un bucle.
--
-- LA SOLUCIÓN:
--   · RLS desactivado en las tablas de paseadores, como el resto de las tablas
--     de la app (ver 010: sin Supabase Auth todavía no hay políticas por usuario).
--   · GRANT explícitos para anon/authenticated (no depender de los permisos
--     por defecto del proyecto).
--   · Recargar el caché de PostgREST: si quedó viejo, las RPCs nuevas
--     (registrar_paseador, completar_perfil_paseador…) devuelven "not found".
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['paseador_perfil', 'paseo_rechazos', 'paseo_mensajes', 'Paseo', 'PaseoTrack'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- Columnas identity (paseo_mensajes.id, PaseoTrack.Id, Paseo.Id_Paseo) usan
-- secuencias: sin USAGE el INSERT falla con "permission denied for sequence".
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Las RPCs públicas de paseadores (por si el proyecto no da EXECUTE por defecto)
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'registrar_paseador(jsonb, text, jsonb)',
    'activar_paseador(text, text, jsonb)',
    'aceptar_solicitud_paseo(integer, integer)',
    'completar_perfil_paseador(integer, jsonb)'
  ] LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'No existe %, ¿falta correr la 035/036?', f;
    END;
  END LOOP;
END $$;

-- Que la API vea las tablas y funciones nuevas ya mismo
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIÓN (correr aparte, debería devolver tu perfil):
--   SELECT id_user, zona, precio_30, precio_60 FROM paseador_perfil;
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('paseador_perfil','paseo_mensajes','paseo_rechazos');
--   -- relrowsecurity tiene que dar false en las tres
-- =============================================================================
