/**
 * zoonivetApi.js — Cliente de ZooniVet (thin client).
 *
 * REFACTOR DE SEGURIDAD: ya no se llama a Groq desde el frontend. Toda la parte
 * sensible (la GROQ_API_KEY, el system prompt, la detección de emergencias y el
 * filtro de salida) vive en la Edge Function `zoonivet-chat`
 * (supabase/functions/zoonivet-chat/index.ts). Este archivo solo:
 *   - Pide el contexto de la mascota a la RPC get_pet_chat_context (migracion_22.sql),
 *     que es la única fuente de ese contexto y lo devuelve ya calculado.
 *   - Invoca la Edge Function con { petId, mensaje, historial, usuario }.
 *
 * La key nunca toca el bundle del cliente.
 */

import { supabase } from '../lib/supabase';
import { fetchMisMascotas } from './petsApi';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const CHAT_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/zoonivet-chat` : '';

// ─── CONTEXTO DE LA MASCOTA ──────────────────────────────────────────────────

/**
 * Contexto completo de una mascota para el chat, calculado en el servidor
 * (RPC get_pet_chat_context). Lo usa la pantalla para los chips de sugerencia
 * y para habilitar el input. Devuelve null si la mascota no existe.
 */
export async function construirContextoMascota(petId) {
  if (petId == null) return null;
  const { data, error } = await supabase.rpc('get_pet_chat_context', { p_pet_id: petId });
  if (error) throw error;
  return data ?? null;
}

/** Lista de mascotas activas para el selector (id, nombre, raza, imagen). */
export async function fetchMascotasParaChat() {
  const { activas } = await fetchMisMascotas();
  return activas;
}

// ─── LLAMADA A LA EDGE FUNCTION ──────────────────────────────────────────────

/**
 * Pregunta a ZooniVet. Manda solo el id de la mascota (el backend reconstruye
 * el contexto), el historial reciente y el mensaje nuevo. Devuelve
 * { texto, emergencia }. El AbortSignal permite el botón "detener".
 */
export async function preguntarZooniVet({ ctx, usuario, historial = [], mensaje, signal }) {
  if (!CHAT_FN_URL) {
    const err = new Error('Falta EXPO_PUBLIC_SUPABASE_URL en el .env de zooni-app.');
    err.code = 'SIN_BACKEND';
    throw err;
  }

  const ventana = historial
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  let res;
  try {
    res = await fetch(CHAT_FN_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        petId: ctx?.id,
        usuario: usuario?.nombre ? { nombre: usuario.nombre } : null,
        historial: ventana,
        mensaje: String(mensaje ?? '').slice(0, 1000),
      }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    const err = new Error('No se pudo contactar al servidor de ZooniVet.');
    err.code = 'NETWORK';
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.message || `El servidor respondió ${res.status}`);
    err.code = data?.error || (res.status === 429 ? 'RATE_LIMIT' : 'GROQ_ERROR');
    err.status = res.status;
    throw err;
  }

  if (!data?.texto) {
    const err = new Error('Respuesta vacía o descartada.');
    err.code = 'RESPUESTA_INVALIDA';
    throw err;
  }

  return { texto: data.texto, emergencia: !!data.emergencia };
}

// ─── CHIPS DE SUGERENCIA personalizados ──────────────────────────────────────

export function sugerenciasIniciales(ctx) {
  if (!ctx) return [];
  const nombre = ctx.nombre ?? 'tu mascota';
  const base = [
    `¿Qué vacunas le faltan a ${nombre}?`,
    '¿Cuánto debería pesar?',
    '¿Cada cuánto lo saco a pasear?',
    '¿Qué comida le hace mal?',
  ];
  const pendientes = Array.isArray(ctx.vacunasPendientes) ? ctx.vacunasPendientes : [];
  if (pendientes.some((v) => /vencida/i.test(v))) {
    base[0] = 'Tiene una vacuna vencida, ¿qué hago?';
  }
  return base;
}
