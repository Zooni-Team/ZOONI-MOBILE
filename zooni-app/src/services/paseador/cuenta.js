/**
 * paseador/cuenta.js — Entrar y darse de alta como paseador, y qué roles tiene
 * la cuenta (dueño, paseador, negocios).
 *
 * La contraseña la maneja Supabase Auth (authApi). Las altas pasan por RPC que
 * toman la identidad de la sesión, no de lo que mande la app.
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId, setCurrentUserId, setModo, MODO_PASEADOR } from '../../config/session';
import { crearCuentaConPassword, iniciarSesionConPassword } from '../authApi';
import { marcarPresencia } from '../presenciaApi';
import { rpcSocial } from '../socialAuthApi';
import { HORARIOS_DEFAULT, serviciosDe } from '../../domain/paseos';
import { errorApp, esEsquemaFaltante } from '../comun';

async function entrarComoPaseador(id, mail) {
  await setCurrentUserId(id, mail);
  await setModo(MODO_PASEADOR);
  marcarPresencia(true);
}

/**
 * Login del paseador. A diferencia del login de dueños, NO entra a la app
 * hasta confirmar que la cuenta tiene perfil de paseador: si no lo tiene,
 * devuelve { necesitaActivar: true, email } para ofrecer sumarlo (la sesión de
 * Auth queda abierta: activarPaseador la usa). Si tiene el rol pero no el
 * perfil, devuelve { necesitaCompletar: true }.
 * Lanza Error('credenciales') si mail/contraseña no coinciden.
 */
export async function loginPaseador(email, password) {
  const mail = email.trim().toLowerCase();
  const usuario = await iniciarSesionConPassword(mail, password);

  const { data: perfil, error: errPerfil } = await supabase
    .from('paseador_perfil').select('id_user').eq('id_user', usuario.id).maybeSingle();

  if (errPerfil) throw errorApp('error_base', errPerfil);
  if (!perfil) {
    // ¿Ya tiene el rol de paseador (ej. asignado a mano) y sólo le falta el
    // perfil? Entonces entra y lo completa, sin "activar" de nuevo.
    const { data: rol } = await supabase.from('UserRole').select('Id_Role')
      .eq('Id_User', usuario.id).eq('Id_Role', 2).maybeSingle();
    if (rol) {
      await setCurrentUserId(usuario.id, mail);
      return { necesitaCompletar: true };
    }
    return { necesitaActivar: true, email: mail, nombre: usuario.nombre, fotoPerfil: usuario.fotoPerfil ?? null };
  }

  await entrarComoPaseador(usuario.id, mail);
  return { usuario };
}

function perfilParaRpc(perfil) {
  return {
    bio: perfil.bio?.trim() || null,
    zona: perfil.zona?.trim() || null,
    lat: perfil.lat ?? null,
    lng: perfil.lng ?? null,
    radioKm: perfil.radioKm ?? 3,
    servicios: serviciosDe(perfil),
    maxPerros: perfil.maxPerros ?? 3,
    tamanos: perfil.tamanos ?? ['chico', 'mediano', 'grande'],
    experienciaAnios: perfil.experienciaAnios ?? 0,
    horarios: perfil.horarios ?? HORARIOS_DEFAULT(),
  };
}

/**
 * Cuenta nueva de paseador. A diferencia del registro de dueños, entra
 * directo: el paseador viene a trabajar y no tiene sentido mandarlo de nuevo
 * al login.
 * Lanza Error('email_existente') si el mail ya tiene cuenta.
 */
export async function registrarPaseador({ usuario, perfil }) {
  // Primero la sesión de Auth (contraseña con bcrypt del lado de Supabase);
  // después la misma RPC que el alta con Google/Facebook: toma el mail de la
  // sesión, no de lo que mande la app.
  await crearCuentaConPassword(usuario.email, usuario.password);

  const { data, error } = await supabase.rpc('registrar_paseador_social', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      telefono: usuario.telefono?.trim() || null,
      genero: usuario.genero,
      fechaNacimiento: usuario.fechaNacimiento, // "YYYY-MM-DD"
    },
    p_perfil: perfilParaRpc(perfil),
  });

  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('email_existente') || error.code === '23505') throw new Error('email_existente');
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email ?? usuario.email);
  return data;
}

/**
 * Alta de paseador que vino de Google / Facebook / Apple: sin contraseña. El
 * mail lo toma el servidor de la sesión del proveedor (043) y `fotoPerfil` es
 * la foto del proveedor (si no eligió otra).
 */
export async function registrarPaseadorSocial({ usuario, perfil, fotoPerfil }) {
  let data;
  try {
    data = await rpcSocial('registrar_paseador_social', {
      p_usuario: {
        nombre: usuario.nombre.trim(),
        apellido: usuario.apellido.trim(),
        telefono: usuario.telefono?.trim() || null,
        genero: usuario.genero,
        fechaNacimiento: usuario.fechaNacimiento,
        fotoPerfil: fotoPerfil ?? null,
      },
      p_perfil: perfilParaRpc(perfil),
    });
  } catch (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('email_existente')) throw new Error('email_existente');
    if (error.message === 'sesion_social_vencida') throw error;
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email);
  return data;
}

/** Cuenta de dueño existente que entró con su proveedor y se suma como paseador. */
export async function activarPaseadorSocial(perfil) {
  let data;
  try {
    data = await rpcSocial('activar_paseador_social', { p_perfil: perfilParaRpc(perfil) });
  } catch (error) {
    if (error.message === 'sesion_social_vencida') throw error;
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email);
  return data;
}

/**
 * Cuenta de dueño existente que se suma como paseador. Usa la sesión que dejó
 * abierta loginPaseador (ya comprobó la contraseña).
 */
export async function activarPaseador({ email, perfil }) {
  const { data, error } = await supabase.rpc('activar_paseador_social', {
    p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (/sin_sesion_social|JWT|token/i.test(String(error.message ?? ''))) throw errorApp('migracion_pendiente', error);
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, email);
  return data;
}

/**
 * Cuenta con rol WALKER (UserRole 2) pero sin fila en paseador_perfil (ej. el
 * rol se asignó a mano en la base): completa el perfil sin pedir contraseña.
 * La RPC verifica en el servidor que el rol exista.
 */
export async function completarPerfilPaseador(perfil) {
  // p_id_user queda en la firma por compatibilidad: la base usa el de la
  // sesión (usuario_actual) y lo ignora (070).
  const { error } = await supabase.rpc('completar_perfil_paseador', {
    p_id_user: null, p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (String(error.message ?? '').includes('no_es_paseador')) throw new Error('no_es_paseador');
    throw errorApp('error_base', error);
  }
  await setModo(MODO_PASEADOR);
}

/** Foto de perfil que ya tiene la cuenta logueada (o null). */
export async function fetchMiFotoPerfil() {
  const { data } = await supabase.from('User').select('FotoPerfil').eq('Id_User', getCurrentUserId()).maybeSingle();
  return data?.FotoPerfil ?? null;
}

/**
 * Qué "apps" puede usar la cuenta logueada:
 *   esDueno       → rol OWNER o tiene alguna mascota
 *   esPaseador    → rol WALKER o tiene perfil de paseador
 *   tienePerfil   → ya existe su fila en paseador_perfil (si es paseador
 *                   por rol pero sin perfil, hay que completarlo)
 *   negocios      → [{ id, tipo, nombre }] veterinaria / peluquería / pet
 *                   shop de la cuenta (046; sin la migración, [])
 * Devuelve null si no se pudo consultar (sin red): quien llama decide.
 */
export async function fetchRolesCuenta(id = getCurrentUserId()) {
  if (id == null) return null;
  const [roles, mascotas, perfil, negocios] = await Promise.all([
    supabase.from('UserRole').select('Id_Role').eq('Id_User', id),
    supabase.from('Mascota').select('Id_Mascota').eq('Id_User', id).limit(1),
    supabase.from('paseador_perfil').select('id_user').eq('id_user', id).maybeSingle(),
    supabase.from('negocio_perfil').select('id, tipo, nombre').eq('id_user', id),
  ]);
  if (roles.error && mascotas.error) return null;
  const ids = new Set((roles.data ?? []).map((r) => r.Id_Role));
  const tienePerfil = !perfil.error && !!perfil.data;
  return {
    esDueno: ids.has(1) || (mascotas.data?.length ?? 0) > 0,
    esPaseador: ids.has(2) || tienePerfil,
    tienePerfil,
    negocios: negocios.error ? [] : (negocios.data ?? []),
  };
}
