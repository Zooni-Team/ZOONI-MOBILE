-- ============================================================
-- Seed: Consejos para Gatos
-- Incluye: consejos genéricos (Raza NULL) y específicos por raza
-- Ejecutar DESPUÉS de la migración 004_create_consejos.sql
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM Consejos WHERE Especie = 'gato')
BEGIN

  -- ── GENÉRICOS PARA TODOS LOS GATOS ───────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'gato', NULL, 'general',
    N'Los gatos son animales independientes pero también necesitan atención y estimulación. Un gato aburrido puede desarrollar conductas problemáticas como el rascado excesivo o la sobrealimentación.',
    1
  ),
  (
    'gato', NULL, 'salud',
    N'Llevá a tu gato al veterinario al menos una vez al año para controles preventivos. Los gatos suelen esconder el dolor, por lo que los chequeos regulares son clave para detectar problemas a tiempo.',
    2
  ),
  (
    'gato', NULL, 'alimentacion',
    N'Los gatos son carnívoros estrictos. Su dieta debe ser rica en proteínas animales. Evitá alimentos con mucho cereal o rellenos vegetales como base de su alimentación.',
    3
  ),
  (
    'gato', NULL, 'ejercicio',
    N'Dedicá al menos 15-20 minutos diarios a jugar con tu gato. Las cañas con plumas, los juguetes de ratón y los puzzles de alimentación estimulan su instinto cazador y lo mantienen activo.',
    4
  ),
  (
    'gato', NULL, 'comportamiento',
    N'Si tu gato araña los muebles, no lo regañes: es una conducta natural para marcar territorio y afilar uñas. Proveele un rascador adecuado y usá cinta doble faz en los lugares que querés proteger.',
    5
  ),
  (
    'gato', NULL, 'cuidado',
    N'Cepillá a tu gato regularmente, especialmente si tiene pelo largo. Además de reducir la muda en casa, el cepillado previene la formación de bolas de pelo que pueden causar obstrucciones digestivas.',
    6
  );

  -- ── PERSA ─────────────────────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'gato', 'Persa', 'cuidado',
    N'El pelaje largo y denso del Persa requiere cepillado diario para evitar enredos y pelotones. Sin cuidado regular, el pelo puede formar nudos que causan dolor e infecciones en la piel.',
    1
  ),
  (
    'gato', 'Persa', 'salud',
    N'Por su cara aplanada (braquicefalia), los Persas son propensos a problemas respiratorios y oculares. Limpiá sus ojos a diario con gasa húmeda y observá si presenta dificultad para respirar.',
    2
  ),
  (
    'gato', 'Persa', 'comportamiento',
    N'Los Persas son gatos tranquilos y poco activos. Prefieren ambientes calmados y rutinas estables. Son ideales para apartamentos y para personas que buscan un compañero sereno.',
    3
  ),
  (
    'gato', 'Persa', 'alimentacion',
    N'Por su tendencia al sedentarismo, los Persas son susceptibles a la obesidad. Optá por alimentos premium controlados en calorías y evitá el picoteo entre comidas.',
    4
  );

  -- ── MAINE COON ────────────────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'gato', 'Maine Coon', 'general',
    N'El Maine Coon es una de las razas de gato doméstico más grandes del mundo. Pueden seguir creciendo hasta los 3-5 años de edad, mucho más que otras razas.',
    1
  ),
  (
    'gato', 'Maine Coon', 'ejercicio',
    N'A diferencia de muchos gatos, el Maine Coon es muy activo y juguetón. Necesita espacio, juguetes variados y sesiones de juego diarias para estar satisfecho.',
    2
  ),
  (
    'gato', 'Maine Coon', 'salud',
    N'Esta raza tiene predisposición a la miocardiopatía hipertrófica (enfermedad del corazón). Los controles cardíacos anuales con ecocardiograma son muy recomendables a partir de los 3 años.',
    3
  ),
  (
    'gato', 'Maine Coon', 'cuidado',
    N'Su pelaje semilargo requiere cepillado 2-3 veces por semana. Prestar especial atención al área del cuello y las axilas, donde se forman más fácilmente los nudos.',
    4
  );

  -- ── SIAMÉS ────────────────────────────────────────────────────────────────

  INSERT INTO Consejos (Especie, Raza, Categoria, Contenido, Orden) VALUES
  (
    'gato', 'Siamés', 'comportamiento',
    N'Los gatos Siameses son extremadamente vocales y comunicativos. Maullidos frecuentes y fuertes son normales en esta raza: simplemente te están "hablando".',
    1
  ),
  (
    'gato', 'Siamés', 'ejercicio',
    N'Son gatos muy sociales y activos que no toleran bien la soledad. Si pasás muchas horas fuera de casa, considerá tener dos gatos para que se hagan compañía.',
    2
  ),
  (
    'gato', 'Siamés', 'salud',
    N'Los Siameses son propensos a problemas dentales y respiratorios. El cepillado dental regular y los controles anuales ayudan a prevenir complicaciones.',
    3
  );

  PRINT 'Seeds de consejos para gatos insertados correctamente.';
END
ELSE
BEGIN
  PRINT 'Consejos para gatos ya existen — sin cambios.';
END
GO
