/**
 * settingsStore.js — Preferencias de Configuración (Instruction-Configuracion §4)
 *
 * Tres categorías que NO se mezclan (§4.1):
 *   - Preferencias de CUENTA  (privacy / notifications / wellbeing) → cuando
 *     exista la tabla user_settings en Supabase, acá va el patch al servidor.
 *   - Preferencias de DISPOSITIVO (device) → solo locales, nunca suben.
 *   - Permisos del SO → se leen, nunca se escriben (viven en permisosApi).
 *
 * Hoy todo persiste local (localStorage en web / memoria en nativo hasta que
 * se agregue AsyncStorage). La API ya es asíncrona y con patch parcial para
 * que el cambio a Supabase (update_user_settings) no toque las pantallas.
 */

import { Platform } from 'react-native';

// Defaults obligatorios (§4.2 — promotions y map_posters arrancan en false:
// todo lo comercial y lo ruidoso es opt-in)
export const DEFAULTS = {
  privacy: {
    private_profile: false,
    show_age: true,
    show_zone: 'neighborhood',
    location_sharing: 'friends',
    location_precision: 'approximate',
    live_walk_location: true,
    friend_requests_from: 'everyone',
    messages_from: 'friends',
    visible_in_match: true,
    show_online_status: true,
    read_receipts: true,
  },
  notifications: {
    push_enabled: true,
    messages: true, friend_requests: true, new_match: true,
    likes_comments: true, new_follower: true,
    live_walk: true, vaccine_reminders: true, vet_appointments: true,
    followed_places: true,
    lost_pets_nearby: true, map_posters: false,
    news_tips: true, promotions: false,
    sound: true, vibration: true,
    lockscreen_preview: 'always', email_digest: false,
    dnd_enabled: false, dnd_from: '22:00', dnd_to: '08:00',
  },
  wellbeing: {
    daily_limit_enabled: false, daily_limit_minutes: 60,
    break_reminder: 'never', weekly_summary: true,
  },
  device: {
    theme: 'light',
    text_size: 'normal',
    reduce_motion: false,
    high_contrast: false,
    upload_quality: 'high',
    download_quality: 'auto',
    live_walk_quality: 'auto',
    autoplay: 'wifi',
    mute_videos: true,
    wifi_only_downloads: false,
    preload_feed: false,
    save_photos: false,
  },
};

const STORAGE_KEY = 'zooni_settings_v1';

let cache = null;
const listeners = new Set();

function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function cargarPersistido() {
  if (Platform.OS === 'web') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* storage bloqueado */ }
  }
  return null;
}

function persistir(settings) {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* lleno */ }
  }
}

/** Devuelve las preferencias completas; nunca falla por ausencia (§4.4). */
export function getSettings() {
  if (!cache) {
    const guardado = cargarPersistido();
    cache = clonar(DEFAULTS);
    if (guardado) {
      // merge superficial por sección: claves desconocidas se descartan
      for (const seccion of Object.keys(DEFAULTS)) {
        Object.assign(cache[seccion], guardado[seccion] ?? {});
      }
    }
  }
  return cache;
}

/**
 * Patch parcial optimista: aplica al instante, notifica a los suscriptores y
 * persiste. Devuelve una función rollback() por si el guardado remoto falla
 * (V5: el control vuelve al valor anterior + toast con Reintentar).
 */
export function patchSettings(seccion, patch) {
  const settings = getSettings();
  const previo = clonar(settings[seccion]);
  Object.assign(settings[seccion], patch);
  persistir(settings);
  listeners.forEach((fn) => fn(settings));
  return function rollback() {
    settings[seccion] = previo;
    persistir(settings);
    listeners.forEach((fn) => fn(settings));
  };
}

/** Suscripción para que las pantallas reflejen cambios hechos en otra pantalla. */
export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
