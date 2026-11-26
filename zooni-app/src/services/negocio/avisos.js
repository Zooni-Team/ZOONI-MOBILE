import { notificar } from '../comun';

export const notificarNegocio = (idUser, titulo, mensaje, opciones = {}) =>
  notificar(idUser, titulo, mensaje, { tipo: 'negocio', ...opciones });
