/**
 * paseador/avisos.js — Notificaciones de paseos (tabla Notificacion).
 *
 * Una cuenta puede ser dueña y paseadora: `modo` dice en cuál de los dos modos
 * de la app se muestra el aviso y `destino` qué pestaña del paseador abre.
 */

import { notificar } from '../comun';

export const notificarPaseo = (idUser, titulo, mensaje, destino = null, modo = 'paseador') =>
  notificar(idUser, titulo, mensaje, { tipo: 'paseo', destino, extra: { modo } });

/** Aviso al dueño de un paseo (se le muestra en modo dueño). */
export const notificarDueno = (paseo, titulo, mensaje) =>
  notificarPaseo(paseo?.idDueno, titulo, mensaje, null, 'dueno');
