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
import { fetchIdsBloqueados } from './moderacionApi';
import { DEFAULT_FILTROS } from '../data/matchDemo';
import { subirImagenPublica } from '../utils/imagenStorage';

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

function mapPerfil(mascota, miUsuario, fotosPorMascota) {
  const user = mascota.User;
  // Portada (Mascota.Foto) + galería (mascota_fotos), sin duplicar
  const galeria = (fotosPorMascota?.get(mascota.Id_Mascota) ?? []).map((f) => f.url);
  const fotos = [mascota.Foto, ...galeria].filter((u, i, arr) => u && arr.indexOf(u) === i);
  return {
    usuario_id: user.Id_User,
    nombre: user.Nombre,
    nombre_usuario: user.NombreUsuario ?? null,
    genero: user.Genero ?? null,
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
      // Todas las fotos (portada + galería) para el carrusel de la tarjeta
      fotos,
      // Antes venía hardcodeado en null: el avatarcito de Match nunca
      // reflejaba el look aplicado en Closet. Se resuelve con el mismo
      // ImagenAsset que usan Home y Ficha Médica.
      imagen_asset: mascota.ImagenAsset ?? null,
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
  // Edad del dueño (max 65 = "65+", no pone techo)
  if (filtros.edad_dueno_min != null || filtros.edad_dueno_max != null) {
    result = result.filter((p) => {
      if (p.edad == null) return true;
      if (filtros.edad_dueno_min != null && p.edad < filtros.edad_dueno_min) return false;
      if (filtros.edad_dueno_max != null && filtros.edad_dueno_max < 65 && p.edad > filtros.edad_dueno_max) return false;
      return true;
    });
  }
  // Género del dueño ('todos' = sin filtro)
  if (filtros.genero_dueno?.length && !filtros.genero_dueno.includes('todos')) {
    result = result.filter((p) => p.genero != null && filtros.genero_dueno.includes(p.genero));
  }
  return result;
}

/** Candidatos crudos (sin filtros de búsqueda) ya excluyendo vistos/matcheados. */
async function obtenerCandidatos() {
  const miMascota = await miMascotaActiva();

  const [{ data: miUsuario }, { data: candidatos, error }, { data: votos }, { data: matches }] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single(),
    // Nunca mascotas propias, ni archivadas/en memoria/eliminadas,
    // ni las que su dueño sacó del pool de Match
    supabase.from('Mascota').select('*, User(*)')
      .neq('Id_User', getCurrentUserId())
      .eq('Estado', 'active')
      .eq('VisibleEnMatch', true),
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

  // Usuarios que bloqueé: sus mascotas no aparecen
  const bloqueados = await fetchIdsBloqueados().catch(() => new Set());

  const visibles = (candidatos ?? []).filter((m) =>
    m.User
    && !vistoIds.has(m.Id_Mascota)
    && !bloqueados.has(m.Id_User)
    // Foto real OBLIGATORIA: sin foto no aparece en Match (nunca se muestra la
    // ilustración grande). Las mascotas viejas sin foto quedan fuera hasta que
    // su dueño suba una.
    && !!m.Foto
    // Solo mascotas activas y visibles en Match (las archivadas/eliminadas
    // del ciclo de vida y las que apagaron la visibilidad no aparecen)
    && (m.Estado ?? 'active') === 'active'
    && m.VisibleEnMatch !== false);

  // Galería de fotos de todas las mascotas visibles, en una sola consulta
  const ids = visibles.map((m) => m.Id_Mascota);
  const fotosPorMascota = new Map();
  if (ids.length) {
    const { data: fotos } = await supabase
      .from('mascota_fotos').select('*').in('id_mascota', ids)
      .order('orden', { ascending: true });
    for (const f of fotos ?? []) {
      if (!fotosPorMascota.has(f.id_mascota)) fotosPorMascota.set(f.id_mascota, []);
      fotosPorMascota.get(f.id_mascota).push(f);
    }
  }

  return visibles.map((m) => mapPerfil(m, miUsuario, fotosPorMascota));
}

// ─────────────────────────────────────────────
// PERFIL DE MATCH POR MASCOTA (migración 023)
// ─────────────────────────────────────────────
// Con varias mascotas activas, cada una tiene su propio perfil de Match.
// La pantalla detecta cuáles no lo tienen y ofrece crearlo.

/** Mascotas activas del usuario con el estado de su perfil de Match. */
export async function fetchMisMascotasMatch() {
  const { data, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return (data ?? [])
    .filter((m) => (m.Estado ?? 'active') === 'active')
    .map((m) => ({
      id: m.Id_Mascota,
      nombre: m.Nombre,
      especie: m.Especie,
      raza: m.Raza,
      imagenAsset: m.ImagenAsset ?? null,
      fotoUrl: m.Foto ?? null,
      esActiva: !!m.EsActiva,
      // Sin la migración 023 la columna no existe → se asume creado para
      // no molestar con prompts que no se pueden guardar
      perfilCreado: m.PerfilMatchCreado !== undefined ? !!m.PerfilMatchCreado : true,
      descripcion: m.Descripcion ?? null,
    }));
}

/** Crea/actualiza el perfil de Match de una mascota del usuario. */
export async function crearPerfilMatchMascota(mascotaId, { descripcion, visibleEnMatch = true } = {}) {
  const patch = { PerfilMatchCreado: true, VisibleEnMatch: visibleEnMatch };
  if (descripcion !== undefined) patch.Descripcion = descripcion || null;
  const { error } = await supabase
    .from('Mascota')
    .update(patch)
    .eq('Id_Mascota', mascotaId)
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

// ─────────────────────────────────────────────
// DETALLE DE UN MATCH (para la ficha de perfil desde el chat)
// ─────────────────────────────────────────────

/**
 * Info completa de la OTRA persona de un match: su perfil, su mascota (la del
 * match), intereses y desde cuándo son match. La usa la ficha tipo
 * Instagram/WhatsApp que se abre al tocar la foto/nombre en el chat o la lista.
 */
export async function fetchDetalleMatch(matchId) {
  const miId = getCurrentUserId();

  const { data: match, error } = await supabase
    .from('Match').select('*').eq('id', matchId).single();
  if (error || !match) throw error ?? new Error('match_inexistente');

  const soyUno = match.idUsuarioUno === miId;
  const otroUserId = soyUno ? match.idUsuarioDos : match.idUsuarioUno;
  const otraMascotaId = soyUno ? match.idMascotaDos : match.idMascotaUno;

  const [{ data: yo }, { data: otro }, { data: mascota }] = await Promise.all([
    supabase.from('User').select('Lat, Lng').eq('Id_User', miId).maybeSingle(),
    supabase.from('User').select('*').eq('Id_User', otroUserId).single(),
    otraMascotaId
      ? supabase.from('Mascota').select('*').eq('Id_Mascota', otraMascotaId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    matchId,
    fechaMatch: match.fecha ?? null,
    persona: {
      id: otro.Id_User,
      nombre: `${otro.Nombre ?? ''} ${otro.Apellido ?? ''}`.trim() || 'Usuario',
      nombreUsuario: otro.NombreUsuario ?? null,
      edad: edadDesde(otro.FechaNacimiento),
      genero: otro.Genero ?? null,
      fotoPerfil: otro.FotoPerfil ?? null,
      ubicacion: otro.Ubicacion ?? null,
      distanciaKm: haversineKm(yo?.Lat, yo?.Lng, otro.Lat, otro.Lng),
      intereses: otro.Intereses ?? [],
    },
    mascota: mascota
      ? {
          id: mascota.Id_Mascota,
          nombre: mascota.Nombre,
          especie: mascota.Especie,
          raza: mascota.Raza,
          edad: edadDesde(mascota.FechaNacimiento),
          sexo: mascota.Sexo ?? null,
          descripcion: mascota.Descripcion ?? null,
          fotoUrl: mascota.Foto ?? null,
          imagenAsset: mascota.ImagenAsset ?? null,
        }
      : null,
  };
}

// ─────────────────────────────────────────────
// PERFIL DE MATCH DEL USUARIO
// ─────────────────────────────────────────────
// El registro solo pide los datos de la mascota + login; para aparecer en el
// swipe de Match hace falta además: foto de perfil (del dueño, no de la
// mascota), fecha de nacimiento, género e intereses. Mientras falte algo de
// esto, MatchScreen muestra el formulario de MatchProfileSetup en vez del
// swipe.

/** Trae los datos de Match del usuario actual (no vienen en fetchHome). */
export async function fetchMiPerfilMatch() {
  const { data, error } = await supabase
    .from('User')
    .select('FechaNacimiento, Genero, Intereses, FotoPerfil')
    .eq('Id_User', getCurrentUserId())
    .single();
  if (error) throw error;
  return {
    fechaNacimiento: data.FechaNacimiento,
    genero: data.Genero,
    intereses: data.Intereses ?? [],
    fotoPerfilUrl: data.FotoPerfil,
  };
}

/** true si el usuario ya cargó todo lo que necesita su perfil de Match. */
export function perfilMatchCompleto(perfil) {
  return Boolean(
    perfil?.fechaNacimiento
    && perfil?.genero
    && perfil?.intereses?.length > 0
    && perfil?.fotoPerfilUrl,
  );
}

/**
 * Guarda el perfil de Match del usuario actual.
 * `fotoUri` es opcional: si no viene, se mantiene la foto ya guardada.
 */
export async function guardarPerfilMatch({ fechaNacimiento, genero, intereses, fotoUri }) {
  const patch = { FechaNacimiento: fechaNacimiento, Genero: genero, Intereses: intereses };
  if (fotoUri) patch.FotoPerfil = await subirImagenPublica(fotoUri, 'perfiles');

  const { error } = await supabase.from('User').update(patch).eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

/**
 * Guarda la ubicación del usuario (User.Lat/Lng) para poder calcular
 * distancia_km contra otros perfiles. El registro no la pide, así que sin
 * esto ningún usuario nuevo tiene ubicación — MatchScreen llama a esto con
 * la geolocalización del navegador/dispositivo apenas se abre Match.
 */
export async function actualizarMiUbicacionMatch(lat, lng) {
  const { error } = await supabase.from('User').update({ Lat: lat, Lng: lng }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
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

  // Notificación para los DOS usuarios, cada una ligada a SU mascota
  // (si el match fue con el perfil de tu perro, la campana dice tu perro,
  // aunque estés parado en el perfil de tu gato). DataExtra guarda el chat
  // del match para que el toque abra la conversación directa. Best-effort.
  try {
    const { data: miUsuario } = await supabase
      .from('User').select('"Nombre","FotoPerfil"')
      .eq('Id_User', getCurrentUserId()).single();

    await supabase.from('Notificacion').insert([
      {
        Id_User: getCurrentUserId(),
        Id_Mascota: miMascota.Id_Mascota,
        Titulo: '¡Nuevo match!',
        Mensaje: `${miMascota.Nombre} hizo match con ${mascotaDestino.Nombre}`,
        Tipo: 'match',
        Leido: false,
        Fecha: new Date().toISOString(),
        DataExtra: {
          chatId: matchCreado.id,
          nombre: mascotaDestino.User?.Nombre ?? 'Usuario',
          fotoPerfilUrl: mascotaDestino.User?.FotoPerfil ?? null,
        },
      },
      {
        Id_User: mascotaDestino.Id_User,
        Id_Mascota: mascotaDestino.Id_Mascota,
        Titulo: '¡Nuevo match!',
        Mensaje: `${mascotaDestino.Nombre} hizo match con ${miMascota.Nombre}`,
        Tipo: 'match',
        Leido: false,
        Fecha: new Date().toISOString(),
        DataExtra: {
          chatId: matchCreado.id,
          nombre: miUsuario?.Nombre ?? 'Usuario',
          fotoPerfilUrl: miUsuario?.FotoPerfil ?? null,
        },
      },
    ]);
  } catch { /* la notificación nunca bloquea el match */ }

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

/**
 * Resuelve el chat del match más reciente de una mascota propia.
 * Lo usa el panel de notificaciones para las notificaciones de match que no
 * tienen DataExtra (creadas antes de la migración 024, o si falló el insert).
 * Devuelve { chatId, nombre, fotoPerfilUrl } o null.
 */
export async function chatDeMatchPorMascota(idMascota) {
  const { data: match } = await supabase
    .from('Match')
    .select('*')
    .or(`idMascotaUno.eq.${idMascota},idMascotaDos.eq.${idMascota}`)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!match) return null;

  const otraMascotaId = match.idMascotaUno === idMascota ? match.idMascotaDos : match.idMascotaUno;
  const { data: otra } = await supabase
    .from('Mascota')
    .select('*, User(*)')
    .eq('Id_Mascota', otraMascotaId)
    .single();

  return {
    chatId: match.id,
    nombre: otra?.User?.Nombre ?? 'Usuario',
    fotoPerfilUrl: otra?.User?.FotoPerfil ?? null,
  };
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
