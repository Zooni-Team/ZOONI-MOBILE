/**
 * chatStore.js — Chat sobre Supabase (tabla Mensaje)
 *
 * Dos tipos de conversación en la misma tabla:
 *   - Match (idMatch):    chat 1 a 1 entre dos usuarios que matchearon.
 *   - Servicio (idServicio): mensajes de un usuario hacia una veterinaria/
 *     paseador/petshop/peluquería. El negocio no tiene cuenta en la app,
 *     así que estos hilos son de un solo lado (no hay respuestas reales).
 * Cada fila pertenece a uno de los dos, nunca a ambos (ver migración 011).
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';

function mapRow(row) {
  return {
    id: row.id,
    texto: row.texto,
    autor: row.idUsuario === getCurrentUserId() ? 'yo' : 'otro',
    fecha: row.fecha,
    // Para los tildes tipo WhatsApp: en mis mensajes, `leido` dice si el otro
    // ya lo abrió (lo marca marcarLeidosMatch cuando entra al chat).
    leido: !!row.leido,
  };
}

/** Mensajes de un chat de Match o de un chat de Servicio, del más viejo al más nuevo. */
export async function getMensajes({ matchId, servicioId }) {
  if (!matchId && !servicioId) return [];
  let query = supabase.from('Mensaje').select('*').order('fecha', { ascending: true });
  query = matchId
    ? query.eq('idMatch', matchId)
    // Un servicio puede tener mensajes de varios clientes distintos — sin este
    // filtro por usuario, cada uno vería la conversación de todos los demás.
    : query.eq('idServicio', servicioId).eq('idUsuario', getCurrentUserId());
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

async function resolverOtroUsuario(matchId) {
  const { data } = await supabase.from('Match').select('*').eq('id', matchId).single();
  if (!data) return getCurrentUserId();
  return data.idUsuarioUno === getCurrentUserId() ? data.idUsuarioDos : data.idUsuarioUno;
}

/** Envía un mensaje mío a un chat de Match o de Servicio y devuelve la lista actualizada. */
export async function enviarMensaje({ matchId, servicioId, texto }) {
  const row = { idUsuario: getCurrentUserId(), texto, fecha: new Date().toISOString() };
  if (matchId) row.idMatch = matchId;
  else row.idServicio = servicioId;

  const { error } = await supabase.from('Mensaje').insert(row);
  if (error) throw error;

  // Solo en chats de Match hay alguien real del otro lado para avisarle
  // (un servicio no tiene cuenta ni Notificaciones propias).
  if (matchId) {
    const otroId = await resolverOtroUsuario(matchId);
    const { data: yo } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).single();
    const nombreMio = `${yo?.Nombre ?? ''} ${yo?.Apellido ?? ''}`.trim() || 'Alguien';
    await supabase.from('Notificacion').insert({
      Id_User: otroId,
      Titulo: `Nuevo mensaje de ${nombreMio}`,
      Mensaje: texto.length > 80 ? `${texto.slice(0, 80)}…` : texto,
      Tipo: 'mensaje',
      Leido: false,
    });
  }

  return getMensajes({ matchId, servicioId });
}

/** Marca como leídos los mensajes que me mandó el otro usuario en un chat de Match. */
export async function marcarLeidosMatch(matchId) {
  if (!matchId) return;
  await supabase.from('Mensaje').update({ leido: true })
    .eq('idMatch', matchId).neq('idUsuario', getCurrentUserId()).eq('leido', false);
}

/** Total de mensajes sin leer en todos mis chats de Match (para el badge del menú). */
export async function contarMensajesNoLeidos() {
  const miId = getCurrentUserId();
  const { data: matches } = await supabase
    .from('Match')
    .select('id')
    .or(`idUsuarioUno.eq.${miId},idUsuarioDos.eq.${miId}`)
    .eq('activo', true);
  const matchIds = (matches ?? []).map((m) => m.id);
  if (!matchIds.length) return 0;

  const { count } = await supabase
    .from('Mensaje')
    .select('id', { count: 'exact', head: true })
    .in('idMatch', matchIds)
    .neq('idUsuario', miId)
    .eq('leido', false);
  return count ?? 0;
}

// ─────────────────────────────────────────────
// INBOX — lista de conversaciones para MensajesScreen
// ─────────────────────────────────────────────

/** Mis conversaciones de Match (con o sin mensajes todavía), la más reciente primero. */
export async function fetchMisConversacionesMatch() {
  const miId = getCurrentUserId();
  const { data: matches, error } = await supabase
    .from('Match')
    .select('*')
    .or(`idUsuarioUno.eq.${miId},idUsuarioDos.eq.${miId}`)
    .eq('activo', true);
  if (error || !matches?.length) return [];

  const otroIdPorMatch = new Map(
    matches.map((m) => [m.id, m.idUsuarioUno === miId ? m.idUsuarioDos : m.idUsuarioUno]),
  );
  const otroIds = [...new Set(otroIdPorMatch.values())];

  const [{ data: usuarios }, { data: mensajes }] = await Promise.all([
    supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil').in('Id_User', otroIds),
    supabase.from('Mensaje').select('*').in('idMatch', matches.map((m) => m.id)).order('fecha', { ascending: false }),
  ]);
  const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.Id_User, u]));

  return matches
    .map((m) => {
      const otro = usuarioPorId.get(otroIdPorMatch.get(m.id));
      const mensajesDelMatch = (mensajes ?? []).filter((msg) => msg.idMatch === m.id);
      const ultimo = mensajesDelMatch[0]; // ya viene ordenado desc
      const noLeidos = mensajesDelMatch.filter((msg) => !msg.leido && msg.idUsuario !== miId).length;
      return {
        chatId: m.id,
        nombre: `${otro?.Nombre ?? ''} ${otro?.Apellido ?? ''}`.trim() || 'Usuario',
        fotoPerfilUrl: otro?.FotoPerfil ?? null,
        ultimoMensaje: ultimo?.texto ?? null,
        fecha: ultimo?.fecha ?? m.fecha,
        noLeidos,
        // Para el tilde en la vista previa del inbox: solo tiene sentido si el
        // último mensaje lo mandé yo (si lo mandó el otro, no hay nada que
        // confirmar de mi lado).
        ultimoEsMio: ultimo ? ultimo.idUsuario === miId : false,
        ultimoLeido: !!ultimo?.leido,
      };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/** Últimos mensajes míos por servicio (para mostrar la vista previa en la lista de Servicios). */
export async function fetchMisUltimosMensajesServicios() {
  const { data: mensajes, error } = await supabase
    .from('Mensaje')
    .select('*')
    .eq('idUsuario', getCurrentUserId())
    .not('idServicio', 'is', null)
    .order('fecha', { ascending: false });
  if (error || !mensajes?.length) return new Map();

  const porServicio = new Map();
  for (const msg of mensajes) {
    if (!porServicio.has(msg.idServicio)) {
      porServicio.set(msg.idServicio, { ultimoMensaje: msg.texto, fecha: msg.fecha });
    }
  }
  return porServicio;
}
