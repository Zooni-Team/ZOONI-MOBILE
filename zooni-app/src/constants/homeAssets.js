/**
 * Imágenes estáticas de la Home.
 *
 * Ubicación en el proyecto:
 *   zooni-app/assets/home_background.png  → fondo del hero (paisaje)
 *   zooni-app/assets/perro_basico.png      → ilustración mascota (transparente)
 *
 * Instalar desde adjuntos de Cursor:  npm run setup:home-assets
 */

// Pre-cargar las imágenes en memoria al iniciar la app (caché)
import { Asset } from 'expo-asset';
import { Image } from 'react-native';

const HOME_BACKGROUND_SOURCE = require('../../assets/home_background.png');
const PET_PLACEHOLDER_SOURCE = require('../../assets/perro_basico.png');

// Pre-cache: cargar en background al importar este módulo
Asset.fromModule(HOME_BACKGROUND_SOURCE).downloadAsync();
Asset.fromModule(PET_PLACEHOLDER_SOURCE).downloadAsync();

export const HOME_BACKGROUND = HOME_BACKGROUND_SOURCE;
export const PET_PLACEHOLDER = PET_PLACEHOLDER_SOURCE;

/**
 * @param {{ fotoUrl?: string | null }} mascota
 * @returns {import('react-native').ImageSourcePropType}
 */
export function resolvePetImageSource(mascota) {
  if (mascota?.fotoUrl) {
    // Preload de imágenes remotas
    Image.prefetch(mascota.fotoUrl);
    return { uri: mascota.fotoUrl };
  }
  return PET_PLACEHOLDER;
}
