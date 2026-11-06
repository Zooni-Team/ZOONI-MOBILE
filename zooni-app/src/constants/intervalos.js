/**
 * intervalos.js — Cada cuánto se refresca lo que no llega en tiempo real.
 *
 * La app consulta periódicamente (no usa Supabase Realtime todavía). Tener los
 * valores juntos permite ver de un vistazo cuánto trabajo le genera cada
 * pantalla a la base. Pendiente: pasar los chats a Realtime (README).
 */

/** Chat abierto: mensajes nuevos. */
export const INTERVALO_CHAT_MS = 4000;

/** Bandeja de conversaciones de un negocio. */
export const INTERVALO_BANDEJA_MS = 15000;

/** Listas que cambian poco (turnos, badges del negocio). */
export const INTERVALO_LISTAS_MS = 30000;
