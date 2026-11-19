/**
 * negocio/avisos.js — Notificaciones de negocios (tabla Notificacion).
 *
 * Al dueño le llegan con tipo 'turno' / 'pedido' / 'mensaje' (su campana lo
 * lleva a Turnos y pedidos o al chat); al negocio, con `destino` = la sección
 * de su app que hay que abrir.
 */

import { notificar } from '../comun';

/** Aviso de un negocio (tipo 'negocio' salvo que se diga otro). */
export const notificarNegocio = (idUser, titulo, mensaje, opciones = {}) =>
  notificar(idUser, titulo, mensaje, { tipo: 'negocio', ...opciones });
