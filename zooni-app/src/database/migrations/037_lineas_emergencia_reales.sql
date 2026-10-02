-- =============================================================================
-- Migración 037: líneas de emergencia REALES en S.O.S Veterinario
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- LO QUE HABÍA (018):
--   · "Línea Zooni 24 hs: 0800-123-4567" → número inventado de relleno. Zooni
--     no tiene línea telefónica; quien lo marcaba caía en cualquier lado.
--   · "Emergencias: 911" → es real, pero el 911 no atiende animales y la card
--     decía "Veterinarias de emergencia 24hs".
--
-- LO QUE QUEDA (verificado en fuentes oficiales, oct-2026):
--   · Centro Nacional de Intoxicaciones (Hospital Posadas)
--       0800-333-0160 · gratuito · 24 hs todos los días
--       Fuente: argentina.gob.ar/salud/hospital-nacional-posadas/intoxicaciones
--       Es un centro de toxicología HUMANA: sirve para orientarse si la mascota
--       comió veneno, raticida, medicamentos o productos de limpieza, pero la
--       mascota igual tiene que ir a una veterinaria.
--   · Instituto de Zoonosis Luis Pasteur (GCBA) — Av. Díaz Vélez 4821, CABA
--       011 4958-9900 · todos los días de 8 a 18 (denuncias por mordedura,
--       rabia, observación antirrábica). NO es guardia veterinaria.
--       Fuente: buenosaires.gob.ar (Departamento de Prevención y Control de Zoonosis)
--
-- No existe en Argentina una línea pública de emergencias veterinarias 24 hs:
-- la atención de urgencia la dan las veterinarias con guardia (la lista que la
-- pantalla muestra debajo de esta card).
-- =============================================================================

-- 1. Nuevos tipos de línea + columna de horario
ALTER TABLE emergency_lines DROP CONSTRAINT IF EXISTS emergency_lines_kind_check;
ALTER TABLE emergency_lines ADD CONSTRAINT emergency_lines_kind_check
  CHECK (kind IN ('zooni', 'national_emergency', 'intoxicaciones', 'zoonosis'));

ALTER TABLE emergency_lines ADD COLUMN IF NOT EXISTS schedule VARCHAR(60);

-- 2. Apagar las líneas de relleno (no se borran: quedan en el historial de llamadas)
UPDATE emergency_lines SET is_active = FALSE
WHERE country_code = 'AR' AND kind IN ('zooni', 'national_emergency');

-- 3. Líneas reales
INSERT INTO emergency_lines (country_code, label, phone, kind, priority, schedule)
SELECT 'AR', 'Intoxicaciones', '0800-333-0160', 'intoxicaciones', 1, 'Gratis · 24 hs'
WHERE NOT EXISTS (SELECT 1 FROM emergency_lines WHERE kind = 'intoxicaciones' AND country_code = 'AR');

INSERT INTO emergency_lines (country_code, label, phone, kind, priority, schedule)
SELECT 'AR', 'Zoonosis y rabia (Inst. Pasteur)', '011 4958-9900', 'zoonosis', 2, 'Todos los días 8 a 18 h · CABA'
WHERE NOT EXISTS (SELECT 1 FROM emergency_lines WHERE kind = 'zoonosis' AND country_code = 'AR');
