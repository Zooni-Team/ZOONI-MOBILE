/**
 * Fotos de demo para Match.
 * Para usar imagen local: guardá assets/match/pet-placeholder.png y usá require abajo.
 */

// export const MATCH_PET_PLACEHOLDER = require('../../assets/match/pet-placeholder.png');

/** Foto por defecto (reemplazable vía foto_real_url en backend o archivo local) */
export const DEFAULT_PET_PHOTO_URI =
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=480&auto=format&fit=crop&q=75';

/**
 * @param {{ foto_real_url?: string | null }} mascota
 * @returns {import('react-native').ImageSourcePropType}
 */
export function resolvePetPhotoSource(mascota) {
  if (mascota?.foto_real_url) {
    return { uri: mascota.foto_real_url };
  }
  // Descomentá cuando tengas pet-placeholder.png local:
  // return MATCH_PET_PLACEHOLDER;
  return { uri: DEFAULT_PET_PHOTO_URI };
}
