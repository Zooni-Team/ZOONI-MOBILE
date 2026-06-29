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
import { API_TIMEOUT_MS } from '../config/apiConfig';

// URL base del backend — cambiar en producción
// IMPORTANTE: Para emulador Android usar 10.0.2.2 en vez de localhost
// Para iOS simulator usar localhost
// Para dispositivo físico usar la IP de tu PC (ej: 192.168.1.x)
const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5165/api/v1',
  ios: 'http://localhost:5165/api/v1',
  default: 'http://localhost:5165/api/v1', // web
});

// ─────────────────────────────────────────────
// CACHÉ DEL TOKEN EN MEMORIA (fix del bloqueo)
// ─────────────────────────────────────────────
let tokenCache = null;
let tokenCacheRead = false; // ← flag para no releer SecureStore si ya cargamos
let tokenPromise = null;

// Instancia de axios con la URL base configurada
const api = axios.create({ 
  baseURL: BASE_URL,
  timeout: 10000, // 10s timeout para evitar esperas infinitas
});

// Interceptor: antes de cada request, adjunta el token JWT en el header
api.interceptors.request.use(async (config) => {
  // Usar el token cacheado en memoria (instantáneo)
  if (tokenCache) {
    config.headers.Authorization = `Bearer ${tokenCache}`;
    return config;
  }

  // Si hay una lectura en progreso, esperar a que termine
  if (tokenPromise) {
    const token = await tokenPromise;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }

  // Primera lectura: leer del disco y cachear
  tokenPromise = getStoredToken();
  const token = await tokenPromise;
  tokenPromise = null;
  
  if (token) {
    tokenCache = token;
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Interceptor de errores: limpiar caché si el token expiró
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido: limpiar caché
      tokenCache = null;
    }
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// MANEJO DEL TOKEN JWT
// SecureStore (mobile) vs localStorage (web)
// ─────────────────────────────────────────────

/** Lee el token guardado. Retorna null si no existe. */
export async function getStoredToken() {
  if (tokenCacheRead) return tokenCache;
  if (Platform.OS === 'web') {
    tokenCache = localStorage.getItem('jwt_token');
  } else {
    tokenCache = await SecureStore.getItemAsync('jwt_token');
  }
  tokenCacheRead = true;
  return tokenCache;
}

/** Guarda el token después de un login exitoso. */
export async function saveToken(token) {
  tokenCache = token;       // Actualizar caché inmediatamente
  tokenCacheRead = true;    // Marcar como leído para no releer del disco
  if (Platform.OS === 'web') {
    localStorage.setItem('jwt_token', token);
    return;
  }
  await SecureStore.setItemAsync('jwt_token', token);
}

/** Elimina el token al cerrar sesión. */
export async function clearToken() {
  tokenCache = null;        // Limpiar caché
  tokenCacheRead = false;   // Forzar relectura en el próximo acceso
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

// ─────────────────────────────────────────────
// EVENTOS PÚBLICOS
// ─────────────────────────────────────────────

/**
 * GET /eventos
 * Trae los eventos activos y vigentes filtrados por ciudad.
 * Si no se pasa ciudad, devuelve todos los eventos sin filtro geográfico.
 *
 * @param {string|null} ciudad - Nombre de la ciudad (ej: "Buenos Aires")
 * @param {number} page        - Página (default 1)
 * @param {number} limit       - Resultados por página (default 10)
 */
export async function fetchEventos(ciudad = null, page = 1, limit = 10) {
  const params = { page, limit };
  if (ciudad) params.ciudad = ciudad;
  const res = await api.get('/eventos', { params });
  return res.data;
}

/**
 * POST /mascotas/:petId/eventos
 * Agrega un evento al calendario de cuidados de una mascota.
 * Usado por EventosScreen para agregar eventos externos (tipo: "Evento").
 *
 * @param {number} petId - ID de la mascota activa
 * @param {object} body  - { titulo, descripcion, fecha_hora, tipo }
 */
export async function agregarEventoAlCalendario(petId, body) {
  const res = await api.post(`/mascotas/${petId}/eventos`, body);
  return res.data;
}
