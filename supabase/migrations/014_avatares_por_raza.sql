-- =============================================================================
-- Migración 014: Avatares específicos por raza (empezando por Mestizo)
-- =============================================================================
-- Cada raza va a tener su propio set de looks — esto agrega la columna para
-- poder filtrarlos y carga los primeros 3 looks reales, para perros Mestizo /
-- Sin raza definida. Si "razas" queda NULL, el look sigue siendo genérico
-- para toda la especie (los 6 looks ya existentes no cambian). Idempotente.
-- =============================================================================

ALTER TABLE avatares_catalogo ADD COLUMN IF NOT EXISTS razas TEXT[];

INSERT INTO avatares_catalogo (especie, asset_name, nombre, orden, razas)
SELECT * FROM (VALUES
  ('perro', 'perro_mestizo_breakingbad',    'Detective',  7, ARRAY['Mestizo / Sin raza definida']),
  ('perro', 'perro_mestizo_ballindeverdad', 'Rapero',     8, ARRAY['Mestizo / Sin raza definida']),
  ('perro', 'perro_mestizo_bienagustin',    'Con Onda',   9, ARRAY['Mestizo / Sin raza definida'])
) AS v(especie, asset_name, nombre, orden, razas)
WHERE NOT EXISTS (SELECT 1 FROM avatares_catalogo WHERE asset_name = v.asset_name);
