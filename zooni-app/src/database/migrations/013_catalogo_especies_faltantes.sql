-- =============================================================================
-- Migración 013: Vacunas/Tratamientos/Consejos para las especies que todavía
-- no tenían NINGÚN contenido cargado (conejo, ave, reptil, pez, hamster, ratón).
-- =============================================================================
-- Reptil, pez, hamster y ratón NO reciben filas en "Vacuna": no existen
-- vacunas de rutina para esas especies en la medicina veterinaria real, así
-- que inventar una sería incorrecto. La pantalla de Vacunas ya maneja bien
-- el catálogo vacío ("No hay vacunas sugeridas para esta especie").
-- Idempotente.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VACUNAS — conejo y ave (las únicas de las 6 con vacunas de rutina reales)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "Vacuna" ("Nombre", "Dosis", "Especie", "FrecuenciaDescripcion")
SELECT * FROM (VALUES
  ('Mixomatosis',                          'Única + refuerzo', 'conejo', 'Refuerzo cada 6-12 meses según la vacuna'),
  ('Enfermedad Hemorrágica Vírica (VHD)',  'Única + refuerzo', 'conejo', 'Refuerzo anual'),
  ('Polyomavirus aviar',                   'Serie inicial 2 dosis', 'ave', 'Recomendada en hogares con más de un ave; consultá con tu veterinario aviar')
) AS v("Nombre","Dosis","Especie","FrecuenciaDescripcion")
WHERE NOT EXISTS (SELECT 1 FROM "Vacuna" WHERE "Nombre" = v."Nombre" AND "Especie" = v."Especie");

-- ─────────────────────────────────────────────────────────────────────────────
-- TRATAMIENTOS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tratamientos_catalogo (especie, nombre, frecuencia_descripcion)
SELECT * FROM (VALUES
  ('conejo',  'Desparasitación interna',                         'Cada 3 meses'),
  ('conejo',  'Revisión de dientes (crecimiento continuo)',      'Cada 6 meses'),
  ('conejo',  'Corte de uñas',                                   'Cada 4-6 semanas'),
  ('ave',     'Desparasitación interna',                          'Cada 6 meses'),
  ('ave',     'Corte de pico y uñas',                             'Cada 2-3 meses'),
  ('ave',     'Suplementación de calcio (hembras ponedoras)',     'Diario, en la dieta'),
  ('reptil',  'Suplementación de calcio y vitamina D3',           'Según especie — consultá a tu veterinario'),
  ('reptil',  'Desparasitación (control de heces)',               'Cada 6 meses'),
  ('reptil',  'Baño de hidratación (tortugas terrestres)',        'Semanal'),
  ('pez',     'Test de calidad del agua (amoníaco/nitritos/pH)',  'Semanal'),
  ('pez',     'Cambio parcial de agua (20-30%)',                  'Semanal'),
  ('hamster', 'Revisión dental (dientes de crecimiento continuo)', 'Mensual'),
  ('hamster', 'Revisión de uñas',                                 'Según necesidad'),
  ('raton',   'Revisión dental (dientes de crecimiento continuo)', 'Mensual'),
  ('raton',   'Desparasitación si hay indicios',                  'Según necesidad')
) AS v(especie, nombre, frecuencia_descripcion)
WHERE NOT EXISTS (SELECT 1 FROM tratamientos_catalogo WHERE nombre = v.nombre AND especie = v.especie);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSEJOS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO consejos_catalogo (especie, categoria, contenido)
SELECT * FROM (VALUES
  ('conejo', 'alimentacion',   'El heno tiene que ser el 80% de la dieta de tu conejo — no un extra. Es lo que mantiene sus dientes y su digestión sanos.'),
  ('conejo', 'salud',          'Si tu conejo pasa más de 12 horas sin comer ni defecar, es una emergencia veterinaria (estasis gastrointestinal), no algo para esperar.'),
  ('conejo', 'comportamiento', 'Los conejos son muy sociales y necesitan tiempo fuera de la jaula todos los días para ejercitarse y explorar.'),
  ('conejo', 'cuidado',        'Dale siempre objetos para roer: sus dientes crecen toda la vida y necesitan desgastarse constantemente.'),

  ('ave', 'alimentacion',    'Nunca le des palta, chocolate, cafeína ni cebolla: son tóxicos para las aves, incluso en cantidades chicas.'),
  ('ave', 'salud',           'Las aves esconden los síntomas de enfermedad por instinto de supervivencia — un chequeo veterinario regular es la única forma de detectar problemas a tiempo.'),
  ('ave', 'comportamiento',  'Las cacatúas y loros necesitan mucha estimulación social y mental: sin suficiente atención o juguetes pueden desarrollar picoteo compulsivo de plumas.'),
  ('ave', 'cuidado',         'La jaula necesita estar lejos de corrientes de aire y recibir luz natural (o UV) — ambas cosas afectan directamente su salud.'),

  ('reptil', 'cuidado',   'Sin una lámpara UVB adecuada, tu reptil puede desarrollar enfermedad ósea metabólica — no es un accesorio opcional, es esencial.'),
  ('reptil', 'cuidado',   'Cada especie necesita un gradiente de temperatura distinto (zona cálida y zona fresca): investigá los valores exactos para la tuya.'),
  ('reptil', 'alimentacion', 'La dieta varía muchísimo según la especie (herbívoro, carnívoro u omnívoro) — confirmá qué necesita la tuya en particular.'),

  ('pez', 'salud',        'La mayoría de las enfermedades de los peces vienen de mala calidad del agua, no de gérmenes — mantener el acuario limpio previene más que cualquier tratamiento.'),
  ('pez', 'cuidado',      'Los peces nuevos necesitan 2 a 4 semanas de cuarentena antes de sumarse al acuario principal, para no contagiar al resto.'),
  ('pez', 'alimentacion', 'La sobrealimentación es el error más común: dale solo lo que puede comer en 2-3 minutos.'),

  ('hamster', 'cuidado',        'Los hamsters son animales nocturnos: respetá su descanso durante el día y dejalo activo de noche.'),
  ('hamster', 'comportamiento', 'La mayoría de las especies de hamster son solitarias — meter dos en la misma jaula suele terminar en peleas.'),
  ('hamster', 'general',        'Necesita espacio para correr (rueda de ejercicio) y un lugar para esconderse — ambas cosas reducen su estrés.'),

  ('raton', 'comportamiento', 'A diferencia del hamster, los ratones son sociales: pueden convivir en grupos del mismo sexo sin problema.'),
  ('raton', 'cuidado',        'Son grandes escapistas — revisá que la jaula no tenga espacios por donde puedan salir.'),
  ('raton', 'alimentacion',   'Necesitan una dieta variada de semillas, pellets y vegetales frescos en pequeñas cantidades.')
) AS v(especie, categoria, contenido)
WHERE NOT EXISTS (SELECT 1 FROM consejos_catalogo WHERE contenido = v.contenido AND especie = v.especie);
