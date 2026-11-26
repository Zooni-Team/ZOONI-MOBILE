import { EMAIL_REGEX } from './validacion.js';

export function sanitizarTexto(valor, maxLen = 200) {
  if (valor == null) return null;
  const limpio = String(valor)
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, maxLen);
  return limpio.length ? limpio : null;
}

export function sanitizarDigitos(valor, maxLen = 20) {
  return String(valor ?? '').replace(/[^0-9]/g, '').slice(0, maxLen);
}

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

export function parseDecimal(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function sanitizarMonto(valor) {
  let limpio = String(valor ?? '').replace(/[^0-9.,]/g, '');
  const coma = limpio.indexOf(',');
  if (coma !== -1) {
    limpio = limpio.slice(0, coma + 1) + limpio.slice(coma + 1).replace(/[.,]/g, '').slice(0, 2);
  }
  return limpio;
}

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

export function sanitizarEmail(valor) {
  const mail = String(valor ?? '').trim().toLowerCase();
  return EMAIL_REGEX.test(mail) ? mail : null;
}

export function enRango(n, min, max) {
  return n == null || (n >= min && n <= max);
}