/**
 * calendarioStore.js — Calendario de Cuidados sobre Supabase (tabla eventos_calendario)
 *
 * Reemplaza el storage local (SecureStore/localStorage) que usaban
 * CalendarioScreen y EventosScreen mientras no había backend conectado.
 * Los eventos ahora persisten en Postgres, filtrados por mascota_id.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';

const SEED_KEY = 'zooni_calendario_seed_inicial_hecho';

function mapRow(row) {
  return {
    id: row.id,
    origen: row.origen,
    origenId: row.origen_evento_id ?? undefined,
    titulo: row.titulo,
    descripcion: row.descripcion,
    fecha_hora: row.fecha_hora,
    tipo: row.tipo,
    emoji: row.emoji,
    color: row.color,
  };
}

/** Devuelve los eventos del calendario de `petId`, o `defaults` si falla o no hay petId. */
export async function getEventosCalendario(petId, defaults = []) {
  if (!petId) return defaults;
  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('*')
    .eq('mascota_id', petId)
    .order('fecha_hora', { ascending: true });
  if (error || !data) return defaults;
  return data.map(mapRow);
}

/** Crea un evento manual (alta desde CalendarioScreen). */
export async function crearEventoCalendario(petId, datos) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      mascota_id: petId,
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      fecha_hora: datos.fecha_hora,
      tipo: datos.tipo ?? 'Otro',
      emoji: datos.emoji ?? null,
      color: datos.color ?? null,
      origen: 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Edita un evento manual existente. */
export async function actualizarEventoCalendario(eventoId, datos) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .update({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      fecha_hora: datos.fecha_hora,
      tipo: datos.tipo ?? 'Otro',
      emoji: datos.emoji ?? null,
      color: datos.color ?? null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', eventoId)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Elimina un evento del calendario. */
export async function eliminarEventoCalendario(eventoId) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('id', eventoId);
  if (error) throw error;
}

/**
 * Agrega un evento público (de EventosScreen) al calendario de `petId`.
 * `evento.origenId` es el id del evento público en la tabla `eventos`,
 * usado para no duplicarlo si ya fue agregado antes.
 */
export async function agregarEventoCalendario(petId, evento) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      mascota_id: petId,
      titulo: evento.titulo,
      descripcion: evento.descripcion ?? null,
      fecha_hora: evento.fecha_hora,
      tipo: evento.tipo ?? 'Evento',
      emoji: evento.emoji ?? null,
      color: evento.color ?? null,
      origen: 'eventos',
      origen_evento_id: evento.origenId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/**
 * Sembrado inicial (una sola vez por dispositivo): los eventos públicos que
 * ya vienen marcados `ya_en_calendario: true` se copian al calendario la
 * primera vez que se abre EventosScreen. Después de esa vez, si el usuario
 * los elimina del calendario NO vuelven a aparecer solos.
 */
export async function yaSeSembroInicial() {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem(SEED_KEY) : null)
      : await SecureStore.getItemAsync(SEED_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function marcarSembradoInicial() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(SEED_KEY, '1');
    } else {
      await SecureStore.setItemAsync(SEED_KEY, '1');
    }
  } catch {
    // noop
  }
}
