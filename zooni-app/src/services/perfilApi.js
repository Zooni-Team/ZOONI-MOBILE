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
import { hashPassword } from './authApi';
import { sanitizarEmail, sanitizarDigitos, sanitizarTexto } from '../utils/sanitizar';

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

/**
 * Perfil PÚBLICO de cualquier usuario (para la ficha que se abre desde
 * Comunidad, Match o donde se muestre una persona). Trae sus datos, su mascota
 * activa e intereses. Nunca expone datos privados (mail, teléfono, etc.).
 */
export async function fetchPerfilPublico(usuarioId) {
  const [{ data: u, error }, { data: mascotas }, { data: yo }] = await Promise.all([
    supabase.from('User')
      .select('Id_User, Nombre, Apellido, NombreUsuario, Bio, FotoPerfil, Ubicacion, FechaNacimiento, Intereses, Lat, Lng')
      .eq('Id_User', usuarioId).single(),
    supabase.from('Mascota').select('*').eq('Id_User', usuarioId).eq('Estado', 'active').order('EsActiva', { ascending: false }),
    supabase.from('User').select('Lat, Lng').eq('Id_User', getCurrentUserId()).maybeSingle(),
  ]);
  if (error) throw error;

  const mascota = mascotas?.find((m) => m.EsActiva) ?? mascotas?.[0] ?? null;
  const edad = (fecha) => {
    if (!fecha) return null;
    const n = parseFechaLocal(fecha), h = new Date();
    let a = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a -= 1;
    return a;
  };
  const distanciaKm = (() => {
    if (yo?.Lat == null || yo?.Lng == null || u.Lat == null || u.Lng == null) return null;
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(u.Lat - yo.Lat), dLng = toRad(u.Lng - yo.Lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(yo.Lat)) * Math.cos(toRad(u.Lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
  })();

  return {
    persona: {
      id: u.Id_User,
      nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Usuario',
      nombreUsuario: u.NombreUsuario ?? null,
      edad: edad(u.FechaNacimiento),
      bio: u.Bio ?? null,
      fotoPerfil: u.FotoPerfil ?? null,
      ubicacion: u.Ubicacion ?? null,
      distanciaKm,
      intereses: u.Intereses ?? [],
    },
    mascota: mascota
      ? {
          id: mascota.Id_Mascota, nombre: mascota.Nombre, especie: mascota.Especie,
          raza: mascota.Raza, edad: edad(mascota.FechaNacimiento), sexo: mascota.Sexo ?? null,
          descripcion: mascota.Descripcion ?? null, fotoUrl: mascota.Foto ?? null,
          imagenAsset: mascota.ImagenAsset ?? null,
        }
      : null,
  };
}

/** Trae las publicaciones activas del usuario logueado, más nuevas primero. */
export async function fetchMisPublicaciones() {
  const { data, error } = await supabase
    .from('Publicacion')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .neq('Activo', false)
    .order('Fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPublicacion);
}

/** Elimina una publicación propia (borrado lógico — ver migración 027). */
export async function eliminarPublicacion(id) {
  const { error } = await supabase
    .from('Publicacion')
    .update({ Activo: false })
    .eq('Id_Publicacion', id)
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return true;
}

/**
 * Actualiza los datos editables del perfil (nombre, apellido, bio, ubicación).
 * El @usuario NO se toca acá: se cambia solo desde Configuración › Cuenta y
 * Seguridad (con validación de formato, unicidad y bloqueo de 30 días).
 */
export async function actualizarMiPerfil({ nombre, apellido, bio, ubicacion }) {
  const { data, error } = await supabase
    .from('User')
    .update({
      Nombre: sanitizarTexto(nombre, 100),
      Apellido: sanitizarTexto(apellido, 100),
      Bio: sanitizarTexto(bio, 150),
      Ubicacion: sanitizarTexto(ubicacion, 200),
    })
    .eq('Id_User', getCurrentUserId())
    .select()
    .single();
  if (error) throw error;
  return mapUsuarioPerfil(data);
}

// ─────────────────────────────────────────────
// CUENTA Y SEGURIDAD (Configuración › Cuenta y Seguridad)
// ─────────────────────────────────────────────

/** Todos los datos de la cuenta del usuario logueado (perfil + acceso). */
export async function fetchMiCuenta() {
  const { data: u, error } = await supabase
    .from('User').select('*').eq('Id_User', getCurrentUserId()).single();
  if (error) throw error;
  return {
    id: u.Id_User,
    nombre: u.Nombre ?? '',
    apellido: u.Apellido ?? '',
    nombreUsuario: u.NombreUsuario ?? null,
    nombreUsuarioCambiadoEn: u.NombreUsuarioCambiadoEn ?? null,
    bio: u.Bio ?? null,
    email: u.Mail ?? null,
    telefono: u.Telefono ?? null,
    codigoTelefono: u.CodigoTelefono ?? null,
    fotoPerfil: u.FotoPerfil ?? null,
  };
}

// Días que hay que esperar para volver a cambiar el @usuario
export const DIAS_BLOQUEO_USUARIO = 30;

/**
 * Si el @usuario se cambió hace menos de 30 días, devuelve la fecha (Date) en
 * la que se va a poder cambiar de nuevo. Si ya se puede, devuelve null.
 */
export function fechaProximoCambioUsuario(cambiadoEn) {
  if (!cambiadoEn) return null;
  const proximo = new Date(new Date(cambiadoEn).getTime() + DIAS_BLOQUEO_USUARIO * 24 * 60 * 60 * 1000);
  return proximo > new Date() ? proximo : null;
}

/** Actualiza nombre y apellido. */
export async function actualizarNombreApellido(nombre, apellido) {
  const { error } = await supabase.from('User')
    .update({ Nombre: sanitizarTexto(nombre, 100), Apellido: sanitizarTexto(apellido, 100) })
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

/**
 * Actualiza el @usuario. Requisitos:
 *  - 3 a 30 caracteres, solo letras, números y guion bajo (sin espacios).
 *  - Único: no puede coincidir con el de otra cuenta (case-insensitive).
 *  - No se puede cambiar de nuevo hasta que pasen 30 días del último cambio.
 * Si el valor es el mismo que ya tenía, no hace nada (no cuenta como cambio).
 */
export async function actualizarNombreUsuario(nombreUsuario) {
  const userId = getCurrentUserId();
  const limpio = (sanitizarTexto(nombreUsuario, 30) ?? '').replace(/\s+/g, '');

  if (limpio.length < 3 || limpio.length > 30) {
    const e = new Error('username_corto'); e.code = 'USERNAME_CORTO'; throw e;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(limpio)) {
    const e = new Error('username_formato'); e.code = 'USERNAME_FORMATO'; throw e;
  }

  // Estado actual: usuario vigente + cuándo se cambió por última vez
  // (select('*') para no romper si la migración 025 todavía no se corrió)
  const { data: actual } = await supabase
    .from('User').select('*').eq('Id_User', userId).single();

  // Sin cambios reales → no gasta el cooldown
  if ((actual?.NombreUsuario ?? '').toLowerCase() === limpio.toLowerCase()) {
    return actual?.NombreUsuario ?? limpio;
  }

  // Bloqueo de 30 días
  const bloqueado = fechaProximoCambioUsuario(actual?.NombreUsuarioCambiadoEn);
  if (bloqueado) {
    const e = new Error('username_bloqueado'); e.code = 'USERNAME_BLOQUEADO';
    e.fecha = bloqueado; throw e;
  }

  // Unicidad case-insensitive
  const { data: existente } = await supabase
    .from('User').select('Id_User').ilike('NombreUsuario', limpio).neq('Id_User', userId).maybeSingle();
  if (existente) {
    const e = new Error('username_tomado'); e.code = 'USERNAME_TAKEN'; throw e;
  }

  const { error } = await supabase.from('User')
    .update({ NombreUsuario: limpio, NombreUsuarioCambiadoEn: new Date().toISOString() })
    .eq('Id_User', userId);
  if (error) throw error;
  return limpio;
}

/** Actualiza la biografía (máx. 150). */
export async function actualizarBio(bio) {
  const { error } = await supabase.from('User')
    .update({ Bio: sanitizarTexto(bio, 150) }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

/** Cambia el correo, validando formato y que no esté en uso por otra cuenta. */
export async function actualizarEmail(email) {
  const userId = getCurrentUserId();
  const limpio = sanitizarEmail(email);
  if (!limpio) { const e = new Error('email_invalido'); e.code = 'EMAIL_INVALIDO'; throw e; }
  const { data: existente } = await supabase
    .from('User').select('Id_User').ilike('Mail', limpio).neq('Id_User', userId).maybeSingle();
  if (existente) { const e = new Error('email_existente'); e.code = 'EMAIL_EXISTENTE'; throw e; }
  const { error } = await supabase.from('User').update({ Mail: limpio }).eq('Id_User', userId);
  if (error) throw error;
  return limpio;
}

/** Actualiza el teléfono (código de país + número). */
export async function actualizarTelefono(codigoTelefono, telefono) {
  const cod = codigoTelefono ? sanitizarTexto(codigoTelefono, 10) : null;
  const num = telefono ? sanitizarDigitos(telefono, 20) : null;
  const { error } = await supabase.from('User')
    .update({ CodigoTelefono: cod, Telefono: num || null }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return { codigoTelefono: cod, telefono: num };
}

/**
 * Cambia la contraseña: verifica la actual y guarda la nueva, hasheadas.
 * Usa la RPC del servidor (021_seguridad.sql); si no está, cae al método
 * legacy sobre la columna "Contrasena".
 * Devuelve true si se cambió, false si la contraseña actual es incorrecta.
 */
export async function cambiarMiContrasena(actual, nueva) {
  const { data: u } = await supabase
    .from('User').select('"Mail"').eq('Id_User', getCurrentUserId()).single();
  const hashActual = await hashPassword(actual);
  const hashNueva = await hashPassword(nueva);

  const { data, error } = await supabase.rpc('cambiar_contrasena', {
    p_mail: u?.Mail, p_hash_actual: hashActual, p_hash_nueva: hashNueva,
  });
  if (!error) return data === true;

  // Fallback legacy (021 sin correr): comparar y actualizar Contrasena
  if (error.code === 'PGRST202' || /function .* does not exist/i.test(error.message ?? '')) {
    const { data: fila } = await supabase
      .from('User').select('"Contrasena"').eq('Id_User', getCurrentUserId()).single();
    if (!fila || (fila.Contrasena !== hashActual && fila.Contrasena !== actual)) return false;
    const { error: errUp } = await supabase.from('User')
      .update({ Contrasena: hashNueva }).eq('Id_User', getCurrentUserId());
    if (errUp) throw errUp;
    return true;
  }
  throw error;
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
