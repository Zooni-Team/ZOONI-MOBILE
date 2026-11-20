/**
 * sanitizar.js — Sanitización de inputs antes de mandarlos a la base
 *
 * Primera línea de defensa del cliente. La segunda (la que vale) son los
 * CHECK constraints y RPCs del lado de Supabase (sección 021 de SUPABASE_PEGAR_TODO.sql):
 * supabase-js parametriza las queries así que no hay SQL injection posible,
 * pero igual no dejamos pasar basura, control chars ni longitudes absurdas.
 */

import { EMAIL_REGEX } from './validacion.js';

/**
 * Texto libre: recorta, saca caracteres de control y limita longitud.
 * No escapa HTML — React Native no interpreta HTML, y escaparlo acá
 * corrompería nombres legítimos ("O'Brien").
 */
export function sanitizarTexto(valor, maxLen = 200) {
  if (valor == null) return null;
  const limpio = String(valor)
    .replace(/\p{Cc}/gu, '') // caracteres de control (categoría Unicode Cc)
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

/** Parsea un decimal de input a Number, o null si no es válido (o está vacío). */
export function parseDecimal(valor) {
  const texto = String(valor ?? '').trim();
  // Number('') es 0: un campo vacío no es "cero".
  if (!texto) return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Monto en pesos como lo escribe alguien en Argentina: "." separa miles y
 * "," los decimales. Para el input: sólo dígitos, puntos y UNA coma.
 *   "1.500" → "1.500" · "1.500,5" → "1.500,5" · "12a,5,0" → "12,50"
 */
export function sanitizarMonto(valor) {
  let limpio = String(valor ?? '').replace(/[^0-9.,]/g, '');
  const coma = limpio.indexOf(',');
  if (coma !== -1) {
    limpio = limpio.slice(0, coma + 1) + limpio.slice(coma + 1).replace(/[.,]/g, '').slice(0, 2);
  }
  return limpio;
}

/**
 * Lee un monto en formato argentino. Antes los montos pasaban por
 * parseDecimal y "1.500" se guardaba como $1,50.
 *   "1.500" → 1500 · "1.500,50" → 1500.5 · "166,66" → 166.66 · "2.5" → 2.5
 * Un único punto seguido de 1 o 2 dígitos se toma como decimal ("2.5"):
 * con 3 dígitos detrás es separador de miles. null si está vacío o no es un número.
 */
export function parseMonto(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  let normal;
  if (texto.includes(',')) {
    normal = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+\.\d{1,2}$/.test(texto)) {
    normal = texto;
  } else {
    normal = texto.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Email: minúsculas, sin espacios; null si no tiene forma de email. */
export function sanitizarEmail(valor) {
  const mail = String(valor ?? '').trim().toLowerCase();
  return EMAIL_REGEX.test(mail) ? mail : null;
}

/** Rango numérico con null pasante (para campos opcionales). */
export function enRango(n, min, max) {
  return n == null || (n >= min && n <= max);
}