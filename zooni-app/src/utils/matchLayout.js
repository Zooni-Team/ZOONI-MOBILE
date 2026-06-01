/**
 * Calcula el tamaño de la tarjeta Match para que quepa en pantalla vertical
 * sin scroll (header + tarjeta + botones).
 */

const HEADER_HEIGHT = 57;
const ACTION_BAR_HEIGHT = 88;
const VERTICAL_PADDING = 12;

/** Proporción vertical típica de foto de mascota (ancho : alto ≈ 4 : 5) */
const CARD_ASPECT = 5 / 4;

export function getMatchCardLayout(screenWidth, screenHeight) {
  const cardWidth = screenWidth - 40;
  const maxHeight =
    screenHeight - HEADER_HEIGHT - ACTION_BAR_HEIGHT - VERTICAL_PADDING * 2;
  const idealHeight = cardWidth * CARD_ASPECT;
  const cardHeight = Math.min(maxHeight, idealHeight);

  return {
    cardWidth,
    cardHeight: Math.round(Math.max(240, cardHeight)),
  };
}
