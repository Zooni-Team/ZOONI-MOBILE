/**
 * colorProximidad.js — Sistema de color por proximidad de fecha
 * Usado por la pantalla Calendario de Cuidados para colorear cards
 * de eventos según cuán cerca está su fecha_hora de hoy.
 */

/**
 * Diferencia en días de calendario entre hoy y el evento (ignora la hora).
 * Antes se dividía el diff exacto en ms: un evento de hoy a la noche daba
 * "Mañana" y uno de ayer a la noche daba "¡Hoy!".
 */
function diasHastaEvento(fechaHora) {
  const ahora = new Date();
  const evento = new Date(fechaHora);
  const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const evento0 = new Date(evento.getFullYear(), evento.getMonth(), evento.getDate());
  return Math.round((evento0 - hoy0) / (1000 * 60 * 60 * 24));
}

export function getColorByProximidad(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return '#AAAAAA';  // pasado
  if (dias <= 3)  return '#E63946';  // hoy / muy próximo
  if (dias <= 7)  return '#F5A623';  // esta semana
  if (dias <= 14) return '#F5C842';  // próximas dos semanas
  if (dias <= 30) return '#7FCFA0';  // este mes
  return '#2DBD72';                   // más de un mes
}

export function getTextoDias(fechaHora) {
  const dias = diasHastaEvento(fechaHora);

  if (dias < 0)   return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}
