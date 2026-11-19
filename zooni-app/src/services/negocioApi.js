/**
 * negocioApi.js — Puerta de entrada a los servicios de Zooni Negocios
 * (veterinarias, peluquerías y pet shops con cuenta propia).
 *
 * El código vive en services/negocio/, un archivo por tema:
 *
 *   cuenta     login y alta del negocio
 *   perfil     datos del negocio, logo, galería y su pin en el mapa
 *   catalogo   servicios / productos que ofrece
 *   turnos     turnos de veterinaria y peluquería, pacientes
 *   pedidos    pedidos del pet shop, clientes
 *   resumen    números del Inicio
 *   chat       mensajes con los clientes
 *
 * Las reglas y formatos puros (horarios, turnos libres, precios, envío) están
 * en domain/negocios.
 */

export * from './negocio/cuenta';
export * from './negocio/perfil';
export * from './negocio/catalogo';
export * from './negocio/turnos';
export * from './negocio/pedidos';
export * from './negocio/resumen';
export * from './negocio/chat';
