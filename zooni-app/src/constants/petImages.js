const FALLBACK = require('../../assets/perro_basico.png');

import { resolveMascotaBasicoImage } from './registroImages';

export const PET_IMAGES = {
  perro_default:           FALLBACK,
  perro_labrador:          FALLBACK,
  perro_golden:            FALLBACK,
  perro_bulldog:           FALLBACK,
  perro_beagle:            FALLBACK,
  perro_poodle:            FALLBACK,
  perro_husky:             FALLBACK,
  perro_pastor_aleman:     FALLBACK,
  perro_dalmata:           FALLBACK,
  perro_chihuahua:         FALLBACK,
  perro_yorkshire:         FALLBACK,

  gato_default:            FALLBACK,
  gato_persa:              FALLBACK,
  gato_siames:             FALLBACK,
  gato_maine_coon:         FALLBACK,
  gato_british:            FALLBACK,

  conejo_default:          FALLBACK,
  hamster_default:         FALLBACK,
  pajaro_default:          FALLBACK,

  perro_mestizo_breakingbad:    require('../../assets/avatares/mestizo/perro_breakingbad.png'),
  perro_mestizo_ballindeverdad: require('../../assets/avatares/mestizo/perro_ballindeverdad.png'),
  perro_mestizo_bienagustin:    require('../../assets/avatares/mestizo/perro_bienagustin.png'),
};

export function resolvePetImage(imagenAsset) {
  const propia = PET_IMAGES[imagenAsset];
  if (propia && propia !== FALLBACK) return propia;

  const especie = String(imagenAsset ?? '').split('_')[0];
  const porEspecie = resolveMascotaBasicoImage(especie === 'pajaro' ? 'ave' : especie, null);
  return porEspecie ?? FALLBACK;
}

export function resolveMascotaVisual(mascota = {}) {
  const fotoUrl = mascota.fotoUrl ?? mascota.foto_url ?? mascota.foto_real_url ?? null;
  const asset = mascota.imagenAsset ?? mascota.imagen_asset ?? null;
  const { especie, raza } = mascota;

  if (fotoUrl && mascota.mostrarFoto !== false) return { uri: fotoUrl };

  const propia = PET_IMAGES[asset];
  if (propia && propia !== FALLBACK) return propia;

  const esp = String(especie ?? '').toLowerCase().trim();
  const porRaza = resolveMascotaBasicoImage(esp === 'pajaro' ? 'ave' : esp, raza);
  if (porRaza && porRaza !== FALLBACK) return porRaza;

  return resolvePetImage(asset);
}
