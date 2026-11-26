import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { aCentavos, formatoPlata } from '../../domain/paseos';
import { costoEnvio, siguienteEstadoPedido } from '../../domain/negocios';
import { errorBase } from '../comun';
import { notificarNegocio } from './avisos';
import { usuariosPorId, negociosPorId } from './enriquecer';

export function mapPedido(r, usuarios = {}, negocios = {}) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    idDueno: r.id_dueno,
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal ?? 0),
    envio: Number(r.envio ?? 0),
    total: Number(r.total ?? 0),
    entrega: r.entrega,
    direccion: r.direccion ?? null,
    medioPago: r.medio_pago ?? null,
    notas: r.notas ?? '',
    estado: r.estado,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
    dueno: usuarios[r.id_dueno] ?? { id: r.id_dueno, nombre: 'Cliente', foto: null },
    negocio: negocios[r.id_negocio] ?? null,
  };
}

export async function fetchPedidosNegocio(idNegocio) {
  const { data, error } = await supabase.from('negocio_pedidos').select('*')
    .eq('id_negocio', idNegocio).order('creado_en', { ascending: false }).limit(300);
  if (error) throw errorBase(error);
  const usuarios = await usuariosPorId((data ?? []).map((r) => r.id_dueno));
  return (data ?? []).map((r) => mapPedido(r, usuarios));
}

export async function cambiarEstadoPedido(negocio, pedido, estado, { motivo } = {}) {
  const permitido = estado === 'rechazado' ? pedido.estado === 'nuevo'
    : estado === 'cancelado' ? ['preparando', 'listo'].includes(pedido.estado)
      : siguienteEstadoPedido(pedido) === estado;
  if (!permitido) throw new Error('transicion_invalida');

  const { data, error } = await supabase.from('negocio_pedidos')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('id', pedido.id).eq('id_negocio', negocio.id).eq('estado', pedido.estado)
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('pedido_cambiado');

  const n = `#${pedido.id}`;
  const avisos = {
    preparando: ['Pedido confirmado 🛍️', `${negocio.nombre} está preparando tu pedido ${n}.`],
    listo: ['¡Tu pedido está listo!', `Ya podés retirar el pedido ${n} en ${negocio.nombre} (${negocio.direccion}).`],
    en_camino: ['Tu pedido va en camino 🛵', `${negocio.nombre} despachó el pedido ${n}.`],
    entregado: ['Pedido entregado ✅', `¡Gracias por comprar en ${negocio.nombre}!`],
    rechazado: ['Pedido no disponible', `${negocio.nombre} no puede tomar el pedido ${n}.${motivo ? ` "${motivo}"` : ''}`],
    cancelado: ['Pedido cancelado', `${negocio.nombre} canceló el pedido ${n}.${motivo ? ` "${motivo}"` : ''}`],
  };
  if (avisos[estado]) {
    notificarNegocio(pedido.idDueno, avisos[estado][0], avisos[estado][1], { tipo: 'pedido', extra: { idPedido: pedido.id } });
  }
  return { ...pedido, estado };
}

export async function crearPedido({ negocio, carrito, entrega, direccion, medioPago, notas }) {
  if (!negocio.abierto) throw new Error('negocio_cerrado');
  const lineas = carrito.filter((x) => x.cantidad > 0);
  if (!lineas.length) throw new Error('carrito_vacio');

  const { data: actuales, error: errItems } = await supabase.from('negocio_items')
    .select('id, nombre, precio, stock, activo').in('id', lineas.map((x) => x.item.id));
  if (errItems) throw errorBase(errItems);
  const porId = Object.fromEntries((actuales ?? []).map((x) => [x.id, x]));
  const sinStock = lineas.filter((x) => {
    const it = porId[x.item.id];
    return !it || !it.activo || (it.stock != null && it.stock < x.cantidad);
  });
  if (sinStock.length) {
    const e = new Error('sin_stock');
    e.productos = sinStock.map((x) => x.item.nombre);
    throw e;
  }

  const items = lineas.map((x) => ({
    idItem: x.item.id, nombre: porId[x.item.id].nombre, precio: Number(porId[x.item.id].precio), cantidad: x.cantidad,
  }));
  const subtotal = aCentavos(items.reduce((a, x) => a + x.precio * x.cantidad, 0));
  const minimo = Number(negocio.datos?.pedidoMinimo) || 0;
  if (minimo > 0 && subtotal < minimo) throw new Error('pedido_minimo');
  const envio = entrega === 'envio' ? (costoEnvio(negocio, subtotal) ?? 0) : 0;
  if (entrega === 'envio' && !negocio.datos?.envios) throw new Error('sin_envios');

  const { data, error } = await supabase.from('negocio_pedidos').insert({
    id_negocio: negocio.id,
    id_dueno: getCurrentUserId(),
    items,
    subtotal,
    envio,
    total: aCentavos(subtotal + envio),
    entrega,
    direccion: entrega === 'envio' ? direccion?.trim() || null : null,
    medio_pago: medioPago ?? null,
    notas: notas?.trim().slice(0, 500) || null,
  }).select('id, total').single();
  if (error) {
    const msg = String(error.message ?? '');
    const codigo = ['sin_stock', 'pedido_minimo', 'sin_envios', 'negocio_cerrado', 'carrito_vacio']
      .find((c) => msg.includes(c));
    if (codigo === 'sin_stock') {
      const e = new Error('sin_stock');
      e.productos = String(error.details ?? '').split(', ').filter(Boolean);
      throw e;
    }
    if (codigo) throw new Error(codigo);
    throw errorBase(error);
  }

  const unidades = items.reduce((a, x) => a + x.cantidad, 0);
  notificarNegocio(negocio.idUser, `Nuevo pedido #${data.id} 🛍️`,
    `${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${formatoPlata(data.total)} · ${entrega === 'envio' ? 'envío a domicilio' : 'retira en el local'}`,
    { destino: 'pedidos' });
  return data.id;
}

export async function fetchMisPedidos() {
  const { data, error } = await supabase.from('negocio_pedidos').select('*')
    .eq('id_dueno', getCurrentUserId()).order('creado_en', { ascending: false }).limit(100);
  if (error) throw errorBase(error);
  const negocios = await negociosPorId((data ?? []).map((r) => r.id_negocio));
  return (data ?? []).map((r) => mapPedido(r, {}, negocios));
}

export async function cancelarPedidoDueno(pedido) {
  const { data, error } = await supabase.from('negocio_pedidos')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('id', pedido.id).eq('id_dueno', getCurrentUserId()).eq('estado', 'nuevo')
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('pedido_cambiado');
  notificarNegocio(pedido.negocio?.idUser, `Pedido #${pedido.id} cancelado`, 'El cliente canceló el pedido antes de que lo prepararas.',
    { destino: 'pedidos' });
}

export async function fetchClientesPetshop(idNegocio) {
  const pedidos = await fetchPedidosNegocio(idNegocio);
  const porDueno = new Map();
  pedidos.forEach((p) => {
    if (!porDueno.has(p.idDueno)) porDueno.set(p.idDueno, { dueno: p.dueno, pedidos: [] });
    porDueno.get(p.idDueno).pedidos.push(p);
  });
  return [...porDueno.values()].map((c) => {
    const entregados = c.pedidos.filter((p) => p.estado === 'entregado');
    const productos = new Map();
    entregados.forEach((p) => p.items.forEach((x) => productos.set(x.nombre, (productos.get(x.nombre) ?? 0) + x.cantidad)));
    return {
      ...c,
      comprado: aCentavos(entregados.reduce((a, p) => a + p.total, 0)),
      compras: entregados.length,
      ultimo: c.pedidos[0]?.creadoEn ?? null,
      favoritos: [...productos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre]) => nombre),
    };
  }).sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));
}
