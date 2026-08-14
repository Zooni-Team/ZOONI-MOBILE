/**
 * avatarImages.js — Imágenes de los looks del Closet
 *
 * Solo unos pocos avatares tienen arte propio todavía. Para el resto NO se usa
 * un placeholder fijo: se cae a la ilustración real de la especie (y raza) de
 * la mascota, la misma que muestran el registro, Home y la Ficha Médica.
 *
 * Antes cualquier avatar sin arte devolvía perro_basico.png, así que el Closet
 * de un British Shorthair mostraba un perro genérico.
 */

import { resolveMascotaBasicoImage } from './registroImages';

const FALLBACK = require('../../assets/perro_basico.png');

const AVATAR_IMAGES = {
  // Mestizo / Sin raza definida — únicos looks con arte real por ahora.
  'perro_mestizo_breakingbad':    require('../../assets/avatares/mestizo/perro_breakingbad.png'),
  'perro_mestizo_ballindeverdad': require('../../assets/avatares/mestizo/perro_ballindeverdad.png'),
  'perro_mestizo_bienagustin':    require('../../assets/avatares/mestizo/perro_bienagustin.png'),
};

/**
 * Imagen de un look del Closet.
 *
 * @param {string}  assetName  asset del avatar (ej. 'gato_lentes')
 * @param {string}  especie    especie de la mascota — define el fallback
 * @param {string}  raza       raza, para caer en la ilustración exacta
 */
export function resolveAvatarImage(assetName, especie = null, raza = null) {
  const propia = AVATAR_IMAGES[assetName];
  if (propia) return propia;

  // Sin arte propio: la especie manda. Si no viene por parámetro se deduce del
  // prefijo del asset ('gato_lentes' → 'gato'), que es como los nombra la tabla
  // avatares_catalogo.
  const esp = String(especie ?? String(assetName ?? '').split('_')[0] ?? '')
    .toLowerCase().trim();
  // El catálogo llama 'pajaro' a lo que el set de ilustraciones llama 'ave'
  const porRaza = resolveMascotaBasicoImage(esp === 'pajaro' ? 'ave' : esp, raza);
  return porRaza ?? FALLBACK;
}

export default AVATAR_IMAGES;
