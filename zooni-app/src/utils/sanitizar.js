/**
 * sanitizar.js — Sanitización de inputs antes de mandarlos a la base
 *
 * Primera línea de defensa del cliente. La segunda (la que vale) son los
 * CHECK constraints y RPCs del lado de Supabase (021_seguridad.sql):
 * supabase-js parametriza las queries así que no hay SQL injection posible,
 * pero igual no dejamos pasar basura, control chars ni longitudes absurdas.
 */

/**
 * Texto libre: recorta, saca caracteres de control y limita longitud.
 * No escapa HTML — React Native no interpreta HTML, y escaparlo acá
 * corrompería nombres legítimos ("O'Brien").
 */
export function sanitizarTexto(valor, maxLen = 200) {
  if (valor == null) return null;
  const limpio = String(valor)
    .replace(/[\u0000-\u001f\u007f]/g, '') // caracteres de control
    .trim()
    .slice(0, maxLen);
  return limpio.length ? limpio : null;
}

/** Solo dígitos (microchip, teléfono). */
export function sanitizarDigitos(valor, maxLen = 20) {
  return String(valor ?? '').replace(/[^0-9]/g, '').slice(0, maxLen);
}

/**
 * Número decimal como texto de input: solo dígitos y UNA coma o punto.
 * "12a,5x" → "12,5" · "1.2.3" → "1.23"
 */
export function sanitizarDecimal(valor) {
  let limpio = String(valor ?? '').replace(/[^0-9.,]/g, '');
  const primerSep = limpio.search(/[.,]/);
  if (primerSep !== -1) {
    limpio =
      limpio.slice(0, primerSep + 1) +
      limpio.slice(primerSep + 1).replace(/[.,]/g, '');
  }
  return limpio;
}

/** Parsea un decimal de input a Number, o null si no es válido. */
export function parseDecimal(valor) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Email: minúsculas, sin espacios; null si no tiene forma de email. */
export function sanitizarEmail(valor) {
  const mail = String(valor ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) ? mail : null;
}

/** Rango numérico con null pasante (para campos opcionales). */
export function enRango(n, min, max) {
  return n == null || (n >= min && n <= max);
}