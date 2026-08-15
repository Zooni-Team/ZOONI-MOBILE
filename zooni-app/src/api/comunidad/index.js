/**
 * api/comunidad/index.js — Módulo Comunidad sobre Supabase
 *
 * Tablas: carteles, servicios, amistades, ubicaciones_usuarios (creadas en
 * database/migrations/010_supabase_live_setup.sql — no existían en ningún
 * schema anterior). Reemplaza los mocks in-memory que usaba esta capa.
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { subirImagenPublica } from '../../utils/imagenStorage';
import { buscarLugares, combinarServicios } from '../../services/lugaresApi';

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function aplicarBbox(query, bbox, latCol = 'lat', lngCol = 'lng') {
  if (!bbox) return query;
  return query
    .gte(latCol, bbox.lat_min).lte(latCol, bbox.lat_max)
    .gte(lngCol, bbox.lng_min).lte(lngCol, bbox.lng_max);
}

// ─────────────────────────────────────────────
// SERVICIOS
// ─────────────────────────────────────────────

/**
 * Servicios del área visible: los cargados en Zooni MÁS los negocios reales que
 * existen ahí (veterinarias, pet shops y peluquerías caninas).
 *
 * La tabla `servicios` sola estaba prácticamente vacía, así que la pestaña
 * mostraba "No hay servicios en esta área" en casi todos lados. Los locales
 * reales los aporta el proveedor de mapas — OpenStreetMap por defecto, gratis y
 * sin clave; ver services/lugaresApi.js.
 *
 * Si el proveedor falla, esto devuelve exactamente lo mismo que antes: los
 * servicios propios. La pestaña nunca queda peor que como estaba.
 */
export async function fetchServicios(bbox, tipo) {
  let query = supabase.from('servicios').select('*');
  query = aplicarBbox(query, bbox);
  if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo);

  const [propios, externos] = await Promise.all([
    query,
    buscarLugares(bbox, tipo ?? 'todos'),
  ]);
  if (propios.error) throw propios.error;

  return { servicios: combinarServicios(propios.data ?? [], externos) };
}

// ─────────────────────────────────────────────
// AMIGOS
// ─────────────────────────────────────────────

// Ventana para considerar a alguien "en línea" (mismo umbral que
// utils/tiempoRelativo.UMBRAL_EN_LINEA_MS)
const CINCO_MIN = 5 * 60 * 1000;

async function miUbicacion() {
  const { data } = await supabase.from('ubicaciones_usuarios').select('*').eq('usuario_id', getCurrentUserId()).maybeSingle();
  return data;
}

export async function fetchAmigos() {
  const { data: amistades, error } = await supabase
    .from('amistades')
    .select('*')
    .or(`usuario_a_id.eq.${getCurrentUserId()},usuario_b_id.eq.${getCurrentUserId()}`)
    .eq('estado', 'aceptada');
  if (error) throw error;

  const idsAmigos = (amistades ?? []).map((a) => (a.usuario_a_id === getCurrentUserId() ? a.usuario_b_id : a.usuario_a_id));
  if (idsAmigos.length === 0) return { amigos: [] };

  const [{ data: usuarios }, { data: mascotas }, { data: ubicaciones }, miUbi] = await Promise.all([
    supabase.from('User').select('*').in('Id_User', idsAmigos),
    supabase.from('Mascota').select('*').in('Id_User', idsAmigos),
    supabase.from('ubicaciones_usuarios').select('*').in('usuario_id', idsAmigos),
    miUbicacion(),
  ]);

  const ubicacionPorUsuario = new Map((ubicaciones ?? []).map((u) => [u.usuario_id, u]));
  const mascotaPorUsuario = new Map();
  (mascotas ?? []).forEach((m) => { if (!mascotaPorUsuario.has(m.Id_User)) mascotaPorUsuario.set(m.Id_User, m); });

  const amigos = (usuarios ?? []).map((u) => {
    const ubi = ubicacionPorUsuario.get(u.Id_User);
    /*
      Última conexión: se toma el latido de presencia (User.UltimaConexion) y,
      si esa columna todavía no existe o el usuario nunca la actualizó, se cae
      al updated_at de su ubicación — que es lo único que había antes.
      El estado "en línea" lo decide utils/tiempoRelativo.estadoPresencia con el
      mismo umbral de 5 minutos que se usaba acá.
    */
    const ultimaConexion = u.UltimaConexion ?? ubi?.updated_at ?? null;
    const online = ultimaConexion
      ? (Date.now() - new Date(ultimaConexion).getTime()) < CINCO_MIN
      : false;
    return {
      usuario_id: u.Id_User,
      nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim(),
      mascota_nombre: mascotaPorUsuario.get(u.Id_User)?.Nombre ?? null,
      distancia_km: miUbi && ubi ? haversineKm(miUbi.lat, miUbi.lng, ubi.lat, ubi.lng) : null,
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
  const { data: usuarios } = await supabase.from('User').select('*').in('Id_User', ids);
  const nombrePorId = new Map((usuarios ?? []).map((u) => [u.Id_User, `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim()]));

  return { solicitudes: data.map((s) => ({ id: s.id, nombre: nombrePorId.get(s.usuario_a_id) ?? 'Usuario' })) };
}

export async function enviarSolicitud(usuarioDestinoId) {
  const { data: existente } = await supabase
    .from('amistades')
    .select('*')
    .or(`and(usuario_a_id.eq.${getCurrentUserId()},usuario_b_id.eq.${usuarioDestinoId}),and(usuario_a_id.eq.${usuarioDestinoId},usuario_b_id.eq.${getCurrentUserId()})`)
    .maybeSingle();
  if (existente) return { ok: true };

  const { error } = await supabase
    .from('amistades')
    .insert({ usuario_a_id: getCurrentUserId(), usuario_b_id: usuarioDestinoId, estado: 'pendiente' });
  if (error) throw error;

  // La pestaña "Solicitudes" de Comunidad ya lee esto de "amistades" directo,
  // pero el panel de Notificaciones del Home lee de la tabla "Notificacion" —
  // sin este insert, la solicitud nunca aparecía ahí.
  const { data: yo } = await supabase.from('User').select('Nombre, Apellido').eq('Id_User', getCurrentUserId()).single();
  const nombreSolicitante = `${yo?.Nombre ?? ''} ${yo?.Apellido ?? ''}`.trim() || 'Alguien';
  await supabase.from('Notificacion').insert({
    Id_User: usuarioDestinoId,
    Titulo: 'Nueva solicitud de amistad',
    Mensaje: `${nombreSolicitante} te envió una solicitud de amistad`,
    Tipo: 'amistad',
    Leido: false,
  });

  return { ok: true };
}

export async function responderSolicitud(id, accion) {
  const estado = accion === 'aceptar' ? 'aceptada' : 'rechazada';
  const { error } = await supabase.from('amistades').update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

export async function buscarUsuarios(q) {
  let query = supabase.from('User').select('*').neq('Id_User', getCurrentUserId()).limit(20);
  if (q) query = query.ilike('Nombre', `%${q}%`);
  const { data: usuarios, error } = await query;
  if (error) throw error;
  if (!usuarios?.length) return { resultados: [] };

  const ids = usuarios.map((u) => u.Id_User);
  const [{ data: mascotas }, { data: amistades }] = await Promise.all([
    supabase.from('Mascota').select('*').in('Id_User', ids),
    supabase.from('amistades').select('*')
      .or(`usuario_a_id.eq.${getCurrentUserId()},usuario_b_id.eq.${getCurrentUserId()}`),
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

// ─────────────────────────────────────────────
// CARTELES
// ─────────────────────────────────────────────

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
  // A diferencia de la foto de mascota del registro (que queda solo en el
  // dispositivo), acá hace falta subirla de verdad: el cartel lo ve gente
  // que no tiene ese archivo local.
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

  const { data: usuario } = await supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single();
  const nombre = `${usuario?.Nombre ?? ''} ${usuario?.Apellido ?? ''}`.trim();

  return { cartel: mapCartel(row, nombre, null) };
}

export async function eliminarCartel(id) {
  const { error } = await supabase.from('carteles').update({ activo: false }).eq('id', id).eq('usuario_id', getCurrentUserId());
  if (error) throw error;
  return { ok: true };
}

// ─────────────────────────────────────────────
// MAPA (carteles + servicios + amigos combinados)
// ─────────────────────────────────────────────

export async function fetchMapaData(bbox) {
  let carteleQuery = supabase.from('carteles').select('*').eq('activo', true);
  carteleQuery = aplicarBbox(carteleQuery, bbox);

  const [{ data: cartelesRaw, error: errCarteles }, { servicios }, { amigos }] = await Promise.all([
    carteleQuery,
    fetchServicios(bbox),
    fetchAmigos(),
  ]);
  if (errCarteles) throw errCarteles;

  const usuarioIds = [...new Set((cartelesRaw ?? []).map((c) => c.usuario_id))];
  const { data: usuarios } = usuarioIds.length
    ? await supabase.from('User').select('*').in('Id_User', usuarioIds)
    : { data: [] };
  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.Id_User, `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim()]));

  const mascotaIds = [...new Set((cartelesRaw ?? []).map((c) => c.mascota_id).filter(Boolean))];
  const { data: mascotas } = mascotaIds.length
    ? await supabase.from('Mascota').select('*').in('Id_Mascota', mascotaIds)
    : { data: [] };
  const mascotaPorId = new Map((mascotas ?? []).map((m) => [m.Id_Mascota, m]));

  const carteles = (cartelesRaw ?? []).map((c) =>
    mapCartel(c, nombrePorUsuario.get(c.usuario_id), c.mascota_id ? mascotaPorId.get(c.mascota_id) : null));

  return { servicios, carteles, amigos };
}

// ─────────────────────────────────────────────
// UBICACIÓN
// ─────────────────────────────────────────────

export async function actualizarUbicacion(lat, lng) {
  const { error } = await supabase
    .from('ubicaciones_usuarios')
    .upsert({ usuario_id: getCurrentUserId(), lat, lng, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
  if (error) throw error;
  return { ok: true };
}
