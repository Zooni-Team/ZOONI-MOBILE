-- =============================================================================
-- Migración 016: Historial de peso + Consultas veterinarias
-- Base de datos: Postgres (Supabase) — correr en el SQL Editor. Idempotente.
-- =============================================================================
-- historial_peso: cada vez que se actualiza el peso desde Ficha Médica se
-- guarda un registro acá, para ver la evolución (no solo el último valor).
--
-- consultas_veterinarias: anotaciones de consultas pasadas (motivo, notas,
-- veterinario) — se muestran en la app y se incluyen en el PDF de la ficha
-- para poder mostrárselas a un veterinario.
-- =============================================================================

CREATE TABLE IF NOT EXISTS historial_peso (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  peso_kg     DECIMAL(5,2) NOT NULL,
  fecha       TIMESTAMP DEFAULT NOW()
);
ALTER TABLE historial_peso DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_historial_peso_mascota ON historial_peso(mascota_id, fecha DESC);

CREATE TABLE IF NOT EXISTS consultas_veterinarias (
  id          SERIAL PRIMARY KEY,
  mascota_id  INTEGER NOT NULL REFERENCES "Mascota"("Id_Mascota") ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  motivo      VARCHAR(150) NOT NULL,
  notas       TEXT,
  veterinario VARCHAR(120),
  creado_en   TIMESTAMP DEFAULT NOW()
);
ALTER TABLE consultas_veterinarias DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consultas_mascota ON consultas_veterinarias(mascota_id, fecha DESC);

-- Semilla del peso actual de cada mascota como primer punto del historial
-- (solo si la tabla está vacía, para que el gráfico no arranque en blanco).
INSERT INTO historial_peso (mascota_id, peso_kg)
SELECT "Id_Mascota", "Peso" FROM "Mascota"
WHERE "Peso" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM historial_peso LIMIT 1);
