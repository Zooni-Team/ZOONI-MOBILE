import { notificar } from '../comun';

export const notificarPaseo = (idUser, titulo, mensaje, destino = null, modo = 'paseador') =>
  notificar(idUser, titulo, mensaje, { tipo: 'paseo', destino, extra: { modo } });

export const notificarDueno = (paseo, titulo, mensaje) =>
  notificarPaseo(paseo?.idDueno, titulo, mensaje, null, 'dueno');
