export const PESO_POR_ESPECIE = {
  perro:   { min: 0.5,   max: 90,   step: 0.5,   inicial: 10    },
  gato:    { min: 0.3,   max: 12,   step: 0.1,   inicial: 4     },
  conejo:  { min: 0.3,   max: 10,   step: 0.1,   inicial: 1.8   },
  ave:     { min: 0.01,  max: 1.6,  step: 0.005, inicial: 0.035 },
  hamster: { min: 0.015, max: 0.25, step: 0.005, inicial: 0.12  },
  raton:   { min: 0.01,  max: 0.5,  step: 0.005, inicial: 0.03  },
  reptil:  { min: 0.02,  max: 40,   step: 0.05,  inicial: 0.5   },
  pez:     { min: 0.005, max: 3,    step: 0.005, inicial: 0.05  },
};

const RANGO_GENERICO = { min: 0.005, max: 90, step: 0.1, inicial: 5 };

export function rangoPeso(especie) {
  const key = String(especie ?? '').toLowerCase().trim();
  return PESO_POR_ESPECIE[key] ?? RANGO_GENERICO;
}

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

export function textoRangoPeso(especie) {
  const { min, max } = rangoPeso(especie);
  return `${formatearPeso(min)} a ${formatearPeso(max)}`;
}

export function pesoValido(kg, especie) {
  const { min, max } = rangoPeso(especie);
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg ?? '').replace(',', '.'));
  return !Number.isNaN(n) && n >= min && n <= max;
}
