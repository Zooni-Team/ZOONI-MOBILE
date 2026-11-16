import { colores } from '../theme/colores';
import { diasHasta } from './fechaLocal';
/**
 * colorProximidad.js — Sistema de color por proximidad de fecha
 * Usado por la pantalla Calendario de Cuidados para colorear cards
 * de eventos según cuán cerca está su fecha_hora de hoy.
 */

// Días de CALENDARIO hasta el evento (ignora la hora): con la diferencia exacta
// en ms, un evento de hoy a la noche daba "Mañana".
const diasHastaEvento = (fechaHora) => diasHasta(fechaHora);

export function getColorByProximidad(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return colores.textoTenue;  // pasado
  if (dias <= 3)  return colores.rojo;  // hoy / muy próximo
  if (dias <= 7)  return colores.ambar;  // esta semana
  if (dias <= 14) return colores.amarillo;  // próximas dos semanas
  if (dias <= 30) return '#7FCFA0';  // este mes
  return colores.verde;                   // más de un mes
}

export function getTextoDias(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}
