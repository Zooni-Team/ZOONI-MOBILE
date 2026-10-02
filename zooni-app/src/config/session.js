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

const STORAGE_KEY = 'zooni_user_id';

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

/** Guarda la sesión tras un login exitoso. */
export async function setCurrentUserId(id) {
  currentUserId = id;
  marcarSesionResuelta();
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
