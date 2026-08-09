-- ============================================================================
-- 029_bloqueos_reportes.sql — Bloquear y reportar usuarios (Match / Comunidad)
--
-- Tablas propias y autocontenidas (no dependen del 019). Idempotente:
-- correr completo en Supabase → SQL Editor.
-- ============================================================================

-- Usuarios que YO bloqueé (efecto: no aparecen en Match ni me escriben)
CREATE TABLE IF NOT EXISTS usuarios_bloqueados (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL,   -- el que bloquea (yo)
  bloqueado_id INTEGER NOT NULL,   -- el bloqueado
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, bloqueado_id)
);
CREATE INDEX IF NOT EXISTS idx_bloqueados_usuario ON usuarios_bloqueados (usuario_id);

-- Reportes de usuarios / contenido (los revisa el equipo, no la app)
CREATE TABLE IF NOT EXISTS reportes (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL,   -- quién reporta
  reportado_id INTEGER,            -- usuario reportado
  motivo       VARCHAR(60) NOT NULL,
  detalle      VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reportes_reportado ON reportes (reportado_id);

ALTER TABLE usuarios_bloqueados DISABLE ROW LEVEL SECURITY;
ALTER TABLE reportes            DISABLE ROW LEVEL SECURITY;

-- El cliente gestiona sus bloqueos; puede crear reportes pero no leerlos ni
-- editarlos (moderación es del equipo, con service_role).
GRANT SELECT, INSERT, DELETE ON usuarios_bloqueados TO anon, authenticated;
GRANT INSERT ON reportes TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE usuarios_bloqueados_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE reportes_id_seq TO anon, authenticated;
