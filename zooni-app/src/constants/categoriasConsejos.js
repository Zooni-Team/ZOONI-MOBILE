import { colores } from '../theme/colores';
/**
 * categoriasConsejos.js — Sistema de categorías de consejos Zooni
 *
 * Cada categoría tiene: nombre, icono (Ionicons), fondo (chip/encabezado pastel), acento (borde/texto)
 * Para agregar una nueva categoría, solo agregar una entrada aquí.
 */

export const CATEGORIAS_CONSEJOS = {
  general:        { nombre: 'General',        icono: 'bulb-outline',       fondo: '#FFFDE7', acento: colores.amarillo },
  salud:          { nombre: 'Salud',           icono: 'heart-outline',      fondo: '#FFF0F0', acento: colores.rojo },
  alimentacion:   { nombre: 'Alimentación',    icono: 'restaurant-outline', fondo: colores.mentaFondo, acento: colores.verde },
  ejercicio:      { nombre: 'Ejercicio',       icono: 'walk-outline',       fondo: '#FFF4E8', acento: colores.ambar },
  comportamiento: { nombre: 'Comportamiento',  icono: 'happy-outline',      fondo: '#F5F0FF', acento: colores.violeta },
  cuidado:        { nombre: 'Cuidado',         icono: 'cut-outline',        fondo: '#EAF5FF', acento: '#3498DB' },
};

/**
 * getCategoriaInfo(key)
 * Devuelve la info de una categoría. Si no existe, retorna un fallback genérico.
 * @param {string} key
 * @returns {{ nombre: string, icono: string, fondo: string, acento: string }}
 */
export function getCategoriaInfo(key) {
  return CATEGORIAS_CONSEJOS[key] ?? {
    nombre: key ?? 'General',
    icono: 'bulb-outline',
    fondo: '#FFFDE7',
    acento: colores.amarillo,
  };
}
