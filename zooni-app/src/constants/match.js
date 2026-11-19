/**
 * match.js — Opciones y valores por defecto de Match: filtros iniciales,
 * tipos de mascota, intereses y géneros que se pueden elegir.
 */

export const DEFAULT_FILTROS = {
  distancia_max_km: 10,
  // false por default: recién registrado nadie tiene ubicación todavía
  // (se completa cuando el navegador/dispositivo da permiso de geolocalización),
  // y con esto en true de entrada los perfiles nuevos no se ven entre sí.
  solo_cercanos: false,
  tipos_mascota: ['cualquiera'],
  edad_mascota_min_meses: 0,
  edad_mascota_max_meses: 240,
  intereses: [],
  edad_dueno_min: 18,
  edad_dueno_max: 65,
  genero_dueno: ['todos'],
};

export const PET_TYPE_OPTIONS = [
  { key: 'perro', label: 'Perro', icon: 'paw-outline' },
  { key: 'gato', label: 'Gato', icon: 'paw-outline' },
  { key: 'conejo', label: 'Conejo', icon: 'paw-outline' },
  { key: 'ave', label: 'Ave', icon: 'paw-outline' },
  { key: 'pez', label: 'Pez', icon: 'fish-outline' },
  { key: 'reptil', label: 'Reptil', icon: 'paw-outline' },
  { key: 'cualquiera', label: 'Cualquiera', icon: null },
];

export const INTEREST_OPTIONS = [
  'Paseos', 'Parques', 'Adopción', 'Juegos', 'Entrenamiento',
  'Exposiciones', 'Natación', 'Socialización', 'Cuidado', 'Otros',
];

export const GENDER_OPTIONS = [
  { key: 'todos', label: 'Todos' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'masculino', label: 'Masculino' },
  { key: 'no_binario', label: 'No binario' },
];

export function especieIcono(especie) {
  return especie === 'pez' ? 'fish-outline' : 'paw-outline';
}
