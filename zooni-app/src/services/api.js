/**
 * api.js — Capa de acceso a datos de Zooni sobre Supabase
 *
 * Reemplaza al backend Express que nunca llegó a desplegarse (BASE_URL
 * apuntaba a localhost:5165, que no existe). Ahora todas estas funciones
 * consultan directo la base Postgres de Supabase con el cliente de
 * src/lib/supabase.js.
 *
 * Todavía no hay login: getCurrentUserId() (src/config/session.js) hace de
 * "usuario logueado" fijo. Cuando se implemente Supabase Auth, reemplazar
 * ese import por la sesión real — las funciones de acá no deberían necesitar
 * cambios más allá de eso.
 *
 * Funciones exportadas:
 *   Token:         getStoredToken, saveToken, clearToken (compat con HamburgerDrawer)
 *   Home:          fetchHome, fetchHomeConfig, saveHomeConfig
 *   Mascotas:      activarMascota
 *   Avatares:      fetchAvatares, aplicarAvatar
 *   Notificaciones: fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas
 *   Eventos:       fetchEventos, agregarEventoAlCalendario
 *   Consejos:      fetchConsejos
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { calcularEdad, calcularEdadMeses } from '../utils/calcularEdad';
import { aplicaParaMascota } from '../utils/filtrarPorMascota';

// ─────────────────────────────────────────────
// TOKEN JWT — se mantiene solo para no romper HamburgerDrawer/pantallas
// que todavía llaman clearToken() al hacer "logout". No hay backend propio
// emitiendo JWT: esto queda vacío hasta que se implemente Supabase Auth.
// ─────────────────────────────────────────────

export async function getStoredToken() {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  }
  return SecureStore.getItemAsync('jwt_token');
}

export async function saveToken(token) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem('jwt_token', token);
    return;
  }
  await SecureStore.setItemAsync('jwt_token', token);
}

export async function clearToken() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('jwt_token');
    return;
  }
  await SecureStore.deleteItemAsync('jwt_token');
}

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

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
    peso: m.Peso != null ? Number(m.Peso) : null,
    fechaNacimiento: m.FechaNacimiento,
    edadAnios: edad.anios,
    edadMeses: edad.meses,
  };
}

function calcularEdadPartes(fechaNacimiento) {
  if (!fechaNacimiento) return { anios: null, meses: null };
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  if (meses < 0) { anios -= 1; meses += 12; }
  if (hoy.getDate() < nacimiento.getDate()) {
    meses -= 1;
    if (meses < 0) { anios -= 1; meses += 12; }
  }
  return { anios, meses };
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

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────

/**
 * Trae en una sola llamada: usuario, mascota activa y badge de notificaciones.
 */
export async function fetchHome() {
  const [{ data: usuario, error: errUsuario }, { data: mascotas, error: errMascotas }, { count: notificacionesNoLeidas }] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single(),
    supabase.from('Mascota').select('*').eq('Id_User', getCurrentUserId()).order('EsActiva', { ascending: false }),
    supabase.from('Notificacion').select('*', { count: 'exact', head: true }).eq('Id_User', getCurrentUserId()).eq('Leido', false),
  ]);

  if (errUsuario) throw errUsuario;
  if (errMascotas) throw errMascotas;

  const mascotaActiva = mascotas?.find((m) => m.EsActiva) ?? mascotas?.[0] ?? null;

  return {
    usuario: mapUsuario(usuario),
    mascotaActiva: mapMascota(mascotaActiva),
    notificacionesNoLeidas: notificacionesNoLeidas ?? 0,
  };
}

/**
 * Configuración de botones personalizados del usuario. Todavía no hay una
 * tabla para esto (es config de UI, no dato de negocio) — se guarda en
 * SecureStore/localStorage por dispositivo hasta que se necesite sincronizar
 * entre dispositivos.
 */
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

// ─────────────────────────────────────────────
// MASCOTAS
// ─────────────────────────────────────────────

/** Marca `mascotaId` como la mascota activa del usuario (y desmarca las demás). */
export async function activarMascota(mascotaId) {
  await supabase.from('Mascota').update({ EsActiva: false }).eq('Id_User', getCurrentUserId());
  const { error } = await supabase.from('Mascota').update({ EsActiva: true }).eq('Id_Mascota', mascotaId);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// CLOSET DE AVATARES
// ─────────────────────────────────────────────

/** Trae la mascota y el catálogo de avatares disponibles para su especie. */
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
      .map((a) => ({ assetName: a.asset_name, nombre: a.nombre })),
  };
}

/** Actualiza el avatar (imagen ilustrada) de la mascota. */
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

// ─────────────────────────────────────────────
// NOTIFICACIONES
// ─────────────────────────────────────────────

const RUTA_POR_TIPO_NOTIFICACION = { mensaje: 'Mensajes', amistad: 'Comunidad' };

function mapNotificacion(n) {
  return {
    id: n.Id,
    titulo: n.Titulo,
    cuerpo: n.Mensaje,
    tipo: n.Tipo,
    leida: n.Leido,
    createdAt: n.Fecha,
    redirigea: RUTA_POR_TIPO_NOTIFICACION[n.Tipo] ?? null,
  };
}

/** Trae la lista paginada de notificaciones del usuario. */
export async function fetchNotificaciones(page = 1, limit = 20, soloNoLeidas = false) {
  let query = supabase
    .from('Notificacion')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (soloNoLeidas) query = query.eq('Leido', false);

  const { data, error } = await query;
  if (error) throw error;
  return { notificaciones: (data ?? []).map(mapNotificacion) };
}

/** Marca una notificación individual como leída. */
export async function marcarNotificacionLeida(id) {
  const { error } = await supabase.from('Notificacion').update({ Leido: true }).eq('Id', id);
  if (error) throw error;
}

/** Marca todas las notificaciones del usuario como leídas. */
export async function marcarTodasLeidas() {
  const { error } = await supabase
    .from('Notificacion')
    .update({ Leido: true })
    .eq('Id_User', getCurrentUserId())
    .eq('Leido', false);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// EVENTOS PÚBLICOS
// ─────────────────────────────────────────────

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

/**
 * Trae los eventos activos y vigentes filtrados por ciudad.
 * @param {string|null} ciudad
 * @param {number} page
 * @param {number} limit
 */
export async function fetchEventos(ciudad = null, page = 1, limit = 10) {
  let query = supabase
    .from('eventos')
    .select('*')
    .eq('activo', true)
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

/**
 * Agrega un evento al calendario de cuidados de una mascota (usado por
 * EventosScreen para eventos externos, tipo "Evento").
 * @param {number} petId
 * @param {object} body - { titulo, descripcion, fecha_hora, tipo, origenEventoId }
 */
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

// ─────────────────────────────────────────────
// CONSEJOS
// ─────────────────────────────────────────────

/** Trae la mascota y los consejos del catálogo filtrados por su especie. */
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
