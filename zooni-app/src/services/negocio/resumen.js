/**
 * negocio/resumen.js — Los números del Inicio del negocio (hoy y este mes).
 */

import { configNegocio } from '../../constants/negocios';
import { aCentavos } from '../../domain/paseos';
import { fetchItems } from './catalogo';
import { fetchPedidosNegocio } from './pedidos';
import { fetchTurnosNegocio } from './turnos';

const inicioDelDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const inicioDelMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export async function fetchResumenNegocio(negocio) {
  const hoy = inicioDelDia();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const mes = inicioDelMes();
  const cfg = configNegocio(negocio.tipo);

  const items = await fetchItems(negocio.id).catch(() => []);
  const base = {
    items: items.length,
    itemsActivos: items.filter((i) => i.activo).length,
    stockBajo: items.filter((i) => i.activo && i.stock != null && i.stock <= 3),
  };

  if (cfg.usaPedidos) {
    const pedidos = await fetchPedidosNegocio(negocio.id);
    const delMes = pedidos.filter((p) => new Date(p.creadoEn) >= mes);
    const entregadosMes = delMes.filter((p) => p.estado === 'entregado');
    return {
      ...base,
      nuevos: pedidos.filter((p) => p.estado === 'nuevo'),
      enCurso: pedidos.filter((p) => ['preparando', 'listo', 'en_camino'].includes(p.estado)),
      ventasMes: aCentavos(entregadosMes.reduce((a, p) => a + p.total, 0)),
      pedidosMes: entregadosMes.length,
      ticketPromedio: entregadosMes.length
        ? aCentavos(entregadosMes.reduce((a, p) => a + p.total, 0) / entregadosMes.length) : 0,
      hoy: pedidos.filter((p) => new Date(p.creadoEn) >= hoy).length,
    };
  }

  const turnos = await fetchTurnosNegocio(negocio.id, { desde: mes > hoy ? hoy : mes });
  const deHoy = turnos.filter((t) => new Date(t.fecha) >= hoy && new Date(t.fecha) < manana
    && ['pendiente', 'confirmado', 'completado'].includes(t.estado));
  const completadosMes = turnos.filter((t) => t.estado === 'completado' && new Date(t.fecha) >= mes);
  const proximos = await fetchTurnosNegocio(negocio.id, { desde: new Date(), estados: ['pendiente', 'confirmado'] });
  return {
    ...base,
    hoy: deHoy,
    pendientes: proximos.filter((t) => t.estado === 'pendiente'),
    urgencias: proximos.filter((t) => t.urgencia && t.estado === 'pendiente'),
    proximos: proximos.filter((t) => t.estado === 'confirmado').slice(0, 5),
    ingresosMes: aCentavos(completadosMes.reduce((a, t) => a + t.precio, 0)),
    atendidosMes: completadosMes.length,
  };
}
