import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { perfilesPorId } from './perfilesPublicos';

const INTERVALO_MS = 2 * 60 * 1000;
const LATIDO_MINIMO_MS = 90 * 1000;

let ultimoLatido = 0;

export async function marcarPresencia(forzar = false) {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (!forzar && AppState.currentState && AppState.currentState !== 'active') return;
  const ahora = Date.now();
  if (!forzar && ahora - ultimoLatido < LATIDO_MINIMO_MS) return;
  ultimoLatido = ahora;

  try {
    await supabase
      .from('User')
      .update({ UltimaConexion: new Date().toISOString() })
      .eq('Id_User', userId);
  } catch {
  }
}

export function iniciarLatidoPresencia() {
  marcarPresencia(true);
  const intervalo = setInterval(() => marcarPresencia(), INTERVALO_MS);
  return () => clearInterval(intervalo);
}

export async function fetchUltimasConexiones(ids = []) {
  if (!ids.length) return new Map();
  try {
    const data = await perfilesPorId(ids, 'Id_User, UltimaConexion');
    return new Map(data.map((u) => [u.Id_User, u.UltimaConexion ?? null]));
  } catch {
    return new Map();
  }
}
