/**
 * calcularEdad.js — Calcula la edad de una mascota desde su fecha de nacimiento
 *
 * @param {string | Date} fechaNacimiento - "YYYY-MM-DD" o instancia de Date
 * @returns {string} - Ej: "4 años y 4 meses" | "8 meses" | "1 año y 0 meses"
 */
import { parseFechaLocal } from './fechaLocal';

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 'Edad desconocida';

  const nacimiento = parseFechaLocal(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return 'Fecha inválida';

  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();

  // Ajustar si el mes actual es anterior al mes de nacimiento
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  // Ajustar si el día actual es anterior al día de nacimiento en el mismo mes
  if (hoy.getDate() < nacimiento.getDate()) {
    meses -= 1;
    if (meses < 0) {
      anios -= 1;
      meses += 12;
    }
  }

  if (anios === 0) {
    return meses === 1 ? '1 mes' : `${meses} meses`;
  }

  const textoAnios = anios === 1 ? '1 año' : `${anios} años`;
  const textoMeses = meses === 1 ? '1 mes' : `${meses} meses`;

  return `${textoAnios} y ${textoMeses}`;
}

/**
 * Igual que calcularEdad, pero como número de meses (para filtrar catálogos
 * de vacunas/tratamientos/consejos por rango de edad). null si no hay fecha.
 */
export function calcularEdadMeses(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = parseFechaLocal(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
  return Math.max(0, meses);
}
