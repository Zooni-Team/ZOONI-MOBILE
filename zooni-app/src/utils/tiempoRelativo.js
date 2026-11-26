import { DIAS_SEMANA, MESES, parseFechaLocal } from './fechaLocal.js';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export function horaCorta(valor) {
  const d = parseFechaLocal(valor);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function esMismoDia(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function mismoDia(a, b) {
  const da = parseFechaLocal(a);
  const db = parseFechaLocal(b);
  if (!da || !db) return false;
  return esMismoDia(da, db);
}

export function etiquetaDia(valor, ahora = new Date()) {
  const d = parseFechaLocal(valor);
  if (!d) return '';

  if (esMismoDia(d, ahora)) return 'Hoy';

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (esMismoDia(d, ayer)) return 'Ayer';

  const soloDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diasAtras = Math.round((soloDia(ahora) - soloDia(d)) / DIA);
  if (diasAtras > 0 && diasAtras < 7) return DIAS_SEMANA[d.getDay()];

  const base = `${d.getDate()} de ${MESES[d.getMonth()]}`;
  return d.getFullYear() === ahora.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

export function tiempoRelativo(valor, ahora = new Date()) {
  const d = parseFechaLocal(valor);
  if (!d) return '';

  const diff = ahora - d;
  if (diff < 0) return horaCorta(d);
  if (diff < MIN) return 'recién';

  if (diff < HORA) {
    const mins = Math.floor(diff / MIN);
    return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  }

  if (esMismoDia(d, ahora)) {
    const horas = Math.floor(diff / HORA);
    return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (esMismoDia(d, ayer)) return `ayer ${horaCorta(d)}`;

  if (diff < 7 * DIA) {
    const dias = Math.floor(diff / DIA);
    return `hace ${dias} días`;
  }

  return `${d.getDate()}/${d.getMonth() + 1} · ${horaCorta(d)}`;
}

export function tiempoRelativoCorto(valor, ahora = new Date()) {
  const d = parseFechaLocal(valor);
  if (!d) return '';

  const diff = ahora - d;
  if (diff < MIN) return 'ahora';
  if (diff < HORA) return `${Math.floor(diff / MIN)} min`;
  if (esMismoDia(d, ahora)) return `${Math.floor(diff / HORA)} h`;

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (esMismoDia(d, ayer)) return 'ayer';

  if (diff < 7 * DIA) return `${Math.floor(diff / DIA)} días`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export const UMBRAL_EN_LINEA_MS = 5 * MIN;

export function estadoPresencia(ultimaConexion, ahora = new Date()) {
  const d = parseFechaLocal(ultimaConexion);
  if (!d) return { enLinea: false, texto: 'Sin actividad reciente' };
  if (ahora - d < UMBRAL_EN_LINEA_MS) return { enLinea: true, texto: 'En línea' };
  return { enLinea: false, texto: `Últ. vez ${tiempoRelativo(d, ahora)}` };
}
