/**
 * session.js — Sesión del usuario actual (sin JWT propio todavía).
 *
 * Después del login, el id del usuario se guarda acá (memoria + storage) y
 * todos los servicios lo leen con getCurrentUserId() al momento de armar cada
 * query.
 *
 * IMPORTANTE — por qué el valor inicial es null y no un usuario de demo:
 * antes este archivo arrancaba con `currentUserId = 1` "para ver datos al
 * desarrollar", pero el id 1 es una CUENTA REAL de la base. Como
 * loadStoredUserId() es asíncrono, todo lo que consultara durante el arranque
 * (o después de un logout, que también volvía al id 1) leía y escribía la
 * cuenta de otra persona: de ahí que la app "cambiara de cuenta sola".
 *
 * Ahora, mientras no haya sesión, el id es null: las queries no devuelven nada
 * en vez de devolver los datos de otro. Falla cerrado, que es lo correcto para
 * algo que decide de quién son los datos.
 *
 * Cuando se migre a Supabase Auth, este archivo pasa a leer
 * supabase.auth.getSession() y el resto de la app no cambia.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { supabase, supabaseSocial } from '../lib/supabase';

const STORAGE_KEY = 'zooni_user_id';
// Mail de la última cuenta que usó este dispositivo: el login lo muestra ya
// escrito después de cerrar sesión. No se borra en el logout (es sólo el mail,
// nunca la contraseña).
const ULTIMO_MAIL_KEY = 'zooni_ultimo_mail';

let currentUserId = null;

// Promesa que se resuelve cuando ya se sabe si hay sesión o no. Sirve para que
// nada que dependa del usuario (el latido de presencia, por ejemplo) corra
// antes de tiempo y le pegue a la cuenta equivocada.
let resolverSesion;
const sesionLista = new Promise((resolve) => { resolverSesion = resolve; });
let sesionResuelta = false;

function marcarSesionResuelta() {
  if (sesionResuelta) return;
  sesionResuelta = true;
  resolverSesion(currentUserId);
}

/**
 * Id del usuario logueado que usan todas las queries.
 * @returns {number|null} null si todavía no se restauró la sesión o no hay nadie.
 */
export function getCurrentUserId() {
  return currentUserId;
}

/** ¿Hay alguien logueado? */
export function haySesion() {
  return currentUserId != null;
}

/**
 * Espera a que la sesión esté restaurada desde el storage.
 * Resuelve con el id, o con null si no había sesión guardada.
 */
export function esperarSesion() {
  return sesionLista;
}

/** Guarda la sesión tras un login exitoso (y el mail, si se conoce). */
export async function setCurrentUserId(id, mail) {
  currentUserId = id;
  marcarSesionResuelta();
  if (mail) recordarUltimoMail(mail);
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, String(id));
    }
  } catch {
    // Sin storage: la sesión dura lo que dure la app abierta.
  }
}

/**
 * Lee la sesión guardada al arrancar la app.
 * Devuelve el id si hay sesión, o null si nunca se logueó nadie.
 */
export async function loadStoredUserId() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    // Number.isInteger descarta storage corrupto ("", "abc", "NaN"): con
    // parseInt a secas quedaba NaN dando vueltas como si fuera un id.
    const id = raw != null ? parseInt(raw, 10) : NaN;
    currentUserId = Number.isInteger(id) && id > 0 ? id : null;
    return currentUserId;
  } catch {
    currentUserId = null;
    return null;
  } finally {
    marcarSesionResuelta();
  }
}

/** Borra la sesión (logout). Queda sin usuario: nadie hereda datos ajenos. */
export async function clearCurrentUserId() {
  // Antes de olvidar el id, guardar su mail para el próximo login (cubre las
  // sesiones abiertas antes de que existiera ULTIMO_MAIL_KEY). Máx. 2 s: el
  // logout no espera a una red lenta.
  const id = currentUserId;
  if (id != null) {
    const mail = await Promise.race([
      supabase.from('User').select('Mail').eq('Id_User', id).maybeSingle()
        .then(({ data }) => data?.Mail ?? null).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (mail) await recordarUltimoMail(mail);
  }
  // Si entró con Google / Facebook / Apple, cortar también esa sesión
  supabaseSocial.auth.signOut({ scope: 'local' }).catch(() => {});
  currentUserId = null;
  modoActual = MODO_DUENO;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(MODO_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      await SecureStore.deleteItemAsync(MODO_KEY);
    }
  } catch {
    // noop
  }
}

// ─────────────────────────────────────────────
// ÚLTIMO MAIL (para precargar el login)
// ─────────────────────────────────────────────

export async function recordarUltimoMail(mail) {
  const limpio = String(mail ?? '').trim().toLowerCase();
  if (!limpio.includes('@')) return;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ULTIMO_MAIL_KEY, limpio);
    } else {
      await SecureStore.setItemAsync(ULTIMO_MAIL_KEY, limpio);
    }
  } catch {
    // noop
  }
}

/**
 * En web se lee SINCRÓNICO para usarlo como valor inicial del campo: si el
 * campo arranca vacío, el gestor de contraseñas del navegador lo puede llenar
 * con un usuario guardado viejo (ej. un teléfono) antes de que llegue el mail.
 */
export function getUltimoMailWeb() {
  try {
    return Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? (localStorage.getItem(ULTIMO_MAIL_KEY) ?? '')
      : '';
  } catch {
    return '';
  }
}

export async function getUltimoMail() {
  if (Platform.OS === 'web') return getUltimoMailWeb();
  try {
    return (await SecureStore.getItemAsync(ULTIMO_MAIL_KEY)) ?? '';
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────
// MODO DE LA APP (dueño / paseador)
// ─────────────────────────────────────────────
// Una misma cuenta puede ser dueño y paseador a la vez. El modo decide qué
// "app" se abre al arrancar: la de dueños (Home) o Zooni Paseadores. Se guarda
// aparte del id para que reabrir la app te deje donde estabas trabajando.

const MODO_KEY = 'zooni_modo';
export const MODO_DUENO = 'dueno';
export const MODO_PASEADOR = 'paseador';

let modoActual = MODO_DUENO;

export function getModo() {
  return modoActual;
}

export async function setModo(modo) {
  modoActual = modo === MODO_PASEADOR ? MODO_PASEADOR : MODO_DUENO;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MODO_KEY, modoActual);
    } else {
      await SecureStore.setItemAsync(MODO_KEY, modoActual);
    }
  } catch {
    // Sin storage: el modo dura lo que dure la app abierta.
  }
}

/** Lee el modo guardado al arrancar (por defecto, dueño). */
export async function loadStoredModo() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(MODO_KEY) : null)
      : await SecureStore.getItemAsync(MODO_KEY);
    modoActual = raw === MODO_PASEADOR ? MODO_PASEADOR : MODO_DUENO;
  } catch {
    modoActual = MODO_DUENO;
  }
  return modoActual;
}
