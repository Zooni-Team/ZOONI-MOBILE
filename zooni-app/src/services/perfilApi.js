/**
 * perfilApi.js — Perfil del usuario logueado sobre Supabase
 *
 * PerfilScreen.jsx corría contra un backend Express que nunca se desplegó
 * (localhost:5165), así que cada request fallaba y siempre caía en datos de
 * demo (Sofía). Este módulo reemplaza esas llamadas por consultas directas a
 * Supabase, igual que el resto de la app.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { subirImagenPublica } from '../utils/imagenStorage';

function mapUsuarioPerfil(u) {
  if (!u) return null;
  return {
    id: u.Id_User,
    nombre: u.Nombre,
    apellido: u.Apellido,
    nombreUsuario: u.NombreUsuario ?? null,
    bio: u.Bio ?? null,
    ubicacion: u.Ubicacion ?? null,
    fotoPerfil: u.FotoPerfil ?? null,
  };
}

function mapMascotaMini(m) {
  if (!m) return null;
  return { id: m.Id_Mascota, nombre: m.Nombre, raza: m.Raza };
}

function mapPublicacion(p) {
  return {
    id: p.Id_Publicacion,
    imagenUrl: p.ImagenUrl,
    descripcion: p.Descripcion,
    fecha: p.Fecha,
  };
}

/** Trae el perfil del usuario logueado: datos, mascota activa y stats reales. */
export async function fetchMiPerfil() {
  const userId = getCurrentUserId();
  const [
    { data: usuario, error: errUsuario },
    { data: mascotas },
    { count: totalPublicaciones },
    { data: amistades },
  ] = await Promise.all([
    supabase.from('User').select('*').eq('Id_User', userId).single(),
    supabase.from('Mascota').select('*').eq('Id_User', userId).order('EsActiva', { ascending: false }),
    supabase.from('Publicacion').select('*', { count: 'exact', head: true }).eq('Id_User', userId),
    supabase.from('amistades').select('*').or(`usuario_a_id.eq.${userId},usuario_b_id.eq.${userId}`).eq('estado', 'aceptada'),
  ]);
  if (errUsuario) throw errUsuario;

  const mascotaActiva = mascotas?.find((m) => m.EsActiva) ?? mascotas?.[0] ?? null;

  return {
    usuario: mapUsuarioPerfil(usuario),
    mascotaActiva: mapMascotaMini(mascotaActiva),
    totalPublicaciones: totalPublicaciones ?? 0,
    // No existe un sistema de "seguir" direccional — "amistades" es mutua,
    // así que seguidores/siguiendo muestran el mismo conteo real de amigos.
    totalAmigos: amistades?.length ?? 0,
  };
}

/** Trae las publicaciones del usuario logueado, más nuevas primero. */
export async function fetchMisPublicaciones() {
  const { data, error } = await supabase
    .from('Publicacion')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPublicacion);
}

/** Actualiza los datos editables del perfil. Valida que el @usuario no esté tomado. */
export async function actualizarMiPerfil({ nombre, apellido, nombreUsuario, bio, ubicacion }) {
  const userId = getCurrentUserId();

  if (nombreUsuario) {
    const { data: existente } = await supabase
      .from('User')
      .select('Id_User')
      .eq('NombreUsuario', nombreUsuario)
      .neq('Id_User', userId)
      .maybeSingle();
    if (existente) throw new Error('USERNAME_TAKEN');
  }

  const { data, error } = await supabase
    .from('User')
    .update({
      Nombre: nombre || null,
      Apellido: apellido || null,
      NombreUsuario: nombreUsuario || null,
      Bio: bio || null,
      Ubicacion: ubicacion || null,
    })
    .eq('Id_User', userId)
    .select()
    .single();
  if (error) throw error;
  return mapUsuarioPerfil(data);
}

/** Sube y guarda una nueva foto de perfil. Devuelve la URL pública guardada. */
export async function actualizarMiFotoPerfil(uri) {
  const url = await subirImagenPublica(uri, 'perfiles');
  const { error } = await supabase.from('User').update({ FotoPerfil: url }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return url;
}

/** Crea una publicación nueva en el perfil del usuario logueado. */
export async function crearPublicacion({ imagenUri, descripcion, mascotaId }) {
  const imagenUrl = await subirImagenPublica(imagenUri, 'publicaciones');
  const { data, error } = await supabase
    .from('Publicacion')
    .insert({
      Id_User: getCurrentUserId(),
      Id_Mascota: mascotaId ?? null,
      ImagenUrl: imagenUrl,
      Descripcion: descripcion || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPublicacion(data);
}
