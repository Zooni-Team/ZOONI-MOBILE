/**
 * Imágenes estáticas de la Home.
 *
 * Ubicación en el proyecto:
 *   zooni-app/assets/home_background.png  → fondo del hero (paisaje)
 *   zooni-app/assets/perro_basico.png      → ilustración mascota (transparente)
 *
 * Instalar desde adjuntos de Cursor:  npm run setup:home-assets
 */

export const HOME_BACKGROUND = require('../../assets/home_background.png');
export const PET_PLACEHOLDER = require('../../assets/perro_basico.png');

/**
 * @param {{ fotoUrl?: string | null }} mascota
 * @returns {import('react-native').ImageSourcePropType}
 */
export function resolvePetImageSource(mascota) {
  if (mascota?.fotoUrl) {
    return { uri: mascota.fotoUrl };
  }
  return PET_PLACEHOLDER;
}
