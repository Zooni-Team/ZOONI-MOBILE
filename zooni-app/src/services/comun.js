/**
 * comun.js — Piezas que comparten todos los servicios (src/services/*).
 *
 *   errorApp('sin_stock', errorDeSupabase)  → Error con código para la pantalla
 *                                             y el detalle real en e.detalle
 *   errorBase(error)                        → idem, eligiendo el código solo
 *   notificar(idUser, titulo, mensaje, { tipo, destino, extra })
 *                                           → aviso en la tabla Notificacion
 *
 * Antes cada servicio tenía su copia (negocioApi y paseadorApi idénticas,
 * chatStore y Comunidad insertaban la notificación a mano).
 * Guía: docs/claude/servicios.md
 */

import { supabase } from '../lib/supabase';

/** La tabla, columna o función no existe: falta correr una migración. */
export function esEsquemaFaltante(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = String(error.message ?? '');
  return ['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST202'].includes(code)
    || /does not exist|schema cache|sin configurar/i.test(msg);
}

/** PGRST202: la función RPC no existe. */
export function esFuncionInexistente(error) {
  return error?.code === 'PGRST202' || /function .* does not exist/i.test(error?.message ?? '');
}

/** RLS o un GRANT no dejan hacer la operación (42501). */
export function esSinPermiso(error) {
  return error?.code === '42501' || /row-level security|permission denied/i.test(String(error?.message ?? ''));
}

/** Error con código para la pantalla + el mensaje real de Supabase en `detalle`. */
export function errorApp(codigo, original) {
  const e = new Error(codigo);
  e.detalle = original
    ? [original.message, original.details, original.hint, original.code && `código ${original.code}`]
      .filter(Boolean).join(' · ')
    : null;
  return e;
}

/** errorApp con el código genérico que corresponda. */
export const errorBase = (error) =>
  errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);

/** Recorta un texto para el cuerpo de una notificación. */
export const resumir = (texto, max = 80) => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

/**
 * Avisa a alguien (tabla Notificacion; la política notif_crear de 061 deja
 * crear avisos para otros). Nunca rompe el flujo que la llama: el cambio
 * principal ya quedó guardado.
 */
export async function notificar(idUser, titulo, mensaje, { tipo = 'general', destino = null, extra = null, idMascota = null } = {}) {
  if (!idUser) return;
  try {
    await supabase.from('Notificacion').insert({
      Id_User: idUser,
      Titulo: titulo,
      Mensaje: mensaje,
      Tipo: tipo,
      Leido: false,
      ...(idMascota ? { Id_Mascota: idMascota } : {}),
      DataExtra: destino || extra ? { ...(extra ?? {}), ...(destino ? { destino } : {}) } : null,
    });
  } catch {
    // La notificación es un extra.
  }
}
