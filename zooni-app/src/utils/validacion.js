export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN = 8;

export const MENSAJE_PASSWORD_CORTA = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;

export function esEmailValido(mail) {
  return EMAIL_REGEX.test(String(mail ?? '').trim());
}

export function esPasswordValida(password) {
  return String(password ?? '').length >= PASSWORD_MIN;
}
