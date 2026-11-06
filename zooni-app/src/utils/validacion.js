/**
 * validacion.js — Reglas de formularios compartidas (login, registro, perfil).
 *
 * Son para AVISAR rápido en la pantalla. La garantía la da el servidor:
 * Supabase Auth valida la contraseña y la base el mail único
 * (supabase/SUPABASE_PEGAR_TODO.sql (sección 053)).
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mínimo de caracteres de una contraseña (el mismo en todos los registros). */
export const PASSWORD_MIN = 7;

export function esEmailValido(mail) {
  return EMAIL_REGEX.test(String(mail ?? '').trim());
}

export function esPasswordValida(password) {
  return String(password ?? '').length >= PASSWORD_MIN;
}
