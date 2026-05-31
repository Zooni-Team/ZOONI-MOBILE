/**
 * api.js — Capa de comunicación con el backend de Zooni
 *
 * Centraliza todas las llamadas HTTP a la API REST.
 * Usa axios con un interceptor que adjunta el JWT automáticamente.
 *
 * BASE_URL apunta al backend local (emulador Android usa 10.0.2.2 en vez de localhost)
 * Para producción, cambiar BASE_URL por la URL del servidor real.
 *
 * Funciones exportadas:
 *   Token:         getStoredToken, saveToken, clearToken
 *   Home:          fetchHome, fetchHomeConfig, saveHomeConfig
 *   Mascotas:      activarMascota
 *   Notificaciones: fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// URL base del backend — cambiar en producción
const BASE_URL = 'http://10.0.2.2:5000/api/v1';

// Instancia de axios con la URL base configurada
const api = axios.create({ baseURL: BASE_URL });

// Interceptor: antes de cada request, adjunta el token JWT en el header
api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────
// MANEJO DEL TOKEN JWT
// SecureStore (mobile) vs localStorage (web)
// ─────────────────────────────────────────────

/** Lee el token guardado. Retorna null si no existe. */
export async function getStoredToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem('jwt_token');
  }
  return SecureStore.getItemAsync('jwt_token');
}

/** Guarda el token después de un login exitoso. */
export async function saveToken(token) {
  if (Platform.OS === 'web') {
    localStorage.setItem('jwt_token', token);
    return;
  }
  await SecureStore.setItemAsync('jwt_token', token);
}

/** Elimina el token al cerrar sesión. */
export async function clearToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem('jwt_token');
    return;
  }
  await SecureStore.deleteItemAsync('jwt_token');
}

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────

/**
 * GET /home
 * Trae en una sola llamada: usuario, mascota activa y badge de notificaciones.
 * Si falla (sin backend), HomeScreen usa DEMO_DATA como fallback.
 */
export async function fetchHome() {
  const res = await api.get('/home');
  return res.data;
}

/**
 * GET /home/config
 * Trae la configuración de botones personalizados del usuario.
 * Si el usuario nunca personalizó, el backend devuelve los 3 botones default.
 */
export async function fetchHomeConfig() {
  const res = await api.get('/home/config');
  return res.data;
}

/**
 * PUT /home/config
 * Guarda el nuevo orden/visibilidad de botones tras editar desde los FABs.
 * @param {object} config - { botones: [{seccion, orden, visible}] }
 */
export async function saveHomeConfig(config) {
  await api.put('/home/config', config);
}

// ─────────────────────────────────────────────
// MASCOTAS
// ─────────────────────────────────────────────

/**
 * PATCH /mascotas/:id/activar
 * Cambia la mascota activa del usuario (la que se muestra en la Home).
 */
export async function activarMascota(mascotaId) {
  await api.patch(`/mascotas/${mascotaId}/activar`);
}

// ─────────────────────────────────────────────
// NOTIFICACIONES
// ─────────────────────────────────────────────

/**
 * GET /notificaciones
 * Trae la lista paginada de notificaciones del usuario.
 * @param {number} page - Página actual (default 1)
 * @param {number} limit - Cantidad por página (default 20)
 * @param {boolean} soloNoLeidas - Si true, filtra solo las no leídas
 */
export async function fetchNotificaciones(page = 1, limit = 20, soloNoLeidas = false) {
  const res = await api.get('/notificaciones', {
    params: { page, limit, leidas: soloNoLeidas ? 'false' : undefined },
  });
  return res.data;
}

/**
 * PATCH /notificaciones/:id/leer
 * Marca una notificación individual como leída al tocarla.
 */
export async function marcarNotificacionLeida(id) {
  await api.patch(`/notificaciones/${id}/leer`);
}

/**
 * PATCH /notificaciones/leer-todas
 * Marca todas las notificaciones como leídas. Se llama al abrir el panel.
 */
export async function marcarTodasLeidas() {
  await api.patch('/notificaciones/leer-todas');
}
