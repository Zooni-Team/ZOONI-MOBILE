/**
 * authLegado.js — SOLO PARA LA TRANSICIÓN. Borrar cuando la Edge Function
 * `migrar-cuenta` esté desplegada (ver README → "Pasar a Supabase Auth").
 *
 * Es el login de antes: la app hashea la contraseña con SHA-256 sin sal y la
 * RPC login_user (021) la compara. Tiene los problemas que marcó la
 * devolución (el hash ES la contraseña para quien lo ve pasar, y la sesión no
 * tiene JWT), por eso:
 *   · sólo se usa si migrar-cuenta no responde (no está desplegada), y
 *   · la sesión NO se guarda en el dispositivo: dura lo que la app abierta.
 * Con 061_rls_por_usuario.sql aplicado, login_user deja de estar expuesta y
 * este camino ya no funciona (que es lo buscado).
 */

import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

export async function loginLegado(mail, password) {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  const { data, error } = await supabase.rpc('login_user', { p_mail: mail, p_hash: hash });
  if (error) {
    // Sin permiso = 061 ya aplicado: la cuenta tiene que migrarse sí o sí
    if (error.code === '42501') throw new Error('credenciales');
    throw error;
  }
  if (!data) throw new Error('credenciales');
  return { ...data, legado: true };
}
