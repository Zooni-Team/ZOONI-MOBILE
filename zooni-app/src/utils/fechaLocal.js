const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

export const MESES = Object.freeze(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']);

export const DIAS_SEMANA = Object.freeze(['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);

export function parseFechaLocal(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha;
  const texto = String(fecha);
  if (DATE_ONLY.test(texto)) {
    const [y, m, d] = texto.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODateLocal(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dos = (n) => String(n).padStart(2, '0');
const OPCIONES_LOCALE = Object.freeze({
  larga: { day: 'numeric', month: 'long', year: 'numeric' },
  diaSemana: { weekday: 'long', day: 'numeric', month: 'long' },
  diaSemanaCorto: { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
  corta: { day: 'numeric', month: 'short', year: 'numeric' },
});

export function formatearFecha(valor, estilo = 'numerica', { vacio = null } = {}) {
  const d = parseFechaLocal(valor);
  if (!d) return vacio;
  if (estilo === 'numerica') return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  if (estilo === 'numericaCeros') return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  const opciones = OPCIONES_LOCALE[estilo];
  if (!opciones) throw new Error(`formatearFecha: estilo desconocido "${estilo}"`);
  return d.toLocaleDateString('es-AR', opciones);
}

export function diasHasta(valor, hoy = new Date()) {
  const d = parseFechaLocal(valor);
  if (!d) return null;
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / MS_DIA);
}

export function cuentaRegresiva(valor, { hoy = new Date(), diasAviso = 7 } = {}) {
  const dias = diasHasta(valor, hoy);
  if (dias == null) return null;
  if (dias < 0) {
    const pasaron = Math.abs(dias);
    return { texto: `Venció hace ${pasaron} ${pasaron === 1 ? 'día' : 'días'}`, tono: 'vencido' };
  }
  if (dias === 0) return { texto: 'Vence hoy', tono: 'pronto' };
  return { texto: dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`, tono: dias <= diasAviso ? 'pronto' : 'lejos' };
}

export function diasEntre(a, b) {
  const da = parseFechaLocal(a);
  return da ? diasHasta(b, da) : null;
}

export function fechaHoraFija(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dia} ${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
}
