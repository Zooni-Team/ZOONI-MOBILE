/**
 * validacion.js — Reglas de formularios compartidas (login, registro, perfil).
 *
 * Son para AVISAR rápido en la pantalla. La garantía la da el servidor:
 * Supabase Auth valida la contraseña y la base el mail único
 * (supabase/SUPABASE_PEGAR_TODO.sql (sección 053)).
 */

// Una sola regla de mail para toda la app (la usa también
// sanitizar.sanitizarEmail): antes una aceptaba un TLD de 1 letra y la otra
// no, y un mail "válido" terminaba guardado como null.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Mínimo de caracteres de una contraseña (el mismo en todos los registros y en
 * Cambiar contraseña). 8, igual que la política de Supabase Auth (#76): con 7
 * la app aceptaba una contraseña que Auth después rechazaba con un error crudo.
 * Los mensajes se arman con esta constante: nunca escribir el número a mano.
 */
export const PASSWORD_MIN = 8;

/** "La contraseña debe tener al menos 8 caracteres." */
export const MENSAJE_PASSWORD_CORTA = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;

export function esEmailValido(mail) {
  return EMAIL_REGEX.test(String(mail ?? '').trim());
}

export function esPasswordValida(password) {
  return String(password ?? '').length >= PASSWORD_MIN;
}
