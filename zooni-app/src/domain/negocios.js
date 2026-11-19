/**
 * domain/negocios.js — Reglas y formatos PUROS de Zooni Negocios (veterinaria,
 * peluquería, pet shop): horarios, turnos libres, precios, envío y los pasos
 * de un turno o un pedido.
 *
 * No toca la red ni la base: se prueba con Node (tests/servicios.test.mjs).
 * Lo que habla con Supabase está en services/negocio/.
 *
 * Ojo: estos cálculos son para MOSTRAR y avisar rápido. Los que valen (precio
 * del turno, total del pedido, stock, transiciones) los vuelve a hacer la base
 * en los triggers _turno_al_crear / _pedido_al_crear / *_al_actualizar.
 */

import { DIA_DE_JS, HORARIOS_NEGOCIO_DEFAULT, TAMANOS, configNegocio } from '../constants/negocios';
import { aCentavos, formatoPlata } from './paseos';
import { distanciaMetros } from '../utils/geo';
import { horaCorta } from '../utils/tiempoRelativo';

// ── Formato ──────────────────────────────────────────────────────────────────

/** "Hoy", "Mañana", "Vie 16/10" */
export function diaTexto(d, ahora = new Date()) {
  const f = d instanceof Date ? d : new Date(d);
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismo(f, ahora)) return 'Hoy';
  if (mismo(f, manana)) return 'Mañana';
  if (mismo(f, ayer)) return 'Ayer';
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][f.getDay()];
  return `${dia} ${f.getDate()}/${f.getMonth() + 1}`;
}

/** "Hoy 17:30", "Vie 16/10 09:00" */
export const cuandoTexto = (d) => `${diaTexto(d)} ${horaCorta(d)}`;

// ── Horarios y turnos libres ─────────────────────────────────────────────────

/** "09:30" → 570 */
export function minutosDe(hhmm) {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
}

export function horarioDelDia(horarios, fecha) {
  const key = DIA_DE_JS[(fecha instanceof Date ? fecha : new Date(fecha)).getDay()];
  return { ...HORARIOS_NEGOCIO_DEFAULT()[key], ...(horarios?.[key] ?? {}) };
}

/** ¿Está abierto en este momento según su horario? */
export function abiertoAhora(horarios, ahora = new Date()) {
  const h = horarioDelDia(horarios, ahora);
  if (!h.activo) return false;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  return min >= minutosDe(h.desde) && min < minutosDe(h.hasta);
}

/**
 * "Lun a Vie 09:00–19:00 · Sáb 09:00–13:00 · Dom cerrado" (agrupa días iguales
 * seguidos). `inactivo` es cómo se nombra un día sin horario (los paseadores
 * usan "no pasea").
 */
export function resumenHorarios(horarios, { inactivo = 'cerrado' } = {}) {
  const orden = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  const cortos = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };
  const base = HORARIOS_NEGOCIO_DEFAULT();
  const txt = (k) => {
    const h = { ...base[k], ...(horarios?.[k] ?? {}) };
    return h.activo ? `${h.desde}–${h.hasta}` : inactivo;
  };
  const grupos = [];
  orden.forEach((k) => {
    const t = txt(k);
    const ult = grupos[grupos.length - 1];
    if (ult && ult.t === t) ult.hasta = k;
    else grupos.push({ desde: k, hasta: k, t });
  });
  return grupos.map((g) => `${cortos[g.desde]}${g.hasta !== g.desde ? ` a ${cortos[g.hasta]}` : ''} ${g.t}`).join(' · ');
}

/**
 * Horarios libres de un día para un turno de `duracion` minutos.
 *   · Dentro del horario del negocio ese día (el turno tiene que terminar
 *     antes del cierre).
 *   · Sin pisarse con turnos ya pedidos o confirmados (`ocupados`).
 *   · Si es hoy, desde dentro de `anticipacionMin` minutos.
 * Cada `paso` minutos (30 por defecto; 15 para servicios cortos).
 */
export function turnosLibres({
  horarios, dia, duracion, ocupados = [], ahora = new Date(), anticipacionMin = 60, paso,
}) {
  const h = horarioDelDia(horarios, dia);
  if (!h.activo || !(duracion > 0)) return [];
  const abre = minutosDe(h.desde);
  const cierra = minutosDe(h.hasta);
  if (abre == null || cierra == null || cierra <= abre) return [];
  const salto = paso ?? (duracion < 30 ? 15 : 30);

  const base = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  const minimo = ahora.getTime() + anticipacionMin * 60000;
  const tomados = ocupados.map((o) => {
    const ini = new Date(o.fecha).getTime();
    return [ini, ini + (o.duracionMin ?? 30) * 60000];
  });

  const libres = [];
  for (let m = abre; m + duracion <= cierra; m += salto) {
    const ini = base.getTime() + m * 60000;
    const fin = ini + duracion * 60000;
    if (ini < minimo) continue;
    if (tomados.some(([a, b]) => ini < b && fin > a)) continue;
    libres.push(new Date(ini));
  }
  return libres;
}

// ── Precios de lo que ofrece ─────────────────────────────────────────────────

/** Precio de un servicio para un tamaño (peluquería) o el precio único. */
export function precioItem(item, tamano) {
  if (item?.precios && typeof item.precios === 'object') {
    const v = item.precios[tamano];
    if (Number(v) > 0) return Number(v);
    const valores = Object.values(item.precios).map(Number).filter((x) => x > 0);
    return valores.length ? Math.min(...valores) : Number(item.precio ?? 0);
  }
  return Number(item?.precio ?? 0);
}

/** "$12.000" o "desde $12.000" si el precio depende del tamaño. */
export function textoPrecioItem(item) {
  if (item?.precios) {
    const valores = TAMANOS.map((t) => Number(item.precios[t.key])).filter((x) => x > 0);
    if (!valores.length) return formatoPlata(item.precio);
    const min = Math.min(...valores);
    return valores.every((v) => v === min) ? formatoPlata(min) : `desde ${formatoPlata(min)}`;
  }
  return formatoPlata(item?.precio);
}

/** Valida un item antes de guardarlo. Devuelve el mensaje del problema o null. */
export function validarItem(item, tipo) {
  const cfg = configNegocio(tipo);
  if ((item.nombre ?? '').trim().length < 2) return 'Es necesario el nombre';
  if (cfg.preciosPorTamano) {
    const ok = TAMANOS.some((t) => Number(item.precios?.[t.key]) > 0);
    if (!ok) return 'Es necesario al menos un precio (chico, mediano o grande)';
  } else if (!(Number(item.precio) > 0)) {
    return 'Es necesario el precio';
  }
  if (cfg.clase === 'servicio') {
    const d = Number(item.duracionMin);
    if (!(d >= 5 && d <= 600)) return 'La duración tiene que estar entre 5 y 600 minutos';
  }
  if (cfg.clase === 'producto' && item.stock !== null && item.stock !== '' && item.stock !== undefined) {
    if (!(Number(item.stock) >= 0)) return 'El stock no puede ser negativo';
  }
  return null;
}

// ── Turnos ───────────────────────────────────────────────────────────────────

/** Transiciones válidas de un turno, desde el lado del negocio. */
export const ACCIONES_TURNO = {
  pendiente: ['confirmado', 'rechazado'],
  confirmado: ['completado', 'ausente', 'cancelado'],
};

/** Recargo por ir a buscar / atender en la casa (hoy: el busca y lleva de la peluquería). */
export function recargoDomicilio(negocio, aDomicilio) {
  if (!aDomicilio || negocio?.tipo !== 'peluqueria') return 0;
  return Number(negocio.datos?.buscaYLlevaCosto) || 0;
}

/**
 * Hasta cuántos km del local busca y lleva la peluquería. null = sin límite
 * (peluquerías que lo configuraron antes de que existiera el radio).
 */
export function radioBuscaYLlevaKm(negocio) {
  if (negocio?.tipo !== 'peluqueria' || !negocio.datos?.buscaYLleva) return null;
  const r = Number(negocio.datos.buscaYLlevaRadioKm);
  return r > 0 ? r : null;
}

/** Km entre el local y un punto { lat, lng }. null si falta alguna coordenada. */
export function distanciaAlLocalKm(negocio, punto) {
  if (negocio?.lat == null || negocio?.lng == null || punto?.lat == null || punto?.lng == null) return null;
  return distanciaMetros({ lat: negocio.lat, lng: negocio.lng }, punto) / 1000;
}

/** Precio final de un turno: el del servicio (por tamaño) más el recargo a domicilio. */
export function precioTurno(negocio, item, tamano, aDomicilio = false) {
  return aCentavos(precioItem(item, tamano) + recargoDomicilio(negocio, aDomicilio));
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

/** Unidades totales de un pedido (suma de cantidades). */
export const unidadesDe = (pedido) => pedido.items.reduce((a, x) => a + (Number(x.cantidad) || 0), 0);

/** Próximo paso de un pedido según cómo se entrega. */
export function siguienteEstadoPedido(pedido) {
  if (pedido.estado === 'nuevo') return 'preparando';
  if (pedido.estado === 'preparando') return pedido.entrega === 'envio' ? 'en_camino' : 'listo';
  if (pedido.estado === 'listo' || pedido.estado === 'en_camino') return 'entregado';
  return null;
}

/** Costo de envío según la configuración del pet shop (gratis desde cierto monto). */
export function costoEnvio(negocio, subtotal) {
  const d = negocio?.datos ?? {};
  if (!d.envios) return null;
  const gratisDesde = Number(d.envioGratisDesde) || 0;
  if (gratisDesde > 0 && subtotal >= gratisDesde) return 0;
  return Number(d.envioCosto) || 0;
}
