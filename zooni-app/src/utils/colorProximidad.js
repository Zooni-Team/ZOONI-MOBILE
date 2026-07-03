/**
 * colorProximidad.js — Sistema de color por proximidad de fecha
 * Usado por la pantalla Calendario de Cuidados para colorear cards
 * de eventos según cuán cerca está su fecha_hora de hoy.
 */

export function getColorByProximidad(fechaHora) {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)   return '#AAAAAA';  // pasado
  if (dias <= 3)  return '#E63946';  // hoy / muy próximo
  if (dias <= 7)  return '#F5A623';  // esta semana
  if (dias <= 14) return '#F5C842';  // próximas dos semanas
  if (dias <= 30) return '#7FCFA0';  // este mes
  return '#2DBD72';                   // más de un mes
}

export function getTextoDias(fechaHora) {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)   return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}
