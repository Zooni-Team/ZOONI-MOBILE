/**
 * calcularEdad.js — ÚNICO lugar donde se calcula una edad (mascotas y personas).
 *
 * Antes había cinco versiones (api.js, petsApi.js, fichaPdf.js, matchApi,
 * perfilApi) y no coincidían: una no miraba el día del mes, así que una
 * mascota nacida el 20 "cumplía" meses el 1.
 *
 *   calcularEdadPartes('2022-02-15') → { anios: 4, meses: 8 }
 *   calcularEdad('2022-02-15')       → "4 años y 8 meses"
 *   edadResumida('2022-02-15')       → "4 años"
 *   calcularEdadMeses / calcularEdadAnios → números (para filtros)
 *
 * Los imports llevan ".js" a propósito: este módulo también lo cargan los
 * scripts de verificación con Node puro (npm run test).
 */
import { parseFechaLocal } from './fechaLocal.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Meses cumplidos (para filtrar catálogos por edad). null si no hay fecha o es futura. */
export function calcularEdadMeses(fechaNacimiento, hoy = new Date()) {
  const nacimiento = parseFechaLocal(fechaNacimiento);
  if (!nacimiento) return null;
  let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
  return meses < 0 ? null : meses;
}

/** { anios, meses } cumplidos, o { anios: null, meses: null } si no hay fecha válida o es futura. */
export function calcularEdadPartes(fechaNacimiento, hoy = new Date()) {
  const meses = calcularEdadMeses(fechaNacimiento, hoy);
  if (meses == null) return { anios: null, meses: null };
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
}

/** Años cumplidos. null si no hay fecha válida. */
export function calcularEdadAnios(fechaNacimiento, hoy = new Date()) {
  const meses = calcularEdadMeses(fechaNacimiento, hoy);
  return meses == null ? null : Math.floor(meses / 12);
}

/**
 * "4 años y 4 meses" | "8 meses" | "1 año y 0 meses".
 * `vacio` es lo que se muestra si no hay fecha (o es inválida / futura).
 */
export function calcularEdad(fechaNacimiento, { vacio = 'Edad desconocida', hoy = new Date() } = {}) {
  const { anios, meses } = calcularEdadPartes(fechaNacimiento, hoy);
  if (anios == null) return vacio;
  if (anios === 0) return plural(meses, 'mes', 'meses');
  return `${plural(anios, 'año', 'años')} y ${plural(meses, 'mes', 'meses')}`;
}

/** "4 años" | "8 meses" | "Menos de 1 mes" (para tarjetas chicas). null si no hay fecha. */
export function edadResumida(fechaNacimiento, hoy = new Date()) {
  const { anios, meses } = calcularEdadPartes(fechaNacimiento, hoy);
  if (anios == null) return null;
  if (anios >= 1) return plural(anios, 'año', 'años');
  if (meses >= 1) return plural(meses, 'mes', 'meses');
  return 'Menos de 1 mes';
}
