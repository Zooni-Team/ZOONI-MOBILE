/**
 * paseador/pagos.js — Cuenta corriente del paseador con cada dueño: lo que le
 * deben (paseos finalizados), lo que anotó que le pagaron y cada cuánto cobra.
 * Tablas paseo_pagos y paseo_cuenta_config.
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { formatoPlata, aCentavos, inicioDePeriodo, medioDePago, ultimoCierre, proximoCierre } from '../../domain/paseos';
import { errorApp, esEsquemaFaltante, esSinPermiso } from '../comun';
import { notificarPaseo } from './avisos';
import { fetchMisPaseos } from './paseos';

function mapPago(r) {
  return {
    id: r.id, idDueno: r.id_dueno, monto: Number(r.monto), medio: r.medio,
    fecha: r.fecha, nota: r.nota ?? '',
  };
}

async function leerPagos() {
  const { data, error } = await supabase.from('paseo_pagos').select('*')
    .eq('id_walker', getCurrentUserId()).order('fecha', { ascending: true });
  if (error) throw errorApp('error_base', error);
  return (data ?? []).map(mapPago);
}

// ── Cada cuánto le cobra el paseador a cada dueño (045) ─────────────────────

/**
 * { [idDueno]: { modalidad, ultimoRecordatorio } }. Sin la 045 → {}.
 * Cualquier OTRO error se propaga: antes también devolvía {} y todas las
 * cuentas pasaban en silencio a "por paseo".
 */
async function leerConfigCuentas() {
  const { data, error } = await supabase.from('paseo_cuenta_config')
    .select('id_dueno, modalidad, ultimo_recordatorio').eq('id_walker', getCurrentUserId());
  if (error) {
    if (esEsquemaFaltante(error)) return {};
    throw errorApp('error_base', error);
  }
  return Object.fromEntries((data ?? []).map((r) => [String(r.id_dueno), {
    modalidad: r.modalidad, ultimoRecordatorio: r.ultimo_recordatorio,
  }]));
}

/**
 * Elige cada cuánto le cobra a un dueño. Al pasar a semanal / mensual, el
 * período en curso no se avisa de nuevo: el próximo recordatorio es en el
 * próximo cierre.
 */
export async function guardarModalidadCobro(idDueno, modalidad) {
  const ultimoRecordatorio = ultimoCierre(modalidad);
  const { error } = await supabase.from('paseo_cuenta_config').upsert({
    id_walker: getCurrentUserId(), id_dueno: idDueno, modalidad,
    ultimo_recordatorio: ultimoRecordatorio, actualizado_en: new Date().toISOString(),
  });
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
}

/**
 * Recordatorios de cobro: a cada dueño que paga por semana / mes y debe
 * plata, cuando se cierra su período le llega al paseador una notificación
 * ("Sofía te debe $X") que lleva a Pagos. Uno por período (ultimo_recordatorio).
 *
 * No hay servidor que corra esto solo: se revisa cada vez que el paseador abre
 * la app. Devuelve cuántos recordatorios se mandaron. Nunca rompe el flujo.
 */
export async function revisarRecordatoriosCobro() {
  try {
    const config = await leerConfigCuentas();
    const pendientes = Object.entries(config).filter(([, c]) => {
      const cierre = ultimoCierre(c.modalidad);
      return cierre && (!c.ultimoRecordatorio || c.ultimoRecordatorio < cierre);
    });
    if (!pendientes.length) return 0;

    const cuentas = await fetchCuentasCorrientes();
    let enviados = 0;
    for (const [idDueno, c] of pendientes) {
      const cierre = ultimoCierre(c.modalidad);
      // Primero se "reclama" el período con un UPDATE condicional y recién
      // después se avisa. Antes se avisaba primero y el error del UPDATE se
      // ignoraba: si fallaba, o con dos dispositivos abiertos a la vez, el
      // recordatorio salía repetido.
      let reclamo = supabase.from('paseo_cuenta_config').update({ ultimo_recordatorio: cierre })
        .eq('id_walker', getCurrentUserId()).eq('id_dueno', Number(idDueno));
      reclamo = c.ultimoRecordatorio
        ? reclamo.lt('ultimo_recordatorio', cierre)
        : reclamo.is('ultimo_recordatorio', null);
      const { data: reclamadas, error: errReclamo } = await reclamo.select('id_dueno');
      if (errReclamo || !reclamadas?.length) continue; // lo avisó otro dispositivo, o falló

      const cuenta = cuentas.find((x) => String(x.idDueno) === idDueno);
      if (cuenta?.saldo > 0) {
        const periodo = c.modalidad === 'semanal' ? 'la semana' : 'el mes';
        const titulo = `${cuenta.dueno.nombre} te debe ${formatoPlata(cuenta.saldo)}`;
        const mensaje = `Terminó ${periodo}: tiene ${cuenta.pendientes} ${cuenta.pendientes === 1 ? 'paseo' : 'paseos'} sin pagar. Tocá para ver su cuenta.`;
        await notificarPaseo(getCurrentUserId(), titulo, mensaje, 'pagos');
        enviados += 1;
      }
    }
    return enviados;
  } catch {
    return 0;
  }
}

/**
 * Cuentas corrientes: una por dueño con el que hiciste paseos o que te pagó.
 *   cargos  = paseos finalizados (lo que te tiene que pagar)
 *   pagos   = lo que anotaste que te pagó
 *   saldo   = cargos - pagos (> 0 te debe, 0 al día, < 0 tiene saldo a favor)
 * Los pagos se imputan a los paseos más viejos primero: cada paseo queda
 * 'pagado', 'parcial' (con cuánto falta) o 'pendiente'.
 * `modalidad` es cada cuánto paga (por_paseo / semanal / mensual, ver 045).
 * Ordenadas: primero los que más deben; después los que están al día.
 */
export async function fetchCuentasCorrientes() {
  const [paseos, pagos, config] = await Promise.all([
    fetchMisPaseos(['finalizado']), leerPagos(), leerConfigCuentas(),
  ]);

  // Medio de pago que eligió el dueño en cada paseo (columna de la 044; si no
  // está, la cuenta igual se arma sin ese dato)
  const medios = {};
  if (paseos.length) {
    const { data, error } = await supabase.from('Paseo').select('"Id_Paseo","MedioPago"')
      .in('Id_Paseo', paseos.map((p) => p.id));
    // Sin la columna (044) la cuenta se arma igual; otro error se avisa.
    if (error && !esEsquemaFaltante(error)) throw errorApp('error_base', error);
    (data ?? []).forEach((r) => { medios[r.Id_Paseo] = r.MedioPago; });
  }

  const cuentas = new Map();
  const cuentaDe = (idDueno, dueno) => {
    const key = String(idDueno);
    if (!cuentas.has(key)) {
      cuentas.set(key, { idDueno, dueno: dueno ?? { id: idDueno, nombre: 'Dueño', foto: null }, paseos: [], pagos: [], mascotas: new Set() });
    }
    const c = cuentas.get(key);
    if (dueno && c.dueno.nombre === 'Dueño') c.dueno = dueno;
    return c;
  };

  paseos.forEach((p) => {
    if (p.idDueno == null) return;
    const c = cuentaDe(p.idDueno, p.dueno);
    c.paseos.push({ ...p, medioPago: medios[p.id] ?? p.medioPago ?? null });
    c.mascotas.add(p.mascota.nombre);
  });
  pagos.forEach((pg) => cuentaDe(pg.idDueno).pagos.push(pg));

  const lista = [...cuentas.values()].map((c) => {
    c.paseos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    c.pagos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const totalCargos = aCentavos(c.paseos.reduce((a, p) => a + p.precio, 0));
    const totalPagado = aCentavos(c.pagos.reduce((a, pg) => a + pg.monto, 0));

    // Imputar los pagos a los paseos más viejos primero (en centavos: con
    // paseos cobrados por tiempo hay montos como $166,66)
    let disponible = totalPagado;
    const paseosEstado = c.paseos.map((p) => {
      const cubierto = aCentavos(Math.min(p.precio, Math.max(0, disponible)));
      disponible = aCentavos(disponible - cubierto);
      const estado = cubierto >= p.precio ? 'pagado' : cubierto > 0 ? 'parcial' : 'pendiente';
      return { ...p, cubierto, falta: aCentavos(p.precio - cubierto), estado };
    });
    const modalidad = config[String(c.idDueno)]?.modalidad ?? 'por_paseo';

    const conMedio = [...paseosEstado].reverse().find((p) => p.medioPago);
    const fechas = [...c.paseos.map((p) => p.fecha), ...c.pagos.map((pg) => pg.fecha)];
    return {
      idDueno: c.idDueno,
      dueno: c.dueno,
      mascotas: [...c.mascotas],
      paseos: paseosEstado,
      pagos: c.pagos,
      totalCargos,
      totalPagado,
      saldo: aCentavos(totalCargos - totalPagado),
      modalidad,
      proximoCierre: proximoCierre(modalidad),
      pendientes: paseosEstado.filter((p) => p.estado !== 'pagado').length,
      medioPreferido: conMedio?.medioPago ?? c.pagos[c.pagos.length - 1]?.medio ?? null,
      ultimoPago: c.pagos[c.pagos.length - 1]?.fecha ?? null,
      ultimoMovimiento: fechas.sort((a, b) => new Date(b) - new Date(a))[0] ?? null,
    };
  });

  return lista.sort((a, b) => {
    if ((a.saldo > 0) !== (b.saldo > 0)) return a.saldo > 0 ? -1 : 1;
    if (a.saldo > 0) return b.saldo - a.saldo;
    return new Date(b.ultimoMovimiento) - new Date(a.ultimoMovimiento);
  });
}

/** La cuenta corriente con un dueño (o null si todavía no hay movimientos). */
export async function fetchCuentaCorriente(idDueno) {
  const cuentas = await fetchCuentasCorrientes();
  return cuentas.find((c) => String(c.idDueno) === String(idDueno)) ?? null;
}

/** Error de paseo_pagos con un código que la pantalla sabe explicar. */
function errorDePagos(error) {
  if (__DEV__) console.error('[paseo_pagos]', error);
  return errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente'
    : esSinPermiso(error) ? 'sin_permiso' : 'error_base', error);
}

function filaPago({ idDueno, monto, medio, fecha, nota }) {
  return {
    id_dueno: idDueno,
    monto: Math.round(Number(monto) * 100) / 100,
    medio,
    fecha: (fecha instanceof Date ? fecha : new Date(fecha ?? Date.now())).toISOString(),
    nota: nota?.trim() || null,
  };
}

/** Anota un pago (total o parcial) de un dueño. Le avisa al dueño. */
export async function registrarPago(pago) {
  const fila = filaPago(pago);
  const { error } = await supabase.from('paseo_pagos').insert({ ...fila, id_walker: getCurrentUserId() });
  if (error) throw errorDePagos(error);
  const medio = medioDePago(fila.medio);
  notificarPaseo(fila.id_dueno, 'Tu paseador registró un pago',
    `${formatoPlata(fila.monto)}${medio ? ` · ${medio.label}` : ''}. ¡Gracias!`, null, 'dueno');
}

/** Corrige un pago ya anotado (monto, medio, fecha o nota). */
export async function editarPago(id, pago) {
  const fila = filaPago(pago);
  const { data, error } = await supabase.from('paseo_pagos')
    .update({ ...fila, actualizado_en: new Date().toISOString() })
    .eq('id', id).eq('id_walker', getCurrentUserId())
    .select('id');
  if (error) throw errorDePagos(error);
  // 0 filas = el pago ya no existe (o la RLS no deja): no decir "guardado".
  if (!data?.length) throw errorApp('pago_inexistente');
}

export async function borrarPago(id) {
  const { data, error } = await supabase.from('paseo_pagos').delete()
    .eq('id', id).eq('id_walker', getCurrentUserId())
    .select('id');
  if (error) throw errorDePagos(error);
  if (!data?.length) throw errorApp('pago_inexistente');
}

/** Paseos finalizados del período, del más nuevo al más viejo. */
export async function fetchGanancias(periodo) {
  const desde = inicioDePeriodo(periodo);
  const lista = await fetchMisPaseos(['finalizado'], desde ? { desde } : {});
  return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
