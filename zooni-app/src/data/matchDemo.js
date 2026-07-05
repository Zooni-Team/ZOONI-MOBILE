/**
 * Datos de demo para Match cuando el backend no está disponible.
 */

export const DEMO_CURRENT_USER = {
  usuario_id: 'me',
  nombre: 'Sofía',
  apellido: 'García',
  foto_perfil_url: null,
};

/** Fotos demo (Unsplash). Reemplazá por URLs propias o assets locales. */
const DEMO_PHOTOS = {
  perroGolden:
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=480&auto=format&fit=crop&q=75',
  gato:
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=480&auto=format&fit=crop&q=75',
  perroBulldog:
    'https://images.unsplash.com/photo-1543467045-531a47f0b227?w=480&auto=format&fit=crop&q=75',
  gatoPersa:
    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=480&auto=format&fit=crop&q=75',
  perroCaniche:
    'https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?w=480&auto=format&fit=crop&q=75',
};

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

export const DEMO_PERFILES = [
  {
    usuario_id: 'u001',
    nombre: 'Valentina',
    edad: 26,
    foto_perfil_url: null,
    barrio: 'Palermo',
    ciudad: 'Buenos Aires',
    distancia_km: 2.4,
    mascota: {
      id: 'm001',
      nombre: 'Luna',
      especie: 'perro',
      raza: 'Golden Retriever',
      edad_anios: 3,
      foto_real_url: DEMO_PHOTOS.perroGolden,
      avatar_url: null,
    },
    intereses: ['Paseos', 'Parques', 'Socialización'],
  },
  {
    usuario_id: 'u002',
    nombre: 'Martín',
    edad: 31,
    foto_perfil_url: null,
    barrio: 'Recoleta',
    ciudad: 'Buenos Aires',
    distancia_km: 4.1,
    mascota: {
      id: 'm002',
      nombre: 'Michi',
      especie: 'gato',
      raza: 'Siamés',
      edad_anios: 2,
      foto_real_url: DEMO_PHOTOS.gato,
      avatar_url: null,
    },
    intereses: ['Juegos', 'Cuidado'],
  },
  {
    usuario_id: 'u003',
    nombre: 'Camila',
    edad: 24,
    foto_perfil_url: null,
    barrio: 'Belgrano',
    ciudad: 'Buenos Aires',
    distancia_km: 6.8,
    mascota: {
      id: 'm003',
      nombre: 'Rocky',
      especie: 'perro',
      raza: 'Bulldog Francés',
      edad_anios: 1,
      foto_real_url: DEMO_PHOTOS.perroBulldog,
      avatar_url: null,
    },
    intereses: ['Parques', 'Entrenamiento', 'Paseos'],
  },
  {
    usuario_id: 'u004',
    nombre: 'Lucas',
    edad: 29,
    foto_perfil_url: null,
    barrio: 'Villa Crespo',
    ciudad: 'Buenos Aires',
    distancia_km: 3.2,
    mascota: {
      id: 'm004',
      nombre: 'Nube',
      especie: 'gato',
      raza: 'Persa',
      edad_anios: 4,
      foto_real_url: DEMO_PHOTOS.gatoPersa,
      avatar_url: null,
    },
    intereses: ['Adopción', 'Cuidado'],
  },
  {
    usuario_id: 'u005',
    nombre: 'Julieta',
    edad: 22,
    foto_perfil_url: null,
    barrio: 'Caballito',
    ciudad: 'Buenos Aires',
    distancia_km: 8.5,
    mascota: {
      id: 'm005',
      nombre: 'Coco',
      especie: 'perro',
      raza: 'Caniche',
      edad_anios: 5,
      foto_real_url: DEMO_PHOTOS.perroCaniche,
      avatar_url: null,
    },
    intereses: ['Exposiciones', 'Paseos', 'Natación'],
  },
];

/** u002 ya dio like a "me" — like mutuo al dar like a Martín */
export const DEMO_PRE_LIKES = ['u002'];

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
