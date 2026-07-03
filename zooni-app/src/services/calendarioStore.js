/**
 * calendarioStore.js — Persistencia local temporal de eventos del Calendario de Cuidados
 *
 * Mientras no hay backend de calendario conectado, los eventos creados desde
 * CalendarioScreen (alta manual) o desde EventosScreen ("Agregar al calendario")
 * se guardan acá para que ambas pantallas vean los mismos datos.
 *
 * Cuando se conecte la API real (GET/POST/PUT/DELETE /api/mascotas/:petId/eventos),
 * este módulo se reemplaza por llamadas a services/api.js sin tocar las pantallas
 * (misma forma: getEventosCalendario / setEventosCalendario).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'zooni_calendario_eventos_demo';

async function leerRaw() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function escribirRaw(eventos) {
  try {
    const raw = JSON.stringify(eventos);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, raw);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, raw);
    }
  } catch {
    // Sin almacenamiento disponible: se pierde al cerrar la app, no es crítico en demo.
  }
}

/** Devuelve los eventos guardados, o `defaults` si todavía no se guardó nada. */
export async function getEventosCalendario(defaults = []) {
  const guardados = await leerRaw();
  return guardados ?? defaults;
}

/** Reemplaza la lista completa de eventos guardados. */
export async function setEventosCalendario(eventos) {
  await escribirRaw(eventos);
}

/** Agrega un evento a la lista guardada (creando la lista si hace falta). */
export async function agregarEventoCalendario(evento, defaults = []) {
  const actuales = await getEventosCalendario(defaults);
  if (actuales.some((e) => e.id === evento.id)) return actuales;
  const nuevos = [...actuales, evento];
  await escribirRaw(nuevos);
  return nuevos;
}
