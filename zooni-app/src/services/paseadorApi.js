/**
 * paseadorApi.js — Puerta de entrada a los servicios de Zooni Paseadores.
 *
 * El código vive en services/paseador/, un archivo por tema:
 *
 *   cuenta          login y altas de paseador, roles de la cuenta
 *   perfil          perfil del paseador logueado
 *   paseos          solicitudes y paseos del paseador (lectura y estados)
 *   pagos           cuenta corriente con cada dueño y ganancias
 *   resenas         reseñas y opiniones
 *   chat            mensajes del paseo e inbox
 *   notificaciones  campana del modo paseador
 *   ladoDueno       buscar paseadores, pedir y cancelar paseos
 *
 * Las reglas y formatos puros (precios, tiempos, cierres) están en
 * domain/paseos; la geocodificación, en services/geocodificacion.
 */

export * from './paseador/cuenta';
export * from './paseador/perfil';
export * from './paseador/paseos';
export * from './paseador/pagos';
export * from './paseador/resenas';
export * from './paseador/chat';
export * from './paseador/notificaciones';
export * from './paseador/ladoDueno';
