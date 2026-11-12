/**
 * intervalos.js — Cada cuánto se refresca lo que no llega en tiempo real.
 *
 * Los chats llegan por Supabase Realtime (hooks/useRecargaEnVivo); el resto
 * se consulta periódicamente. Tener los valores juntos permite ver de un
 * vistazo cuánto trabajo le genera cada pantalla a la base.
 */

/**
 * Chat abierto: consulta de respaldo por si el socket de Realtime se cortó.
 * Los mensajes nuevos llegan al instante por Realtime, no por esto.
 */
export const INTERVALO_CHAT_RESPALDO_MS = 30000;

/** Hora "de ahora" en un chat abierto (separadores Hoy / Ayer). */
export const INTERVALO_RELOJ_CHAT_MS = 60000;

/** Bandeja de conversaciones de un negocio. */
export const INTERVALO_BANDEJA_MS = 15000;

/** Listas que cambian poco (turnos, badges del negocio). */
export const INTERVALO_LISTAS_MS = 30000;
