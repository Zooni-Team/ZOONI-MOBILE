/**
 * colorProximidad.js — Utilidad para calcular el color y texto de proximidad
 * de un evento del Calendario de Cuidados según su cercanía a la fecha actual.
 *
 * Usada en CalendarioScreen para colorear el borde del card, el tipo de evento
 * y el badge de días restantes.
 */

/**
 * Retorna un color hex según los días entre ahora y la fecha del evento.
 * @param {string|Date} fechaHora - ISO string o Date del evento
 * @returns {string} Color hex
 */
export const getColorByProximidad = (fechaHora) => {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)   return '#AAAAAA'; // pasado
  if (dias <= 3)  return '#E63946'; // hoy / muy próximo
  if (dias <= 7)  return '#F5A623'; // esta semana
  if (dias <= 14) return '#F5C842'; // próximas dos semanas
  if (dias <= 30) return '#7FCFA0'; // este mes
  return '#2DBD72';                  // más de un mes
};

/**
 * Retorna el texto del badge según los días restantes.
 * @param {string|Date} fechaHora
 * @returns {string} Ej: "¡Hoy!", "Mañana", "En 5 días", "Pasado"
 */
export const getTextoDias = (fechaHora) => {
  const ahora = new Date();
  const fechaEvento = new Date(fechaHora);
  const diffMs = fechaEvento - ahora;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0)   return 'Pasado';
  if (dias === 0) return '¡Hoy!';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
};

/**
 * Convierte un color hex a rgba con la opacidad dada.
 * Usado para el fondo del badge de días.
 * @param {string} hex - Color hex (#RRGGBB)
 * @param {number} opacity - Opacidad entre 0 y 1
 * @returns {string} Color rgba
 */
export const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
