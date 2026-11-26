import { supabase } from '../lib/supabase';
import { setCurrentUserId, setModo, MODO_DUENO } from '../config/session';
import { toISODateLocal } from '../utils/fechaLocal';
import { borrarImagenPublica, subirImagenPublica } from './imagenStorage';
import { errorBase } from './comun';
import { marcarPresencia } from './presenciaApi';
import { esPasswordValida } from '../utils/validacion';

export async function fetchRazas(especie) {
  const { data, error } = await supabase
    .from('razas')
    .select('id, nombre')
    .eq('especie', especie)
    .eq('activo', true);
  if (error) throw error;
  return { razas: ordenarRazas(data ?? []) };
}

const ES_COMODIN = /sin (raza|especificar)/i;
function ordenarRazas(razas) {
  return [...razas].sort((a, b) =>
    ES_COMODIN.test(a.nombre) - ES_COMODIN.test(b.nombre)
    || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

async function migrarCuentaVieja(mail, password) {
  const { data, error } = await supabase.rpc('migrar_cuenta_legada', { p_mail: mail, p_password: password });
  if (error) throw error;
  return data === true;
}

export async function mailDeLaSesion() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function cuentaDeLaSesion() {
  const { data, error } = await supabase.rpc('login_social');
  if (error) {
    if (String(error.message ?? '').includes('cuenta_sin_migrar')) throw new Error('credenciales');
    throw error;
  }
  if (!data || data.nuevo) throw new Error('registro_incompleto');
  return data;
}

export async function iniciarSesionConPassword(email, password) {
  const mail = email.trim().toLowerCase();

  let migrada = false;
  let { error } = await supabase.auth.signInWithPassword({ email: mail, password });
  if (error && /invalid login credentials|invalid_credentials/i.test(`${error.code} ${error.message}`)) {
    migrada = await migrarCuentaVieja(mail, password);
    if (migrada) {
      ({ error } = await supabase.auth.signInWithPassword({ email: mail, password }));
    }
  }
  if (error) {
    if (/invalid login credentials|invalid_credentials/i.test(`${error.code} ${error.message}`)) {
      throw new Error('credenciales');
    }
    throw error;
  }
  const cuenta = await cuentaDeLaSesion();
  return {
    ...cuenta,
    debeCambiarContrasena: cuenta.debeCambiarContrasena === true || (migrada && !esPasswordValida(password)),
  };
}

export async function crearCuentaConPassword(email, password) {
  const mail = email.trim().toLowerCase();
  if (!esPasswordValida(password)) throw new Error('password_corta');

  const { data, error } = await supabase.auth.signUp({ email: mail, password });
  if (error) {
    if (!/already registered|already exists|user_already_exists/i.test(`${error.code} ${error.message}`)) {
      throw error;
    }
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (errLogin) throw new Error('email_existente');
    const { data: cuenta, error: errCuenta } = await supabase.rpc('login_social');
    if (errCuenta || !cuenta?.nuevo) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('email_existente');
    }
    return;
  }
  if (!data?.session) throw new Error('confirmar_mail');
}

export async function login(email, password) {
  const mail = email.trim().toLowerCase();
  const usuario = await iniciarSesionConPassword(mail, password);

  await setCurrentUserId(usuario.id, mail);
  await setModo(MODO_DUENO);

  marcarPresencia(true);

  const { data: mascotas, error: errMascotas } = await supabase
    .from('Mascota')
    .select('Id_Mascota, Nombre, Especie, Raza, ImagenAsset')
    .eq('Id_User', usuario.id)
    .order('EsActiva', { ascending: false });
  if (errMascotas) throw errorBase(errMascotas);

  const mascotaActiva = mascotas?.[0] ?? null;

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      fotoPerfil: usuario.fotoPerfil ?? null,
      debeCambiarContrasena: usuario.debeCambiarContrasena === true,
      bajaCancelada: usuario.bajaCancelada === true,
    },
    mascotaActiva: mascotaActiva
      ? {
          id: mascotaActiva.Id_Mascota,
          nombre: mascotaActiva.Nombre,
          especie: mascotaActiva.Especie,
          raza: mascotaActiva.Raza,
          imagen_asset: mascotaActiva.ImagenAsset ?? 'perro_default',
        }
      : null,
  };
}

export async function verificarDisponibilidad({ email, nombreUsuario }) {
  const mail = (email ?? '').trim().toLowerCase();
  const usuario = (nombreUsuario ?? '').trim().replace(/^@/, '');
  const { data, error } = await supabase.rpc('disponibilidad_registro', {
    p_mail: mail || null,
    p_usuario: usuario || null,
  });
  if (error || !data) return { mailTomado: false, usuarioTomado: false };
  return { mailTomado: !!data.mailTomado, usuarioTomado: !!data.usuarioTomado };
}

function resolverFechaNacimiento(mascota) {
  if (mascota.fechaNacimiento) return mascota.fechaNacimiento;
  if (mascota.edadMeses == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - mascota.edadMeses);
  return toISODateLocal(d);
}

const IMAGEN_ASSET_POR_ESPECIE = {
  perro: 'perro_default',
  gato: 'gato_default',
  conejo: 'conejo_default',
  ave: 'pajaro_default',
  reptil: 'perro_default',
  pez: 'perro_default',
  hamster: 'hamster_default',
  raton: 'hamster_default',
};

export async function registro(datos) {
  const { mascota, usuario, social } = datos;
  const mail = usuario.email.trim().toLowerCase();

  if (!social && !esPasswordValida(usuario.password)) throw new Error('password_corta');

  const nombreUsuario = usuario.nombreUsuario?.trim().replace(/^@/, '') || null;
  const { mailTomado, usuarioTomado } = await verificarDisponibilidad({ email: mail, nombreUsuario });
  if (mailTomado) throw new Error('email_existente');
  if (usuarioTomado) throw new Error('usuario_existente');

  if (!social) await crearCuentaConPassword(mail, usuario.password);

  let fotoMascotaUrl = null;
  const deshacer = async () => {
    if (fotoMascotaUrl) await borrarImagenPublica(fotoMascotaUrl);
    if (!social) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  };

  try {
    fotoMascotaUrl = mascota.fotoUri
      ? await subirImagenPublica(mascota.fotoUri, 'mascotas')
      : null;
  } catch (e) {
    await deshacer();
    throw e;
  }

  const ubicacionDisplay = [usuario.ciudad, usuario.provincia].filter(Boolean).join(', ') || null;
  const { data, error } = await supabase.rpc('registrar_social_con_mascota', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      telefono: usuario.telefono?.trim() || null,
      codigoTelefono: usuario.codigoTelefono?.trim() || null,
      pais: usuario.pais ?? null,
      paisCodigo: usuario.paisCodigo ?? null,
      provincia: usuario.provincia?.trim() || null,
      ciudad: usuario.ciudad?.trim() || null,
      ubicacion: ubicacionDisplay,
      fotoPerfil: social?.foto ?? null,
    },
    p_mascota: {
      nombre: mascota.nombre.trim(),
      especie: mascota.especie,
      sexo: mascota.sexo,
      raza: mascota.razaNombre,
      peso: mascota.pesoKg ?? null,
      fechaNacimiento: resolverFechaNacimiento(mascota),
      imagenAsset: IMAGEN_ASSET_POR_ESPECIE[mascota.especie] ?? 'perro_default',
    },
  });
  if (error) {
    await deshacer();
    if (String(error.message ?? '').includes('email_existente') || error.code === '23505') {
      throw new Error('email_existente');
    }
    if (/JWT|token|sin_sesion_social/i.test(String(error.message ?? ''))) throw new Error('sesion_social_vencida');
    throw error;
  }

  let usuarioNoGuardado = false;
  if (nombreUsuario) {
    const { error: errUsuario } = await supabase.from('User')
      .update({ NombreUsuario: nombreUsuario }).eq('Id_User', data.id);
    if (errUsuario) {
      usuarioNoGuardado = true;
      if (__DEV__) console.warn('[registro] @usuario', errUsuario.message);
    }
  }
  if (fotoMascotaUrl) {
    const { error: errFoto } = await supabase.from('Mascota')
      .update({ Foto: fotoMascotaUrl }).eq('Id_User', data.id);
    if (errFoto) {
      if (__DEV__) console.warn('[registro] foto', errFoto.message);
      await borrarImagenPublica(fotoMascotaUrl);
    }
  }

  if (!social) await supabase.auth.signOut({ scope: 'local' });

  return {
    mensaje: 'Cuenta creada exitosamente',
    usuarioNoGuardado,
    usuario: { id: data.id, nombre: usuario.nombre.trim(), apellido: usuario.apellido.trim(), email: data.email ?? mail },
  };
}

export async function cuentaTieneContrasena() {
  const { data } = await supabase.auth.getSession();
  const meta = data?.session?.user?.app_metadata ?? {};
  const proveedores = meta.providers ?? (meta.provider ? [meta.provider] : []);
  return proveedores.includes('email');
}

export async function solicitarBajaDeCuenta({ password, motivo, motivoTexto }) {
  const { data: sesion } = await supabase.auth.getSession();
  const mail = sesion?.session?.user?.email;
  if (!mail) throw new Error('sin_sesion');

  if (await cuentaTieneContrasena()) {
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password: password ?? '' });
    if (error) {
      if (/invalid login credentials|invalid_credentials/i.test(`${error.code} ${error.message}`)) {
        throw new Error('credenciales');
      }
      throw error;
    }
  }

  const { data, error } = await supabase.rpc('solicitar_eliminacion_cuenta', {
    p_motivo: motivo ?? null,
    p_motivo_texto: motivoTexto?.trim() || null,
  });
  if (error) throw errorBase(error);
  return new Date(data);
}
