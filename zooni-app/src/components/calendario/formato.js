/**
 * formato.js — Cómo se escribe la fecha y hora de un recordatorio del
 * calendario: "06/11/2026 09:05".
 */

import { formatearFecha } from '../../utils/fechaLocal';
import { horaCorta } from '../../utils/tiempoRelativo';

export function fechaHoraTexto(valor) {
  const fecha = formatearFecha(valor, 'numericaCeros');
  return fecha ? `${fecha} ${horaCorta(valor)}` : null;
}

/** Junta el día de `fecha` con la hora de `hora` en un solo Date. */
export function combinarFechaHora(fecha, hora) {
  const d = new Date(fecha);
  d.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
  return d;
}
