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
  /** Botones chicos y chips que se despegan apenas del fondo. */
  suave: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  }),
  /** Tarjetas con borde dentro de una hoja blanca (registros de salud). */
  sutil: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  }),
  /** Ventanas modales centradas. */
  modal: Object.freeze({
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  }),
});
