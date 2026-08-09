/**
 * moderacionApi.js — Bloquear y reportar usuarios (migración 029)
 *
 * Bloquear: el usuario deja de aparecerte en Match. Reportar: queda un
 * registro para que lo revise el equipo. Todo filtrado por el usuario logueado.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { sanitizarTexto } from '../utils/sanitizar';

export const MOTIVOS_REPORTE = [
  { value: 'spam',        label: 'Spam o estafa' },
  { value: 'inapropiado', label: 'Contenido inapropiado' },
  { value: 'acoso',       label: 'Acoso o insultos' },
  { value: 'falso',       label: 'Perfil falso' },
  { value: 'otro',        label: 'Otro' },
];

/** Ids de usuarios que bloqueé (para excluirlos de Match/Comunidad). */
export async function fetchIdsBloqueados() {
  const { data } = await supabase
    .from('usuarios_bloqueados').select('bloqueado_id')
    .eq('usuario_id', getCurrentUserId());
  return new Set((data ?? []).map((r) => r.bloqueado_id));
}

/** Bloquea a un usuario (idempotente). */
export async function bloquearUsuario(usuarioId) {
  const { error } = await supabase.from('usuarios_bloqueados')
    .upsert({ usuario_id: getCurrentUserId(), bloqueado_id: usuarioId },
      { onConflict: 'usuario_id,bloqueado_id' });
  if (error) throw error;
  return true;
}

/** Desbloquea a un usuario. */
export async function desbloquearUsuario(usuarioId) {
  const { error } = await supabase.from('usuarios_bloqueados').delete()
    .eq('usuario_id', getCurrentUserId()).eq('bloqueado_id', usuarioId);
  if (error) throw error;
  return true;
}

/** Reporta a un usuario con un motivo y un detalle opcional. */
export async function reportarUsuario(usuarioId, motivo, detalle = null) {
  const { error } = await supabase.from('reportes').insert({
    usuario_id: getCurrentUserId(),
    reportado_id: usuarioId,
    motivo: sanitizarTexto(motivo, 60) ?? 'otro',
    detalle: sanitizarTexto(detalle, 500),
  });
  if (error) throw error;
  return true;
}
