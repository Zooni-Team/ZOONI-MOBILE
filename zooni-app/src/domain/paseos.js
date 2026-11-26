import { horaCorta } from '../utils/tiempoRelativo.js';

export const DIAS = [
  { key: 'lun', label: 'Lunes' }, { key: 'mar', label: 'Martes' },
  { key: 'mie', label: 'Miércoles' }, { key: 'jue', label: 'Jueves' },
  { key: 'vie', label: 'Viernes' }, { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

export function HORARIOS_DEFAULT() {
  const h = {};
  DIAS.forEach(({ key }) => {
    const finde = key === 'sab' || key === 'dom';
    h[key] = { activo: !finde, desde: '08:00', hasta: '19:00' };
  });
  return h;
}

export function formatoPlata(n) {
  const centavos = Math.round((Number(n) || 0) * 100);
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const entero = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = abs % 100;
  return `${signo}$${entero}${resto ? `,${String(resto).padStart(2, '0')}` : ''}`;
}

export const aCentavos = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const SERVICIO_MIN_MINUTOS = 10;
export const SERVICIO_MAX_MINUTOS = 240;
export const SERVICIOS_MAX = 4;

export const formatoDuracion = (min) => `${min} minutos`;

export function serviciosDe(p) {
  const lista = Array.isArray(p?.servicios) && p.servicios.length
    ? p.servicios
    : [{ minutos: 30, precio: p?.precio30 }, { minutos: 60, precio: p?.precio60 }];
  return lista
    .map((x) => ({ minutos: Number(x.minutos), precio: Number(x.precio) }))
    .filter((x) => x.minutos > 0 && x.precio > 0)
    .sort((a, b) => a.minutos - b.minutos);
}

export function precioPara(paseador, minutos) {
  return serviciosDe(paseador).find((x) => x.minutos === Number(minutos))?.precio ?? null;
}

export function validarServicios(lista) {
  if (!lista?.length) return 'Es necesario cargar al menos un tiempo de paseo con su precio';
  for (const x of lista) {
    const m = Number(x.minutos);
    if (!(m >= SERVICIO_MIN_MINUTOS && m <= SERVICIO_MAX_MINUTOS)) {
      return `Cada paseo tiene que durar entre ${SERVICIO_MIN_MINUTOS} y ${SERVICIO_MAX_MINUTOS} minutos`;
    }
    if (!(Number(x.precio) > 0)) return `Es necesario el precio del paseo de ${m} minutos`;
  }
  const minutos = lista.map((x) => Number(x.minutos));
  if (new Set(minutos).size !== minutos.length) return 'Hay dos paseos con la misma duración';
  return null;
}

export function formatoDistancia(metros) {
  const m = Math.max(0, Math.round(Number(metros) || 0));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatoTimer(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const horaDe = (iso) => horaCorta(iso) || '--:--';

export function cuandoDe(iso) {
  if (!iso) return 'Sin horario';
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  if (mismo(d, hoy)) return `Hoy ${horaDe(iso)}`;
  if (mismo(d, manana)) return `Mañana ${horaDe(iso)}`;
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  return `${dia} ${d.getDate()}/${d.getMonth() + 1} ${horaDe(iso)}`;
}

export function segundosDePaseo(paseo, ahora = Date.now()) {
  if (!paseo) return 0;
  const tramo = paseo.reanudadoEn ? (ahora - new Date(paseo.reanudadoEn).getTime()) / 1000 : 0;
  return (paseo.segundosAcumulados ?? 0) + Math.max(0, tramo);
}

export const COMISION_ZOONI = 0;

const segundosEnteros = (segundos) => Math.max(0, Math.round(Number(segundos) || 0));

export function formatoTiempoPaseado(segundos) {
  const s = segundosEnteros(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return seg > 0 ? `${m} min ${seg} s` : `${m} min`;
  return `${seg} s`;
}

export const comisionDe = (cobrado) => aCentavos(Number(cobrado) * COMISION_ZOONI);

export const RETOMAR_MINUTOS = 15;

export function sePuedeRetomar(paseo, ahora = Date.now()) {
  if (paseo?.estado !== 'finalizado' || !paseo.horaFin) return false;
  return ahora - new Date(paseo.horaFin).getTime() < RETOMAR_MINUTOS * 60 * 1000;
}

export function inicioDePeriodo(periodo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periodo === 'semana') {
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
  }
  if (periodo === 'mes') {
    d.setDate(1);
    return d;
  }
  return null;
}

export const MEDIOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo', icono: 'cash-outline' },
  { key: 'transferencia', label: 'Transferencia', icono: 'swap-horizontal-outline' },
  { key: 'mercadopago', label: 'Mercado Pago', icono: 'phone-portrait-outline' },
  { key: 'otro', label: 'Otro', icono: 'ellipsis-horizontal-circle-outline' },
];
export const medioDePago = (key) => MEDIOS_PAGO.find((m) => m.key === key) ?? null;

export const MODALIDADES_COBRO = [
  { key: 'por_paseo', label: 'Cada paseo', corto: 'Paga cada paseo', icono: 'walk-outline' },
  { key: 'semanal', label: 'Fin de semana', corto: 'Paga los domingos', icono: 'calendar-outline' },
  { key: 'mensual', label: 'Fin de mes', corto: 'Paga a fin de mes', icono: 'calendar-number-outline' },
];
export const modalidadDeCobro = (key) => MODALIDADES_COBRO.find((m) => m.key === key) ?? MODALIDADES_COBRO[0];

const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ultimoCierre(modalidad, hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (modalidad === 'semanal') {
    d.setDate(d.getDate() - d.getDay());
    return fechaISO(d);
  }
  if (modalidad === 'mensual') {
    const manana = new Date(d);
    manana.setDate(d.getDate() + 1);
    if (manana.getMonth() !== d.getMonth()) return fechaISO(d);
    return fechaISO(new Date(d.getFullYear(), d.getMonth(), 0));
  }
  return null;
}

export function proximoCierre(modalidad, hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (modalidad === 'semanal') {
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    return d;
  }
  if (modalidad === 'mensual') return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return null;
}

export function experienciaEnZooni(fechas, ahora = new Date()) {
  const tiempos = (Array.isArray(fechas) ? fechas : [fechas])
    .map((f) => (f ? new Date(f).getTime() : NaN))
    .filter(Number.isFinite);
  if (!tiempos.length) return { valor: 'Nuevo', etiqueta: 'en Zooni' };
  const desde = new Date(Math.min(...tiempos));

  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.max(0, Math.round((dia(ahora) - dia(desde)) / 86400000));
  if (dias < 7) return { valor: 'Nuevo', etiqueta: 'en Zooni' };

  let meses = (ahora.getFullYear() - desde.getFullYear()) * 12 + (ahora.getMonth() - desde.getMonth());
  if (ahora.getDate() < desde.getDate()) meses -= 1;
  if (meses < 1) {
    const semanas = Math.floor(dias / 7);
    return { valor: String(semanas), etiqueta: semanas === 1 ? 'semana en Zooni' : 'semanas en Zooni' };
  }
  if (meses < 12) return { valor: String(meses), etiqueta: meses === 1 ? 'mes en Zooni' : 'meses en Zooni' };
  const anios = Math.floor(meses / 12);
  return { valor: String(anios), etiqueta: anios === 1 ? 'año en Zooni' : 'años en Zooni' };
}

export const ASPECTOS_RESENA = [
  { key: 'puntualidad', label: 'Puntualidad' },
  { key: 'trato', label: 'Trato con tu mascota' },
  { key: 'comunicacion', label: 'Comunicación' },
];

export const PREGUNTAS_RESENA = [
  { key: 'fotos', pregunta: '¿Te mandó fotos o novedades durante el paseo?', resumen: 'manda novedades' },
  { key: 'contenta', pregunta: '¿Tu mascota volvió tranquila y contenta?', resumen: 'mascotas contentas' },
  { key: 'repetiria', pregunta: '¿Lo volverías a contratar?', resumen: 'lo volvería a contratar' },
];

export const MEDIA_RESENA_MAX = 6;

export const GRACIA_PENDIENTE_MS = 60 * 60 * 1000;
export const GRACIA_ACEPTADO_MS = 2 * 60 * 60 * 1000;

export function estadoVigente({ estado, fecha, duracionMin = 30 }, ahora = Date.now()) {
  if (!fecha || !['pendiente', 'aceptado'].includes(estado)) return estado;
  const inicio = new Date(fecha).getTime();
  if (Number.isNaN(inicio)) return estado;
  if (estado === 'pendiente' && inicio + GRACIA_PENDIENTE_MS < ahora) return 'vencido';
  if (estado === 'aceptado' && inicio + duracionMin * 60000 + GRACIA_ACEPTADO_MS < ahora) return 'vencido';
  return estado;
}
