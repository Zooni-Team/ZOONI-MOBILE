import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { borrarImagenPublica, subirImagenPublica } from './imagenStorage';
import { sanitizarEmail, sanitizarDigitos, sanitizarTexto } from '../utils/sanitizar';
import { perfilPorId } from './perfilesPublicos';
import { distanciaKm } from '../utils/geo';

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
    supabase.from('amistades').select('*').or(`usuario_a_id.eq.${Number(userId)},usuario_b_id.eq.${Number(userId)}`).eq('estado', 'aceptada'),
  ]);
  if (errUsuario) throw errUsuario;

  const mascotaActiva = mascotas?.find((m) => m.EsActiva) ?? mascotas?.[0] ?? null;

  return {
    usuario: mapUsuarioPerfil(usuario),
    mascotaActiva: mapMascotaMini(mascotaActiva),
    totalPublicaciones: totalPublicaciones ?? 0,
    totalAmigos: amistades?.length ?? 0,
  };
}

export async function fetchPerfilPublico(usuarioId) {
  const [u, { data: mascotas }, { data: yo }] = await Promise.all([
    perfilPorId(usuarioId, 'Id_User, Nombre, Apellido, NombreUsuario, Bio, FotoPerfil, Ubicacion, Edad, Intereses, Lat, Lng'),
    supabase.from('mascota_publica').select('*').eq('Id_User', usuarioId).order('EsActiva', { ascending: false }),
    supabase.from('User').select('Lat, Lng').eq('Id_User', getCurrentUserId()).maybeSingle(),
  ]);
  if (!u) throw new Error('perfil_inexistente');

  const mascota = mascotas?.find((m) => m.EsActiva) ?? mascotas?.[0] ?? null;

  return {
    persona: {
      id: u.Id_User,
      nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Usuario',
      nombreUsuario: u.NombreUsuario ?? null,
      edad: u.Edad ?? null,
      bio: u.Bio ?? null,
      fotoPerfil: u.FotoPerfil ?? null,
      ubicacion: u.Ubicacion ?? null,
      distanciaKm: distanciaKm({ lat: yo?.Lat, lng: yo?.Lng }, { lat: u.Lat, lng: u.Lng }),
      intereses: u.Intereses ?? [],
    },
    mascota: mascota
      ? {
          id: mascota.Id_Mascota, nombre: mascota.Nombre, especie: mascota.Especie,
          raza: mascota.Raza, edad: mascota.EdadAnios ?? null, sexo: mascota.Sexo ?? null,
          descripcion: mascota.Descripcion ?? null, fotoUrl: mascota.Foto ?? null,
          imagenAsset: mascota.ImagenAsset ?? null,
        }
      : null,
  };
}

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

export async function eliminarPublicacion(id) {
  const { error } = await supabase
    .from('Publicacion')
    .update({ Activo: false })
    .eq('Id_Publicacion', id)
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return true;
}

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

export const DIAS_BLOQUEO_USUARIO = 30;

export function fechaProximoCambioUsuario(cambiadoEn) {
  if (!cambiadoEn) return null;
  const proximo = new Date(new Date(cambiadoEn).getTime() + DIAS_BLOQUEO_USUARIO * 24 * 60 * 60 * 1000);
  return proximo > new Date() ? proximo : null;
}

export async function actualizarNombreApellido(nombre, apellido) {
  const { error } = await supabase.from('User')
    .update({ Nombre: sanitizarTexto(nombre, 100), Apellido: sanitizarTexto(apellido, 100) })
    .eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

export async function actualizarNombreUsuario(nombreUsuario) {
  const userId = getCurrentUserId();
  const limpio = (sanitizarTexto(nombreUsuario, 30) ?? '').replace(/\s+/g, '');

  if (limpio.length < 3 || limpio.length > 30) {
    const e = new Error('username_corto'); e.code = 'USERNAME_CORTO'; throw e;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(limpio)) {
    const e = new Error('username_formato'); e.code = 'USERNAME_FORMATO'; throw e;
  }

  const { data: actual } = await supabase
    .from('User').select('*').eq('Id_User', userId).single();

  if ((actual?.NombreUsuario ?? '').toLowerCase() === limpio.toLowerCase()) {
    return actual?.NombreUsuario ?? limpio;
  }

  const bloqueado = fechaProximoCambioUsuario(actual?.NombreUsuarioCambiadoEn);
  if (bloqueado) {
    const e = new Error('username_bloqueado'); e.code = 'USERNAME_BLOQUEADO';
    e.fecha = bloqueado; throw e;
  }

  const tomado = () => { const e = new Error('username_tomado'); e.code = 'USERNAME_TAKEN'; return e; };
  const { data: disp, error: errDisp } = await supabase.rpc('disponibilidad_registro', {
    p_mail: null, p_usuario: limpio,
  });
  if (errDisp) throw errDisp;
  if (disp?.usuarioTomado) throw tomado();

  const { error } = await supabase.from('User')
    .update({ NombreUsuario: limpio, NombreUsuarioCambiadoEn: new Date().toISOString() })
    .eq('Id_User', userId);
  if (error?.code === '23505') throw tomado();
  if (error) throw error;
  return limpio;
}

export async function actualizarBio(bio) {
  const { error } = await supabase.from('User')
    .update({ Bio: sanitizarTexto(bio, 150) }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
}

export async function actualizarEmail(email) {
  const limpio = sanitizarEmail(email);
  if (!limpio) { const e = new Error('email_invalido'); e.code = 'EMAIL_INVALIDO'; throw e; }
  const { data: disp } = await supabase.rpc('disponibilidad_registro', { p_mail: limpio, p_usuario: null });
  if (disp?.mailTomado) { const e = new Error('email_existente'); e.code = 'EMAIL_EXISTENTE'; throw e; }
  const { error } = await supabase.auth.updateUser({ email: limpio });
  if (error) throw error;
  return limpio;
}

export async function actualizarTelefono(codigoTelefono, telefono) {
  const cod = codigoTelefono ? sanitizarTexto(codigoTelefono, 10) : null;
  const num = telefono ? sanitizarDigitos(telefono, 20) : null;
  const { error } = await supabase.from('User')
    .update({ CodigoTelefono: cod, Telefono: num || null }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return { codigoTelefono: cod, telefono: num };
}

export async function cambiarMiContrasena(actual, nueva) {
  const { data } = await supabase.auth.getSession();
  const mail = data?.session?.user?.email;
  if (!mail) throw new Error('sin_sesion');
  const { error: errActual } = await supabase.auth.signInWithPassword({ email: mail, password: actual });
  if (errActual) return false;
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw error;
  await supabase.from('User').update({ DebeCambiarContrasena: false })
    .eq('Id_User', getCurrentUserId()).eq('DebeCambiarContrasena', true)
    .then(() => {}, () => {});
  return true;
}

export async function actualizarMiFotoPerfil(uri) {
  const { data: antes } = await supabase.from('User').select('FotoPerfil')
    .eq('Id_User', getCurrentUserId()).maybeSingle();
  const url = await subirImagenPublica(uri, 'perfiles');
  const { error } = await supabase.from('User').update({ FotoPerfil: url }).eq('Id_User', getCurrentUserId());
  if (error) {
    await borrarImagenPublica(url);
    throw error;
  }
  if (antes?.FotoPerfil && antes.FotoPerfil !== url) await borrarImagenPublica(antes.FotoPerfil);
  return url;
}

export async function quitarMiFotoPerfil() {
  const { data: antes } = await supabase.from('User').select('FotoPerfil')
    .eq('Id_User', getCurrentUserId()).maybeSingle();
  const { error } = await supabase.from('User').update({ FotoPerfil: null }).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  if (antes?.FotoPerfil) await borrarImagenPublica(antes.FotoPerfil);
}

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
