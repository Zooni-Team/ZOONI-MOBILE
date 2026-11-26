import { Platform } from 'react-native';

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
    upload_quality: 'medium',
    download_quality: 'auto',
    live_walk_quality: 'auto',
    autoplay: 'wifi',
    mute_videos: true,
    wifi_only_downloads: false,
    preload_feed: false,
    save_photos: false,
    recordar_mail: true,
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
    } catch {  }
  }
  return null;
}

function persistir(settings) {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {  }
  }
}

export function getSettings() {
  if (!cache) {
    const guardado = cargarPersistido();
    cache = clonar(DEFAULTS);
    if (guardado) {
      for (const seccion of Object.keys(DEFAULTS)) {
        Object.assign(cache[seccion], guardado[seccion] ?? {});
      }
    }
  }
  return cache;
}

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

export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
