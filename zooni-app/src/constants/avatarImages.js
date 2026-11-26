import { resolveMascotaBasicoImage } from './registroImages';

const FALLBACK = require('../../assets/perro_basico.png');

const AVATAR_IMAGES = {
  'perro_mestizo_breakingbad':    require('../../assets/avatares/mestizo/perro_breakingbad.png'),
  'perro_mestizo_ballindeverdad': require('../../assets/avatares/mestizo/perro_ballindeverdad.png'),
  'perro_mestizo_bienagustin':    require('../../assets/avatares/mestizo/perro_bienagustin.png'),
};

export function resolveAvatarImage(assetName, especie = null, raza = null) {
  const propia = AVATAR_IMAGES[assetName];
  if (propia) return propia;

  const esp = String(especie ?? String(assetName ?? '').split('_')[0] ?? '')
    .toLowerCase().trim();
  const porRaza = resolveMascotaBasicoImage(esp === 'pajaro' ? 'ave' : esp, raza);
  return porRaza ?? FALLBACK;
}

export default AVATAR_IMAGES;
