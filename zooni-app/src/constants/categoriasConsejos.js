import { colores } from '../theme/colores';

export const CATEGORIAS_CONSEJOS = {
  general:        { nombre: 'General',        icono: 'bulb-outline',       fondo: '#FFFDE7', acento: colores.amarillo },
  salud:          { nombre: 'Salud',           icono: 'heart-outline',      fondo: '#FFF0F0', acento: colores.rojo },
  alimentacion:   { nombre: 'Alimentación',    icono: 'restaurant-outline', fondo: colores.mentaFondo, acento: colores.verde },
  ejercicio:      { nombre: 'Ejercicio',       icono: 'walk-outline',       fondo: '#FFF4E8', acento: colores.ambar },
  comportamiento: { nombre: 'Comportamiento',  icono: 'happy-outline',      fondo: '#F5F0FF', acento: colores.violeta },
  cuidado:        { nombre: 'Cuidado',         icono: 'cut-outline',        fondo: '#EAF5FF', acento: '#3498DB' },
};

export function getCategoriaInfo(key) {
  return CATEGORIAS_CONSEJOS[key] ?? {
    nombre: key ?? 'General',
    icono: 'bulb-outline',
    fondo: '#FFFDE7',
    acento: colores.amarillo,
  };
}
