import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { fetchIdsBloqueados } from './moderacionApi';
import { DEFAULT_FILTROS } from '../constants/match';
import { subirImagenPublica } from './imagenStorage';
import { distanciaKm } from '../utils/geo';
import { calcularEdadAnios } from '../utils/calcularEdad';
import { mapaPerfilesPorId, perfilPorId } from './perfilesPublicos';

const FILTROS_KEY = 'zooni_match_filtros';

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

const puntoDe = (u) => ({ lat: u?.Lat, lng: u?.Lng });

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
  const galeria = (fotosPorMascota?.get(mascota.Id_Mascota) ?? []).map((f) => f.url);
  const fotos = [mascota.Foto, ...galeria].filter((u, i, arr) => u && arr.indexOf(u) === i);
  return {
    usuario_id: user.Id_User,
    nombre: user.Nombre,
    nombre_usuario: user.NombreUsuario ?? null,
    genero: user.Genero ?? null,
    edad: user.Edad ?? null,
    foto_perfil_url: user.FotoPerfil ?? null,
    barrio: user.Ubicacion ?? null,
    ciudad: null,
    distancia_km: distanciaKm(puntoDe(miUsuario), puntoDe(user)),
    mascota: {
      id: mascota.Id_Mascota,
      nombre: mascota.Nombre,
      especie: mascota.Especie,
      raza: mascota.Raza,
      edad_anios: mascota.EdadAnios ?? calcularEdadAnios(mascota.FechaNacimiento),
      foto_real_url: mascota.Foto ?? null,
      fotos,
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
  if (filtros.edad_dueno_min != null || filtros.edad_dueno_max != null) {
    result = result.filter((p) => {
      if (p.edad == null) return true;
      if (filtros.edad_dueno_min != null && p.edad < filtros.edad_dueno_min) return false;
      if (filtros.edad_dueno_max != null && filtros.edad_dueno_max < 65 && p.edad > filtros.edad_dueno_max) return false;
      return true;
    });
  }
  if (filtros.genero_dueno?.length && !filtros.genero_dueno.includes('todos')) {
    result = result.filter((p) => p.genero != null && filtros.genero_dueno.includes(p.genero));
  }
  return result;
}

async function obtenerCandidatos() {
  const miMascota = await miMascotaActiva();

  const [{ data: miUsuario }, { data: candidatos, error }, { data: votos }, { data: matches }] = await Promise.all([
    supabase.from('User').select('Lat, Lng').eq('Id_User', getCurrentUserId()).single(),
    supabase.from('mascota_publica').select('*')
      .neq('Id_User', getCurrentUserId())
      .eq('VisibleEnMatch', true),
    miMascota
      ? supabase.from('Voto').select('idMascotaDestino').eq('idMascotaOrigen', miMascota.Id_Mascota)
      : Promise.resolve({ data: [] }),
    miMascota
      ? supabase.from('Match').select('idMascotaUno,idMascotaDos')
          .or(`idMascotaUno.eq.${Number(miMascota.Id_Mascota)},idMascotaDos.eq.${Number(miMascota.Id_Mascota)}`)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  const duenos = await mapaPerfilesPorId((candidatos ?? []).map((m) => m.Id_User),
    'Id_User, Nombre, NombreUsuario, Genero, Edad, FotoPerfil, Ubicacion, Lat, Lng, Intereses');
  (candidatos ?? []).forEach((m) => { m.User = duenos.get(m.Id_User) ?? null; });

  const vistoIds = new Set([
    ...(votos ?? []).map((v) => v.idMascotaDestino),
    ...(matches ?? []).flatMap((m) => [m.idMascotaUno, m.idMascotaDos]),
  ]);

  const bloqueados = await fetchIdsBloqueados().catch(() => new Set());

  const visibles = (candidatos ?? []).filter((m) =>
    m.User
    && !vistoIds.has(m.Id_Mascota)
    && !bloqueados.has(m.Id_User)
    && !!m.Foto
    && m.VisibleEnMatch !== false);

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

export async function fetchMisMascotasMatch() {
  const { data, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .order('Id_Mascota', { ascending: true });
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
      perfilCreado: m.PerfilMatchCreado !== undefined ? !!m.PerfilMatchCreado : true,
      descripcion: m.Descripcion ?? null,
    }));
}

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
    perfilPorId(otroUserId, 'Id_User, Nombre, Apellido, NombreUsuario, Edad, Genero, FotoPerfil, Ubicacion, Lat, Lng, Intereses')
      .then((data) => ({ data })),
    otraMascotaId
      ? supabase.from('mascota_publica').select('*').eq('Id_Mascota', otraMascotaId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    matchId,
    fechaMatch: match.fecha ?? null,
    persona: {
      id: otro.Id_User,
      nombre: `${otro.Nombre ?? ''} ${otro.Apellido ?? ''}`.trim() || 'Usuario',
      nombreUsuario: otro.NombreUsuario ?? null,
      edad: otro.Edad ?? null,
      genero: otro.Genero ?? null,
      fotoPerfil: otro.FotoPerfil ?? null,
      ubicacion: otro.Ubicacion ?? null,
      distanciaKm: distanciaKm(puntoDe(yo), puntoDe(otro)),
      intereses: otro.Intereses ?? [],
    },
    mascota: mascota
      ? {
          id: mascota.Id_Mascota,
          nombre: mascota.Nombre,
          especie: mascota.Especie,
          raza: mascota.Raza,
          edad: mascota.EdadAnios ?? null,
          sexo: mascota.Sexo ?? null,
          descripcion: mascota.Descripcion ?? null,
          fotoUrl: mascota.Foto ?? null,
          imagenAsset: mascota.ImagenAsset ?? null,
        }
      : null,
  };
}

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

export async function fetchMiTarjetaMatch() {
  const [{ data: user, error }, mascota] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', getCurrentUserId()).single(),
    miMascotaActiva(),
  ]);
  if (error) throw error;
  if (!user || !mascota) return null;

  const { data: fotos } = await supabase
    .from('mascota_fotos').select('*').eq('id_mascota', mascota.Id_Mascota)
    .order('orden', { ascending: true });

  const fotosPorMascota = new Map([[mascota.Id_Mascota, fotos ?? []]]);
  return mapPerfil({ ...mascota, User: user }, user, fotosPorMascota);
}

export function perfilMatchCompleto(perfil) {
  return Boolean(
    perfil?.fechaNacimiento
    && perfil?.genero
    && perfil?.intereses?.length > 0
    && perfil?.fotoPerfilUrl,
  );
}

export async function guardarPerfilMatch({ fechaNacimiento, genero, intereses, fotoUri }) {
  const patch = { FechaNacimiento: fechaNacimiento, Genero: genero, Intereses: intereses };
  if (fotoUri) patch.FotoPerfil = await subirImagenPublica(fotoUri, 'perfiles');

  const { error } = await supabase.from('User').update(patch).eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

export async function actualizarMiUbicacionMatch(lat, lng) {
  const { error } = await supabase.from('User').update({ Lat: lat, Lng: lng }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

export async function fetchMatchPerfiles() {
  const [candidatos, filtros] = await Promise.all([obtenerCandidatos(), leerFiltrosGuardados()]);
  return { perfiles: aplicarFiltros(candidatos, filtros), cursor_siguiente: null, hay_mas: false };
}

async function votar(mascotaDestinoId, leGusta) {
  const miMascota = await miMascotaActiva();
  if (!miMascota) return { match: false };
  const { data, error } = await supabase.rpc('votar_mascota', {
    p_origen: miMascota.Id_Mascota, p_destino: mascotaDestinoId, p_le_gusta: leGusta,
  });
  if (error) throw error;
  return data ?? { match: false };
}

export function postMatchLike(mascotaDestinoId) {
  return votar(mascotaDestinoId, true);
}

export async function postMatchSkip(mascotaDestinoId) {
  await votar(mascotaDestinoId, false);
}

export async function chatDeMatchPorMascota(idMascotaParam) {
  const idMascota = Number(idMascotaParam);
  const { data: match } = await supabase
    .from('Match')
    .select('*')
    .or(`idMascotaUno.eq.${idMascota},idMascotaDos.eq.${idMascota}`)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!match) return null;

  const otroUsuario = match.idMascotaUno === idMascota ? match.idUsuarioDos : match.idUsuarioUno;
  const otro = await perfilPorId(otroUsuario, 'Id_User, Nombre, FotoPerfil');

  return {
    chatId: match.id,
    nombre: otro?.Nombre ?? 'Usuario',
    fotoPerfilUrl: otro?.FotoPerfil ?? null,
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
