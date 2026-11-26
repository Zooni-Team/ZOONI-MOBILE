import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { subirImagenPublica } from './imagenStorage';
import { buscarLugares, combinarServicios } from './lugaresApi';
import { consultarPerfiles, perfilesPorId } from './perfilesPublicos';
import { distanciaKm } from '../utils/geo';
import { notificar } from './comun';
import { filtrosBusquedaPersonas } from '../utils/texto';

function aplicarBbox(query, bbox, latCol = 'lat', lngCol = 'lng') {
  if (!bbox) return query;
  return query
    .gte(latCol, bbox.lat_min).lte(latCol, bbox.lat_max)
    .gte(lngCol, bbox.lng_min).lte(lngCol, bbox.lng_max);
}

export async function fetchServiciosPropios(bbox, tipo) {
  let query = supabase.from('servicios').select('*');
  query = aplicarBbox(query, bbox);
  if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchServicios(bbox, tipo) {
  const [propios, externos] = await Promise.all([
    fetchServiciosPropios(bbox, tipo),
    buscarLugares(bbox, tipo ?? 'todos'),
  ]);
  return { servicios: combinarServicios(propios, externos) };
}

export async function fetchServiciosPorId(ids) {
  const lista = [...new Set((ids ?? []).filter((x) => x != null))];
  if (!lista.length) return [];
  const { data, error } = await supabase.from('servicios').select('*').in('id', lista);
  if (error) throw error;
  return data ?? [];
}

const CINCO_MIN = 5 * 60 * 1000;

async function miUbicacion() {
  const { data } = await supabase.from('ubicaciones_usuarios').select('*').eq('usuario_id', getCurrentUserId()).maybeSingle();
  return data;
}

export async function fetchAmigos() {
  const { data: amistades, error } = await supabase
    .from('amistades')
    .select('*')
    .or(`usuario_a_id.eq.${Number(getCurrentUserId())},usuario_b_id.eq.${Number(getCurrentUserId())}`)
    .eq('estado', 'aceptada');
  if (error) throw error;

  const idsAmigos = (amistades ?? []).map((a) => (a.usuario_a_id === getCurrentUserId() ? a.usuario_b_id : a.usuario_a_id));
  if (idsAmigos.length === 0) return { amigos: [] };

  const [usuarios, { data: mascotas }, { data: ubicaciones }, miUbi] = await Promise.all([
    perfilesPorId(idsAmigos, 'Id_User, Nombre, Apellido, UltimaConexion'),
    supabase.from('mascota_publica').select('Id_User, Nombre').in('Id_User', idsAmigos),
    supabase.from('ubicaciones_usuarios').select('*').in('usuario_id', idsAmigos),
    miUbicacion(),
  ]);

  const ubicacionPorUsuario = new Map((ubicaciones ?? []).map((u) => [u.usuario_id, u]));
  const mascotaPorUsuario = new Map();
  (mascotas ?? []).forEach((m) => { if (!mascotaPorUsuario.has(m.Id_User)) mascotaPorUsuario.set(m.Id_User, m); });

  const amigos = (usuarios ?? []).map((u) => {
    const ubi = ubicacionPorUsuario.get(u.Id_User);
    const ultimaConexion = u.UltimaConexion ?? ubi?.updated_at ?? null;
    const online = ultimaConexion
      ? (Date.now() - new Date(ultimaConexion).getTime()) < CINCO_MIN
      : false;
    return {
      usuario_id: u.Id_User,
      nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim(),
      mascota_nombre: mascotaPorUsuario.get(u.Id_User)?.Nombre ?? null,
      distancia_km: distanciaKm(miUbi, ubi),
      online,
      ultima_conexion: ultimaConexion,
      lat: ubi?.lat != null ? Number(ubi.lat) : null,
      lng: ubi?.lng != null ? Number(ubi.lng) : null,
    };
  });

  return { amigos };
}

export async function fetchSolicitudes() {
  const { data, error } = await supabase
    .from('amistades')
    .select('*')
    .eq('usuario_b_id', getCurrentUserId())
    .eq('estado', 'pendiente');
  if (error) throw error;
  if (!data?.length) return { solicitudes: [] };

  const ids = data.map((s) => s.usuario_a_id);
  const usuarios = await perfilesPorId(ids, 'Id_User, Nombre, Apellido');
  const nombrePorId = new Map((usuarios ?? []).map((u) => [u.Id_User, `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim()]));

  return { solicitudes: data.map((s) => ({ id: s.id, nombre: nombrePorId.get(s.usuario_a_id) ?? 'Usuario' })) };
}

export async function enviarSolicitud(usuarioDestinoId) {
  const { data: existente } = await supabase
    .from('amistades')
    .select('*')
    .or(`and(usuario_a_id.eq.${Number(getCurrentUserId())},usuario_b_id.eq.${Number(usuarioDestinoId)}),and(usuario_a_id.eq.${Number(usuarioDestinoId)},usuario_b_id.eq.${Number(getCurrentUserId())})`)
    .maybeSingle();
  if (existente) return { ok: true };

  const { error } = await supabase
    .from('amistades')
    .insert({ usuario_a_id: getCurrentUserId(), usuario_b_id: usuarioDestinoId, estado: 'pendiente' });
  if (error) throw error;

  const { data: yo } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).single();
  const nombreSolicitante = `${yo?.Nombre ?? ''} ${yo?.Apellido ?? ''}`.trim() || 'Alguien';
  await notificar(usuarioDestinoId, 'Nueva solicitud de amistad', `${nombreSolicitante} te envió una solicitud de amistad`, { tipo: 'amistad' });

  return { ok: true };
}

export async function responderSolicitud(id, accion) {
  const estado = accion === 'aceptar' ? 'aceptada' : 'rechazada';
  const { error } = await supabase.from('amistades').update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

export async function buscarUsuarios(q) {
  const filtros = filtrosBusquedaPersonas(q);
  if (!filtros.length) return { resultados: [] };
  const usuarios = await consultarPerfiles('Id_User, Nombre, Apellido, Ubicacion', (query) => {
    let x = query.neq('Id_User', getCurrentUserId()).limit(20);
    filtros.forEach((f) => { x = x.or(f); });
    return x;
  });
  if (!usuarios.length) return { resultados: [] };

  const ids = usuarios.map((u) => u.Id_User);
  const [{ data: mascotas }, { data: amistades }] = await Promise.all([
    supabase.from('mascota_publica').select('Id_User, Nombre').in('Id_User', ids),
    supabase.from('amistades').select('*')
      .or(`usuario_a_id.eq.${Number(getCurrentUserId())},usuario_b_id.eq.${Number(getCurrentUserId())}`),
  ]);

  const mascotaPorUsuario = new Map();
  (mascotas ?? []).forEach((m) => { if (!mascotaPorUsuario.has(m.Id_User)) mascotaPorUsuario.set(m.Id_User, m); });

  const amigosIds = new Set(
    (amistades ?? [])
      .filter((a) => a.estado === 'aceptada')
      .map((a) => (a.usuario_a_id === getCurrentUserId() ? a.usuario_b_id : a.usuario_a_id)),
  );

  const resultados = usuarios.map((u) => ({
    usuario_id: u.Id_User,
    nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim(),
    mascota_nombre: mascotaPorUsuario.get(u.Id_User)?.Nombre ?? null,
    barrio: u.Ubicacion ?? null,
    es_amigo: amigosIds.has(u.Id_User),
  }));

  return { resultados };
}

function mapCartel(row, nombrePublicador, mascota) {
  return {
    id: row.id,
    tipo: row.tipo,
    descripcion: row.descripcion,
    telefono_contacto: row.telefono_contacto,
    foto_url: row.foto_url,
    lat: Number(row.lat),
    lng: Number(row.lng),
    created_at: row.created_at,
    usuario_id: row.usuario_id,
    publicado_por: nombrePublicador ?? 'Usuario Zooni',
    mascota_nombre: mascota?.Nombre ?? null,
    mascota_especie: mascota?.Especie ?? null,
    mascota_raza: mascota?.Raza ?? null,
  };
}

export async function crearCartel(datos) {
  const fotoUrl = datos.fotoUri ? await subirImagenPublica(datos.fotoUri, 'carteles') : null;

  const { data: row, error } = await supabase
    .from('carteles')
    .insert({
      usuario_id: getCurrentUserId(),
      tipo: datos.tipo,
      descripcion: datos.descripcion || null,
      telefono_contacto: datos.telefono_contacto,
      foto_url: fotoUrl,
      lat: datos.lat,
      lng: datos.lng,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: usuario } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).single();
  const nombre = `${usuario?.Nombre ?? ''} ${usuario?.Apellido ?? ''}`.trim();

  return { cartel: mapCartel(row, nombre, null) };
}

export async function eliminarCartel(id) {
  const { error } = await supabase.from('carteles').update({ activo: false }).eq('id', id).eq('usuario_id', getCurrentUserId());
  if (error) throw error;
  return { ok: true };
}

export async function fetchCarteles(bbox) {
  let carteleQuery = supabase.from('carteles').select('*').eq('activo', true);
  carteleQuery = aplicarBbox(carteleQuery, bbox);
  const { data: cartelesRaw, error: errCarteles } = await carteleQuery;
  if (errCarteles) throw errCarteles;

  const usuarioIds = [...new Set((cartelesRaw ?? []).map((c) => c.usuario_id))];
  const mascotaIds = [...new Set((cartelesRaw ?? []).map((c) => c.mascota_id).filter(Boolean))];
  const [usuarios, { data: mascotas }] = await Promise.all([
    perfilesPorId(usuarioIds, 'Id_User, Nombre, Apellido'),
    mascotaIds.length
      ? supabase.from('mascota_publica').select('*').in('Id_Mascota', mascotaIds)
      : { data: [] },
  ]);
  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.Id_User, `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim()]));
  const mascotaPorId = new Map((mascotas ?? []).map((m) => [m.Id_Mascota, m]));

  return (cartelesRaw ?? []).map((c) =>
    mapCartel(c, nombrePorUsuario.get(c.usuario_id), c.mascota_id ? mascotaPorId.get(c.mascota_id) : null));
}

export async function actualizarUbicacion(lat, lng) {
  const { error } = await supabase
    .from('ubicaciones_usuarios')
    .upsert({ usuario_id: getCurrentUserId(), lat, lng, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
  if (error) throw error;
  return { ok: true };
}
