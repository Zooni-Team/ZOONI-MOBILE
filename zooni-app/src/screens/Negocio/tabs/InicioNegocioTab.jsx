/**
 * InicioNegocioTab.jsx — El "panel de control" del negocio
 *
 *   · Estado: el switch grande para recibir (o no) turnos / pedidos nuevos, si
 *     está abierto ahora según su horario y —en veterinarias— urgencias 24 h.
 *   · Primeros pasos: lo que le falta cargar para que los clientes lo elijan
 *     (servicios o catálogo, logo, descripción). Desaparece cuando está todo.
 *   · Números del día y del mes:
 *       turnos  → hoy, por confirmar, facturado y atendidos en el mes
 *       pedidos → nuevos, en curso, ventas del mes y ticket promedio
 *   · Lo que hay que mirar ya: urgencias, turnos de hoy o pedidos nuevos, y
 *     productos con poco stock.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, Card, Seccion, Stat, SwitchGrande, sombra } from '../../../components/paseador/PaseadorUI';
import { PedidoCard, TurnoCard } from '../../../components/negocio/NegocioUI';
import {
  abiertoAhora, actualizarDatos, fetchResumenNegocio, formatoPlata, horarioDelDia, setAbiertoNegocio,
} from '../../../services/negocioApi';

function Paso({ hecho, titulo, texto, onPress }) {
  return (
    <TouchableOpacity style={s.paso} onPress={onPress} disabled={hecho} activeOpacity={0.85}>
      <Ionicons name={hecho ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={hecho ? C.teal : C.gris} />
      <View style={{ flex: 1 }}>
        <Text style={[s.pasoTitulo, hecho && s.pasoHecho]}>{titulo}</Text>
        {!hecho ? <Text style={s.pasoTxt}>{texto}</Text> : null}
      </View>
      {!hecho ? <Ionicons name="chevron-forward" size={18} color={C.teal} /> : null}
    </TouchableOpacity>
  );
}

export default function InicioNegocioTab({ negocio, setNegocio, cfg, irA, avisar, abrirChat, refrescarBadges }) {
  const [resumen, setResumen] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setResumen(await fetchResumenNegocio(negocio));
    } catch {
      setResumen((r) => r ?? { error: true });
    }
  }, [negocio]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarBadges()]);
    setRefrescando(false);
  };

  const cambiarAbierto = async (v) => {
    setGuardandoEstado(true);
    try {
      setNegocio(await setAbiertoNegocio(negocio, v));
      avisar(v ? cfg.abierto.on : `${cfg.abierto.off}: tus clientes no pueden pedir por ahora`, v ? 'radio-button-on' : 'pause-circle');
    } catch {
      avisar('No se pudo cambiar. Probá de nuevo.', 'alert-circle');
    } finally {
      setGuardandoEstado(false);
    }
  };

  const cambiarUrgencias = async () => {
    try {
      setNegocio(await actualizarDatos(negocio, { urgencias24h: !negocio.datos?.urgencias24h }));
    } catch {
      avisar('No se pudo cambiar. Probá de nuevo.', 'alert-circle');
    }
  };

  const hoy = horarioDelDia(negocio.horarios, new Date());
  const abiertoYa = abiertoAhora(negocio.horarios);
  const seccionItems = cfg.usaPedidos ? 'catalogo' : 'servicios';

  const pasos = resumen && !resumen.error ? [
    {
      hecho: resumen.itemsActivos > 0,
      titulo: cfg.usaPedidos ? 'Cargá tu catálogo' : 'Cargá tus servicios y precios',
      texto: cfg.usaPedidos ? 'Sin productos, tus clientes no pueden hacerte pedidos.' : 'Sin servicios, tus clientes no pueden pedir turno.',
      onPress: () => irA(seccionItems),
    },
    { hecho: !!negocio.logo, titulo: 'Subí tu logo', texto: 'Te reconocen más rápido en el mapa.', onPress: () => irA('perfil') },
    {
      hecho: (negocio.descripcion ?? '').trim().length > 10, titulo: 'Contá qué hacen',
      texto: 'Una descripción corta en tu ficha.', onPress: () => irA('perfil'),
    },
  ] : [];
  const faltan = pasos.filter((p) => !p.hecho).length;

  return (
    <ScrollView contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}>
      {/* Estado */}
      <Card style={[s.estado, negocio.abierto ? s.estadoOn : null]}>
        <View style={{ flex: 1 }}>
          <Text style={s.estadoTitulo}>{negocio.abierto ? cfg.abierto.on : cfg.abierto.off}</Text>
          <Text style={s.estadoTxt}>
            {negocio.abierto
              ? (cfg.usaPedidos ? 'Tus clientes pueden hacerte pedidos.' : 'Tus clientes pueden pedirte turnos.')
              : 'Nadie puede pedirte nada nuevo hasta que lo actives.'}
          </Text>
          <View style={s.horaHoy}>
            <View style={[s.punto, { backgroundColor: abiertoYa ? C.teal : C.gris }]} />
            <Text style={s.horaHoyTxt}>
              {abiertoYa ? `Abierto ahora · hasta las ${hoy.hasta}` : hoy.activo ? `Hoy de ${hoy.desde} a ${hoy.hasta}` : 'Hoy cerrado'}
            </Text>
          </View>
        </View>
        <SwitchGrande valor={negocio.abierto} onCambio={cambiarAbierto} disabled={guardandoEstado} />
      </Card>

      {negocio.tipo === 'veterinaria' && (
        <TouchableOpacity style={[s.urgencias, negocio.datos?.urgencias24h && s.urgenciasOn]} onPress={cambiarUrgencias}
          accessibilityRole="switch" accessibilityState={{ checked: !!negocio.datos?.urgencias24h }}>
          <Ionicons name="alert-circle" size={22} color={negocio.datos?.urgencias24h ? C.rojo : C.gris} />
          <View style={{ flex: 1 }}>
            <Text style={s.urgenciasTitulo}>Urgencias 24 h {negocio.datos?.urgencias24h ? 'activadas' : 'desactivadas'}</Text>
            <Text style={s.urgenciasTxt}>
              {negocio.datos?.urgencias24h
                ? 'Los dueños pueden pedirte turno urgente a cualquier hora.'
                : 'Tocá para recibir pedidos urgentes fuera de horario.'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {!resumen ? <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} /> : resumen.error ? (
        <Text style={s.error}>No se pudieron cargar tus números. Deslizá hacia abajo para reintentar.</Text>
      ) : (
        <>
          {faltan > 0 && (
            <>
              <Seccion titulo={`Primeros pasos · ${pasos.length - faltan} de ${pasos.length}`} />
              <Card style={{ paddingVertical: 6 }}>
                {pasos.map((p) => <Paso key={p.titulo} {...p} />)}
              </Card>
            </>
          )}

          {/* Números */}
          {cfg.usaPedidos ? (
            <View style={s.stats}>
              <TouchableOpacity style={s.statBox} onPress={() => irA('pedidos')}>
                <Stat valor={String(resumen.nuevos.length)} etiqueta="pedidos nuevos" icono="sparkles" />
              </TouchableOpacity>
              <TouchableOpacity style={s.statBox} onPress={() => irA('pedidos')}>
                <Stat valor={String(resumen.enCurso.length)} etiqueta="en curso" icono="cube" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.stats}>
              <TouchableOpacity style={s.statBox} onPress={() => irA('turnos')}>
                <Stat valor={String(resumen.hoy.length)} etiqueta="turnos hoy" icono="today" />
              </TouchableOpacity>
              <TouchableOpacity style={s.statBox} onPress={() => irA('turnos')}>
                <Stat valor={String(resumen.pendientes.length)} etiqueta="por confirmar" icono="hourglass" />
              </TouchableOpacity>
            </View>
          )}
          <Card style={s.mes}>
            <Text style={s.mesLabel}>{cfg.usaPedidos ? 'Ventas de este mes' : 'Facturado este mes'}</Text>
            <Text style={s.mesValor} numberOfLines={1} adjustsFontSizeToFit>
              {formatoPlata(cfg.usaPedidos ? resumen.ventasMes : resumen.ingresosMes)}
            </Text>
            <Text style={s.mesTxt}>
              {cfg.usaPedidos
                ? `${resumen.pedidosMes} ${resumen.pedidosMes === 1 ? 'pedido entregado' : 'pedidos entregados'}${resumen.pedidosMes ? ` · ticket promedio ${formatoPlata(resumen.ticketPromedio)}` : ''}`
                : `${resumen.atendidosMes} ${resumen.atendidosMes === 1 ? 'turno atendido' : 'turnos atendidos'}`}
            </Text>
          </Card>

          {/* Lo urgente */}
          {!cfg.usaPedidos && resumen.urgencias.length > 0 && (
            <>
              <Seccion titulo="🚨 Urgencias por confirmar" accion="Ver" onAccion={() => irA('turnos')} />
              {resumen.urgencias.map((t) => (
                <TurnoCard key={t.id} turno={t} mostrarFecha onPress={() => irA('turnos')}
                  onChat={() => abrirChat(t.idDueno, t.dueno.nombre)} />
              ))}
            </>
          )}

          {!cfg.usaPedidos && (
            <>
              <Seccion titulo="Turnos de hoy" accion="Agenda" onAccion={() => irA('turnos')} />
              {resumen.hoy.length ? resumen.hoy.map((t) => (
                <TurnoCard key={t.id} turno={t} onPress={() => irA('turnos')}
                  onChat={() => abrirChat(t.idDueno, t.dueno.nombre)} />
              )) : (
                <Text style={s.vacio}>No tenés turnos hoy.</Text>
              )}
              {resumen.proximos.length > 0 && (
                <>
                  <Seccion titulo="Próximos confirmados" />
                  {resumen.proximos.filter((t) => !resumen.hoy.some((h) => h.id === t.id)).slice(0, 3).map((t) => (
                    <TurnoCard key={t.id} turno={t} mostrarFecha onPress={() => irA('turnos')} />
                  ))}
                </>
              )}
            </>
          )}

          {cfg.usaPedidos && (
            <>
              <Seccion titulo="Pedidos nuevos" accion="Ver todos" onAccion={() => irA('pedidos')} />
              {resumen.nuevos.length ? resumen.nuevos.slice(0, 3).map((p) => (
                <TouchableOpacity key={p.id} activeOpacity={0.9} onPress={() => irA('pedidos')}>
                  <PedidoCard pedido={p} onChat={() => abrirChat(p.idDueno, p.dueno.nombre)} />
                </TouchableOpacity>
              )) : (
                <Text style={s.vacio}>No hay pedidos nuevos.</Text>
              )}
            </>
          )}

          {resumen.stockBajo?.length > 0 && (
            <>
              <Seccion titulo="Poco stock" accion="Catálogo" onAccion={() => irA('catalogo')} />
              <Card style={{ paddingVertical: 4 }}>
                {resumen.stockBajo.slice(0, 6).map((it) => (
                  <View key={it.id} style={s.stockFila}>
                    <Text style={s.stockNombre} numberOfLines={1}>{it.nombre}</Text>
                    <Text style={[s.stockCant, it.stock === 0 && { color: C.rojo }]}>
                      {it.stock === 0 ? 'Sin stock' : `Quedan ${it.stock}`}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  estadoOn: { backgroundColor: '#F2FCF6', borderWidth: 1.5, borderColor: C.menta },
  estadoTitulo: { fontSize: 19, fontWeight: '900', color: C.texto },
  estadoTxt: { fontSize: 13, color: C.texto2, marginTop: 2, lineHeight: 18 },
  horaHoy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  horaHoyTxt: { fontSize: 12, fontWeight: '700', color: C.texto },

  urgencias: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: '#EEEEEE', ...sombra,
  },
  urgenciasOn: { borderColor: '#F5B7BD', backgroundColor: '#FFF7F8' },
  urgenciasTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  urgenciasTxt: { fontSize: 12, color: C.texto2, marginTop: 2 },

  paso: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pasoTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  pasoHecho: { color: C.texto2, textDecorationLine: 'line-through' },
  pasoTxt: { fontSize: 12, color: C.texto2, marginTop: 1 },

  stats: { flexDirection: 'row', gap: 12, marginTop: 18 },
  statBox: { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 16, ...sombra },
  mes: { marginTop: 12, backgroundColor: C.menta },
  mesLabel: { fontSize: 13, fontWeight: '700', color: C.texto },
  mesValor: { fontSize: 36, fontWeight: '900', color: C.texto, marginTop: 2 },
  mesTxt: { fontSize: 12, color: C.texto2, fontWeight: '600', marginTop: 2 },

  vacio: { fontSize: 14, color: C.texto2, textAlign: 'center', paddingVertical: 12 },
  error: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 30 },
  stockFila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  stockNombre: { flex: 1, fontSize: 14, color: C.texto, fontWeight: '600', marginRight: 10 },
  stockCant: { fontSize: 13, fontWeight: '800', color: C.ambar },
});
