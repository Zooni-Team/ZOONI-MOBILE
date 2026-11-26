import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { esNotificacionDePaseador } from '../comun';

export async function fetchNotificacionesPaseador() {
  const { data } = await supabase.from('Notificacion')
    .select('Id, Titulo, Mensaje, Fecha, Leido, Tipo, DataExtra')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .limit(40);
  return (data ?? []).filter(esNotificacionDePaseador).slice(0, 20).map((n) => ({
    id: n.Id, titulo: n.Titulo, mensaje: n.Mensaje, fecha: n.Fecha, leido: n.Leido,
    tipo: n.Tipo ?? null, dataExtra: n.DataExtra ?? null,
  }));
}

export function destinoNotificacionPaseador(n) {
  if (n?.dataExtra?.destino) return n.dataExtra.destino;
  if (n?.tipo === 'mensaje') return 'chats';

  const titulo = String(n?.titulo ?? '').toLowerCase();
  if (titulo.includes('mensaje')) return 'chats';
  if (titulo.includes('solicitud')) return 'solicitudes';
  return 'inicio';
}

export async function marcarNotificacionPaseadorLeida(id) {
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id', id).eq('Id_User', getCurrentUserId());
}

export async function marcarNotificacionesLeidas() {
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id_User', getCurrentUserId()).eq('Leido', false);
}
