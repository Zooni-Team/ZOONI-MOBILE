import { colores } from '../theme/colores';
import { diasHasta } from './fechaLocal';

const diasHastaEvento = (fechaHora) => diasHasta(fechaHora);

export function getColorByProximidad(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return colores.textoTenue;
  if (dias <= 3)  return colores.rojo;
  if (dias <= 7)  return colores.ambar;
  if (dias <= 14) return colores.amarillo;
  if (dias <= 30) return '#7FCFA0';
  return colores.verde;
}

export function getTextoDias(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}
