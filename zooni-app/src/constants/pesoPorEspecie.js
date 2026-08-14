/**
 * pesoPorEspecie.js — Rangos de peso realistas por especie
 *
 * El slider de peso iba de 0 a 100 kg con pasos de medio kilo para TODAS las
 * especies. Para un hámster de 120 gramos o un canario de 20 eso no servía:
 * el primer paso posible (0,5 kg) ya era cuatro veces el animal entero, así
 * que era imposible cargar un peso correcto.
 *
 * Acá está el rango de cada especie, con su paso y un valor inicial típico.
 * Los números son pesos de ADULTO habituales en mascotas, tomando el extremo
 * chico y el grande de las razas más comunes.
 */

export const PESO_POR_ESPECIE = {
  // Chihuahua ~1,5 kg · mastín ~90 kg
  perro:   { min: 0.5,   max: 90,   step: 0.5,   inicial: 10    },
  // Gato adulto típico 3–5 kg; un maine coon llega a 11–12
  gato:    { min: 0.3,   max: 12,   step: 0.1,   inicial: 4     },
  // Enano de Holanda ~0,8 kg · gigante de Flandes hasta 10
  conejo:  { min: 0.3,   max: 10,   step: 0.1,   inicial: 1.8   },
  // Canario ~20 g · periquito ~35 g · cacatúa ~800 g · guacamayo ~1,5 kg
  ave:     { min: 0.01,  max: 1.6,  step: 0.005, inicial: 0.035 },
  // Roborovski ~20 g · sirio (el más común) 120–200 g
  hamster: { min: 0.015, max: 0.25, step: 0.005, inicial: 0.12  },
  // Ratón doméstico 20–40 g · rata dumbo/rex 250–500 g
  raton:   { min: 0.01,  max: 0.5,  step: 0.005, inicial: 0.03  },
  // Gecko leopardo ~60 g · dragón barbudo ~500 g · iguana ~8 kg · tortuga grande ~40
  reptil:  { min: 0.02,  max: 40,   step: 0.05,  inicial: 0.5   },
  // Guppy ~2 g · goldfish 100–300 g · koi adulto hasta 3 kg
  pez:     { min: 0.005, max: 3,    step: 0.005, inicial: 0.05  },
};

// Especie desconocida: el rango amplio de antes, que al menos no bloquea nada
const RANGO_GENERICO = { min: 0.005, max: 90, step: 0.1, inicial: 5 };

/** Rango de peso de una especie (nunca devuelve undefined). */
export function rangoPeso(especie) {
  const key = String(especie ?? '').toLowerCase().trim();
  return PESO_POR_ESPECIE[key] ?? RANGO_GENERICO;
}

/**
 * Peso legible. Debajo del kilo se muestra en GRAMOS: "35 g" se entiende de
 * una, "0,04 kg" no le dice nada a nadie.
 *   0.035 → "35 g" | 4 → "4 kg" | 20.4 → "20,4 kg"
 */
export function formatearPeso(kg) {
  if (kg == null || kg === '') return '—';
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg).replace(',', '.'));
  if (Number.isNaN(n)) return '—';

  if (n < 1) return `${Math.round(n * 1000)} g`;

  const decimales = n < 10 ? 1 : 1;
  return `${n.toLocaleString('es-AR', {
    minimumFractionDigits: 0, maximumFractionDigits: decimales,
  })} kg`;
}

/** Texto del rango permitido, para placeholders y mensajes de error. */
export function textoRangoPeso(especie) {
  const { min, max } = rangoPeso(especie);
  return `${formatearPeso(min)} a ${formatearPeso(max)}`;
}

/** ¿El peso entra en el rango de la especie? */
export function pesoValido(kg, especie) {
  const { min, max } = rangoPeso(especie);
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg ?? '').replace(',', '.'));
  return !Number.isNaN(n) && n >= min && n <= max;
}
