/**
 * paseador/notificaciones.js — Campana del modo paseador.
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { esNotificacionDePaseador } from '../comun';

export async function fetchNotificacionesPaseador() {
  // Tipo y DataExtra se traen para poder navegar al tocar la notificación,
  // igual que en el panel del Home de dueños.
  const { data } = await supabase.from('Notificacion')
    .select('Id, Titulo, Mensaje, Fecha, Leido, Tipo, DataExtra')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .limit(40);
  // Sólo las del modo paseador (las de dueño van al Home de dueños)
  return (data ?? []).filter(esNotificacionDePaseador).slice(0, 20).map((n) => ({
    id: n.Id, titulo: n.Titulo, mensaje: n.Mensaje, fecha: n.Fecha, leido: n.Leido,
    tipo: n.Tipo ?? null, dataExtra: n.DataExtra ?? null,
  }));
}

/**
 * A dónde lleva una notificación del paseador al tocarla.
 *
 * Las notificaciones viejas se guardaron todas con Tipo 'paseo' y sin
 * DataExtra, así que para esas hay que mirar el título. Las nuevas traen
 * `DataExtra.destino` y entran por el primer caso.
 *
 * @returns {'chats'|'solicitudes'|'pagos'|'inicio'}
 */
export function destinoNotificacionPaseador(n) {
  if (n?.dataExtra?.destino) return n.dataExtra.destino;
  if (n?.tipo === 'mensaje') return 'chats';

  const titulo = String(n?.titulo ?? '').toLowerCase();
  if (titulo.includes('mensaje')) return 'chats';
  if (titulo.includes('solicitud')) return 'solicitudes';
  return 'inicio';
}

/** Marca UNA notificación como leída (al tocarla), sin tocar las demás. */
export async function marcarNotificacionPaseadorLeida(id) {
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id', id).eq('Id_User', getCurrentUserId());
}

export async function marcarNotificacionesLeidas() {
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id_User', getCurrentUserId()).eq('Leido', false);
}
