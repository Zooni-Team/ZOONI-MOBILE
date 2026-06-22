/**
 * categoriasConsejos.js — Sistema de categorías de consejos Zooni
 *
 * Define las 6 categorías posibles para los consejos y curiosidades de mascotas.
 * Cada categoría tiene:
 *   nombre  → nombre en español para mostrar en chips y cards
 *   emoji   → emoji representativo usado como ícono
 *   fondo   → color de fondo del chip y encabezado de la card (pastel suave)
 *   acento  → color del texto, borde izquierdo y círculo del emoji
 *
 * Para agregar una nueva categoría en el futuro, solo agregar una entrada aquí.
 * El sistema de chips y cards la adoptará automáticamente.
 */

export const CATEGORIAS_CONSEJOS = {
  general: {
    nombre: 'General',
    emoji: '💡',
    fondo: '#FFFDE7',
    acento: '#F5C842',
  },
  salud: {
    nombre: 'Salud',
    emoji: '❤️',
    fondo: '#FFF0F0',
    acento: '#E63946',
  },
  alimentacion: {
    nombre: 'Alimentación',
    emoji: '🍖',
    fondo: '#F0FFF6',
    acento: '#2DBD72',
  },
  ejercicio: {
    nombre: 'Ejercicio',
    emoji: '🏃',
    fondo: '#FFF4E8',
    acento: '#F5A623',
  },
  comportamiento: {
    nombre: 'Comportamiento',
    emoji: '🧠',
    fondo: '#F5F0FF',
    acento: '#9B59B6',
  },
  cuidado: {
    nombre: 'Cuidado',
    emoji: '✂️',
    fondo: '#EAF5FF',
    acento: '#3498DB',
  },
};

/**
 * getCategoriaInfo(key) — Devuelve la info de una categoría por su key.
 * Si la key no existe, devuelve un fallback genérico para no romper la UI.
 *
 * @param {string} key - categoria_key (ej: 'salud', 'ejercicio')
 * @returns {{ nombre: string, emoji: string, fondo: string, acento: string }}
 */
export function getCategoriaInfo(key) {
  return (
    CATEGORIAS_CONSEJOS[key] ?? {
      nombre: key ?? 'General',
      emoji: '💡',
      fondo: '#FFFDE7',
      acento: '#F5C842',
    }
  );
}
