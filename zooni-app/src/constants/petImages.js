/**
 * petImages.js — Mapa de nombre de asset → require() para imágenes de mascotas
 *
 * El backend guarda solo el string del nombre del asset (ej: "perro_labrador").
 * Este archivo resuelve qué archivo de imagen local usar para cada nombre.
 *
 * CÓMO AGREGAR UNA NUEVA IMAGEN:
 *   1. Buscá el archivo .png en zooni-app/wwwroot/img/mascotas/{especie}s/{raza}/
 *      (o agregalo ahí si es nuevo)
 *   2. Agregá una entrada en PET_IMAGES con el mismo key que guardarás en la DB
 *
 * IMPORTANTE: En React Native los require() deben ser estáticos (string literal).
 * No se pueden construir dinámicamente con variables.
 */

// Imagen de fallback cuando el asset no existe o no está definido
const FALLBACK = require('../../assets/perro_basico.png');

// Ilustraciones reales por especie + raza (las del registro, wwwroot/img/mascotas)
import { resolveMascotaBasicoImage } from './registroImages';

export const PET_IMAGES = {
  // ── Perros ──────────────────────────────────────────────────────────────
  perro_default:           FALLBACK,
  perro_labrador:          FALLBACK, // reemplazar con require('../../wwwroot/img/mascotas/perros/labrador retriever/perro_basico.png')
  perro_golden:            FALLBACK,
  perro_bulldog:           FALLBACK,
  perro_beagle:            FALLBACK,
  perro_poodle:            FALLBACK,
  perro_husky:             FALLBACK,
  perro_pastor_aleman:     FALLBACK,
  perro_dalmata:           FALLBACK,
  perro_chihuahua:         FALLBACK,
  perro_yorkshire:         FALLBACK,

  // ── Gatos ──────────────────────────────────────────────────────────────
  gato_default:            FALLBACK,
  gato_persa:              FALLBACK,
  gato_siames:             FALLBACK,
  gato_maine_coon:         FALLBACK,
  gato_british:            FALLBACK,

  // ── Otros ──────────────────────────────────────────────────────────────
  conejo_default:          FALLBACK,
  hamster_default:         FALLBACK,
  pajaro_default:          FALLBACK,

  // ── Looks del Closet (Mestizo / Sin raza definida) — mismos archivos que
  // constants/avatarImages.js, para que el avatar aplicado se vea igual acá
  // (Home, Ficha Médica, Match) y no solo en la vista previa del Closet.
  perro_mestizo_breakingbad:    require('../../assets/avatares/mestizo/perro_breakingbad.png'),
  perro_mestizo_ballindeverdad: require('../../assets/avatares/mestizo/perro_ballindeverdad.png'),
  perro_mestizo_bienagustin:    require('../../assets/avatares/mestizo/perro_bienagustin.png'),
};

/**
 * resolvePetImage(imagenAsset)
 * Devuelve el source de imagen para un asset dado.
 * Si el key no existe en el mapa, devuelve el placeholder.
 *
 * @param {string | null | undefined} imagenAsset
 * @returns {import('react-native').ImageSourcePropType}
 */
export function resolvePetImage(imagenAsset) {
  // Asset con imagen propia (ej: avatares del Closet) → se respeta
  const propia = PET_IMAGES[imagenAsset];
  if (propia && propia !== FALLBACK) return propia;

  // Asset tipo '<especie>_default' (o desconocido): usar la ilustración REAL
  // de esa especie ('otra raza' del set del registro) en vez del perro genérico
  const especie = String(imagenAsset ?? '').split('_')[0];
  const porEspecie = resolveMascotaBasicoImage(especie === 'pajaro' ? 'ave' : especie, null);
  return porEspecie ?? FALLBACK;
}

/**
 * resolveMascotaVisual({ fotoUrl, imagenAsset, especie, raza })
 * Resolución completa de la imagen de una mascota, con la misma lógica por
 * especie + raza que usa el registro, para TODAS las especies:
 *   1. Foto real subida por el usuario
 *   2. Avatar aplicado desde el Closet (asset con imagen propia)
 *   3. Ilustración de su raza (ej: gato persa) — cae en 'otra raza' de la
 *      especie si la raza no tiene dibujo propio
 *   4. Fallback genérico
 */
export function resolveMascotaVisual(mascota = {}) {
  const fotoUrl = mascota.fotoUrl ?? mascota.foto_url ?? mascota.foto_real_url ?? null;
  const asset = mascota.imagenAsset ?? mascota.imagen_asset ?? null;
  const { especie, raza } = mascota;

  if (fotoUrl) return { uri: fotoUrl };

  const propia = PET_IMAGES[asset];
  if (propia && propia !== FALLBACK) return propia;

  const esp = String(especie ?? '').toLowerCase().trim();
  const porRaza = resolveMascotaBasicoImage(esp === 'pajaro' ? 'ave' : esp, raza);
  if (porRaza && porRaza !== FALLBACK) return porRaza;

  return resolvePetImage(asset);
}
