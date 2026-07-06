/**
 * fechaLocal.js — Parseo seguro de fechas "YYYY-MM-DD"
 *
 * new Date('2022-02-15') se interpreta como medianoche UTC: en Argentina
 * (UTC-3) eso cae a las 21:00 del día ANTERIOR, así que getDate() y los
 * cálculos de días quedaban corridos un día (ej: el editor de fecha de
 * nacimiento abría un día atrás y "Vence hoy" aparecía un día antes).
 *
 * Este helper arma la fecha con el constructor local para que represente
 * el mismo día calendario acá. Timestamps completos (con hora) y objetos
 * Date pasan sin tocar — solo las fechas "solo día" tienen el problema.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseFechaLocal(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (DATE_ONLY.test(fecha)) {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(fecha);
}

/** Date → "YYYY-MM-DD" usando el día calendario local (no toISOString, que usa UTC). */
export function toISODateLocal(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
