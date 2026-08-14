/**
 * presenciaApi.js — Latido de "última vez en línea"
 *
 * La app marca al usuario como activo cada tanto (User.UltimaConexion) y
 * Comunidad usa ese dato para mostrar "En línea" o "Últ. vez hace 20 minutos".
 *
 * Antes lo único parecido era `ubicaciones_usuarios.updated_at`, que solo se
 * actualiza cuando el usuario comparte ubicación: quien no lo hacía figuraba
 * desconectado para siempre.
 *
 * Nada de acá bloquea la UI: si falla el latido, la app sigue igual.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';

// Más seguido que esto no aporta: el umbral de "en línea" es de 5 minutos.
const INTERVALO_MS = 2 * 60 * 1000;

let ultimoLatido = 0;

/**
 * Marca al usuario logueado como activo ahora.
 * @param {boolean} forzar  ignora el intervalo mínimo (login, volver del fondo)
 */
export async function marcarPresencia(forzar = false) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const ahora = Date.now();
  if (!forzar && ahora - ultimoLatido < INTERVALO_MS) return;
  ultimoLatido = ahora;

  try {
    await supabase
      .from('User')
      .update({ UltimaConexion: new Date().toISOString() })
      .eq('Id_User', userId);
  } catch {
    // Sin la columna (migración sin correr) o sin red: la app funciona igual,
    // simplemente no se actualiza la última conexión.
  }
}

/**
 * Arranca el latido periódico. Devuelve la función para frenarlo.
 * Se llama una sola vez desde App.jsx.
 */
export function iniciarLatidoPresencia() {
  marcarPresencia(true);
  const intervalo = setInterval(() => marcarPresencia(), INTERVALO_MS);
  return () => clearInterval(intervalo);
}

/** Última conexión de varios usuarios: Map<idUsuario, ISO string | null>. */
export async function fetchUltimasConexiones(ids = []) {
  if (!ids.length) return new Map();
  try {
    const { data, error } = await supabase
      .from('User')
      .select('Id_User, UltimaConexion')
      .in('Id_User', ids);
    if (error) return new Map();
    return new Map((data ?? []).map((u) => [u.Id_User, u.UltimaConexion ?? null]));
  } catch {
    return new Map();
  }
}
