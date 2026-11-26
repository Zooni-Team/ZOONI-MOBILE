import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { esNotificacionDePaseador } from './comun';
import { calcularEdadMeses } from '../utils/calcularEdad';
import { aplicaParaMascota } from '../utils/filtrarPorMascota';
import { calcularEdadPartes } from '../utils/calcularEdad';

export async function clearToken() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('jwt_token');
    return;
  }
  await SecureStore.deleteItemAsync('jwt_token');
}

function mapMascota(m) {
  if (!m) return null;
  const edad = calcularEdadPartes(m.FechaNacimiento);
  return {
    id: m.Id_Mascota,
    nombre: m.Nombre,
    especie: m.Especie,
    raza: m.Raza,
    fotoUrl: m.Foto ?? null,
    imagen_asset: m.ImagenAsset ?? 'perro_default',
    mostrarFoto: m.MostrarFoto ?? true,
    peso: m.Peso != null ? Number(m.Peso) : null,
    fechaNacimiento: m.FechaNacimiento,
    edadAnios: edad.anios,
    edadMeses: edad.meses,
  };
}

function mapUsuario(u) {
  if (!u) return null;
  return {
    id: u.Id_User,
    nombre: u.Nombre,
    apellido: u.Apellido,
    fotoPerfil: u.FotoPerfil ?? null,
  };
}

export async function fetchHome() {
  const [{ data: usuario, error: errUsuario }, { data: mascotas, error: errMascotas }, { data: noLeidas }] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single(),
    supabase.from('Mascota').select('*').eq('Id_User', getCurrentUserId()).order('EsActiva', { ascending: false }),
    supabase.from('Notificacion').select('Tipo, Titulo, DataExtra')
      .eq('Id_User', getCurrentUserId()).eq('Leido', false).limit(200),
  ]);
  const notificacionesNoLeidas = (noLeidas ?? []).filter((n) => !esNotificacionDePaseador(n)).length;

  if (errUsuario) throw errUsuario;
  if (errMascotas) throw errMascotas;

  const activas = (mascotas ?? []).filter((m) => (m.Estado ?? 'active') === 'active');
  const mascotaActiva = activas.find((m) => m.EsActiva) ?? activas[0] ?? null;

  return {
    usuario: mapUsuario(usuario),
    mascotaActiva: mapMascota(mascotaActiva),
    mascotas: activas.map(mapMascota),
    notificacionesNoLeidas: notificacionesNoLeidas ?? 0,
  };
}

const HOME_CONFIG_KEY = 'zooni_home_config';
const DEFAULT_HOME_CONFIG = {
  botones: [
    { seccion: 'comunidad', orden: 1, visible: true },
    { seccion: 'ficha_medica', orden: 2, visible: true },
    { seccion: 'match', orden: 3, visible: true },
  ],
};

export async function fetchHomeConfig() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(HOME_CONFIG_KEY) : null)
      : await SecureStore.getItemAsync(HOME_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HOME_CONFIG;
  } catch {
    return DEFAULT_HOME_CONFIG;
  }
}

export async function saveHomeConfig(config) {
  const raw = JSON.stringify(config);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HOME_CONFIG_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(HOME_CONFIG_KEY, raw);
}

export async function activarMascota(mascotaId) {
  await supabase.from('Mascota').update({ EsActiva: false }).eq('Id_User', getCurrentUserId());
  const { error } = await supabase
    .from('Mascota')
    .update({ EsActiva: true })
    .eq('Id_Mascota', mascotaId)
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

export async function fetchAvatares(petId) {
  const [{ data: mascota, error: errMascota }, { data: avatares, error: errAvatares }] = await Promise.all([
    supabase.from('Mascota').select('*').eq('Id_Mascota', petId).single(),
    supabase.from('avatares_catalogo').select('*').order('orden', { ascending: true }),
  ]);
  if (errMascota) throw errMascota;
  if (errAvatares) throw errAvatares;

  const especie = mascota?.Especie ?? 'perro';
  return {
    mascota: mapMascota(mascota),
    avatares: (avatares ?? [])
      .filter((a) => a.especie === especie && a.activo)
      .filter((a) => aplicaParaMascota({ razas: a.razas }, { raza: mascota?.Raza ?? null }))
      .map((a) => ({ asset_name: a.asset_name, nombre: a.nombre })),
  };
}

export async function aplicarAvatar(petId, imagenAsset) {
  const { data, error } = await supabase
    .from('Mascota')
    .update({ ImagenAsset: imagenAsset })
    .eq('Id_Mascota', petId)
    .select()
    .single();
  if (error) throw error;
  return mapMascota(data);
}

const RUTA_POR_TIPO_NOTIFICACION = { mensaje: 'Mensajes', amistad: 'Comunidad', match: 'Match' };

function mapNotificacion(n, mascotasPorId) {
  const m = n.Id_Mascota != null ? mascotasPorId?.get(n.Id_Mascota) : null;
  return {
    id: n.Id,
    titulo: n.Titulo,
    cuerpo: n.Mensaje,
    tipo: n.Tipo,
    leida: n.Leido,
    createdAt: n.Fecha,
    redirigea: RUTA_POR_TIPO_NOTIFICACION[n.Tipo] ?? null,
    dataExtra: n.DataExtra ?? null,
    mascota: m
      ? {
          id: m.Id_Mascota,
          nombre: m.Nombre,
          especie: m.Especie,
          raza: m.Raza,
          fotoUrl: m.Foto ?? null,
          imagenAsset: m.ImagenAsset ?? null,
          mostrarFoto: m.MostrarFoto ?? true,
        }
      : null,
  };
}

export async function fetchNotificaciones(page = 1, limit = 20, soloNoLeidas = false) {
  let query = supabase
    .from('Notificacion')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (soloNoLeidas) query = query.eq('Leido', false);

  const [{ data, error }, { data: mascotas }] = await Promise.all([
    query,
    supabase.from('Mascota').select('*').eq('Id_User', getCurrentUserId()),
  ]);
  if (error) throw error;

  const mascotasPorId = new Map((mascotas ?? []).map((m) => [m.Id_Mascota, m]));
  return {
    notificaciones: (data ?? []).filter((n) => !esNotificacionDePaseador(n))
      .map((n) => mapNotificacion(n, mascotasPorId)),
  };
}

export async function marcarNotificacionLeida(id) {
  const { error } = await supabase.from('Notificacion').update({ Leido: true }).eq('Id', id);
  if (error) throw error;
}

export async function marcarTodasLeidas() {
  const { error } = await supabase
    .from('Notificacion')
    .update({ Leido: true })
    .eq('Id_User', getCurrentUserId())
    .eq('Leido', false);
  if (error) throw error;
}

function mapEvento(e, organizadoresPorId, calendarioOrigenIds) {
  const organizador = organizadoresPorId?.get(e.organizador_id);
  return {
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    imagen_url: e.imagen_url,
    fecha_hora: e.fecha_hora,
    ubicacion_nombre: e.ubicacion_nombre,
    lat: e.lat != null ? Number(e.lat) : null,
    lng: e.lng != null ? Number(e.lng) : null,
    ciudad: e.ciudad,
    categoria_tag: e.categoria_tag,
    organizador_nombre: organizador?.nombre ?? null,
    organizador_es_oficial: organizador?.es_oficial ?? false,
    ya_en_calendario: calendarioOrigenIds?.has(e.id) ?? false,
  };
}

export async function fetchEventos(ciudad = null, page = 1, limit = 10) {
  let query = supabase
    .from('eventos')
    .select('*')
    .eq('activo', true)
    .gte('fecha_hora', new Date().toISOString())
    .order('fecha_hora', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (ciudad) query = query.eq('ciudad', ciudad);

  const { data: eventos, error } = await query;
  if (error) throw error;

  const organizadorIds = [...new Set((eventos ?? []).map((e) => e.organizador_id))];
  const { data: organizadores } = organizadorIds.length
    ? await supabase.from('organizadores_verificados').select('*').in('id', organizadorIds)
    : { data: [] };
  const organizadoresPorId = new Map((organizadores ?? []).map((o) => [o.id, o]));

  const { data: yaAgregados } = await supabase
    .from('eventos_calendario')
    .select('origen_evento_id')
    .not('origen_evento_id', 'is', null);
  const calendarioOrigenIds = new Set((yaAgregados ?? []).map((e) => e.origen_evento_id));

  return { eventos: (eventos ?? []).map((e) => mapEvento(e, organizadoresPorId, calendarioOrigenIds)) };
}

export async function agregarEventoAlCalendario(petId, body) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      mascota_id: petId,
      titulo: body.titulo,
      descripcion: body.descripcion ?? null,
      fecha_hora: body.fecha_hora,
      tipo: body.tipo ?? 'Evento',
      origen: 'eventos',
      origen_evento_id: body.origenEventoId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchConsejos(petId) {
  const { data: mascota, error: errMascota } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_Mascota', petId)
    .single();
  if (errMascota) throw errMascota;

  const especie = mascota?.Especie ?? 'perro';
  const { data: consejos, error: errConsejos } = await supabase
    .from('consejos_catalogo')
    .select('*')
    .eq('especie', especie)
    .eq('activo', true);
  if (errConsejos) throw errConsejos;

  const perfil = {
    edadMeses: calcularEdadMeses(mascota?.FechaNacimiento),
    pesoKg: mascota?.Peso != null ? Number(mascota.Peso) : null,
    raza: mascota?.Raza ?? null,
  };

  return {
    mascota: mapMascota(mascota),
    consejos: (consejos ?? [])
      .filter((c) => aplicaParaMascota({
        edadMinMeses: c.edad_min_meses, edadMaxMeses: c.edad_max_meses,
        pesoMinKg: c.peso_min_kg, pesoMaxKg: c.peso_max_kg, razas: c.razas,
      }, perfil))
      .map((c) => ({ id: c.id, categoria: c.categoria, contenido: c.contenido })),
  };
}
