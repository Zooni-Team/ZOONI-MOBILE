/**
 * fechaLocal.js — ÚNICO módulo para leer y mostrar fechas.
 *
 * 1. Leer: parseFechaLocal()
 *    new Date('2022-02-15') se interpreta como medianoche UTC: en Argentina
 *    (UTC-3) eso cae a las 21:00 del día ANTERIOR, así que getDate() y los
 *    cálculos de días quedaban corridos un día. Este helper arma la fecha con
 *    el constructor local para que represente el mismo día calendario acá.
 *    Timestamps completos (con hora) y objetos Date pasan sin tocar.
 *
 * 2. Escribir en la base: toISODateLocal() → "YYYY-MM-DD" del día local.
 *
 * 3. Mostrar: formatearFecha(valor, estilo) con estilos con nombre, en vez
 *    de que cada pantalla arme el suyo (había 7 "formatFecha" distintos y
 *    algunos mostraban el día anterior por el problema del punto 1).
 *
 * Fechas relativas ("hace 5 min", "Ayer"): utils/tiempoRelativo.js
 * Guía: docs/claude/utilidades.md
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

export const MESES = Object.freeze(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']);

export const DIAS_SEMANA = Object.freeze(['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);

/** "YYYY-MM-DD", timestamp ISO o Date → Date local. null si falta o no es válida. */
export function parseFechaLocal(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha;
  const texto = String(fecha);
  if (DATE_ONLY.test(texto)) {
    const [y, m, d] = texto.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" usando el día calendario local (no toISOString, que usa UTC). */
export function toISODateLocal(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dos = (n) => String(n).padStart(2, '0');
const OPCIONES_LOCALE = Object.freeze({
  larga: { day: 'numeric', month: 'long', year: 'numeric' },                            // 14 de agosto de 2026
  diaSemana: { weekday: 'long', day: 'numeric', month: 'long' },                        // jueves, 14 de agosto
  diaSemanaCorto: { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }, // jue, 14 de agosto de 2026
  corta: { day: 'numeric', month: 'short', year: 'numeric' },                           // 14 ago 2026
});

/**
 * Fecha lista para mostrar. Estilos:
 *   'numerica'       14/8/2026            (default)
 *   'numericaCeros'  14/08/2026           (PDF, listados tabulares)
 *   'larga'          14 de agosto de 2026
 *   'diaSemana'      jueves, 14 de agosto
 *   'diaSemanaCorto' jue, 14 de agosto de 2026
 *   'corta'          14 ago 2026
 * Devuelve `vacio` (null por defecto) si no hay fecha válida.
 */
export function formatearFecha(valor, estilo = 'numerica', { vacio = null } = {}) {
  const d = parseFechaLocal(valor);
  if (!d) return vacio;
  if (estilo === 'numerica') return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  if (estilo === 'numericaCeros') return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  const opciones = OPCIONES_LOCALE[estilo];
  if (!opciones) throw new Error(`formatearFecha: estilo desconocido "${estilo}"`);
  return d.toLocaleDateString('es-AR', opciones);
}

/** Días calendario desde `hoy` hasta `valor` (negativo si ya pasó). null si no hay fecha. */
export function diasHasta(valor, hoy = new Date()) {
  const d = parseFechaLocal(valor);
  if (!d) return null;
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / MS_DIA);
}

/** Días calendario entre dos fechas (b - a). null si falta alguna. */
export function diasEntre(a, b) {
  const da = parseFechaLocal(a);
  return da ? diasHasta(b, da) : null;
}

/**
 * "Mié 12/11 12:00" — fecha y hora SIN "Hoy"/"Mañana". Para textos que se
 * guardan (notificaciones): un "Hoy 12:00" guardado sigue diciendo "Hoy" diez
 * días después. Para mostrar en vivo están cuandoDe / cuandoTexto.
 */
export function fechaHoraFija(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dia} ${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
}
