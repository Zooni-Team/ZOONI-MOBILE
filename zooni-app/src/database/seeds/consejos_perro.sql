-- ============================================================
-- Seed: Consejos para Perros
-- Incluye: consejos genéricos (Raza NULL) y específicos por raza
-- Ejecutar DESPUÉS de la migración 004_create_consejos.sql
-- ============================================================

-- Evitar duplicados: solo insertar si la tabla está vacía para perros
IF NOT EXISTS (SELECT 1 FROM Consejos WHERE Especie = 'perro')
BEGIN

  -- ── GENÉRICOS PARA TODOS LOS PERROS ──────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'perro', NULL, 'general',
    N'Los perros son animales sociales que necesitan compañía y afecto a diario. Dedicarles tiempo de calidad fortalece el vínculo y mejora su bienestar emocional.',
    1
  ),
  (
    'perro', NULL, 'salud',
    N'Revisá las orejas de tu perro una vez por semana. Las infecciones de oído son comunes y detectarlas temprano evita complicaciones mayores.',
    2
  ),
  (
    'perro', NULL, 'alimentacion',
    N'Establecé un horario fijo de comida. Los perros se estresarán menos y tendrán mejor digestión si comen a la misma hora todos los días.',
    3
  ),
  (
    'perro', NULL, 'ejercicio',
    N'El ejercicio diario es esencial para la salud física y mental de tu perro. Un perro bien ejercitado es más tranquilo y equilibrado en casa.',
    4
  ),
  (
    'perro', NULL, 'comportamiento',
    N'Los perros aprenden mejor con refuerzo positivo. Premiá los comportamientos que querés repetir en lugar de castigar los que no querés.',
    5
  ),
  (
    'perro', NULL, 'cuidado',
    N'Cepillá los dientes de tu perro al menos 2 veces por semana con pasta dental canina. La higiene bucal previene enfermedades sistémicas.',
    6
  );

  -- ── LABRADOR RETRIEVER ───────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'perro', 'Labrador Retriever', 'alimentacion',
    N'Los Labrador Retriever son una de las razas más propensas a la obesidad. Controlá las porciones, evitá los premios en exceso y optá por alimentos de alta calidad sin rellenos.',
    1
  ),
  (
    'perro', 'Labrador Retriever', 'ejercicio',
    N'Los Labradores necesitan al menos 1 hora de ejercicio intenso diario. Son ideales para actividades como natación, fetch y senderismo. Sin suficiente actividad pueden volverse destructivos.',
    2
  ),
  (
    'perro', 'Labrador Retriever', 'salud',
    N'Esta raza es susceptible a displasia de cadera y codo. Consultá con tu veterinario sobre suplementos articulares y evitá el ejercicio excesivo de impacto en cachorros menores de 18 meses.',
    3
  ),
  (
    'perro', 'Labrador Retriever', 'comportamiento',
    N'Los Labradores son perros de alto nivel de energía y pueden aburrirse fácilmente. Los juguetes de enriquecimiento mental, como los Kong rellenos, son excelentes para mantenerlos estimulados.',
    4
  ),
  (
    'perro', 'Labrador Retriever', 'cuidado',
    N'Su pelaje denso y de doble capa muda intensamente 2 veces al año. Cepillalo 2-3 veces por semana con un cepillo de cerdas firmes para minimizar el pelo en casa.',
    5
  ),
  (
    'perro', 'Labrador Retriever', 'general',
    N'Los Labrador Retriever son conocidos por su boca suave: pueden llevar un huevo en la boca sin romperlo. Esta característica los hace ideales como perros de asistencia y rescate.',
    6
  );

  -- ── GOLDEN RETRIEVER ─────────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'perro', 'Golden Retriever', 'comportamiento',
    N'Los Golden Retriever son naturalmente amigables y pacientes, lo que los hace excelentes con niños. Necesitan socialización temprana para mantener su carácter equilibrado.',
    1
  ),
  (
    'perro', 'Golden Retriever', 'salud',
    N'Esta raza tiene mayor predisposición al cáncer que otras. Los controles veterinarios anuales a partir de los 6 años son especialmente importantes.',
    2
  ),
  (
    'perro', 'Golden Retriever', 'cuidado',
    N'Su pelaje largo y denso requiere cepillado frecuente (3-4 veces por semana) para evitar enredos y reducir la muda. El baño mensual ayuda a mantener la piel sana.',
    3
  ),
  (
    'perro', 'Golden Retriever', 'ejercicio',
    N'Necesitan entre 1 y 2 horas de ejercicio diario. Adoran nadar, correr y jugar a buscar la pelota. Son el compañero ideal para actividades al aire libre.',
    4
  );

  -- ── BEAGLE ───────────────────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'perro', 'Beagle', 'comportamiento',
    N'Los Beagle tienen un olfato extraordinario y tienden a seguir rastros olvidando todo lo demás. Siempre usá correa en espacios abiertos y asegurate de tener el jardín bien cercado.',
    1
  ),
  (
    'perro', 'Beagle', 'alimentacion',
    N'Los Beagle son glotones por naturaleza y pueden comer en exceso si se les da la oportunidad. Medí siempre las porciones y evitá dejar comida disponible todo el tiempo.',
    2
  ),
  (
    'perro', 'Beagle', 'ejercicio',
    N'Necesitan al menos 1 hora de ejercicio diario para evitar el aburrimiento y la destructividad. Las actividades de olfato y rastreo los entretienen enormemente.',
    3
  );

  PRINT 'Seeds de consejos para perros insertados correctamente.';
END
ELSE
BEGIN
  PRINT 'Consejos para perros ya existen — sin cambios.';
END
GO
