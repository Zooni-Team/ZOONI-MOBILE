-- =============================================================================
-- Migración 049: permisos de las tablas de Zooni Negocios
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- Requiere la 046.
-- =============================================================================
-- EL BUG ("Ya registré mi veterinaria pero el login dice que no tengo una"):
--   Es el mismo de los paseadores (038). El registro guarda el negocio con una
--   RPC SECURITY DEFINER (pasa por encima de RLS y de los permisos), así que el
--   INSERT funciona. Pero después la app LEE negocio_perfil con la key pública
--   (rol anon), y si la tabla quedó con RLS activo (Supabase puede activarlo
--   solo en tablas nuevas) la lectura vuelve VACÍA sin error. El login
--   concluía "esta cuenta no tiene una veterinaria" y ofrecía sumarla de
--   nuevo: un bucle.
--
-- LA SOLUCIÓN (igual que la 038 / 047):
--   · RLS desactivado en las tablas de negocios, como el resto de las tablas
--     de la app (ver 010: sin Supabase Auth todavía no hay políticas por usuario).
--   · GRANT explícitos para anon/authenticated.
--   · Recargar el caché de PostgREST.
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['negocio_perfil', 'negocio_items', 'negocio_turnos', 'negocio_pedidos', 'servicios'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
    ELSE
      RAISE NOTICE 'No existe %, ¿falta correr la 046?', t;
    END IF;
  END LOOP;
END $$;

-- Columnas serial/identity: sin USAGE el INSERT falla con
-- "permission denied for sequence"
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Las RPCs públicas de negocios (por si el proyecto no da EXECUTE por defecto)
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'registrar_negocio(jsonb, text, jsonb)',
    'activar_negocio(text, text, jsonb)'
  ] LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'No existe %, ¿falta correr la 046?', f;
    END;
  END LOOP;
END $$;

-- Que la API vea los cambios ya mismo
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIÓN (correr aparte):
--   SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname IN ('negocio_perfil', 'negocio_items', 'negocio_turnos', 'negocio_pedidos');
--     (relrowsecurity tiene que dar false en todas)
--
--   Tu negocio (cambiá el mail):
--   SELECT n.id, n.tipo, n.nombre, u."Id_User", u."Mail"
--     FROM negocio_perfil n JOIN "User" u ON u."Id_User" = n.id_user
--     WHERE lower(u."Mail") = 'tu@mail.com';
-- =============================================================================
