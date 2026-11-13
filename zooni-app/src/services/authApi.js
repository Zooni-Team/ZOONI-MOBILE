/**
 * authApi.js — Login y registro con Supabase Auth.
 *
 * Qué viaja y quién lo verifica:
 *   · Login: mail + contraseña van por HTTPS a Supabase Auth
 *     (signInWithPassword). Supabase compara contra un hash bcrypt (con sal y
 *     costo) y devuelve un JWT firmado. La app nunca hashea ni compara nada.
 *   · Con ese JWT, la RPC login_social() devuelve a qué cuenta de Zooni
 *     ("User") corresponde. Desde ahí, cada consulta lleva el JWT y RLS decide.
 *   · Registro: signUp crea el usuario de Auth (y la sesión); después una RPC
 *     crea "User" + mascota + rol en UNA transacción (registrar_social_con_mascota,
 *     043): si algo falla a mitad de camino, la base deshace todo.
 *
 * Cuentas creadas antes del cambio (contraseña como SHA-256 en
 * user_credentials): el primer login las migra solo, ver migrarCuentaVieja().
 */

import { supabase } from '../lib/supabase';
import { setCurrentUserId, setModo, MODO_DUENO } from '../config/session';
import { toISODateLocal } from '../utils/fechaLocal';
import { subirImagenPublica } from '../utils/imagenStorage';
import { marcarPresencia } from './presenciaApi';
import { loginLegado } from './authLegado';
import { esPasswordValida } from '../utils/validacion';

// ─────────────────────────────────────────────
// RAZAS (catálogo para el Registro Paso 2)
// ─────────────────────────────────────────────

/** Devuelve las razas activas de una especie, ordenadas. */
export async function fetchRazas(especie) {
  const { data, error } = await supabase
    .from('razas')
    .select('id, nombre')
    .eq('especie', especie)
    .eq('activo', true);
  if (error) throw error;
  return { razas: ordenarRazas(data ?? []) };
}

// Orden alfabético para que sea fácil encontrar la raza en el desplegable.
// Las opciones comodín ("Mestizo / Sin raza definida", "Otro / Sin
// especificar") van siempre al final, como en el catálogo original.
const ES_COMODIN = /sin (raza|especificar)/i;
function ordenarRazas(razas) {
  return [...razas].sort((a, b) =>
    ES_COMODIN.test(a.nombre) - ES_COMODIN.test(b.nombre)
    || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

// ─────────────────────────────────────────────
// SESIÓN (compartido por dueños, paseadores y negocios)
// ─────────────────────────────────────────────

/** PostgREST no encontró la función: la base no tiene la 065 todavía. */
function esFuncionInexistente(error) {
  return error?.code === 'PGRST202' || /could not find the function/i.test(error?.message ?? '');
}

/**
 * Cuenta vieja → Supabase Auth. Devuelve:
 *   true   la cuenta se migró (ya se puede hacer signInWithPassword)
 *   false  no había cuenta vieja con ese mail y contraseña
 *   null   no se pudo intentar (base sin 065 y sin la Edge Function, o sin red)
 *
 * Primero la función de la base (065, migrar_cuenta_legada): no depende de
 * desplegar nada. Si la base todavía no la tiene, la Edge Function de antes.
 */
async function migrarCuentaVieja(mail, password) {
  const { data, error } = await supabase.rpc('migrar_cuenta_legada', { p_mail: mail, p_password: password });
  if (!error) return data === true;
  if (!esFuncionInexistente(error)) return null;

  const { data: dataFn, error: errorFn } = await supabase.functions.invoke('migrar-cuenta', {
    body: { email: mail, password },
  });
  if (errorFn) return null;
  return !!dataFn?.migrada;
}

/** Traduce la sesión de Auth a la cuenta de Zooni. */
async function cuentaDeLaSesion() {
  const { data, error } = await supabase.rpc('login_social');
  if (error) {
    if (String(error.message ?? '').includes('cuenta_sin_migrar')) throw new Error('credenciales');
    throw error;
  }
  if (!data || data.nuevo) throw new Error('registro_incompleto');
  return data;
}

/**
 * Inicia sesión con mail y contraseña. NO elige el modo de la app: eso lo
 * hace quien llama (login de dueño, de paseador o de negocio).
 * @returns {{ id, nombre, apellido, email, fotoPerfil, legado?: boolean }}
 * Lanza Error('credenciales') si mail o contraseña no coinciden (sin decir cuál).
 */
export async function iniciarSesionConPassword(email, password) {
  const mail = email.trim().toLowerCase();

  let { error } = await supabase.auth.signInWithPassword({ email: mail, password });
  if (error && /invalid login credentials|invalid_credentials/i.test(`${error.code} ${error.message}`)) {
    const migrada = await migrarCuentaVieja(mail, password);
    if (migrada) {
      ({ error } = await supabase.auth.signInWithPassword({ email: mail, password }));
    } else if (migrada === null) {
      // TRANSICIÓN: no se pudo intentar la migración (base sin 065 y sin la
      // Edge Function). Se entra como antes, sin JWT. Borrar authLegado.js y
      // este bloque cuando user_credentials quede vacía (ver faltaporhacer.md).
      return loginLegado(mail, password);
    }
  }
  if (error) {
    if (/invalid login credentials|invalid_credentials/i.test(`${error.code} ${error.message}`)) {
      throw new Error('credenciales');
    }
    throw error;
  }
  return cuentaDeLaSesion();
}

/**
 * Crea el usuario de Supabase Auth para un registro con contraseña y deja la
 * sesión abierta (las RPC de alta la necesitan).
 *
 * Si el mail ya está en Auth pero nunca terminó el alta (se cortó la red
 * entre el signUp y la RPC), se retoma con la misma contraseña en vez de
 * dejar a la persona sin poder registrarse.
 */
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
  // Con "Confirm email" activado en Supabase, signUp no devuelve sesión
  // hasta que se confirma el mail (ver README → Supabase Auth).
  if (!data?.session) throw new Error('confirmar_mail');
}

// ─────────────────────────────────────────────
// LOGIN DE DUEÑOS
// ─────────────────────────────────────────────

/**
 * Login de la app de dueños. Devuelve { usuario, mascotaActiva }.
 * Lanza Error('credenciales') si el mail o la contraseña no coinciden.
 */
export async function login(email, password) {
  const mail = email.trim().toLowerCase();
  const usuario = await iniciarSesionConPassword(mail, password);

  await setCurrentUserId(usuario.id, mail);
  // Entró por el login de dueños: la app arranca en modo dueño aunque la
  // cuenta también sea de paseador (eso se elige desde "Proveedor").
  await setModo(MODO_DUENO);

  // Primer latido de presencia apenas entra: si no, hasta el próximo tick del
  // intervalo figuraría desconectado en Comunidad.
  marcarPresencia(true);

  const { data: mascotas } = await supabase
    .from('Mascota')
    .select('Id_Mascota, Nombre, Especie, Raza, ImagenAsset')
    .eq('Id_User', usuario.id)
    .order('EsActiva', { ascending: false });

  const mascotaActiva = mascotas?.[0] ?? null;

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      fotoPerfil: usuario.fotoPerfil ?? null,
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

// ─────────────────────────────────────────────
// DISPONIBILIDAD DE MAIL Y @USUARIO
// ─────────────────────────────────────────────

/**
 * Chequeo de disponibilidad para el PASO 3 del registro (mail y @usuario).
 *
 * Avisa temprano, en la misma pantalla donde se escribe. No es la garantía:
 * entre el paso 3 y el 4 alguien más puede quedarse con ese mail. La garantía
 * es el índice único del servidor (053_mail_unico.sql).
 *
 * Se pregunta con la RPC disponibilidad_registro (060): con RLS un anónimo ya
 * no puede leer la tabla "User", y esta función sólo responde sí/no.
 * Ante un error devuelve todo libre a propósito: no tiene sentido bloquear el
 * registro por no haber podido consultar.
 *
 * @returns {Promise<{mailTomado: boolean, usuarioTomado: boolean}>}
 */
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

// ─────────────────────────────────────────────
// REGISTRO DE DUEÑOS
// ─────────────────────────────────────────────

/**
 * Fecha de nacimiento de la mascota. El registro la pide directamente
 * (Paso 2); `edadMeses` queda solo como respaldo para cualquier pantalla vieja
 * que todavía mande una edad en meses.
 */
function resolverFechaNacimiento(mascota) {
  if (mascota.fechaNacimiento) return mascota.fechaNacimiento;
  if (mascota.edadMeses == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - mascota.edadMeses);
  // toISOString usa UTC: de noche (UTC-3) devolvía el día siguiente
  return toISODateLocal(d);
}

const IMAGEN_ASSET_POR_ESPECIE = {
  perro: 'perro_default',
  gato: 'gato_default',
  conejo: 'conejo_default',
  ave: 'pajaro_default',
  reptil: 'perro_default',   // sin asset propio todavía — ver Instruction-CargarImagenes.md
  pez: 'perro_default',
  hamster: 'hamster_default',
  raton: 'hamster_default',
};

/**
 * Registra usuario + primera mascota.
 * @param {object} datos
 *   {
 *     mascota: { nombre, especie, sexo, razaNombre, pesoKg, fechaNacimiento, fotoUri },
 *     usuario: { nombre, apellido, email, password, pais, paisCodigo,
 *                provincia, ciudad, codigoTelefono, telefono, nombreUsuario },
 *     social:  { foto } si vino de Google / Facebook (ya hay sesión, sin contraseña)
 *   }
 * Lanza Error('email_existente') si ya hay una cuenta con ese mail.
 * Con contraseña NO deja la sesión abierta: el flujo vuelve al Login con un
 * banner de éxito.
 */
export async function registro(datos) {
  const { mascota, usuario, social } = datos;
  const mail = usuario.email.trim().toLowerCase();

  if (!social && !esPasswordValida(usuario.password)) throw new Error('password_corta');

  // Chequeo temprano (mail y @usuario): corta ANTES de crear nada.
  const nombreUsuario = usuario.nombreUsuario?.trim().replace(/^@/, '') || null;
  const { mailTomado, usuarioTomado } = await verificarDisponibilidad({ email: mail, nombreUsuario });
  if (mailTomado) throw new Error('email_existente');
  if (usuarioTomado) throw new Error('usuario_existente');

  // 1. Sesión de Auth (con proveedor ya existe; con contraseña se crea acá)
  if (!social) await crearCuentaConPassword(mail, usuario.password);

  // 2. Foto real de la mascota (Storage exige sesión: va después del signUp)
  const fotoMascotaUrl = mascota.fotoUri
    ? await subirImagenPublica(mascota.fotoUri, 'mascotas')
    : null;

  // 3. Usuario + mascota + rol en una transacción del servidor
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
    if (String(error.message ?? '').includes('email_existente') || error.code === '23505') {
      throw new Error('email_existente');
    }
    if (/JWT|token|sin_sesion_social/i.test(String(error.message ?? ''))) throw new Error('sesion_social_vencida');
    throw error;
  }

  // 4. Detalles que la RPC no recibe (con la sesión de la cuenta nueva)
  if (nombreUsuario) {
    const { error: errUsuario } = await supabase.from('User')
      .update({ NombreUsuario: nombreUsuario }).eq('Id_User', data.id);
    if (errUsuario && String(errUsuario.message ?? '').includes('idx_user_nombreusuario')) {
      throw new Error('usuario_existente');
    }
  }
  if (fotoMascotaUrl) {
    await supabase.from('Mascota').update({ Foto: fotoMascotaUrl }).eq('Id_User', data.id);
  }

  if (!social) await supabase.auth.signOut({ scope: 'local' });

  return {
    mensaje: 'Cuenta creada exitosamente',
    usuario: { id: data.id, nombre: usuario.nombre.trim(), apellido: usuario.apellido.trim(), email: data.email ?? mail },
  };
}
