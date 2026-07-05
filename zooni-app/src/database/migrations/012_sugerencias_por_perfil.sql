-- =============================================================================
-- Migración 012: Sugerencias de Vacunas/Tratamientos/Consejos según el perfil
-- de la mascota (raza, edad, peso) — no solo por especie.
-- =============================================================================
-- Agrega columnas de "targeting" opcionales a los 3 catálogos. Si quedan en
-- NULL, la sugerencia sigue aplicando a cualquier mascota de esa especie
-- (comportamiento actual, sin cambios); si se completan, la app las filtra
-- según el peso/edad/raza de la mascota. Idempotente.
-- =============================================================================

-- ── Vacuna (columnas PascalCase, igual que el resto de esa tabla) ───────────
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "EdadMinMeses" INTEGER;
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "EdadMaxMeses" INTEGER;
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "PesoMinKg" DECIMAL(5,2);
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "PesoMaxKg" DECIMAL(5,2);
ALTER TABLE "Vacuna" ADD COLUMN IF NOT EXISTS "Razas" TEXT[];

-- ── tratamientos_catalogo (snake_case, igual que el resto de esa tabla) ─────
ALTER TABLE tratamientos_catalogo ADD COLUMN IF NOT EXISTS edad_min_meses INTEGER;
ALTER TABLE tratamientos_catalogo ADD COLUMN IF NOT EXISTS edad_max_meses INTEGER;
ALTER TABLE tratamientos_catalogo ADD COLUMN IF NOT EXISTS peso_min_kg DECIMAL(5,2);
ALTER TABLE tratamientos_catalogo ADD COLUMN IF NOT EXISTS peso_max_kg DECIMAL(5,2);
ALTER TABLE tratamientos_catalogo ADD COLUMN IF NOT EXISTS razas TEXT[];

-- ── consejos_catalogo (snake_case) ──────────────────────────────────────────
ALTER TABLE consejos_catalogo ADD COLUMN IF NOT EXISTS edad_min_meses INTEGER;
ALTER TABLE consejos_catalogo ADD COLUMN IF NOT EXISTS edad_max_meses INTEGER;
ALTER TABLE consejos_catalogo ADD COLUMN IF NOT EXISTS peso_min_kg DECIMAL(5,2);
ALTER TABLE consejos_catalogo ADD COLUMN IF NOT EXISTS peso_max_kg DECIMAL(5,2);
ALTER TABLE consejos_catalogo ADD COLUMN IF NOT EXISTS razas TEXT[];

-- ─────────────────────────────────────────────────────────────────────────────
-- SEEDS — vacunas por edad (cachorro/gatito)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "Vacuna" ("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion", "EdadMaxMeses")
SELECT * FROM (VALUES
  ('Primera dosis Séxtuple/Óctuple (cachorro)', 'Serie inicial: 3 dosis cada 21 días', 'perro', 'Serie de cachorro — después pasa al refuerzo anual', 4),
  ('Primera dosis Triple Felina (gatito)',      'Serie inicial: 3 dosis cada 21-28 días', 'gato',  'Serie de gatito — después pasa al refuerzo anual', 4)
) AS v("Nombre","Dosis","Especie","FrecuenciaDescripcion","EdadMaxMeses")
WHERE NOT EXISTS (SELECT 1 FROM "Vacuna" WHERE "Nombre" = v."Nombre" AND "Especie" = v."Especie");

-- ─────────────────────────────────────────────────────────────────────────────
-- SEEDS — tratamientos por peso y por raza
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tratamientos_catalogo (especie, nombre, frecuencia_descripcion, peso_min_kg, razas)
SELECT * FROM (VALUES
  ('perro', 'Suplemento articular (glucosamina/condroitina)', 'Diario, desde la adultez', 25::DECIMAL,
    ARRAY['Labrador Retriever','Golden Retriever','Pastor Alemán','Rottweiler','Boxer','Husky Siberiano','Doberman']),
  ('perro', 'Antiparasitario externo — dosis razas grandes', 'Cada 30 días (presentación XL)', 25::DECIMAL, NULL)
) AS v(especie, nombre, frecuencia_descripcion, peso_min_kg, razas)
WHERE NOT EXISTS (SELECT 1 FROM tratamientos_catalogo WHERE nombre = v.nombre AND especie = v.especie);

INSERT INTO tratamientos_catalogo (especie, nombre, frecuencia_descripcion, peso_max_kg, razas)
SELECT * FROM (VALUES
  ('perro', 'Higiene dental reforzada (cepillado 3 veces por semana)', 'Semanal', 6::DECIMAL,
    ARRAY['Yorkshire Terrier','Chihuahua','Poodle','Pomerania','Shih Tzu']),
  ('perro', 'Antiparasitario externo — dosis razas toy/mini', 'Cada 30 días (presentación Mini)', 6::DECIMAL, NULL)
) AS v(especie, nombre, frecuencia_descripcion, peso_max_kg, razas)
WHERE NOT EXISTS (SELECT 1 FROM tratamientos_catalogo WHERE nombre = v.nombre AND especie = v.especie);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEEDS — consejos por edad, peso y raza
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO consejos_catalogo (especie, categoria, contenido, edad_max_meses)
SELECT * FROM (VALUES
  ('perro', 'comportamiento', 'Tu cachorro está en la ventana crítica de socialización (hasta los 4 meses): exponelo a personas, sonidos y otros animales vacunados para que sea un adulto seguro.', 4),
  ('gato',  'comportamiento', 'Los gatitos aprenden a usar el arenero y a controlar la fuerza del mordisco jugando — no lo retes con la mano, usá juguetes para que no asocie tu mano con el juego brusco.', 4)
) AS v(especie, categoria, contenido, edad_max_meses)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo WHERE contenido = v.contenido AND especie = v.especie);

INSERT INTO consejos_catalogo (especie, categoria, contenido, edad_min_meses)
SELECT * FROM (VALUES
  ('perro', 'salud', 'Tu perro entró en la etapa senior: pasá los chequeos veterinarios de 1 vez al año a cada 6 meses para detectar a tiempo problemas renales, articulares o dentales.', 84),
  ('gato',  'salud', 'Tu gato entró en la etapa senior: un chequeo cada 6 meses ayuda a detectar a tiempo hipertiroidismo o insuficiencia renal, muy comunes a esta edad.', 132)
) AS v(especie, categoria, contenido, edad_min_meses)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo WHERE contenido = v.contenido AND especie = v.especie);

INSERT INTO consejos_catalogo (especie, categoria, contenido, peso_min_kg)
SELECT * FROM (VALUES
  ('perro', 'cuidado', 'Las razas grandes son más propensas a displasia de cadera: evitá que suba y baje escaleras o salte desde alturas mientras es cachorro, aunque tenga ganas.', 25::DECIMAL)
) AS v(especie, categoria, contenido, peso_min_kg)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo WHERE contenido = v.contenido AND especie = v.especie);

INSERT INTO consejos_catalogo (especie, categoria, contenido, razas)
SELECT * FROM (VALUES
  ('perro', 'salud', 'Las razas de hocico corto (braquicéfalas) tienen más riesgo con el calor y la anestesia: evitá pasearlo en las horas de más calor y avisá siempre al veterinario que es de esta raza antes de cualquier cirugía.',
    ARRAY['Bulldog Francés','Boxer'])
) AS v(especie, categoria, contenido, razas)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo WHERE contenido = v.contenido AND especie = v.especie);
