// Placeholder temporal — reemplazar cada require con el PNG real del avatar
// cuando el equipo de diseño los agregue en assets/avatares/
const PLACEHOLDER = require('../../assets/perro_basico.png');

const AVATAR_IMAGES = {
  'perro_default':           PLACEHOLDER,
  'gato_default':            PLACEHOLDER,
  'gato_lentes':             PLACEHOLDER,
  'gato_corona':             PLACEHOLDER,

  // Mestizo / Sin raza definida — únicos looks de perro con arte real por ahora.
  'perro_mestizo_breakingbad':    require('../../assets/avatares/mestizo/perro_breakingbad.png'),
  'perro_mestizo_ballindeverdad': require('../../assets/avatares/mestizo/perro_ballindeverdad.png'),
  'perro_mestizo_bienagustin':    require('../../assets/avatares/mestizo/perro_bienagustin.png'),
};

export function resolveAvatarImage(assetName, especie = 'perro') {
  if (assetName && AVATAR_IMAGES[assetName]) {
    return AVATAR_IMAGES[assetName];
  }
  return PLACEHOLDER;
}

export default AVATAR_IMAGES;
