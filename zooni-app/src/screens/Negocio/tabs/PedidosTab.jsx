/**
 * PedidosTab.jsx — Pedidos del pet shop
 *
 *   Nuevos      Aceptar (pasa a "En preparación" y descuenta el stock) ·
 *               Rechazar (con motivo opcional)
 *   En curso    el paso siguiente según la entrega:
 *                 retiro → "Listo para retirar" → "Entregado"
 *                 envío  → "Salió el envío"     → "Entregado"
 *               y Cancelar mientras no se entregó
 *   Historial   entregados, cancelados y rechazados, con lo vendido
 *
 * Cada paso le llega al dueño como notificación (negocioApi).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View,
} from 'react-native';

import { C, PillButton, Vacio } from '../../../components/paseador/PaseadorUI';
import { MotivoModal, PedidoCard, Segmento } from '../../../components/negocio/NegocioUI';
import {
  cambiarEstadoPedido, fetchPedidosNegocio, formatoPlata, siguienteEstadoPedido,
} from '../../../services/negocioApi';

const TEXTO_SIGUIENTE = {
  preparando: { titulo: 'Aceptar', icono: 'checkmark', aviso: 'Pedido aceptado: descontamos el stock' },
  listo: { titulo: 'Listo para retirar', icono: 'bag-check', aviso: 'Le avisamos que puede pasar a buscarlo' },
  en_camino: { titulo: 'Salió el envío', icono: 'bicycle', aviso: 'Le avisamos que va en camino' },
  entregado: { titulo: 'Entregado', icono: 'checkmark-done', aviso: '¡Venta cerrada!' },
};

export default function PedidosTab({ negocio, avisar, abrirChat, refrescarBadges }) {
  const [pedidos, setPedidos] = useState(null);
  const [vista, setVista] = useState('nuevos');
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [motivo, setMotivo] = useState(null); // { pedido, estado }

  const cargar = useCallback(async () => {
    try {
      setPedidos(await fetchPedidosNegocio(negocio.id));
    } catch {
      setPedidos((p) => p ?? []);
      avisar('No se pudieron cargar los pedidos.', 'alert-circle');
    }
  }, [negocio.id, avisar]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarBadges()]);
    setRefrescando(false);
  };

  const lista = pedidos ?? [];
  const grupos = useMemo(() => ({
    nuevos: lista.filter((p) => p.estado === 'nuevo').sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn)),
    curso: lista.filter((p) => ['preparando', 'listo', 'en_camino'].includes(p.estado)),
    historial: lista.filter((p) => ['entregado', 'cancelado', 'rechazado'].includes(p.estado)),
  }), [lista]);

  const cambiar = async (pedido, estado, extra) => {
    setOcupado(pedido.id);
    try {
      const nuevo = await cambiarEstadoPedido(negocio, pedido, estado, extra);
      setPedidos((ps) => ps.map((p) => (p.id === pedido.id ? nuevo : p)));
      refrescarBadges();
      avisar(TEXTO_SIGUIENTE[estado]?.aviso
        ?? (estado === 'rechazado' ? 'Pedido rechazado: le avisamos al cliente' : 'Pedido cancelado: le avisamos al cliente'));
    } catch (err) {
      avisar(err?.message === 'pedido_cambiado'
        ? 'El pedido cambió mientras tanto (¿lo canceló el cliente?). Actualizamos la lista.'
        : 'No se pudo actualizar el pedido. Probá de nuevo.', 'alert-circle');
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  if (pedidos === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  const vendido = grupos.historial.filter((p) => p.estado === 'entregado').reduce((a, p) => a + p.total, 0);
  const datos = vista === 'nuevos' ? grupos.nuevos : vista === 'curso' ? grupos.curso : grupos.historial;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <Segmento
          opciones={[
            { key: 'nuevos', label: 'Nuevos', badge: grupos.nuevos.length || null },
            { key: 'curso', label: 'En curso', badge: grupos.curso.length || null },
            { key: 'historial', label: 'Historial' },
          ]}
          valor={vista}
          onCambio={setVista}
        />
      </View>
      <FlatList
        data={datos}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListHeaderComponent={vista === 'historial' && vendido > 0 ? (
          <Text style={s.resumen}>Vendido en total: {formatoPlata(vendido)}</Text>
        ) : null}
        ListEmptyComponent={
          <Vacio
            icono={vista === 'nuevos' ? 'receipt-outline' : vista === 'curso' ? 'cube-outline' : 'time-outline'}
            titulo={vista === 'nuevos' ? 'No hay pedidos nuevos' : vista === 'curso' ? 'Nada en preparación' : 'Todavía no hay historial'}
            texto={vista === 'nuevos' ? 'Cuando un cliente te haga un pedido, aparece acá y te llega una notificación.' : undefined}
          />
        }
        renderItem={({ item: p }) => {
          const siguiente = siguienteEstadoPedido(p);
          const txt = TEXTO_SIGUIENTE[siguiente];
          const conAcciones = ['nuevo', 'preparando', 'listo', 'en_camino'].includes(p.estado);
          return (
            <PedidoCard pedido={p} onChat={() => abrirChat(p.idDueno, p.dueno.nombre)}>
              {conAcciones ? (
                <>
                  {p.estado === 'nuevo' ? (
                    <PillButton titulo="Rechazar" variante="secundario" chico disabled={ocupado === p.id}
                      onPress={() => setMotivo({ pedido: p, estado: 'rechazado' })} style={{ flex: 1 }} />
                  ) : p.estado !== 'en_camino' ? (
                    <PillButton titulo="Cancelar" variante="secundario" chico disabled={ocupado === p.id}
                      onPress={() => setMotivo({ pedido: p, estado: 'cancelado' })} style={{ flex: 1 }} />
                  ) : null}
                  {txt ? (
                    <PillButton titulo={txt.titulo} icono={txt.icono} variante={siguiente === 'preparando' ? 'teal' : 'primario'}
                      chico cargando={ocupado === p.id} onPress={() => cambiar(p, siguiente)} style={{ flex: 1.4 }} />
                  ) : null}
                </>
              ) : null}
            </PedidoCard>
          );
        }}
      />
      <MotivoModal
        visible={!!motivo}
        titulo={motivo?.estado === 'rechazado' ? '¿Rechazar el pedido?' : '¿Cancelar el pedido?'}
        texto={motivo ? `Pedido #${motivo.pedido.id} de ${motivo.pedido.dueno.nombre}. Le avisamos al cliente.` : ''}
        textoOk={motivo?.estado === 'rechazado' ? 'Rechazar' : 'Cancelar pedido'}
        placeholder="Ej: No nos queda ese alimento, ¿te sirve otra marca?"
        onCerrar={() => setMotivo(null)}
        onConfirmar={async (texto) => {
          const { pedido, estado } = motivo;
          setMotivo(null);
          await cambiar(pedido, estado, { motivo: texto });
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 16 },
  lista: { padding: 20, paddingBottom: 40 },
  resumen: { fontSize: 13, fontWeight: '700', color: C.texto2, marginBottom: 10 },
});
