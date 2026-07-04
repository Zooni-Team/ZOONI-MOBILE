/**
 * session.js — Sesión del usuario actual (sin JWT propio todavía).
 *
 * Después del login, el id del usuario se guarda acá (memoria + storage) y
 * todos los servicios lo leen con getCurrentUserId() al momento de armar cada
 * query. Mientras nadie inició sesión, se usa el usuario demo (id 1) para que
 * las pantallas sigan mostrando datos al desarrollar.
 *
 * Cuando se migre a Supabase Auth, este archivo pasa a leer
 * supabase.auth.getSession() y el resto de la app no cambia.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'zooni_user_id';
const DEMO_USER_ID = 1;

let currentUserId = DEMO_USER_ID;

/** Id del usuario "logueado" que usan todas las queries. */
export function getCurrentUserId() {
  return currentUserId;
}

/** Guarda la sesión tras un login exitoso. */
export async function setCurrentUserId(id) {
  currentUserId = id;
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
    if (raw) {
      currentUserId = parseInt(raw, 10);
      return currentUserId;
    }
    return null;
  } catch {
    return null;
  }
}

/** Borra la sesión (logout). Vuelve al usuario demo para no romper pantallas abiertas. */
export async function clearCurrentUserId() {
  currentUserId = DEMO_USER_ID;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch {
    // noop
  }
}
