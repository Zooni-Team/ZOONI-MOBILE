import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../lib/supabase';
import { getSettings } from '../services/settingsStore';

const ULTIMO_MAIL_KEY = 'zooni_ultimo_mail';

let currentUserId = null;

let resolverSesion;
const sesionLista = new Promise((resolve) => { resolverSesion = resolve; });
let sesionResuelta = false;

function marcarSesionResuelta() {
  if (sesionResuelta) return;
  sesionResuelta = true;
  resolverSesion(currentUserId);
}

export function getCurrentUserId() {
  return currentUserId;
}

export function haySesion() {
  return currentUserId != null;
}

export function esperarSesion() {
  return sesionLista;
}

export async function setCurrentUserId(id, mail) {
  currentUserId = id;
  marcarSesionResuelta();
  if (mail) recordarUltimoMail(mail);
}

const ESPERAS_REINTENTO_MS = [600, 1800];
const esErrorPasajero = (error) => {
  const status = Number(error?.status ?? error?.context?.status ?? 0);
  return (!error?.code && status === 0) || status >= 500
    || /fetch|network|timeout|conexi/i.test(String(error?.message ?? ''));
};

async function cuentaDeLaSesionConReintentos() {
  for (let intento = 0; ; intento += 1) {
    let respuesta;
    try {
      respuesta = await supabase.rpc('login_social');
    } catch (e) {
      respuesta = { data: null, error: e };
    }
    const { data, error } = respuesta;
    if (!error) return data;
    if (!esErrorPasajero(error) || intento >= ESPERAS_REINTENTO_MS.length) return null;
    await new Promise((r) => setTimeout(r, ESPERAS_REINTENTO_MS[intento]));
  }
}

export async function restaurarSesion() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      currentUserId = null;
      return null;
    }
    const cuenta = await cuentaDeLaSesionConReintentos();
    currentUserId = cuenta && !cuenta.nuevo ? cuenta.id : null;
    return currentUserId;
  } catch {
    currentUserId = null;
    return null;
  } finally {
    marcarSesionResuelta();
  }
}

export async function clearCurrentUserId() {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }));
  const mail = data?.session?.user?.email;
  if (mail) await recordarUltimoMail(mail);

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
  }
}

export async function recordarUltimoMail(mail) {
  if (!getSettings().device.recordar_mail) { await olvidarUltimoMail(); return; }
  const limpio = String(mail ?? '').trim().toLowerCase();
  if (!limpio.includes('@')) return;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ULTIMO_MAIL_KEY, limpio);
    } else {
      await SecureStore.setItemAsync(ULTIMO_MAIL_KEY, limpio);
    }
  } catch {
  }
}

export async function olvidarUltimoMail() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(ULTIMO_MAIL_KEY);
    } else {
      await SecureStore.deleteItemAsync(ULTIMO_MAIL_KEY);
    }
  } catch {
  }
}

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

const MODO_KEY = 'zooni_modo';
export const MODO_DUENO = 'dueno';
export const MODO_PASEADOR = 'paseador';
const TIPOS_NEGOCIO_VALIDOS = ['veterinaria', 'peluqueria', 'petshop'];

export const modoNegocio = (tipo) => `negocio:${tipo}`;

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
  }
}

const PASEADOR_KEY = 'zooni_paseador_id';
let paseadorId = null;

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
