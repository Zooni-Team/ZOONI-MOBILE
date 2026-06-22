// Placeholder temporal — reemplazar cada require con el PNG real del avatar
// cuando el equipo de diseño los agregue en assets/avatares/
const PLACEHOLDER = require('../../assets/perro_basico.png');

const AVATAR_IMAGES = {
  'perro_default':           PLACEHOLDER,
  'perro_labrador_gorro':    PLACEHOLDER,
  'perro_labrador_lentes':   PLACEHOLDER,
  'perro_golden_corbata':    PLACEHOLDER,
  'perro_bombero':           PLACEHOLDER,
  'perro_astronauta':        PLACEHOLDER,
  'gato_default':            PLACEHOLDER,
  'gato_lentes':             PLACEHOLDER,
  'gato_corona':             PLACEHOLDER,
};

export function resolveAvatarImage(assetName, especie = 'perro') {
  if (assetName && AVATAR_IMAGES[assetName]) {
    return AVATAR_IMAGES[assetName];
  }
  return PLACEHOLDER;
}

export default AVATAR_IMAGES;
