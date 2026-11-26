import { formatearFecha } from '../../utils/fechaLocal';
import { horaCorta } from '../../utils/tiempoRelativo';

export function fechaHoraTexto(valor) {
  const fecha = formatearFecha(valor, 'numericaCeros');
  return fecha ? `${fecha} ${horaCorta(valor)}` : null;
}

export function combinarFechaHora(fecha, hora) {
  const d = new Date(fecha);
  d.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
  return d;
}
