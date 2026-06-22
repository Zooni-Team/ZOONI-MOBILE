/**
 * petImages.js — Mapa de nombre de asset → require() para imágenes de mascotas
 *
 * El backend guarda solo el string del nombre del asset (ej: "perro_labrador").
 * Este archivo resuelve qué archivo de imagen local usar para cada nombre.
 *
 * CÓMO AGREGAR UNA NUEVA IMAGEN:
 *   1. Copiá el archivo .png a zooni-app/assets/mascotas/
 *   2. Agregá una entrada en PET_IMAGES con el mismo key que guardarás en la DB
 *
 * IMPORTANTE: En React Native los require() deben ser estáticos (string literal).
 * No se pueden construir dinámicamente con variables.
 */

// Imagen de fallback cuando el asset no existe o no está definido
const FALLBACK = require('../../assets/perro_basico.png');

export const PET_IMAGES = {
  // ── Perros ──────────────────────────────────────────────────────────────
  perro_default:           FALLBACK,
  perro_labrador:          FALLBACK, // reemplazar con require('../../assets/mascotas/perro_labrador.png')
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
  if (!imagenAsset) return FALLBACK;
  return PET_IMAGES[imagenAsset] ?? FALLBACK;
}
