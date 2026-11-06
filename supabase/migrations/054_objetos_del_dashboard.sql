-- =============================================================================
-- 054_objetos_del_dashboard.sql — Lo que existía en la base viva pero no en
-- ningún script. Idempotente.
-- =============================================================================
-- Al comparar el esquema que arman 000…053 sobre una base vacía contra el
-- export de la base real (modelo_datos_zooni.txt, ya quitado del repo), las
-- únicas diferencias eran estas dos, creadas a mano desde el dashboard:
--
--   · "User"."UltimaConexion": la usa presenciaApi.js para el "en línea" de
--     Comunidad.
--   · zooni_politica_tablas: tabla de anotaciones que acompañaba a las
--     políticas "zooni_app_acceso" / "zooni_catalogo_lectura". Esas políticas
--     las reemplaza 061_rls_por_usuario.sql; la tabla queda para no perder
--     la documentación de qué es catálogo y qué es dato de usuario.
-- =============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "UltimaConexion" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS zooni_politica_tablas (
  tabla     TEXT PRIMARY KEY,
  categoria TEXT NOT NULL,
  motivo    TEXT
);

ALTER TABLE zooni_politica_tablas ENABLE ROW LEVEL SECURITY;
