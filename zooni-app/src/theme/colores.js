/**
 * colores.js — Paleta ÚNICA de Zooni.
 *
 * Todo color que aparezca en más de un lugar sale de acá:
 *   import { colores } from '../theme';
 *   backgroundColor: colores.verde
 *
 * Los valores son EXACTAMENTE los que ya usaba la app (se migró con un codemod
 * sin cambiar ni un pixel). Por eso hay grises muy parecidos entre sí: unificarlos
 * es una decisión de diseño pendiente, ver docs/claude/estilos.md.
 *
 * Cambiar el color de marca = cambiar UNA línea (`verde`).
 */

export const colores = Object.freeze({
  // ── Marca ──────────────────────────────────────────────────────────────────
  verde: '#2DBD72',          // color principal (botones, íconos activos)
  verdeOscuro: '#177046',    // textos sobre fondos verdes claros
  verdeExito: '#27AE60',     // confirmaciones / estados OK
  verdeBurbuja: '#A8E6C0',   // burbujas de chat propias
  menta: '#C8F0D8',          // fondos de pantalla / chips activos
  mentaSuave: '#E8F5EC',
  mentaFondo: '#F0FFF6',
  mentaTarjeta: '#E3F7EC',
  mentaClara: '#D4F5E2',
  mentaGris: '#E8EFE9',
  mentaBorde: '#E8F7EE',
  verdeGrisaceo: '#5A6B60',
  turquesa: '#5BC8D0',

  // ── Acentos ────────────────────────────────────────────────────────────────
  amarillo: '#F5C842',       // CTA principal
  ambar: '#F5A623',          // advertencias
  ambarFondo: '#FFF1DC',
  ambarOscuro: '#B07A00',
  marron: '#5C3D1E',
  violeta: '#9B59B6',
  azul: '#2B6CB0',
  azulFondo: '#E6F0FA',

  // ── Error / peligro ────────────────────────────────────────────────────────
  rojo: '#E63946',
  rojoOscuro: '#B3121D',
  rojoFondo: '#FDECEE',
  rojoBorde: '#F5B7BD',

  // ── Texto ──────────────────────────────────────────────────────────────────
  texto: '#2C2C2C',
  textoSecundario: '#6B6B6B',
  textoTenue: '#AAAAAA',
  textoDeshabilitado: '#9B9B9B',
  textoGris: '#9A9A9A',

  // ── Neutros (de más claro a más oscuro) ───────────────────────────────────
  blanco: '#FFFFFF',
  negro: '#000000',
  gris50: '#F5F5F5',
  gris75: '#F2F2F2',
  gris100: '#F1F1F1',
  gris150: '#F0F0F0',
  gris200: '#EFEFEF',
  gris250: '#EEEEEE',
  gris300: '#E8E8E8',
  gris350: '#E6E6E6',
  gris400: '#E0E0E0',
  gris500: '#DDDDDD',        // bordes de inputs
  gris600: '#D8D8D8',
});

/**
 * Valores literales → nombre. Lo usa scripts/verificar-colores.mjs para
 * avisar si alguien vuelve a escribir un hex de la paleta a mano.
 */
export const COLOR_POR_HEX = Object.freeze(
  Object.fromEntries(Object.entries(colores).map(([nombre, hex]) => [hex, nombre])),
);
