/**
 * negocio/chat.js — Chat del negocio con sus clientes. Reusa la tabla
 * "Mensaje": el hilo es (idServicio, dueño) y "deNegocio" dice quién escribió.
 * Los mensajes nuevos llegan por Realtime (hooks/useRecargaEnVivo).
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { configNegocio } from '../../constants/negocios';
import { errorBase } from '../comun';
import { notificarNegocio } from './avisos';
import { usuariosPorId } from './enriquecer';
import { mapPedido } from './pedidos';
import { enriquecerTurnos } from './turnos';

/** Conversaciones del negocio: una por dueño que le escribió, la más reciente arriba. */
export async function fetchConversacionesNegocio(idServicio) {
  if (!idServicio) return [];
  const { data, error } = await supabase.from('Mensaje').select('*')
    .eq('idServicio', idServicio).order('fecha', { ascending: false }).limit(500);
  if (error) throw errorBase(error);
  const hilos = new Map();
  (data ?? []).forEach((m) => {
    if (!hilos.has(m.idUsuario)) hilos.set(m.idUsuario, { idDueno: m.idUsuario, ultimo: m, sinLeer: 0 });
    if (!m.deNegocio && !m.leido) hilos.get(m.idUsuario).sinLeer += 1;
  });
  const usuarios = await usuariosPorId([...hilos.keys()]);
  return [...hilos.values()].map((h) => ({
    idDueno: h.idDueno,
    dueno: usuarios[h.idDueno] ?? { id: h.idDueno, nombre: 'Cliente', foto: null },
    ultimoTexto: h.ultimo.texto,
    ultimoMio: !!h.ultimo.deNegocio,
    fecha: h.ultimo.fecha,
    sinLeer: h.sinLeer,
  }));
}

export async function contarNoLeidosNegocio(idServicio) {
  if (!idServicio) return 0;
  const { count } = await supabase.from('Mensaje').select('id', { count: 'exact', head: true })
    .eq('idServicio', idServicio).eq('deNegocio', false).eq('leido', false);
  return count ?? 0;
}

export async function getMensajesNegocio(idServicio, idDueno) {
  const { data, error } = await supabase.from('Mensaje').select('*')
    .eq('idServicio', idServicio).eq('idUsuario', idDueno).order('fecha', { ascending: true });
  if (error) throw errorBase(error);
  return (data ?? []).map((m) => ({
    id: m.id, texto: m.texto, fecha: m.fecha, leido: !!m.leido, autor: m.deNegocio ? 'yo' : 'otro',
  }));
}

export async function marcarLeidosNegocio(idServicio, idDueno) {
  await supabase.from('Mensaje').update({ leido: true })
    .eq('idServicio', idServicio).eq('idUsuario', idDueno).eq('deNegocio', false).eq('leido', false);
}

/**
 * Lo que el negocio necesita saber de un cliente mientras chatea con él:
 * quién es, su próximo turno (o el pedido que tiene en curso) y cuántas veces
 * vino o compró. Nunca falla: sin datos devuelve lo mínimo.
 */
export async function fetchContextoCliente(negocio, idDueno) {
  const [usuarios, filas] = await Promise.all([
    usuariosPorId([idDueno]),
    configNegocio(negocio.tipo).usaPedidos
      ? supabase.from('negocio_pedidos').select('*').eq('id_negocio', negocio.id).eq('id_dueno', idDueno)
        .order('creado_en', { ascending: false }).limit(20)
      : supabase.from('negocio_turnos').select('*').eq('id_negocio', negocio.id).eq('id_dueno', idDueno)
        .order('fecha', { ascending: false }).limit(30),
  ]).catch(() => [{}, { data: [] }]);
  const dueno = usuarios[idDueno] ?? { id: idDueno, nombre: 'Cliente', foto: null, telefono: null };

  if (configNegocio(negocio.tipo).usaPedidos) {
    const pedidos = (filas.data ?? []).map((r) => mapPedido(r, usuarios));
    return {
      dueno,
      pedidoActivo: pedidos.find((p) => ['nuevo', 'preparando', 'listo', 'en_camino'].includes(p.estado)) ?? null,
      compras: pedidos.filter((p) => p.estado === 'entregado').length,
    };
  }
  const turnos = await enriquecerTurnos(filas.data ?? []).catch(() => []);
  const ahora = Date.now();
  return {
    dueno,
    proximoTurno: turnos
      .filter((t) => ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.fecha).getTime() > ahora - 3600000)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0] ?? null,
    visitas: turnos.filter((t) => t.estado === 'completado').length,
    mascotas: [...new Map(turnos.filter((t) => t.idMascota).map((t) => [t.idMascota, t.mascota])).values()],
  };
}

/** El negocio le contesta a un dueño. Al dueño le llega la notificación al chat. */
export async function enviarMensajeNegocio(negocio, idDueno, texto) {
  const limpio = texto.trim().slice(0, 2000);
  if (!limpio) return;
  const { error } = await supabase.from('Mensaje').insert({
    idUsuario: idDueno, idServicio: negocio.idServicio, texto: limpio,
    fecha: new Date().toISOString(), deNegocio: true,
  });
  if (error) throw errorBase(error);
  notificarNegocio(idDueno, `Mensaje de ${negocio.nombre}`, limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio, {
    tipo: 'mensaje',
    extra: { servicioId: negocio.idServicio, nombre: negocio.nombre, tipoServicio: configNegocio(negocio.tipo).label },
  });
}

/**
 * Pines de Comunidad ("servicios") de los negocios que contraté: les pedí un
 * turno o les hice un pedido. Para la pestaña Servicios de Mensajes. Sin la
 * 046 (o sin red) devuelve [].
 */
export async function fetchServiciosContratados() {
  const yo = getCurrentUserId();
  if (yo == null) return [];
  const [turnos, pedidos] = await Promise.all([
    supabase.from('negocio_turnos').select('id_negocio').eq('id_dueno', yo),
    supabase.from('negocio_pedidos').select('id_negocio').eq('id_dueno', yo),
  ]);
  const ids = [...new Set([...(turnos.data ?? []), ...(pedidos.data ?? [])].map((r) => r.id_negocio).filter(Boolean))];
  if (!ids.length) return [];
  const { data } = await supabase.from('servicios').select('*').in('id_negocio', ids);
  return data ?? [];
}
