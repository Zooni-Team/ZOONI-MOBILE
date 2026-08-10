/**
 * consejosData.js — Consejos de cuidado por especie y por raza.
 *
 * Fuente de datos local (no depende del backend) para la pantalla de Consejos.
 * `generarConsejos({ especie, raza })` devuelve una lista combinada de:
 *   1. Consejos específicos de la raza (si se reconoce).
 *   2. Consejos generales de la especie.
 * Cada consejo tiene { id, categoria, contenido } — mismas categorías que
 * categoriasConsejos.js (general, salud, alimentacion, ejercicio, comportamiento, cuidado).
 */

// Normaliza para comparar razas/especies: minúsculas y sin acentos.
function norm(txt) {
  return String(txt ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ─── CONSEJOS GENERALES POR ESPECIE ──────────────────────────────────────────

const GENERALES_PERRO = [
  { categoria: 'alimentacion', contenido: 'Dale de comer a horarios fijos y con alimento adecuado a su edad y tamaño. Evitá las sobras de la mesa: muchas comidas nuestras (cebolla, ajo, chocolate, uvas) son tóxicas para los perros.' },
  { categoria: 'salud', contenido: 'Mantené al día las vacunas y la desparasitación, y llevalo a un control veterinario al menos una vez al año aunque esté sano. La prevención es siempre más barata que el tratamiento.' },
  { categoria: 'ejercicio', contenido: 'Un perro necesita paseos diarios: no solo gasta energía, también explora olores y se estimula mentalmente. Un perro bien paseado es mucho más tranquilo en casa.' },
  { categoria: 'comportamiento', contenido: 'Educá con refuerzo positivo: premiá al instante lo que querés que repita e ignorá lo que no. Los retos y castigos generan miedo, no aprendizaje.' },
  { categoria: 'cuidado', contenido: 'Revisale orejas, dientes y uñas cada semana. El cepillado dental 2 o 3 veces por semana previene sarro y problemas cardíacos y renales a futuro.' },
  { categoria: 'salud', contenido: 'Tené siempre agua fresca disponible y cuidalo del golpe de calor: nunca lo dejes en un auto cerrado ni lo saques a pasear en las horas de más sol en verano.' },
];

const GENERALES_GATO = [
  { categoria: 'alimentacion', contenido: 'El gato es carnívoro estricto: necesita alimento de buena calidad rico en proteína animal. Sumá comida húmeda para aumentar el consumo de agua y cuidar sus riñones.' },
  { categoria: 'salud', contenido: 'La deshidratación silenciosa daña los riñones de los gatos. Ofrecé varias fuentes de agua fresca (mejor lejos de la comida) y considerá una fuente con movimiento: suelen tomar más.' },
  { categoria: 'cuidado', contenido: 'Mantené la bandeja sanitaria muy limpia y en un lugar tranquilo. Regla práctica: una bandeja por gato más una extra. Un cambio en el uso de la bandeja suele ser la primera señal de un problema de salud.' },
  { categoria: 'comportamiento', contenido: 'Los rascadores no son un lujo: rascar es una necesidad natural para marcar y afilar las uñas. Ofrecé varios (verticales y horizontales) para que no elija el sillón.' },
  { categoria: 'ejercicio', contenido: 'Jugá todos los días con cañas o juguetes que imiten presas. El juego canaliza su instinto cazador, previene el sobrepeso y evita el aburrimiento y el estrés.' },
  { categoria: 'cuidado', contenido: 'El enriquecimiento vertical los hace felices: repisas, rascadores altos o un lugar junto a la ventana. Trepar y observar desde las alturas les da seguridad.' },
];

const GENERALES_OTRA = [
  { categoria: 'salud', contenido: 'Buscá un veterinario con experiencia en tu tipo de mascota: no todas las clínicas atienden animales exóticos o no convencionales, y sus necesidades son muy distintas a las de perros y gatos.' },
  { categoria: 'cuidado', contenido: 'Informate bien sobre el hábitat, la temperatura y la dieta específica de tu especie. Un ambiente mal armado es la causa más común de enfermedad en mascotas no convencionales.' },
  { categoria: 'alimentacion', contenido: 'Cada especie tiene una dieta particular: lo que es sano para una puede ser dañino para otra. Confirmá siempre con una fuente confiable antes de introducir un alimento nuevo.' },
];

// ─── CONSEJOS ESPECÍFICOS POR RAZA ───────────────────────────────────────────
// La clave se compara con la raza normalizada (incluida como substring).

const RAZAS_PERRO = {
  labrador: [
    { categoria: 'alimentacion', contenido: 'El Labrador tiende a comer de más y engordar con facilidad. Medí sus porciones y evitá el picoteo: el sobrepeso le carga las articulaciones y le acorta la vida.' },
    { categoria: 'ejercicio', contenido: 'Es una raza muy enérgica: necesita bastante ejercicio diario, y le encanta el agua y buscar la pelota. Sin actividad suficiente puede volverse ansioso o destructivo.' },
    { categoria: 'salud', contenido: 'Vigilá sus caderas y codos: la displasia es frecuente en la raza. Evitá el ejercicio brusco mientras es cachorro y mantené un peso saludable.' },
  ],
  golden: [
    { categoria: 'cuidado', contenido: 'Su pelaje largo y doble necesita cepillado varias veces por semana para evitar nudos y controlar la muda, que es abundante.' },
    { categoria: 'salud', contenido: 'El Golden es propenso a problemas de cadera y a ciertos tumores. Los controles veterinarios anuales y detectar bultos a tiempo son clave.' },
    { categoria: 'ejercicio', contenido: 'Necesita ejercicio y compañía: es muy sociable y sufre si pasa mucho tiempo solo. El trabajo de olfato y los juegos de buscar lo mantienen equilibrado.' },
  ],
  'bulldog frances': [
    { categoria: 'salud', contenido: 'Es braquicéfalo (hocico chato): le cuesta respirar y regular la temperatura. Cuidalo mucho del calor y del esfuerzo intenso; en verano, paseos cortos y a la sombra.' },
    { categoria: 'ejercicio', contenido: 'Ejercicio moderado y sin exigir: se agita rápido. Nunca lo obligues a correr largo ni en horas de calor.' },
    { categoria: 'cuidado', contenido: 'Limpiale y secale bien los pliegues de la cara para prevenir dermatitis. No es buen nadador: cuidado cerca de piletas.' },
  ],
  bulldog: [
    { categoria: 'salud', contenido: 'Como raza de hocico chato, tolera mal el calor y el ejercicio intenso. Evitá el esfuerzo en verano y vigilá su respiración.' },
    { categoria: 'cuidado', contenido: 'Limpiale los pliegues de la piel con regularidad para evitar infecciones, y controlá su peso: la obesidad le agrava los problemas respiratorios y articulares.' },
  ],
  caniche: [
    { categoria: 'cuidado', contenido: 'El Caniche (Poodle) no muda como otras razas, pero su pelo crece sin parar: necesita peluquería cada 6-8 semanas y cepillado frecuente para que no se apelmace.' },
    { categoria: 'comportamiento', contenido: 'Es muy inteligente y aprende rápido: aprovechalo con juegos de obediencia y trucos. Se aburre si no lo estimulás mentalmente.' },
    { categoria: 'salud', contenido: 'Revisale los oídos seguido (le crece pelo dentro del canal) y los ojos, propensos a lagrimeo. La limpieza dental también es importante en razas chicas.' },
  ],
  poodle: [
    { categoria: 'cuidado', contenido: 'Su pelo crece continuamente y no muda: necesita peluquería regular y cepillado frecuente para evitar nudos.' },
    { categoria: 'comportamiento', contenido: 'Muy inteligente y activo mentalmente: los trucos y juegos de obediencia lo hacen feliz y evitan el aburrimiento.' },
  ],
  chihuahua: [
    { categoria: 'salud', contenido: 'Siendo tan chico, es sensible al frío: usá abrigo en invierno. Cuidá también su dentadura, propensa al sarro, y sus rótulas, que pueden dislocarse.' },
    { categoria: 'comportamiento', contenido: 'No lo sobreprotejas: socializalo con otras personas y perros desde chico para que no se vuelva miedoso o reactivo. Es un perro, no un juguete.' },
    { categoria: 'alimentacion', contenido: 'Las razas mini pueden tener bajones de azúcar: dividí su comida en varias tomas chicas al día y no lo dejes muchas horas sin comer.' },
  ],
  'pastor aleman': [
    { categoria: 'salud', contenido: 'Es propenso a la displasia de cadera. Cuidá el ejercicio de cachorro (nada de saltos ni escaleras en exceso) y mantené su peso ideal toda la vida.' },
    { categoria: 'ejercicio', contenido: 'Necesita mucho ejercicio físico y mental: es un perro de trabajo. El adiestramiento y los juegos de olfato le dan el propósito que necesita.' },
    { categoria: 'cuidado', contenido: 'Muda mucho, sobre todo en cambios de estación: cepillalo varias veces por semana para controlar el pelo suelto.' },
  ],
  rottweiler: [
    { categoria: 'comportamiento', contenido: 'Es fuerte y protector: la socialización y educación temprana con refuerzo positivo son fundamentales para un adulto equilibrado y seguro.' },
    { categoria: 'salud', contenido: 'Vigilá caderas y articulaciones, y controlá su peso: la obesidad le agrava los problemas óseos. Los controles cardíacos también son recomendables.' },
    { categoria: 'ejercicio', contenido: 'Necesita ejercicio diario y tareas que lo hagan pensar. Un Rottweiler aburrido puede volverse destructivo.' },
  ],
  boxer: [
    { categoria: 'salud', contenido: 'Tolera mal el calor por su hocico corto: cuidalo en verano. Es una raza con predisposición a problemas cardíacos y a ciertos tumores; los controles anuales son importantes.' },
    { categoria: 'ejercicio', contenido: 'Es juguetón y enérgico incluso de adulto: necesita ejercicio diario y compañía. Se apega mucho a su familia.' },
  ],
  beagle: [
    { categoria: 'comportamiento', contenido: 'Guiado por el olfato, puede escaparse siguiendo un rastro: paseos con correa y patio bien cercado. El trabajo de olfato en casa lo entretiene muchísimo.' },
    { categoria: 'alimentacion', contenido: 'Es comilón y engorda fácil: controlá las porciones y las golosinas. Escondé la comida en juguetes dispensadores para que use la cabeza.' },
    { categoria: 'cuidado', contenido: 'Sus orejas caídas retienen humedad: revisalas y limpiálas con frecuencia para prevenir infecciones.' },
  ],
  dalmata: [
    { categoria: 'salud', contenido: 'Cierta proporción de Dálmatas nace con sordera: si notás que no responde a sonidos, comentalo con el veterinario. Son propensos a cálculos urinarios, así que el agua fresca constante es clave.' },
    { categoria: 'ejercicio', contenido: 'Tiene muchísima energía y resistencia: necesita bastante ejercicio diario para no acumular estrés.' },
  ],
  dachshund: [
    { categoria: 'salud', contenido: 'Por su lomo largo, es propenso a hernias de disco. Evitá que salte del sillón o suba y baje escaleras, y no dejes que engorde: el sobrepeso castiga su columna.' },
    { categoria: 'ejercicio', contenido: 'Necesita ejercicio moderado y regular, pero cuidando siempre su espalda: mejor caminatas que saltos.' },
  ],
  salchicha: [
    { categoria: 'salud', contenido: 'El Salchicha (Dachshund) tiene predisposición a problemas de columna. Evitá saltos y escaleras, y mantené su peso a raya para proteger su lomo.' },
    { categoria: 'ejercicio', contenido: 'Paseos regulares sí, pero cuidando la espalda: nada de saltar desde alturas.' },
  ],
  yorkshire: [
    { categoria: 'cuidado', contenido: 'Su pelo es fino como el cabello y crece sin parar: cepillalo a diario y llevalo a peluquería seguido para evitar nudos.' },
    { categoria: 'salud', contenido: 'Cuidá su dentadura (muy propensa al sarro en razas mini) y protegelo del frío. Puede tener bajones de azúcar de cachorro: alimentación repartida en el día.' },
  ],
  pug: [
    { categoria: 'salud', contenido: 'Es braquicéfalo: le cuesta respirar y regular la temperatura. Extremá el cuidado con el calor y evitá el ejercicio intenso. Vigilá también sus ojos, saltones y propensos a lastimarse.' },
    { categoria: 'cuidado', contenido: 'Limpiale los pliegues de la cara con regularidad y controlá su peso: la obesidad le empeora la respiración.' },
  ],
  carlino: [
    { categoria: 'salud', contenido: 'El Carlino (Pug) es de hocico chato: cuidalo del calor y del esfuerzo. Sus ojos saltones necesitan atención ante cualquier irritación.' },
    { categoria: 'cuidado', contenido: 'Limpiá los pliegues faciales seguido y vigilá su peso para no agravar los problemas respiratorios.' },
  ],
  'border collie': [
    { categoria: 'ejercicio', contenido: 'Es probablemente el perro más inteligente y enérgico: necesita muchísimo ejercicio y estimulación mental. Sin un "trabajo" que hacer, desarrolla conductas obsesivas.' },
    { categoria: 'comportamiento', contenido: 'Aprende trucos y órdenes con una facilidad enorme. Dale desafíos: agility, juegos de olfato, obediencia avanzada.' },
  ],
  husky: [
    { categoria: 'ejercicio', contenido: 'El Husky Siberiano tiene una energía enorme y necesita muchísimo ejercicio. Es un escapista experto: patio muy bien cercado y correa en los paseos.' },
    { categoria: 'cuidado', contenido: 'Su doble manto muda de forma intensa dos veces al año: cepillado frecuente. Tolera mal el calor, así que cuidalo mucho en verano.' },
  ],
  schnauzer: [
    { categoria: 'cuidado', contenido: 'Su pelo duro necesita peluquería regular y cepillado de la barba, que acumula comida y suciedad. Limpiásela después de comer.' },
    { categoria: 'salud', contenido: 'Las variedades mini pueden tener tendencia a grasa alta en sangre: cuidá una dieta baja en grasas y evitá premios grasosos.' },
  ],
  cocker: [
    { categoria: 'cuidado', contenido: 'Sus orejas largas y caídas retienen humedad y se infectan con facilidad: revisalas y limpiálas seguido, y secáselas bien después del baño.' },
    { categoria: 'salud', contenido: 'Es propenso a problemas oculares y de oído. Los controles regulares y una buena higiene previenen la mayoría de los problemas.' },
  ],
  pitbull: [
    { categoria: 'comportamiento', contenido: 'La socialización y educación temprana con refuerzo positivo son clave: es un perro fuerte, leal y muy apegado a su familia. Evitá métodos de castigo.' },
    { categoria: 'cuidado', contenido: 'Su piel puede ser sensible y propensa a alergias. Vigilá irritaciones y consultá si aparecen rojeces o picazón persistente. En invierno agradece un abrigo.' },
    { categoria: 'ejercicio', contenido: 'Es atlético y enérgico: necesita ejercicio diario y juegos que lo cansen físicamente y mentalmente.' },
  ],
  'shih tzu': [
    { categoria: 'cuidado', contenido: 'Su pelo largo necesita cepillado diario y peluquería regular. Muchos dueños optan por un corte corto para el día a día.' },
    { categoria: 'salud', contenido: 'Es braquicéfalo: cuidalo del calor. Sus ojos grandes son propensos a irritarse; mantené el pelo lejos de ellos y consultá ante lagrimeo excesivo.' },
  ],
  maltes: [
    { categoria: 'cuidado', contenido: 'Su pelo blanco y largo se enreda fácil: cepillado diario. Limpiale el lagrimeo bajo los ojos para evitar las manchas marrones típicas de la raza.' },
    { categoria: 'salud', contenido: 'Como toda raza mini, cuidá su dentadura del sarro y protegelo del frío. Puede tener rótulas sensibles: evitá saltos grandes.' },
  ],
  'san bernardo': [
    { categoria: 'salud', contenido: 'Las razas gigantes son propensas a displasia y a torsión de estómago. Dale de comer en tomas repartidas y evitá el ejercicio justo después de comer.' },
    { categoria: 'cuidado', contenido: 'Tolera mal el calor y babea bastante. Cepillalo seguido y ofrecele siempre un lugar fresco. Su crecimiento debe ser controlado para no forzar las articulaciones.' },
  ],
  doberman: [
    { categoria: 'ejercicio', contenido: 'Es atlético, inteligente y muy apegado: necesita ejercicio diario y compañía. El adiestramiento con refuerzo positivo lo mantiene equilibrado.' },
    { categoria: 'salud', contenido: 'La raza tiene predisposición a problemas cardíacos: los controles veterinarios periódicos, incluido el corazón, son especialmente importantes.' },
  ],
};

const RAZAS_GATO = {
  siames: [
    { categoria: 'comportamiento', contenido: 'El Siamés es muy vocal y sociable: "habla" mucho y demanda atención. Sufre la soledad, así que dedicale tiempo de juego e interacción todos los días.' },
    { categoria: 'salud', contenido: 'Es propenso a problemas dentales y respiratorios. Mantené sus controles al día y cuidá su higiene bucal.' },
  ],
  persa: [
    { categoria: 'cuidado', contenido: 'Su pelo largo y denso necesita cepillado diario sin excepción: si no, se hacen nudos dolorosos que hay que rapar. Un baño ocasional ayuda a mantenerlo.' },
    { categoria: 'salud', contenido: 'Por su cara chata lagrimea mucho: limpiale los ojos a diario para evitar manchas e irritación. Es propenso a problemas renales; controles y comida húmeda ayudan.' },
  ],
  'british shorthair': [
    { categoria: 'alimentacion', contenido: 'El British Shorthair es tranquilo y tiende al sobrepeso: medí sus porciones y estimulá el juego para que se mueva. La obesidad es su principal riesgo de salud.' },
    { categoria: 'cuidado', contenido: 'Su manto denso agradece un cepillado semanal (más seguido en épocas de muda) para controlar el pelo suelto y las bolas de pelo.' },
    { categoria: 'salud', contenido: 'La raza tiene cierta predisposición a una enfermedad cardíaca (miocardiopatía hipertrófica). Los controles veterinarios periódicos ayudan a detectarla a tiempo.' },
  ],
  'maine coon': [
    { categoria: 'cuidado', contenido: 'Es un gato grande de pelo largo: cepillalo 2 o 3 veces por semana para evitar nudos y bolas de pelo. Su tamaño requiere bandeja, rascador y comedero acordes.' },
    { categoria: 'salud', contenido: 'Tiene predisposición a problemas cardíacos y de cadera. Mantené sus controles al día y vigilá su peso, que puede ser considerable.' },
    { categoria: 'comportamiento', contenido: 'Es sociable, juguetón y muy apegado, casi "perruno". Disfruta la interacción y muchos aman el agua.' },
  ],
  bengali: [
    { categoria: 'ejercicio', contenido: 'El Bengalí es atlético y muy activo: necesita mucho juego, trepadores altos y enriquecimiento. Se aburre rápido y puede volverse travieso si no gasta energía.' },
    { categoria: 'comportamiento', contenido: 'Es inteligente y curioso: aprende trucos y disfruta juguetes interactivos. Muchos aman el agua.' },
  ],
  sphynx: [
    { categoria: 'cuidado', contenido: 'Al no tener pelo, su piel acumula grasa: necesita baños regulares y limpieza de orejas frecuente. Protegelo del sol y del frío; siente mucho la temperatura.' },
    { categoria: 'alimentacion', contenido: 'Gasta más energía para mantener el calor corporal, así que suele tener buen apetito. Ajustá su alimentación con el veterinario para que no falte ni sobre.' },
  ],
  ragdoll: [
    { categoria: 'comportamiento', contenido: 'Es tranquilo, cariñoso y muy dependiente de su familia: le encanta que lo alcen (se relaja "como un muñeco"). Necesita compañía y no lleva bien la soledad.' },
    { categoria: 'cuidado', contenido: 'Su pelo semilargo y sedoso necesita cepillado varias veces por semana para evitar nudos.' },
  ],
  angora: [
    { categoria: 'cuidado', contenido: 'Su pelo largo y fino se enreda fácil: cepillado frecuente para evitar nudos y controlar las bolas de pelo.' },
    { categoria: 'comportamiento', contenido: 'Es activo, curioso y sociable: disfruta el juego y trepar. Ofrecele altura y estímulos para que no se aburra.' },
  ],
  'azul ruso': [
    { categoria: 'comportamiento', contenido: 'Es reservado y tranquilo, un poco tímido con extraños pero muy fiel a su familia. Valora la rutina y los ambientes calmos.' },
    { categoria: 'alimentacion', contenido: 'Tiende a comer de más si le dejás comida libre: controlá las porciones para prevenir el sobrepeso.' },
  ],
  'scottish fold': [
    { categoria: 'salud', contenido: 'La mutación de sus orejas dobladas se asocia a problemas de cartílago y articulaciones. Vigilá signos de dolor o rigidez al moverse y hacé controles veterinarios regulares.' },
    { categoria: 'cuidado', contenido: 'Revisale las orejas con frecuencia: su forma particular puede acumular más cera y humedad.' },
  ],
  abisinio: [
    { categoria: 'ejercicio', contenido: 'Es muy activo, atlético y curioso: necesita trepadores, juguetes y juego diario. Le encanta explorar en altura.' },
    { categoria: 'salud', contenido: 'Cuidá su higiene dental, punto sensible en la raza, y mantené sus controles al día.' },
  ],
};

// ─── GENERADOR ───────────────────────────────────────────────────────────────

function esGato(especieNorm) {
  return especieNorm.includes('gato') || especieNorm.includes('felino');
}
function esPerro(especieNorm) {
  return especieNorm.includes('perro') || especieNorm.includes('canino');
}

/** Busca en el mapa de razas la primera clave contenida en la raza normalizada. */
function consejosDeRaza(razaNorm, mapa) {
  if (!razaNorm || razaNorm.includes('sin raza') || razaNorm.includes('mestizo') || razaNorm.includes('comun') || razaNorm.includes('europeo')) {
    return [];
  }
  for (const clave of Object.keys(mapa)) {
    if (razaNorm.includes(clave)) return mapa[clave];
  }
  return [];
}

/**
 * Devuelve una lista de consejos { id, categoria, contenido } combinando los de
 * la raza (si se reconoce) con los generales de la especie. Los de la raza van
 * primero por ser los más específicos.
 */
export function generarConsejos({ especie, raza } = {}) {
  const e = norm(especie);
  const r = norm(raza);

  let generales;
  let razaTips;
  if (esGato(e)) {
    generales = GENERALES_GATO;
    razaTips = consejosDeRaza(r, RAZAS_GATO);
  } else if (esPerro(e)) {
    generales = GENERALES_PERRO;
    razaTips = consejosDeRaza(r, RAZAS_PERRO);
  } else {
    generales = GENERALES_OTRA;
    razaTips = [];
  }

  return [...razaTips, ...generales].map((c, i) => ({
    id: `c${i}`,
    categoria: c.categoria,
    contenido: c.contenido,
  }));
}
