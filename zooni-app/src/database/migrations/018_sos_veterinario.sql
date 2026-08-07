-- =============================================================================
-- Migración 018: S.O.S Veterinario (Instruction-SOS, Rama B adaptada)
-- Base de datos: Postgres (Supabase) — correr en el SQL Editor. Idempotente.
-- =============================================================================
-- emergency_lines:     líneas de emergencia configurables por país, para que
--                      los números de los botones C1/C2 no estén hardcodeados.
-- veterinary_clinics:  veterinarias del listado (lat/lng como DECIMAL, igual
--                      que ubicacion_usuario de la migración 010 — la distancia
--                      se calcula en el cliente; PostGIS + RPC nearby_clinics
--                      quedan para cuando el proyecto adopte la extensión).
-- sos_events:          emergencias iniciadas por el usuario (variante V7).
-- sos_call_logs:       auditoría de llamados — nunca bloquea la UI.
-- emergency_contacts:  contactos a avisar cuando se inicia un SOS.
--
-- Igual que el resto de las migraciones, RLS queda deshabilitada porque la
-- app todavía no usa Supabase Auth (ver src/config/session.js). Cuando se
-- migre a auth real, aplicar las políticas de la sección 4.3 del prompt.
-- =============================================================================

CREATE TABLE IF NOT EXISTS emergency_lines (
  id            SERIAL PRIMARY KEY,
  country_code  VARCHAR(2)   NOT NULL,           -- ISO-3166 alpha-2, ej. 'AR'
  label         VARCHAR(80)  NOT NULL,           -- ej. 'Línea Zooni 24 hs'
  phone         VARCHAR(30)  NOT NULL,           -- en formato marcable
  kind          VARCHAR(30)  NOT NULL CHECK (kind IN ('zooni', 'national_emergency')),
  priority      INTEGER      NOT NULL DEFAULT 0, -- orden de aparición, menor primero
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);
ALTER TABLE emergency_lines DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_emergency_lines_pais ON emergency_lines(country_code, priority);

CREATE TABLE IF NOT EXISTS veterinary_clinics (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(120)  NOT NULL,
  phone             VARCHAR(30)   NOT NULL,
  whatsapp          VARCHAR(30),
  address           VARCHAR(200)  NOT NULL,
  neighborhood      VARCHAR(80),                  -- zona, se usa en la búsqueda
  city              VARCHAR(80),
  province          VARCHAR(80),
  lat               DECIMAL(10,7),
  lng               DECIMAL(10,7),
  logo_url          VARCHAR(500),
  specialties       TEXT[]        NOT NULL DEFAULT '{}',
  services          TEXT[]        NOT NULL DEFAULT '{}', -- internacion, cirugia, radiologia, domicilio
  is_24h            BOOLEAN       NOT NULL DEFAULT FALSE,
  emergency_service BOOLEAN       NOT NULL DEFAULT FALSE, -- controla el badge URGENCIAS
  opening_hours     JSONB,                        -- {"mon":[["08:00","20:00"]], ...} soporta cortes de mediodía
  rating_avg        DECIMAL(2,1),                 -- denormalizado, 0.0–5.0
  rating_count      INTEGER       NOT NULL DEFAULT 0,
  is_verified       BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);
ALTER TABLE veterinary_clinics DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_clinics_activas ON veterinary_clinics(is_active, emergency_service);

CREATE TABLE IF NOT EXISTS sos_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      NOT NULL REFERENCES "User"("Id_User"),
  pet_id       INTEGER      REFERENCES "Mascota"("Id_Mascota"),
  clinic_id    INTEGER      REFERENCES veterinary_clinics(id),
  status       VARCHAR(20)  NOT NULL DEFAULT 'searching'
               CHECK (status IN ('searching', 'confirmed', 'on_the_way', 'resolved', 'cancelled')),
  origin       VARCHAR(30)  CHECK (origin IN ('hotline', 'emergency_number', 'clinic_call', 'manual')),
  lat          DECIMAL(10,7),
  lng          DECIMAL(10,7),
  notes        TEXT,                              -- qué le pasa a la mascota
  started_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMP
);
ALTER TABLE sos_events DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sos_events_usuario ON sos_events(user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS sos_call_logs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER     REFERENCES "User"("Id_User"),
  clinic_id     INTEGER     REFERENCES veterinary_clinics(id),
  line_id       INTEGER     REFERENCES emergency_lines(id),
  phone_dialed  VARCHAR(30) NOT NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);
ALTER TABLE sos_call_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER      NOT NULL REFERENCES "User"("Id_User"),
  name           VARCHAR(80)  NOT NULL,
  phone          VARCHAR(30)  NOT NULL,
  relation       VARCHAR(50),
  notify_on_sos  BOOLEAN      NOT NULL DEFAULT TRUE
);
ALTER TABLE emergency_contacts DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Semillas
-- =============================================================================

INSERT INTO emergency_lines (country_code, label, phone, kind, priority)
SELECT 'AR', 'Línea Zooni 24 hs', '0800-123-4567', 'zooni', 1
WHERE NOT EXISTS (SELECT 1 FROM emergency_lines WHERE kind = 'zooni' AND country_code = 'AR');

INSERT INTO emergency_lines (country_code, label, phone, kind, priority)
SELECT 'AR', 'Emergencias', '911', 'national_emergency', 2
WHERE NOT EXISTS (SELECT 1 FROM emergency_lines WHERE kind = 'national_emergency' AND country_code = 'AR');

INSERT INTO veterinary_clinics
  (name, phone, address, neighborhood, city, lat, lng, specialties, services, is_24h, emergency_service, opening_hours, rating_avg, rating_count, is_verified)
SELECT * FROM (VALUES
  ('Clínica Veterinaria del Centro', '011-4901-2233', 'Av. Rivadavia 4980', 'Caballito', 'CABA',
   -34.6187000, -58.4370000, ARRAY['Medicina General','Emergencias'], ARRAY['internacion','cirugia'],
   FALSE, TRUE,
   '{"mon":[["08:00","20:00"]],"tue":[["08:00","20:00"]],"wed":[["08:00","20:00"]],"thu":[["08:00","20:00"]],"fri":[["08:00","20:00"]],"sat":[["09:00","13:00"]],"sun":[]}'::jsonb,
   4.8, 87, TRUE),
  ('Veterinaria San Roque 24 hs', '011-4902-8800', 'Av. La Plata 355', 'Caballito', 'CABA',
   -34.6152000, -58.4258000, ARRAY['Emergencias','Internación'], ARRAY['internacion','radiologia'],
   TRUE, TRUE, NULL, 4.6, 54, TRUE),
  ('Hospital Veterinario Belgrano', '011-4788-1144', 'Av. Cabildo 2250', 'Belgrano', 'CABA',
   -34.5601000, -58.4590000, ARRAY['Medicina General','Cirugía','Emergencias'], ARRAY['internacion','cirugia','radiologia'],
   FALSE, TRUE,
   '{"mon":[["08:00","21:00"]],"tue":[["08:00","21:00"]],"wed":[["08:00","21:00"]],"thu":[["08:00","21:00"]],"fri":[["08:00","21:00"]],"sat":[["08:00","21:00"]],"sun":[["09:00","18:00"]]}'::jsonb,
   4.9, 203, TRUE),
  ('Veterinaria Patitas', '011-4632-5511', 'Bogotá 2140', 'Flores', 'CABA',
   -34.6289000, -58.4622000, ARRAY['Medicina General','Vacunación'], ARRAY[]::text[],
   FALSE, FALSE,
   '{"mon":[["09:00","19:00"]],"tue":[["09:00","19:00"]],"wed":[["09:00","19:00"]],"thu":[["09:00","19:00"]],"fri":[["09:00","19:00"]],"sat":[["09:00","13:00"]],"sun":[]}'::jsonb,
   4.3, 31, FALSE),
  ('Centro Veterinario Flores', '011-4611-7788', 'Av. Avellaneda 3652', 'Flores', 'CABA',
   -34.6334000, -58.4761000, ARRAY['Medicina General','Dermatología'], ARRAY['domicilio'],
   FALSE, FALSE,
   '{"mon":[["08:00","13:00"],["16:00","20:00"]],"tue":[["08:00","13:00"],["16:00","20:00"]],"wed":[["08:00","13:00"],["16:00","20:00"]],"thu":[["08:00","13:00"],["16:00","20:00"]],"fri":[["08:00","13:00"],["16:00","20:00"]],"sat":[],"sun":[]}'::jsonb,
   4.5, 42, FALSE),
  ('Clínica Felina Miau', '011-4855-9090', 'Aráoz 1128', 'Palermo', 'CABA',
   -34.5936000, -58.4211000, ARRAY['Felinos','Medicina General'], ARRAY[]::text[],
   FALSE, FALSE,
   '{"mon":[["10:00","19:00"]],"tue":[["10:00","19:00"]],"wed":[["10:00","19:00"]],"thu":[["10:00","19:00"]],"fri":[["10:00","19:00"]],"sat":[["10:00","14:00"]],"sun":[]}'::jsonb,
   4.7, 66, FALSE),
  ('Veterinaria Zooni a Domicilio', '011-15-6044-2211', 'Atiende en tu casa', 'CABA', 'CABA',
   NULL, NULL, ARRAY['Atención a domicilio','Urgencias'], ARRAY['domicilio'],
   TRUE, TRUE, NULL, NULL, 0, FALSE)
) AS v(name, phone, address, neighborhood, city, lat, lng, specialties, services, is_24h, emergency_service, opening_hours, rating_avg, rating_count, is_verified)
WHERE NOT EXISTS (SELECT 1 FROM veterinary_clinics LIMIT 1);
