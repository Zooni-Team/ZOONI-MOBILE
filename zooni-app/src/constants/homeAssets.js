import { Asset } from 'expo-asset';
import { Image } from 'react-native';

const HOME_BACKGROUND_SOURCE = require('../../assets/home_background.png');
const PET_PLACEHOLDER_SOURCE = require('../../assets/perro_basico.png');

Asset.fromModule(HOME_BACKGROUND_SOURCE).downloadAsync();
Asset.fromModule(PET_PLACEHOLDER_SOURCE).downloadAsync();

export const HOME_BACKGROUND = HOME_BACKGROUND_SOURCE;
export const PET_PLACEHOLDER = PET_PLACEHOLDER_SOURCE;

export function resolvePetImageSource(mascota) {
  if (mascota?.fotoUrl) {
    Image.prefetch(mascota.fotoUrl);
    return { uri: mascota.fotoUrl };
  }
  return PET_PLACEHOLDER;
}
