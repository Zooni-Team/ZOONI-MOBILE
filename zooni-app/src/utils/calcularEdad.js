import { parseFechaLocal } from './fechaLocal.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function calcularEdadMeses(fechaNacimiento, hoy = new Date()) {
  const nacimiento = parseFechaLocal(fechaNacimiento);
  if (!nacimiento) return null;
  let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
  return meses < 0 ? null : meses;
}

export function calcularEdadPartes(fechaNacimiento, hoy = new Date()) {
  const meses = calcularEdadMeses(fechaNacimiento, hoy);
  if (meses == null) return { anios: null, meses: null };
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
}

export function calcularEdadAnios(fechaNacimiento, hoy = new Date()) {
  const meses = calcularEdadMeses(fechaNacimiento, hoy);
  return meses == null ? null : Math.floor(meses / 12);
}

export function calcularEdad(fechaNacimiento, { vacio = 'Edad desconocida', hoy = new Date() } = {}) {
  const { anios, meses } = calcularEdadPartes(fechaNacimiento, hoy);
  if (anios == null) return vacio;
  if (anios === 0) return plural(meses, 'mes', 'meses');
  return `${plural(anios, 'año', 'años')} y ${plural(meses, 'mes', 'meses')}`;
}

export function edadResumida(fechaNacimiento, hoy = new Date()) {
  const { anios, meses } = calcularEdadPartes(fechaNacimiento, hoy);
  if (anios == null) return null;
  if (anios >= 1) return plural(anios, 'año', 'años');
  if (meses >= 1) return plural(meses, 'mes', 'meses');
  return 'Menos de 1 mes';
}
