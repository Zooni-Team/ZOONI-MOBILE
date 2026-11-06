/**
 * sombras.js — Sombras compartidas (iOS usa shadow*, Android elevation).
 *
 *   import { sombras } from '../theme';
 *   tarjeta: { ...sombras.tarjeta, borderRadius: 16 }
 */

import { colores } from './colores';

export const sombras = Object.freeze({
  /** Tarjetas de listas (paseos, turnos, negocios). */
  tarjeta: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  }),
});
