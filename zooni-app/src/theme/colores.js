/**
 * colores.js — Paleta ÚNICA de Zooni.
 *
 * Todo color que aparezca en más de un lugar sale de acá:
 *   import { colores } from '../theme';
 *   backgroundColor: colores.verde
 *
 * Grises: cinco, de más claro a más oscuro. Antes eran once (#F2F2F2, #F1F1F1,
 * #EFEFEF…) que se diferenciaban en 1 a 3 niveles de 255: imposibles de
 * distinguir a simple vista. Se unificaron al más cercano.
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
  gris50: '#F5F5F5',         // fondos de campos deshabilitados, chips apagados
  gris100: '#F0F0F0',        // separadores, fondos de filas, bordes de tarjetas
  gris200: '#E8E8E8',        // botones secundarios (Cancelar), placeholders de carga
  gris300: '#DDDDDD',        // bordes de inputs
  gris400: '#D8D8D8',        // líneas dentro de los placeholders de carga
});

/**
 * Valores literales → nombre. Lo usa scripts/verificar-colores.mjs (npm test)
 * para frenar un hex de la paleta escrito a mano.
 */
export const COLOR_POR_HEX = Object.freeze(
  Object.fromEntries(Object.entries(colores).map(([nombre, hex]) => [hex, nombre])),
);
