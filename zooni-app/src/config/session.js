/**
 * session.js — Quién es el usuario actual de la app.
 *
 * La IDENTIDAD es la sesión de Supabase Auth (src/lib/supabase.js): un JWT
 * firmado por Supabase que viaja en cada consulta y que la base traduce a un
 * "Id_User" con usuario_actual() (060_auth_supabase.sql). Las políticas de RLS
 * deciden con eso, no con nada que diga la app.
 *
 * Este módulo sólo guarda en memoria el Id_User de esa sesión, para que los
 * servicios armen sus consultas (".eq('Id_User', getCurrentUserId())"). Ese
 * número es una comodidad, no una prueba: si alguien lo cambiara, la base
 * igual le devolvería sólo lo que su JWT permite.
 *
 * Al arrancar, restaurarSesion() lee la sesión guardada por Supabase Auth y le
 * pregunta a la base a qué cuenta corresponde (RPC login_social). Sin sesión,
 * el id es null: las consultas no devuelven nada en vez de devolver datos de
 * otro (falla cerrado).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../lib/supabase';

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
 * Id_User de la sesión actual.
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
 * Espera a que la sesión esté restaurada.
 * Resuelve con el id, o con null si no había sesión.
 */
export function esperarSesion() {
  return sesionLista;
}

/**
 * Registra el Id_User de la sesión recién iniciada (lo llaman los flujos de
 * login después de supabase.auth.signInWithPassword / OAuth + login_social).
 */
export async function setCurrentUserId(id, mail) {
  currentUserId = id;
  marcarSesionResuelta();
  if (mail) recordarUltimoMail(mail);
}

/**
 * Al arrancar la app: ¿hay una sesión de Supabase Auth guardada? Si la hay,
 * se pregunta a la base qué cuenta es. Devuelve el Id_User o null.
 */
export async function restaurarSesion() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      currentUserId = null;
      return null;
    }
    const { data: cuenta, error } = await supabase.rpc('login_social');
    currentUserId = !error && cuenta && !cuenta.nuevo ? cuenta.id : null;
    return currentUserId;
  } catch {
    currentUserId = null;
    return null;
  } finally {
    marcarSesionResuelta();
  }
}


/** Cierra la sesión (logout). Queda sin usuario: nadie hereda datos ajenos. */
export async function clearCurrentUserId() {
  // Antes de olvidar la cuenta, guardar su mail para el próximo login.
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }));
  const mail = data?.session?.user?.email;
  if (mail) await recordarUltimoMail(mail);

  // scope 'local': cierra la sesión de ESTE dispositivo (borra los tokens
  // guardados). El refresh token deja de servir del lado del servidor.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  currentUserId = null;
  modoActual = MODO_DUENO;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(MODO_KEY);
    } else {
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
// Una misma cuenta puede ser dueño, paseador y tener negocios (veterinaria,
// peluquería, pet shop) a la vez. El modo decide qué "app" se abre al
// arrancar: la de dueños (Home), Zooni Paseadores o la de uno de sus negocios
// ('negocio:veterinaria'…). Se guarda aparte del id para que reabrir la app
// te deje donde estabas trabajando.

const MODO_KEY = 'zooni_modo';
export const MODO_DUENO = 'dueno';
export const MODO_PASEADOR = 'paseador';
const TIPOS_NEGOCIO_VALIDOS = ['veterinaria', 'peluqueria', 'petshop'];

/** 'veterinaria' → 'negocio:veterinaria' */
export const modoNegocio = (tipo) => `negocio:${tipo}`;

/** 'negocio:petshop' → 'petshop'; cualquier otro modo → null */
export function tipoNegocioDeModo(modo) {
  const tipo = String(modo ?? '').startsWith('negocio:') ? modo.slice(8) : null;
  return TIPOS_NEGOCIO_VALIDOS.includes(tipo) ? tipo : null;
}

function modoValido(modo) {
  if (modo === MODO_PASEADOR) return MODO_PASEADOR;
  if (tipoNegocioDeModo(modo)) return modo;
  return MODO_DUENO;
}

let modoActual = MODO_DUENO;

export function getModo() {
  return modoActual;
}

export async function setModo(modo) {
  modoActual = modoValido(modo);
  if (modoActual === MODO_PASEADOR) await recordarModoPaseador();
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

// ¿Esta cuenta ya entró alguna vez a Zooni Paseadores en este dispositivo?
// El menú del dueño lo usa para ofrecer "Cambiar a modo paseador" aunque la
// base no devuelva el rol (ej. la app de paseador corriendo en modo demo, o
// sin red): si pudo ir de paseador a dueño, tiene que poder volver. Se guarda
// el id (no un sí/no) para que otra cuenta del mismo dispositivo no lo herede.
const PASEADOR_KEY = 'zooni_paseador_id';
let paseadorId = null;

/** Marca la cuenta logueada como usuaria de Zooni Paseadores. */
export async function recordarModoPaseador() {
  if (currentUserId == null) return;
  paseadorId = String(currentUserId);
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(PASEADOR_KEY, paseadorId);
    } else {
      await SecureStore.setItemAsync(PASEADOR_KEY, paseadorId);
    }
  } catch {
    // Sin storage: vale mientras la app siga abierta.
  }
}

export async function usoModoPaseador() {
  if (currentUserId == null) return false;
  if (paseadorId == null) {
    try {
      paseadorId = Platform.OS === 'web'
        ? (typeof localStorage !== 'undefined' ? localStorage.getItem(PASEADOR_KEY) : null)
        : await SecureStore.getItemAsync(PASEADOR_KEY);
    } catch {
      paseadorId = null;
    }
  }
  return paseadorId === String(currentUserId);
}

/** Lee el modo guardado al arrancar (por defecto, dueño). */
export async function loadStoredModo() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(MODO_KEY) : null)
      : await SecureStore.getItemAsync(MODO_KEY);
    modoActual = modoValido(raw);
  } catch {
    modoActual = MODO_DUENO;
  }
  return modoActual;
}
