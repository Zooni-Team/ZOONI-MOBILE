/**
 * chatStore.js — Persistencia local temporal de mensajes de Match
 *
 * Mientras no hay backend de chat conectado, los mensajes de cada conversación
 * (una por chat_id, creado automáticamente al hacer match) se guardan acá.
 *
 * Cuando se conecte la API real (GET/POST /api/chats/:chatId/mensajes, sockets, etc.),
 * este módulo se reemplaza por llamadas a services/api.js sin tocar ChatScreen
 * (misma forma: getMensajes / agregarMensaje).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'zooni_chats_demo';

async function leerTodos() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function escribirTodos(chats) {
  try {
    const raw = JSON.stringify(chats);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, raw);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, raw);
    }
  } catch {
    // Sin almacenamiento disponible: se pierde al cerrar la app, no es crítico en demo.
  }
}

/** Devuelve los mensajes de un chat, ordenados del más viejo al más nuevo. */
export async function getMensajes(chatId) {
  const chats = await leerTodos();
  return chats[chatId] ?? [];
}

/** Agrega un mensaje a un chat y devuelve la lista actualizada. */
export async function agregarMensaje(chatId, mensaje) {
  const chats = await leerTodos();
  const actuales = chats[chatId] ?? [];
  const nuevos = [...actuales, mensaje];
  chats[chatId] = nuevos;
  await escribirTodos(chats);
  return nuevos;
}

/** Borra todas las conversaciones guardadas (se llama al iniciar la app). */
export async function resetChats() {
  await escribirTodos({});
}
