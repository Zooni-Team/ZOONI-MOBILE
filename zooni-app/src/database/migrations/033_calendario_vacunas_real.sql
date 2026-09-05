-- =============================================================================
-- Migración 033: calendario de vacunación realista (por edad)
-- Base de datos: Postgres (Supabase) — CORRER EN EL SQL EDITOR. Idempotente.
-- =============================================================================
-- PROBLEMA:
--   La tabla Vacuna YA tenía las columnas EdadMinMeses / EdadMaxMeses /
--   PesoMinKg / PesoMaxKg / Razas, y utils/filtrarPorMascota.js ya filtraba con
--   ellas. Pero de las 11 filas cargadas, solo 2 usaban el rango de edad y
--   NINGUNA el resto. El resultado: el plan sugerido era el mismo para un
--   cachorro de 2 meses que para un perro de 8 años.
--
--   Concretamente, un gatito de 4 meses veía "Antirrábica — refuerzo anual" y
--   "Leucemia felina — refuerzo anual", que son las pautas del animal ADULTO.
--   La serie inicial (las 2-3 dosis separadas por 3-4 semanas, que es lo que de
--   verdad le toca a esa edad) no aparecía por ningún lado.
--
-- QUÉ HACE:
--   1. Corrige los rangos de edad y los textos de frecuencia de lo que ya está.
--   2. Agrega las dosis de la serie inicial que faltaban (cachorro y gatito).
--   3. Agrega la vacuna de tos de las perreras, que es la otra que se aplica
--      habitualmente en perros que van a plaza, guardería o peluquería.
--
--   NO borra ninguna fila: los ids 7, 8, 9, 10, 12 y 17 están referenciados
--   desde MascotaVacuna (vacunas que los usuarios ya registraron) y borrarlos
--   rompería esas fichas. Todo se hace con UPDATE + INSERT condicional.
--
-- SOBRE PESO Y RAZA:
--   Se dejan en NULL a propósito. Qué vacunas necesita un animal y cada cuánto
--   se repiten depende de la ESPECIE y la EDAD (y del riesgo de exposición),
--   no de cuánto pesa ni de su raza: la dosis de una vacuna es la misma para un
--   caniche que para un gran danés. Poner cortes por peso o raza acá sería
--   inventar una regla que no existe.
--
--   Donde el peso y la raza SÍ mandan es en los antiparasitarios, que se dosifican
--   por kilo — y eso ya está contemplado en tratamientos_catalogo, que tiene
--   filas separadas para razas grandes y para razas toy/mini.
--
-- Las pautas siguen el esquema habitual de pequeños animales (serie inicial de
-- cachorro/gatito + refuerzos anuales). El documento y la pantalla aclaran que
-- es orientativo y que no reemplaza al veterinario.
-- =============================================================================

-- ── 1. PERRO ─────────────────────────────────────────────────────────────────

-- Serie inicial: primera dosis (la fila ya existía con otro nombre)
UPDATE "Vacuna" SET
  "Nombre" = 'Séxtuple/Óctuple — 1.ª dosis (cachorro)',
  "Dosis" = '1 de 3',
  "FrecuenciaDescripcion" = 'A las 6-8 semanas de vida. Después siguen 2 dosis más, cada 21-28 días.',
  "EdadMinMeses" = NULL, "EdadMaxMeses" = 3
WHERE "Especie" = 'perro' AND "Nombre" = 'Primera dosis Séxtuple/Óctuple (cachorro)';

-- Refuerzo anual: solo desde el año de vida
UPDATE "Vacuna" SET
  "Dosis" = 'Refuerzo',
  "FrecuenciaDescripcion" = 'Refuerzo al año de la última dosis de cachorro y después, una vez por año.',
  "EdadMinMeses" = 12, "EdadMaxMeses" = NULL
WHERE "Especie" = 'perro' AND "Nombre" = 'Séxtuple/Óctuple';

UPDATE "Vacuna" SET
  "Dosis" = '1 dosis + refuerzo anual',
  "FrecuenciaDescripcion" = 'Primera dosis a partir de los 3 meses. Después, refuerzo una vez por año.',
  "EdadMinMeses" = 3, "EdadMaxMeses" = NULL
WHERE "Especie" = 'perro' AND "Nombre" = 'Antirrábica';

UPDATE "Vacuna" SET
  "Dosis" = 'Incluida en la óctuple',
  "FrecuenciaDescripcion" = 'Suele venir dentro de la óctuple. Refuerzo anual (cada 6 meses si hay mucha exposición a agua estancada o roedores).',
  "EdadMinMeses" = 3, "EdadMaxMeses" = NULL
WHERE "Especie" = 'perro' AND "Nombre" = 'Leptospirosis';

INSERT INTO "Vacuna" ("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion", "EdadMinMeses", "EdadMaxMeses")
SELECT * FROM (VALUES
  ('Séxtuple/Óctuple — 2.ª dosis (cachorro)', '2 de 3', 'perro',
   '21-28 días después de la primera dosis (alrededor de las 10-12 semanas).', 2, 4),
  ('Séxtuple/Óctuple — 3.ª dosis (cachorro)', '3 de 3', 'perro',
   '21-28 días después de la segunda (alrededor de las 14-16 semanas). Cierra la serie inicial.', 3, 6),
  ('Tos de las perreras (Bordetella)', '1 dosis + refuerzo anual', 'perro',
   'Desde las 8 semanas, refuerzo anual. Recomendada si va a guardería, peluquería, pensión o plazas.', 2, NULL)
) AS v("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion", "EdadMinMeses", "EdadMaxMeses")
WHERE NOT EXISTS (
  SELECT 1 FROM "Vacuna" x WHERE x."Especie" = v."Especie" AND x."Nombre" = v."Nombre"
);

-- ── 2. GATO ──────────────────────────────────────────────────────────────────

UPDATE "Vacuna" SET
  "Nombre" = 'Triple felina — 1.ª dosis (gatito)',
  "Dosis" = '1 de 2',
  "FrecuenciaDescripcion" = 'A las 8-9 semanas de vida. Después sigue una 2.ª dosis, 21-28 días más tarde.',
  "EdadMinMeses" = NULL, "EdadMaxMeses" = 3
WHERE "Especie" = 'gato' AND "Nombre" = 'Primera dosis Triple Felina (gatito)';

UPDATE "Vacuna" SET
  "Dosis" = 'Refuerzo',
  "FrecuenciaDescripcion" = 'Refuerzo al año de la serie inicial y después, una vez por año.',
  "EdadMinMeses" = 12, "EdadMaxMeses" = NULL
WHERE "Especie" = 'gato' AND "Nombre" = 'Triple Felina';

UPDATE "Vacuna" SET
  "Dosis" = '1 dosis + refuerzo anual',
  "FrecuenciaDescripcion" = 'Primera dosis a partir de los 3 meses. Después, refuerzo una vez por año.',
  "EdadMinMeses" = 3, "EdadMaxMeses" = NULL
WHERE "Especie" = 'gato' AND "Nombre" = 'Antirrábica';

UPDATE "Vacuna" SET
  "Dosis" = '2 dosis + refuerzo anual',
  "FrecuenciaDescripcion" = 'Requiere test de leucemia negativo antes de aplicarla. 2 dosis separadas 21-28 días; refuerzo anual en gatos con salida al exterior.',
  "EdadMinMeses" = 2, "EdadMaxMeses" = NULL
WHERE "Especie" = 'gato' AND "Nombre" = 'Leucemia Felina';

INSERT INTO "Vacuna" ("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion", "EdadMinMeses", "EdadMaxMeses")
SELECT * FROM (VALUES
  ('Triple felina — 2.ª dosis (gatito)', '2 de 2', 'gato',
   '21-28 días después de la primera dosis (alrededor de las 12 semanas). Cierra la serie inicial.', 2, 5)
) AS v("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion", "EdadMinMeses", "EdadMaxMeses")
WHERE NOT EXISTS (
  SELECT 1 FROM "Vacuna" x WHERE x."Especie" = v."Especie" AND x."Nombre" = v."Nombre"
);

-- ── 3. CONEJO ────────────────────────────────────────────────────────────────

UPDATE "Vacuna" SET
  "Dosis" = '1 dosis + refuerzo anual',
  "FrecuenciaDescripcion" = 'Desde las 8-10 semanas de vida. Refuerzo una vez por año.',
  "EdadMinMeses" = 2, "EdadMaxMeses" = NULL
WHERE "Especie" = 'conejo' AND "Nombre" = 'Enfermedad Hemorrágica Vírica (VHD)';

UPDATE "Vacuna" SET
  "Dosis" = '1 dosis + refuerzo',
  "FrecuenciaDescripcion" = 'Desde las 8-10 semanas de vida. Refuerzo cada 6 meses en zonas con mosquitos y pulgas; si no, anual.',
  "EdadMinMeses" = 2, "EdadMaxMeses" = NULL
WHERE "Especie" = 'conejo' AND "Nombre" = 'Mixomatosis';

-- ── 4. AVE ───────────────────────────────────────────────────────────────────
-- No existe un plan de vacunación de rutina para aves de compañía: la fila se
-- conserva (está referenciada desde MascotaVacuna) pero el texto deja de
-- sugerir un calendario que no corresponde.
UPDATE "Vacuna" SET
  "Dosis" = 'Según indicación veterinaria',
  "FrecuenciaDescripcion" = 'Las aves de compañía no tienen un calendario de vacunación de rutina. Se aplica solo en casos puntuales, indicada por un veterinario especializado en aves.',
  "EdadMinMeses" = NULL, "EdadMaxMeses" = NULL
WHERE "Especie" = 'ave' AND "Nombre" = 'Polyomavirus aviar';

-- ── 5. Verificación rápida (opcional, correr después) ────────────────────────
--   · Plan de un cachorro de 2 meses (debe traer la 1.ª y 2.ª dosis, NO refuerzos anuales):
--       SELECT "Nombre", "EdadMinMeses", "EdadMaxMeses" FROM "Vacuna"
--       WHERE "Especie" = 'perro'
--         AND ("EdadMinMeses" IS NULL OR "EdadMinMeses" <= 2)
--         AND ("EdadMaxMeses" IS NULL OR "EdadMaxMeses" >= 2);
--   · Plan de un perro adulto de 3 años (36 meses) — debe traer los refuerzos:
--       SELECT "Nombre" FROM "Vacuna" WHERE "Especie" = 'perro'
--         AND ("EdadMinMeses" IS NULL OR "EdadMinMeses" <= 36)
--         AND ("EdadMaxMeses" IS NULL OR "EdadMaxMeses" >= 36);
