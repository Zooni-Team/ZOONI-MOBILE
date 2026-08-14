/**
 * tiempoRelativo.js — "hace 5 minutos", "ayer 21:40", "en línea"
 *
 * Lo usan el chat, la lista de Mensajes y Comunidad (última conexión), que
 * antes tenían cada uno su propia versión con formatos distintos: en el inbox
 * decía "5 min" y en el chat solo la hora suelta, sin forma de saber si un
 * mensaje era de hoy o de la semana pasada.
 */

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

function aFecha(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "21:40" */
export function horaCorta(valor) {
  const d = aFecha(valor);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function esMismoDia(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Texto largo para el detalle de un mensaje.
 *   < 1 min  → "recién"
 *   < 1 h    → "hace 5 minutos"
 *   hoy      → "hace 3 horas"
 *   ayer     → "ayer 21:40"
 *   resto    → "12/8 · 21:40"
 */
export function tiempoRelativo(valor, ahora = new Date()) {
  const d = aFecha(valor);
  if (!d) return '';

  const diff = ahora - d;
  if (diff < 0) return horaCorta(d);          // relojes desfasados: no inventar
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

/**
 * Versión corta para listas (inbox, Comunidad): "5 min", "3 h", "ayer", "12/8".
 */
export function tiempoRelativoCorto(valor, ahora = new Date()) {
  const d = aFecha(valor);
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

/**
 * Presencia de un usuario a partir de su última conexión.
 * Se considera EN LÍNEA hasta 5 minutos después del último latido — el mismo
 * umbral que ya usaba Comunidad para el punto verde de ubicación.
 */
export const UMBRAL_EN_LINEA_MS = 5 * MIN;

export function estadoPresencia(ultimaConexion, ahora = new Date()) {
  const d = aFecha(ultimaConexion);
  if (!d) return { enLinea: false, texto: 'Sin actividad reciente' };
  if (ahora - d < UMBRAL_EN_LINEA_MS) return { enLinea: true, texto: 'En línea' };
  return { enLinea: false, texto: `Últ. vez ${tiempoRelativo(d, ahora)}` };
}
