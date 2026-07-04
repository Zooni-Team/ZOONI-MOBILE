/**
 * matchApi.js — Módulo Match sobre Supabase
 *
 * El "swipe" es mascota-contra-mascota: la tabla Voto guarda
 * idMascotaOrigen/idMascotaDestino, y Match se crea cuando ambas mascotas
 * se dieron like. "Mi mascota" para votar es la mascota activa
 * (Mascota.EsActiva) del usuario actual (getCurrentUserId()).
 *
 * Los filtros de búsqueda (distancia, especie, edad, intereses) no son un
 * dato de negocio compartido entre dispositivos todavía, así que se
 * guardan localmente (mismo patrón que fetchHomeConfig en services/api.js).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { DEFAULT_FILTROS } from '../data/matchDemo';

const FILTROS_KEY = 'zooni_match_filtros';

// ─────────────────────────────────────────────
// FILTROS (persistencia local por dispositivo)
// ─────────────────────────────────────────────

async function leerFiltrosGuardados() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(FILTROS_KEY) : null)
      : await SecureStore.getItemAsync(FILTROS_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_FILTROS };
  } catch {
    return { ...DEFAULT_FILTROS };
  }
}

async function guardarFiltrosStorage(filtros) {
  const raw = JSON.stringify(filtros);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(FILTROS_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(FILTROS_KEY, raw);
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

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

function edadDesde(fecha) {
  if (!fecha) return null;
  const n = new Date(fecha);
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a -= 1;
  return a;
}

async function miMascotaActiva() {
  const { data, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .eq('EsActiva', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function mapPerfil(mascota, miUsuario) {
  const user = mascota.User;
  return {
    usuario_id: user.Id_User,
    nombre: user.Nombre,
    edad: edadDesde(user.FechaNacimiento),
    foto_perfil_url: user.FotoPerfil ?? null,
    barrio: user.Ubicacion ?? null,
    ciudad: user.Ubicacion ?? null,
    distancia_km: haversineKm(miUsuario?.Lat, miUsuario?.Lng, user.Lat, user.Lng),
    mascota: {
      id: mascota.Id_Mascota,
      nombre: mascota.Nombre,
      especie: mascota.Especie,
      raza: mascota.Raza,
      edad_anios: edadDesde(mascota.FechaNacimiento),
      foto_real_url: mascota.Foto ?? null,
      avatar_url: null,
    },
    intereses: user.Intereses ?? [],
  };
}

function aplicarFiltros(lista, filtros) {
  let result = [...lista];
  if (filtros.tipos_mascota?.length && !filtros.tipos_mascota.includes('cualquiera')) {
    result = result.filter((p) => filtros.tipos_mascota.includes(p.mascota.especie));
  }
  if (filtros.intereses?.length) {
    result = result.filter((p) => p.intereses.some((i) => filtros.intereses.includes(i)));
  }
  if (filtros.distancia_max_km) {
    result = result.filter((p) => p.distancia_km == null || p.distancia_km <= filtros.distancia_max_km);
  }
  if (filtros.solo_cercanos) {
    result = result.filter((p) => p.distancia_km != null && p.distancia_km < 5);
  }
  if (filtros.edad_mascota_min_meses != null || filtros.edad_mascota_max_meses != null) {
    result = result.filter((p) => {
      const meses = p.mascota.edad_anios != null ? p.mascota.edad_anios * 12 : null;
      if (meses == null) return true;
      if (filtros.edad_mascota_min_meses != null && meses < filtros.edad_mascota_min_meses) return false;
      if (filtros.edad_mascota_max_meses != null && meses > filtros.edad_mascota_max_meses) return false;
      return true;
    });
  }
  return result;
}

/** Candidatos crudos (sin filtros de búsqueda) ya excluyendo vistos/matcheados. */
async function obtenerCandidatos() {
  const miMascota = await miMascotaActiva();

  const [{ data: miUsuario }, { data: candidatos, error }, { data: votos }, { data: matches }] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single(),
    supabase.from('Mascota').select('*, User(*)').neq('Id_User', getCurrentUserId()),
    miMascota
      ? supabase.from('Voto').select('idMascotaDestino').eq('idMascotaOrigen', miMascota.Id_Mascota)
      : Promise.resolve({ data: [] }),
    miMascota
      ? supabase.from('Match').select('idMascotaUno,idMascotaDos')
          .or(`idMascotaUno.eq.${miMascota.Id_Mascota},idMascotaDos.eq.${miMascota.Id_Mascota}`)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  const vistoIds = new Set([
    ...(votos ?? []).map((v) => v.idMascotaDestino),
    ...(matches ?? []).flatMap((m) => [m.idMascotaUno, m.idMascotaDos]),
  ]);

  return (candidatos ?? [])
    .filter((m) => m.User && !vistoIds.has(m.Id_Mascota))
    .map((m) => mapPerfil(m, miUsuario));
}

// ─────────────────────────────────────────────
// API PÚBLICA (mismos nombres que usan las pantallas)
// ─────────────────────────────────────────────

export async function fetchMatchPerfiles() {
  const [candidatos, filtros] = await Promise.all([obtenerCandidatos(), leerFiltrosGuardados()]);
  return { perfiles: aplicarFiltros(candidatos, filtros), cursor_siguiente: null, hay_mas: false };
}

/** Da like a la mascota `mascotaDestinoId`. Si hay like recíproco, crea el Match. */
export async function postMatchLike(mascotaDestinoId) {
  const miMascota = await miMascotaActiva();
  if (!miMascota) return { match: false };

  await supabase.from('Voto').insert({
    idMascotaOrigen: miMascota.Id_Mascota,
    idMascotaDestino: mascotaDestinoId,
    leGusta: true,
  });

  const { data: votoReciproco } = await supabase
    .from('Voto')
    .select('*')
    .eq('idMascotaOrigen', mascotaDestinoId)
    .eq('idMascotaDestino', miMascota.Id_Mascota)
    .eq('leGusta', true)
    .maybeSingle();

  if (!votoReciproco) return { match: false };

  const { data: mascotaDestino } = await supabase
    .from('Mascota')
    .select('*, User(*)')
    .eq('Id_Mascota', mascotaDestinoId)
    .single();

  const { data: matchCreado, error } = await supabase
    .from('Match')
    .insert({
      idMascotaUno: miMascota.Id_Mascota,
      idMascotaDos: mascotaDestinoId,
      idUsuarioUno: getCurrentUserId(),
      idUsuarioDos: mascotaDestino.Id_User,
    })
    .select()
    .single();
  if (error) throw error;

  return {
    match: true,
    match_id: matchCreado.id,
    chat_id: matchCreado.id,
    usuario_match: {
      nombre: mascotaDestino.User?.Nombre ?? 'Usuario',
      foto_perfil_url: mascotaDestino.User?.FotoPerfil ?? null,
    },
  };
}

/** Descarta la mascota `mascotaDestinoId` (no vuelve a aparecer en el swipe). */
export async function postMatchSkip(mascotaDestinoId) {
  const miMascota = await miMascotaActiva();
  if (!miMascota) return;
  await supabase.from('Voto').insert({
    idMascotaOrigen: miMascota.Id_Mascota,
    idMascotaDestino: mascotaDestinoId,
    leGusta: false,
  });
}

export async function fetchMatchFiltros() {
  return leerFiltrosGuardados();
}

export async function putMatchFiltros(filtros) {
  await guardarFiltrosStorage(filtros);
  return { mensaje: 'Filtros actualizados correctamente' };
}

export async function previewMatchFiltros(filtros) {
  const candidatos = await obtenerCandidatos();
  return { cantidad: aplicarFiltros(candidatos, filtros).length };
}

/**
 * Reinicia el historial de likes/skips de mi mascota activa (útil tras
 * cambiar filtros, para que reaparezcan perfiles ya descartados). Esto borra
 * decisiones reales en Voto — solo tiene sentido mientras se prueba la app.
 */
export async function resetDemoMatchState() {
  const miMascota = await miMascotaActiva();
  if (!miMascota) return;
  await supabase.from('Voto').delete().eq('idMascotaOrigen', miMascota.Id_Mascota);
}
