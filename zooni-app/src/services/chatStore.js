import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { perfilesPorId } from './perfilesPublicos';
import { errorBase, notificar, resumir } from './comun';

function mapRow(row) {
  return {
    id: row.id,
    texto: row.texto,
    autor: !row.deNegocio && row.idUsuario === getCurrentUserId() ? 'yo' : 'otro',
    fecha: row.fecha,
    leido: !!row.leido,
  };
}

const MAX_MENSAJES = 200;

export async function getMensajes({ matchId, servicioId }) {
  if (!matchId && !servicioId) return [];
  let query = supabase.from('Mensaje').select('*')
    .order('fecha', { ascending: false }).order('id', { ascending: false }).limit(MAX_MENSAJES);
  query = matchId
    ? query.eq('idMatch', matchId)
    : query.eq('idServicio', servicioId).eq('idUsuario', getCurrentUserId());
  const { data, error } = await query;
  if (error) throw errorBase(error);
  return (data ?? []).reverse().map(mapRow);
}

async function resolverOtroUsuario(matchId) {
  const { data } = await supabase.from('Match').select('idUsuarioUno, idUsuarioDos').eq('id', matchId).maybeSingle();
  if (!data) return null;
  const miId = getCurrentUserId();
  return data.idUsuarioUno === miId ? data.idUsuarioDos : data.idUsuarioUno;
}

async function avisarAlOtroDelMatch(matchId, texto) {
  const otroId = await resolverOtroUsuario(matchId);
  if (!otroId) return;
  const { data: yo } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).maybeSingle();
  const nombreMio = `${yo?.Nombre ?? ''} ${yo?.Apellido ?? ''}`.trim() || 'Alguien';
  await notificar(otroId, `Nuevo mensaje de ${nombreMio}`, resumir(texto), { tipo: 'mensaje' });
}

export async function enviarMensaje({ matchId, servicioId, texto }) {
  const limpio = String(texto ?? '').trim().slice(0, 2000);
  if (!limpio) return null;
  const row = { idUsuario: getCurrentUserId(), texto: limpio };
  if (matchId) row.idMatch = matchId;
  else row.idServicio = servicioId;

  const { error } = await supabase.from('Mensaje').insert(row);
  if (error) throw errorBase(error);

  if (servicioId) avisarAlNegocio(servicioId, limpio).catch(() => {});
  if (matchId) avisarAlOtroDelMatch(matchId, limpio).catch(() => {});

  return getMensajes({ matchId, servicioId }).catch(() => null);
}

async function avisarAlNegocio(servicioId, texto) {
  const { data: pin } = await supabase.from('servicios').select('id_negocio').eq('id', servicioId).maybeSingle();
  if (!pin?.id_negocio) return;
  const { data: negocio } = await supabase.from('negocio_perfil').select('id_user').eq('id', pin.id_negocio).maybeSingle();
  if (!negocio?.id_user || negocio.id_user === getCurrentUserId()) return;
  const { data: yo } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).maybeSingle();
  const nombreMio = `${yo?.Nombre ?? ''} ${yo?.Apellido ?? ''}`.trim() || 'Un cliente';
  await notificar(negocio.id_user, `Mensaje de ${nombreMio}`, resumir(texto), { tipo: 'negocio', destino: 'mensajes' });
}

export async function negocioDeServicio(servicioId) {
  if (!servicioId) return null;
  const { data } = await supabase.from('servicios').select('id_negocio').eq('id', servicioId).maybeSingle();
  return data?.id_negocio ?? null;
}

export async function marcarLeidosServicio(servicioId) {
  if (!servicioId) return;
  await supabase.from('Mensaje').update({ leido: true })
    .eq('idServicio', servicioId).eq('idUsuario', getCurrentUserId()).eq('deNegocio', true).eq('leido', false);
}

export async function marcarLeidosMatch(matchId) {
  if (!matchId) return;
  await supabase.from('Mensaje').update({ leido: true })
    .eq('idMatch', matchId).neq('idUsuario', getCurrentUserId()).eq('leido', false);
}

export async function contarMensajesNoLeidos() {
  const miId = getCurrentUserId();
  const [deMatches, deNegocios] = await Promise.all([contarNoLeidosMatch(miId), contarRespuestasNegocios(miId)]);
  return deMatches + deNegocios;
}

async function contarNoLeidosMatch(miId) {
  const { data: matches } = await supabase
    .from('Match')
    .select('id')
    .or(`idUsuarioUno.eq.${Number(miId)},idUsuarioDos.eq.${Number(miId)}`)
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

async function contarRespuestasNegocios(miId) {
  const { count, error } = await supabase
    .from('Mensaje')
    .select('id', { count: 'exact', head: true })
    .eq('idUsuario', miId)
    .eq('deNegocio', true)
    .eq('leido', false);
  return error ? 0 : (count ?? 0);
}

export async function fetchMisConversacionesMatch() {
  const miId = getCurrentUserId();
  const { data: matches, error } = await supabase
    .from('Match')
    .select('*')
    .or(`idUsuarioUno.eq.${Number(miId)},idUsuarioDos.eq.${Number(miId)}`)
    .eq('activo', true);
  if (error || !matches?.length) return [];

  const otroIdPorMatch = new Map(
    matches.map((m) => [m.id, m.idUsuarioUno === miId ? m.idUsuarioDos : m.idUsuarioUno]),
  );
  const otroIds = [...new Set(otroIdPorMatch.values())];

  const idsMascotas = [...new Set(matches.flatMap((m) => [m.idMascotaUno, m.idMascotaDos]))];
  const [usuarios, { data: mensajes }, { data: mascotas }] = await Promise.all([
    perfilesPorId(otroIds),
    supabase.from('Mensaje').select('*').in('idMatch', matches.map((m) => m.id)).order('fecha', { ascending: false }),
    supabase.from('Mascota').select('Id_Mascota, Nombre').in('Id_Mascota', idsMascotas),
  ]);
  const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.Id_User, u]));
  const nombreMascota = new Map((mascotas ?? []).map((x) => [x.Id_Mascota, x.Nombre]));
  const matchesPorPersona = new Map();
  otroIdPorMatch.forEach((otro) => matchesPorPersona.set(otro, (matchesPorPersona.get(otro) ?? 0) + 1));

  return matches
    .map((m) => {
      const otro = usuarioPorId.get(otroIdPorMatch.get(m.id));
      const mensajesDelMatch = (mensajes ?? []).filter((msg) => msg.idMatch === m.id);
      const ultimo = mensajesDelMatch[0];
      const noLeidos = mensajesDelMatch.filter((msg) => !msg.leido && msg.idUsuario !== miId).length;
      const nombre = `${otro?.Nombre ?? ''} ${otro?.Apellido ?? ''}`.trim() || 'Usuario';
      const repetido = matchesPorPersona.get(otroIdPorMatch.get(m.id)) > 1;
      const parMascotas = [m.idMascotaUno, m.idMascotaDos].map((id) => nombreMascota.get(id)).filter(Boolean).join(' y ');
      return {
        chatId: m.id,
        nombre: repetido && parMascotas ? `${nombre} · ${parMascotas}` : nombre,
        fotoPerfilUrl: otro?.FotoPerfil ?? null,
        ultimoMensaje: ultimo?.texto ?? null,
        fecha: ultimo?.fecha ?? m.fecha,
        noLeidos,
        ultimoEsMio: ultimo ? ultimo.idUsuario === miId : false,
        ultimoLeido: !!ultimo?.leido,
      };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

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
      porServicio.set(msg.idServicio, {
        ultimoMensaje: msg.texto, fecha: msg.fecha, ultimoDelNegocio: !!msg.deNegocio, noLeidos: 0,
      });
    }
    if (msg.deNegocio && !msg.leido) porServicio.get(msg.idServicio).noLeidos += 1;
  }
  return porServicio;
}
