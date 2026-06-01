/**
 * matchApi.js — Llamadas HTTP al módulo Match + fallback demo local.
 */

import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  DEMO_PERFILES,
  DEMO_PRE_LIKES,
  DEFAULT_FILTROS,
} from '../data/matchDemo';
import { API_TIMEOUT_MS } from '../config/apiConfig';

const BASE_URL = 'http://10.0.2.2:5000/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: API_TIMEOUT_MS });

api.interceptors.request.use(async (config) => {
  let token = null;
  if (Platform.OS === 'web') {
    token = localStorage.getItem('jwt_token');
  } else {
    token = await SecureStore.getItemAsync('jwt_token');
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Estado demo en memoria (solo cuando no hay backend)
let demoSkips = new Set();
let demoLikes = new Set();
let demoFiltros = { ...DEFAULT_FILTROS };

function applyDemoFiltros(list, filtros) {
  let result = [...list];
  if (!filtros.tipos_mascota?.includes('cualquiera') && filtros.tipos_mascota?.length) {
    result = result.filter((p) => filtros.tipos_mascota.includes(p.mascota.especie));
  }
  if (filtros.intereses?.length) {
    result = result.filter((p) =>
      p.intereses.some((i) => filtros.intereses.includes(i))
    );
  }
  if (filtros.distancia_max_km) {
    result = result.filter((p) => p.distancia_km <= filtros.distancia_max_km);
  }
  if (filtros.solo_cercanos) {
    result = result.filter((p) => p.distancia_km < 5);
  }
  return result;
}

function filterDemoPerfiles() {
  const unseen = DEMO_PERFILES.filter(
    (p) => !demoSkips.has(p.usuario_id) && !demoLikes.has(p.usuario_id)
  );
  return applyDemoFiltros(unseen, demoFiltros);
}

/** Perfiles demo listos al instante (sin esperar red). */
export function getDemoPerfilesSnapshot() {
  return filterDemoPerfiles();
}

function countDemoPreview(filtros) {
  return applyDemoFiltros(DEMO_PERFILES, filtros).length;
}

export async function fetchMatchPerfiles(lat, lng, cursor) {
  try {
    const res = await api.get('/match/perfiles', {
      params: { lat, lng, cursor },
    });
    return res.data;
  } catch {
    const perfiles = filterDemoPerfiles();
    return {
      perfiles,
      cursor_siguiente: null,
      hay_mas: false,
    };
  }
}

export async function postMatchLike(usuarioDestinoId) {
  try {
    const res = await api.post('/match/like', { usuario_destino_id: usuarioDestinoId });
    return res.data;
  } catch {
    demoLikes.add(usuarioDestinoId);
    const perfil = DEMO_PERFILES.find((p) => p.usuario_id === usuarioDestinoId);
    if (DEMO_PRE_LIKES.includes(usuarioDestinoId)) {
      return {
        match: true,
        match_id: `mx-${usuarioDestinoId}`,
        chat_id: `ch-${usuarioDestinoId}`,
        usuario_match: {
          nombre: perfil?.nombre ?? 'Usuario',
          foto_perfil_url: perfil?.foto_perfil_url ?? null,
        },
      };
    }
    return { match: false };
  }
}

export async function postMatchSkip(usuarioDestinoId) {
  try {
    await api.post('/match/skip', { usuario_destino_id: usuarioDestinoId });
  } catch {
    demoSkips.add(usuarioDestinoId);
  }
}

export async function fetchMatchFiltros() {
  try {
    const res = await api.get('/match/filtros');
    return res.data;
  } catch {
    return { ...demoFiltros };
  }
}

export async function putMatchFiltros(filtros) {
  try {
    await api.put('/match/filtros', filtros);
    return { mensaje: 'Filtros actualizados correctamente' };
  } catch {
    demoFiltros = { ...filtros };
    demoSkips = new Set();
    demoLikes = new Set();
    return { mensaje: 'Filtros actualizados correctamente' };
  }
}

export async function previewMatchFiltros(filtros) {
  try {
    const res = await api.get('/match/filtros/preview', { params: filtros });
    return res.data;
  } catch {
    return { cantidad: countDemoPreview(filtros) };
  }
}

/** Reinicia historial demo (útil tras resetear filtros) */
export function resetDemoMatchState() {
  demoSkips = new Set();
  demoLikes = new Set();
}
