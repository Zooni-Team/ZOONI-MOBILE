-- ============================================================================
-- 019_configuracion.sql — Esquema de Configuración (Instruction-Configuracion §4)
--
-- Idempotente: se puede correr más de una vez sin romper nada.
-- Nota: el spec asume Supabase Auth (auth.users / auth.uid()). Mientras la app
-- siga con el login interim (tabla "User", sin Supabase Auth), user_id guarda
-- el "Id_User" como bigint y las políticas RLS quedan definidas pero las
-- tablas se crean con RLS deshabilitado, igual que el resto del schema vivo.
-- Al migrar a Supabase Auth: cambiar user_id a uuid FK auth.users y habilitar
-- RLS con las políticas comentadas al pie.
-- ============================================================================

-- ── user_settings: una fila por usuario, preferencias de CUENTA en jsonb ────
-- (las preferencias de dispositivo NO van acá: viven solo en el teléfono)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        BIGINT PRIMARY KEY,
  privacy        JSONB NOT NULL DEFAULT '{}'::jsonb,
  notifications  JSONB NOT NULL DEFAULT '{}'::jsonb,
  wellbeing      JSONB NOT NULL DEFAULT '{}'::jsonb,
  locale         TEXT NOT NULL DEFAULT 'es-AR',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_user_settings_privacy
  ON user_settings USING gin (privacy);

-- Trigger: updated_at + version en cada escritura (resuelve conflictos
-- entre dispositivos: el cliente manda la versión que cree tener y si no
-- coincide recibe 409 con el estado actual)
CREATE OR REPLACE FUNCTION user_settings_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_settings_touch ON user_settings;
CREATE TRIGGER trg_user_settings_touch
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION user_settings_touch();

-- ── blocked_users: bloquear es bidireccional en efecto ──────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL,
  blocked_user_id  BIGINT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id)
);

-- ── muted_users: silenciar es unidireccional ────────────────────────────────
CREATE TABLE IF NOT EXISTS muted_users (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL,
  muted_user_id  BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id)
);

-- ── user_sessions: alimenta "Sesiones activas" (§3.5.1) ─────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL,
  device_name    TEXT,
  device_model   TEXT,
  os             TEXT,
  app_version    TEXT,
  ip_country     TEXT,
  ip_city        TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);

-- ── app_usage_daily: un upsert por sesión de app, no un ping por minuto ─────
CREATE TABLE IF NOT EXISTS app_usage_daily (
  user_id       BIGINT NOT NULL,
  date          DATE NOT NULL,
  total_seconds INT NOT NULL DEFAULT 0,
  by_section    JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, date),
  -- El dato no debe ser manipulable: máximo un día entero y sin fechas futuras
  CONSTRAINT chk_usage_seconds CHECK (total_seconds >= 0 AND total_seconds <= 86400),
  CONSTRAINT chk_usage_date    CHECK (date <= CURRENT_DATE)
);

-- ── deletion_requests: período de gracia de 30 días ─────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  reason        TEXT,
  reason_text   TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON deletion_requests (user_id);

-- ── data_export_requests: rate limit de una solicitud cada 48 horas ─────────
CREATE TABLE IF NOT EXISTS data_export_requests (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','processing','ready','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_url     TEXT,
  expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests (user_id);

-- ── subscriptions: fuente de verdad = webhooks de la tienda, nunca el cliente
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL UNIQUE,
  plan                 TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','plus')),
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','grace_period','cancelled','expired')),
  store                TEXT CHECK (store IN ('app_store','play_store')),
  store_transaction_id TEXT,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RLS (§4.3) — DEJAR COMENTADO hasta migrar a Supabase Auth.
-- Con el login interim la app usa la anon key sin auth.uid(), así que
-- habilitar esto hoy rompería todas las lecturas.
--
-- ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE blocked_users        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE muted_users          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_sessions        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_usage_daily      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deletion_requests    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
--
-- -- user_settings: select/insert/update propios, SIN delete
-- CREATE POLICY user_settings_own ON user_settings
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--
-- -- subscriptions: el usuario lee la suya; escribe solo service_role
-- CREATE POLICY subscriptions_read_own ON subscriptions
--   FOR SELECT USING (auth.uid() = user_id);
--
-- -- blocked_users: el bloqueado NO puede leer la fila que lo bloquea
-- CREATE POLICY blocked_users_own ON blocked_users
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- ============================================================================
