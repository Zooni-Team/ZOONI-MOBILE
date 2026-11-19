/**
 * negocio/turnos.js — Turnos de veterinaria y peluquería (tabla negocio_turnos):
 *
 *   pendiente → confirmado → completado (con informe)
 *             ↘ rechazado / cancelado / ausente
 *
 * Todo cambio de estado le llega al otro lado como notificación.
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { tamanoPorPeso } from '../../constants/negocios';
import { aCentavos } from '../../domain/paseos';
import { ACCIONES_TURNO, precioTurno } from '../../domain/negocios';
import { fechaHoraFija } from '../../utils/fechaLocal';
import { errorBase } from '../comun';
import { notificarNegocio } from './avisos';
import { mascotasPorId, usuariosPorId, negociosPorId } from './enriquecer';

function mapTurno(r, mascotas = {}, usuarios = {}, negocios = {}) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    idDueno: r.id_dueno,
    idMascota: r.id_mascota,
    idItem: r.id_item,
    servicio: r.servicio,
    fecha: r.fecha,
    duracionMin: r.duracion_min ?? 30,
    precio: Number(r.precio ?? 0),
    urgencia: !!r.urgencia,
    aDomicilio: !!r.a_domicilio,
    direccion: r.direccion ?? null,
    estado: r.estado,
    notas: r.notas_dueno ?? '',
    informe: r.informe ?? null,
    creadoEn: r.creado_en,
    mascota: mascotas[r.id_mascota] ?? { id: r.id_mascota, nombre: 'Mascota', visual: null },
    dueno: usuarios[r.id_dueno] ?? { id: r.id_dueno, nombre: 'Cliente', foto: null },
    negocio: negocios[r.id_negocio] ?? null,
  };
}

export async function enriquecerTurnos(rows, { conNegocio = false } = {}) {
  const [mascotas, usuarios, negocios] = await Promise.all([
    mascotasPorId(rows.map((r) => r.id_mascota)),
    usuariosPorId(rows.map((r) => r.id_dueno)),
    conNegocio ? negociosPorId(rows.map((r) => r.id_negocio)) : {},
  ]);
  return rows.map((r) => mapTurno(r, mascotas, usuarios, negocios));
}

/** Turnos del negocio. `desde`/`hasta` son Date; `estados` filtra. */
export async function fetchTurnosNegocio(idNegocio, { desde, hasta, estados } = {}) {
  let q = supabase.from('negocio_turnos').select('*').eq('id_negocio', idNegocio);
  if (desde) q = q.gte('fecha', desde.toISOString());
  if (hasta) q = q.lt('fecha', hasta.toISOString());
  if (estados?.length) q = q.in('estado', estados);
  const { data, error } = await q.order('fecha', { ascending: true }).limit(500);
  if (error) throw errorBase(error);
  return enriquecerTurnos(data ?? []);
}

/** Lo ya ocupado de un día: turnos pedidos o confirmados → [{ fecha, duracionMin }]. */
export async function fetchOcupados(idNegocio, dia) {
  const desde = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  const { data, error } = await supabase.from('negocio_turnos').select('fecha, duracion_min')
    .eq('id_negocio', idNegocio).in('estado', ['pendiente', 'confirmado'])
    .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString());
  if (error) throw errorBase(error);
  return (data ?? []).map((r) => ({ fecha: r.fecha, duracionMin: r.duracion_min }));
}

/**
 * El negocio cambia el estado de un turno y le avisa al dueño.
 * `informe` (al completar): veterinaria → { motivo, diagnostico, tratamiento,
 * peso, temperatura, proximoControl, notas }; peluquería → { notas, fotos }.
 */
export async function cambiarEstadoTurno(negocio, turno, estado, { informe, motivo } = {}) {
  if (!ACCIONES_TURNO[turno.estado]?.includes(estado)) throw new Error('transicion_invalida');
  const fila = { estado, actualizado_en: new Date().toISOString() };
  if (informe) fila.informe = informe;
  const { data, error } = await supabase.from('negocio_turnos').update(fila)
    .eq('id', turno.id).eq('id_negocio', negocio.id).eq('estado', turno.estado)
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('turno_cambiado'); // lo canceló el dueño mientras tanto

  const quien = turno.mascota?.nombre ?? 'tu mascota';
  const cuando = fechaHoraFija(turno.fecha); // queda guardado: sin "Hoy"
  const avisos = {
    confirmado: [`Turno confirmado ✅`, `${negocio.nombre} confirmó el turno de ${quien}: ${turno.servicio}, ${cuando}.`],
    rechazado: ['Turno no disponible', `${negocio.nombre} no puede atender a ${quien} ${cuando}.${motivo ? ` "${motivo}"` : ''} Probá con otro horario.`],
    cancelado: ['Turno cancelado', `${negocio.nombre} canceló el turno de ${quien} (${cuando}).${motivo ? ` "${motivo}"` : ''}`],
    completado: negocio.tipo === 'veterinaria'
      ? ['Consulta finalizada 🩺', `${quien} ya fue atendido en ${negocio.nombre}. Mirá el informe en Turnos y pedidos.`]
      : ['¡Listo! 🛁', `${quien} ya está listo en ${negocio.nombre}.`],
  };
  if (avisos[estado]) {
    notificarNegocio(turno.idDueno, avisos[estado][0], avisos[estado][1], { tipo: 'turno', extra: { idTurno: turno.id } });
  }
  return { ...turno, estado, informe: informe ?? turno.informe };
}

/** Guarda / corrige el informe de un turno ya atendido (sin cambiar el estado). */
export async function guardarInforme(negocio, turno, informe) {
  const { error } = await supabase.from('negocio_turnos')
    .update({ informe, actualizado_en: new Date().toISOString() })
    .eq('id', turno.id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
  return { ...turno, informe };
}

/**
 * El dueño pide un turno. El precio sale del servicio elegido (y del tamaño de
 * la mascota en peluquería), más el busca y lleva si lo pidió. El chequeo de
 * horario libre de acá es para avisar rápido; la garantía es el trigger
 * _turno_al_crear (062), que serializa las reservas de cada negocio y valida
 * que el precio sea uno de los del servicio.
 */
export async function crearTurno({
  negocio, item, mascota, fecha, tamano, urgencia = false, aDomicilio = false, direccion = null, notas = '',
}) {
  if (!negocio.abierto) throw new Error('negocio_cerrado');
  const ocupados = await fetchOcupados(negocio.id, fecha);
  const ini = fecha.getTime();
  const fin = ini + item.duracionMin * 60000;
  const pisa = ocupados.some((o) => {
    const a = new Date(o.fecha).getTime();
    return ini < a + o.duracionMin * 60000 && fin > a;
  });
  if (pisa) throw new Error('horario_ocupado');

  // El tamaño sale de la mascota (mascota_publica lo expone); tamanoPorPeso
  // queda para cuando se elige una mascota propia, que sí trae el peso.
  const precio = precioTurno(
    negocio, item, tamano ?? mascota?.tamano ?? tamanoPorPeso(mascota?.peso), aDomicilio,
  );
  const { data, error } = await supabase.from('negocio_turnos').insert({
    id_negocio: negocio.id,
    id_dueno: getCurrentUserId(),
    id_mascota: mascota?.id ?? null,
    id_item: item.id,
    servicio: item.nombre,
    fecha: fecha.toISOString(),
    duracion_min: item.duracionMin,
    precio,
    urgencia,
    a_domicilio: aDomicilio,
    direccion: aDomicilio ? direccion?.trim() || null : null,
    notas_dueno: notas?.trim().slice(0, 500) || null,
  }).select('id').single();
  if (error) {
    // La base re-chequea con un candado por negocio: si otro reservó ese
    // horario entre la consulta de arriba y este insert, gana el primero.
    const codigo = ['horario_ocupado', 'precio_invalido', 'servicio_inexistente', 'negocio_cerrado']
      .find((c) => String(error.message ?? '').includes(c));
    throw codigo ? new Error(codigo) : errorBase(error);
  }

  notificarNegocio(negocio.idUser,
    urgencia ? '🚨 Pedido de turno URGENTE' : 'Nuevo pedido de turno',
    `${mascota?.nombre ?? 'Una mascota'} · ${item.nombre} · ${fechaHoraFija(fecha)}${aDomicilio ? ' · a domicilio' : ''}`,
    { destino: 'turnos' });
  return data.id;
}

/** Mis turnos como dueño (los más nuevos primero). */
export async function fetchMisTurnos() {
  const { data, error } = await supabase.from('negocio_turnos').select('*')
    .eq('id_dueno', getCurrentUserId()).order('fecha', { ascending: false }).limit(100);
  if (error) throw errorBase(error);
  return enriquecerTurnos(data ?? [], { conNegocio: true });
}

/** El dueño cancela un turno pedido o confirmado y le avisa al negocio. */
export async function cancelarTurnoDueno(turno) {
  const { error } = await supabase.from('negocio_turnos')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('id', turno.id).eq('id_dueno', getCurrentUserId()).in('estado', ['pendiente', 'confirmado']);
  if (error) throw errorBase(error);
  notificarNegocio(turno.negocio?.idUser, 'Turno cancelado por el cliente',
    `${turno.mascota?.nombre ?? 'Mascota'} · ${turno.servicio} · ${fechaHoraFija(turno.fecha)}`, { destino: 'turnos' });
}

// ── Pacientes (veterinaria) / clientes (peluquería) ──────────────────────────

/**
 * Una ficha por mascota atendida (o con turno), armada con sus turnos:
 * visitas del más nuevo al más viejo, próximo turno, último informe y cuánto
 * se facturó. Ordenadas por la última actividad.
 */
export async function fetchPacientes(idNegocio) {
  const turnos = await fetchTurnosNegocio(idNegocio, { estados: ['pendiente', 'confirmado', 'completado', 'ausente'] });
  const ahora = Date.now();
  const fichas = new Map();
  turnos.forEach((t) => {
    if (t.idMascota == null) return;
    if (!fichas.has(t.idMascota)) fichas.set(t.idMascota, { mascota: t.mascota, dueno: t.dueno, turnos: [] });
    fichas.get(t.idMascota).turnos.push(t);
  });
  return [...fichas.values()].map((f) => {
    const visitas = f.turnos.filter((t) => t.estado === 'completado')
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const proximo = f.turnos.filter((t) => ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.fecha).getTime() > ahora)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0] ?? null;
    const ultimo = visitas[0] ?? null;
    const controles = visitas.map((v) => v.informe?.proximoControl).filter(Boolean)
      .filter((d) => new Date(d).getTime() > ahora).sort();
    return {
      ...f,
      visitas,
      ausencias: f.turnos.filter((t) => t.estado === 'ausente').length,
      proximo,
      ultimaVisita: ultimo?.fecha ?? null,
      ultimoInforme: visitas.find((v) => v.informe)?.informe ?? null,
      proximoControl: controles[0] ?? null,
      facturado: aCentavos(visitas.reduce((a, v) => a + v.precio, 0)),
      actividad: proximo?.fecha ?? ultimo?.fecha ?? f.turnos[0]?.fecha,
    };
  }).sort((a, b) => new Date(b.actividad) - new Date(a.actividad));
}
