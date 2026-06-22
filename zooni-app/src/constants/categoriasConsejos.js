/**
 * categoriasConsejos.js — Sistema de categorías de consejos Zooni
 *
 * Cada categoría tiene: nombre, emoji, fondo (chip/encabezado pastel), acento (borde/texto)
 * Para agregar una nueva categoría, solo agregar una entrada aquí.
 */

export const CATEGORIAS_CONSEJOS = {
  general:        { nombre: 'General',        emoji: '💡', fondo: '#FFFDE7', acento: '#F5C842' },
  salud:          { nombre: 'Salud',           emoji: '❤️', fondo: '#FFF0F0', acento: '#E63946' },
  alimentacion:   { nombre: 'Alimentación',    emoji: '🍖', fondo: '#F0FFF6', acento: '#2DBD72' },
  ejercicio:      { nombre: 'Ejercicio',       emoji: '🏃', fondo: '#FFF4E8', acento: '#F5A623' },
  comportamiento: { nombre: 'Comportamiento',  emoji: '🧠', fondo: '#F5F0FF', acento: '#9B59B6' },
  cuidado:        { nombre: 'Cuidado',         emoji: '✂️', fondo: '#EAF5FF', acento: '#3498DB' },
};

/**
 * getCategoriaInfo(key)
 * Devuelve la info de una categoría. Si no existe, retorna un fallback genérico.
 * @param {string} key
 * @returns {{ nombre: string, emoji: string, fondo: string, acento: string }}
 */
export function getCategoriaInfo(key) {
  return CATEGORIAS_CONSEJOS[key] ?? {
    nombre: key ?? 'General',
    emoji: '💡',
    fondo: '#FFFDE7',
    acento: '#F5C842',
  };
}
