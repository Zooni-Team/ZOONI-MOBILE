/**
 * MisTurnosScreen.jsx — "Turnos y pedidos" del dueño
 *
 * Todo lo que contrató en veterinarias, peluquerías y pet shops de Zooni:
 *
 *   Turnos   Próximos (por confirmar / confirmados) y Anteriores. Cada uno con
 *            el negocio, la mascota, el servicio, cuándo y cuánto. Se puede
 *            cancelar mientras no pasó, chatear con el negocio, ver el informe
 *            de la consulta (veterinaria: diagnóstico, indicaciones, peso,
 *            temperatura y próximo control) o las fotos de cómo quedó
 *            (peluquería), y "Volver a pedir" el mismo servicio.
 *   Pedidos  Con el seguimiento paso a paso (recibido → en preparación →
 *            listo / en camino → entregado). Se cancela mientras el pet shop
 *            no lo aceptó.
 *
 * Se refresca sola cada 30 s mientras está abierta (para ver confirmaciones).
 * Llegan acá las notificaciones de turnos y pedidos.
 *
 * Params: { tab?: 'turnos' | 'pedidos', aviso? }
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import HamburgerDrawer from '../components/HamburgerDrawer';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { MEDIOS_PAGO_NEGOCIO, configNegocio } from '../constants/negocios';
import {
  cancelarPedidoDueno, cancelarTurnoDueno, cuandoTexto, fetchMisPedidos, fetchMisTurnos, formatoPlata,
} from '../services/negocioApi';
import { confirmar } from '../utils/dialogo';

const VERDE = '#2DBD72';
const MENTA = '#C8F0D8';
const AMARILLO = '#F5C842';
const ROJO = '#E63946';
const AMBAR = '#F5A623';
const AZUL = '#2B6CB0';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';
const POLL_MS = 30000;

// Mismos estados que ve el negocio, contados desde el lado del dueño
const ESTADO_TURNO = {
  pendiente: { txt: 'Esperando confirmación', icono: 'hourglass-outline', color: AMBAR, fondo: '#FFF1DC' },
  confirmado: { txt: 'Confirmado', icono: 'checkmark-circle', color: VERDE, fondo: '#E3F7EC' },
  completado: { txt: 'Atendido', icono: 'ribbon-outline', color: AZUL, fondo: '#E6F0FA' },
  rechazado: { txt: 'No pudieron atenderte', icono: 'close-circle', color: ROJO, fondo: '#FDECEE' },
  cancelado: { txt: 'Cancelado', icono: 'ban', color: TEXTO2, fondo: '#F1F1F1' },
  ausente: { txt: 'No fuiste', icono: 'person-remove-outline', color: TEXTO2, fondo: '#F1F1F1' },
};
const ESTADO_PEDIDO = {
  nuevo: { txt: 'Esperando que lo acepten', icono: 'hourglass-outline', color: AMBAR, fondo: '#FFF1DC' },
  preparando: { txt: 'En preparación', icono: 'cube-outline', color: AZUL, fondo: '#E6F0FA' },
  listo: { txt: 'Listo para retirar', icono: 'bag-check', color: VERDE, fondo: '#E3F7EC' },
  en_camino: { txt: 'En camino', icono: 'bicycle', color: VERDE, fondo: '#E3F7EC' },
  entregado: { txt: 'Entregado', icono: 'checkmark-done', color: AZUL, fondo: '#E6F0FA' },
  cancelado: { txt: 'Cancelado', icono: 'ban', color: TEXTO2, fondo: '#F1F1F1' },
  rechazado: { txt: 'No pudieron tomarlo', icono: 'close-circle', color: ROJO, fondo: '#FDECEE' },
};

function Estado({ e }) {
  return (
    <View style={[s.estado, { backgroundColor: e.fondo }]}>
      <Ionicons name={e.icono} size={13} color={e.color} />
      <Text style={[s.estadoTxt, { color: e.color }]}>{e.txt}</Text>
    </View>
  );
}

function LogoNegocio({ negocio, size = 46 }) {
  const cfg = configNegocio(negocio?.tipo);
  return negocio?.logo
    ? <Image source={{ uri: negocio.logo }} style={{ width: size, height: size, borderRadius: size * 0.3 }} />
    : (
      <View style={{
        width: size, height: size, borderRadius: size * 0.3, backgroundColor: cfg.fondoIcono,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={cfg.icono} size={size * 0.5} color={cfg.color} />
      </View>
    );
}

/** Pasos del pedido según cómo se entrega. */
function Seguimiento({ pedido }) {
  const pasos = ['nuevo', 'preparando', pedido.entrega === 'envio' ? 'en_camino' : 'listo', 'entregado'];
  const textos = { nuevo: 'Recibido', preparando: 'Preparando', listo: 'Para retirar', en_camino: 'En camino', entregado: 'Entregado' };
  const actual = pasos.indexOf(pedido.estado);
  return (
    <View style={s.seguimiento}>
      {pasos.map((p, i) => {
        const hecho = i <= actual;
        return (
          <View key={p} style={s.paso}>
            <View style={s.pasoFila}>
              {i > 0 ? <View style={[s.pasoLinea, i <= actual && { backgroundColor: VERDE }]} /> : <View style={s.pasoLineaVacia} />}
              <View style={[s.pasoPunto, hecho && s.pasoPuntoOn, i === actual && s.pasoPuntoActual]}>
                {hecho ? <Ionicons name="checkmark" size={11} color="#FFF" /> : null}
              </View>
              {i < pasos.length - 1 ? <View style={[s.pasoLinea, i < actual && { backgroundColor: VERDE }]} /> : <View style={s.pasoLineaVacia} />}
            </View>
            <Text style={[s.pasoTxt, hecho && { color: TEXTO, fontWeight: '800' }]}>{textos[p]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Lo que dejó el negocio al atender: informe veterinario o fotos de la peluquería. */
function InformeDueno({ turno, onCerrar }) {
  const i = turno?.informe ?? {};
  const esVet = turno?.negocio?.tipo === 'veterinaria';
  const Dato = ({ icono, titulo, texto }) => (texto ? (
    <View style={s.dato}>
      <Ionicons name={icono} size={18} color={VERDE} />
      <View style={{ flex: 1 }}>
        <Text style={s.datoTitulo}>{titulo}</Text>
        <Text style={s.datoTxt}>{texto}</Text>
      </View>
    </View>
  ) : null);
  return (
    <Modal visible={!!turno} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color={TEXTO} />
          </TouchableOpacity>
          <Text style={s.titulo}>{esVet ? 'Informe de la consulta' : 'Cómo quedó'}</Text>
          <View style={{ width: 26 }} />
        </View>
        {turno ? (
          <ScrollView contentContainerStyle={s.lista}>
            <View style={s.card}>
              <View style={s.fila}>
                <Image source={turno.mascota.visual} style={s.foto} />
                <View style={{ flex: 1 }}>
                  <Text style={s.nombre}>{turno.mascota.nombre} · {turno.servicio}</Text>
                  <Text style={s.sub}>{turno.negocio?.nombre} · {cuandoTexto(turno.fecha)}</Text>
                </View>
              </View>
            </View>
            {esVet ? (
              <View style={[s.card, { marginTop: 12, gap: 14 }]}>
                <Dato icono="help-circle-outline" titulo="Motivo de la consulta" texto={i.motivo} />
                <Dato icono="pulse-outline" titulo="Diagnóstico" texto={i.diagnostico} />
                <Dato icono="medkit-outline" titulo="Tratamiento e indicaciones" texto={i.tratamiento} />
                {(i.peso != null || i.temperatura != null) ? (
                  <View style={s.medidas}>
                    {i.peso != null ? (
                      <View style={s.medida}>
                        <Text style={s.medidaValor}>{String(i.peso).replace('.', ',')} kg</Text>
                        <Text style={s.medidaTxt}>peso</Text>
                      </View>
                    ) : null}
                    {i.temperatura != null ? (
                      <View style={s.medida}>
                        <Text style={s.medidaValor}>{String(i.temperatura).replace('.', ',')} °C</Text>
                        <Text style={s.medidaTxt}>temperatura</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {i.proximoControl ? (
                  <View style={s.control}>
                    <Ionicons name="alarm" size={20} color="#B07A00" />
                    <Text style={s.controlTxt}>
                      Próximo control: {new Date(i.proximoControl).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                ) : null}
                <Dato icono="document-text-outline" titulo="Notas" texto={i.notas} />
              </View>
            ) : (
              <View style={[s.card, { marginTop: 12 }]}>
                {i.notas ? <Text style={s.datoTxt}>{i.notas}</Text> : null}
                {i.fotos?.length ? (
                  <View style={s.fotos}>
                    {i.fotos.map((u) => <Image key={u} source={{ uri: u }} style={s.fotoTrabajo} />)}
                  </View>
                ) : null}
                {!i.notas && !i.fotos?.length ? <Text style={s.sub}>La peluquería no dejó notas ni fotos.</Text> : null}
              </View>
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export default function MisTurnosScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { usuario, mascotaActiva } = useUsuarioActivo();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState(route.params?.tab ?? 'turnos');
  const [turnos, setTurnos] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(route.params?.aviso ?? null);
  const [refrescando, setRefrescando] = useState(false);
  const [informe, setInforme] = useState(null);

  const cargar = useCallback(async () => {
    const [t, p] = await Promise.allSettled([fetchMisTurnos(), fetchMisPedidos()]);
    setTurnos(t.status === 'fulfilled' ? t.value : (x) => x ?? []);
    setPedidos(p.status === 'fulfilled' ? p.value : (x) => x ?? []);
    const err = [t, p].find((r) => r.status === 'rejected')?.reason;
    setError(err ? (err.message === 'migracion_pendiente'
      ? 'A la base de datos le falta Zooni Negocios: es necesario correr la migración 046.'
      : 'No se pudo cargar todo. Deslizá hacia abajo para reintentar.') : null);
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar]));

  // Si llega una notificación con otra pestaña / aviso estando ya abierta
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
    if (route.params?.aviso) setAviso(route.params.aviso);
  }, [route.params?.tab, route.params?.aviso]);

  useEffect(() => {
    if (!aviso) return undefined;
    navigation.setParams({ aviso: undefined });
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso, navigation]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const chat = (negocio) => {
    if (!negocio?.idServicio) return;
    navigation.navigate('Chat', {
      servicioId: negocio.idServicio, nombre: negocio.nombre, tipoServicio: configNegocio(negocio.tipo).label,
    });
  };

  const cancelarTurno = async (t) => {
    const ok = await confirmar(`¿Cancelar el turno de ${t.mascota.nombre}?`,
      `${t.servicio} · ${cuandoTexto(t.fecha)}. Le avisamos a ${t.negocio?.nombre ?? 'el negocio'}.`,
      { textoOk: 'Cancelar turno', textoCancelar: 'Volver', destructivo: true });
    if (!ok) return;
    try {
      await cancelarTurnoDueno(t);
      setAviso('Turno cancelado. Le avisamos al negocio.');
      cargar();
    } catch {
      setError('No se pudo cancelar. Probá de nuevo.');
    }
  };

  const cancelarPedido = async (p) => {
    const ok = await confirmar(`¿Cancelar el pedido #${p.id}?`, 'Todavía no lo aceptaron, así que no hay problema.',
      { textoOk: 'Cancelar pedido', textoCancelar: 'Volver', destructivo: true });
    if (!ok) return;
    try {
      await cancelarPedidoDueno(p);
      setAviso('Pedido cancelado.');
      cargar();
    } catch (err) {
      setError(err?.message === 'pedido_cambiado'
        ? 'El pet shop ya lo aceptó: para cancelarlo escribile por chat.'
        : 'No se pudo cancelar. Probá de nuevo.');
      cargar();
    }
  };

  const ahora = Date.now();
  const listaTurnos = turnos ?? [];
  const proximos = listaTurnos
    .filter((t) => ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.fecha).getTime() > ahora - 3600000)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const anteriores = listaTurnos.filter((t) => !proximos.includes(t));
  const listaPedidos = pedidos ?? [];
  const pedidosActivos = listaPedidos.filter((p) => ['nuevo', 'preparando', 'listo', 'en_camino'].includes(p.estado));
  const pedidosViejos = listaPedidos.filter((p) => !pedidosActivos.includes(p));

  const renderTurno = (t) => {
    const e = ESTADO_TURNO[t.estado] ?? ESTADO_TURNO.pendiente;
    const futuro = new Date(t.fecha).getTime() > ahora;
    const cfg = configNegocio(t.negocio?.tipo);
    return (
      <View key={t.id} style={[s.card, { marginBottom: 12 }, t.urgencia && t.estado === 'pendiente' && s.cardUrgente]}>
        <View style={s.cardTop}>
          <Estado e={e} />
          {t.urgencia ? <Text style={s.urgenteTxt}>Urgencia</Text> : null}
        </View>
        <TouchableOpacity style={s.fila} activeOpacity={0.8}
          onPress={() => t.negocio && navigation.navigate('NegocioPublico', { idNegocio: t.idNegocio })}>
          <LogoNegocio negocio={t.negocio} />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre} numberOfLines={1}>{t.servicio} · {t.mascota.nombre}</Text>
            <Text style={s.sub} numberOfLines={1}>{t.negocio?.nombre ?? cfg.label}</Text>
            <Text style={s.cuando}>{cuandoTexto(t.fecha)} · {t.duracionMin} min</Text>
          </View>
          <Text style={s.precio}>{formatoPlata(t.precio)}</Text>
        </TouchableOpacity>
        {t.aDomicilio ? (
          <View style={s.nota}>
            <Ionicons name="home-outline" size={14} color={TEXTO2} />
            <Text style={s.notaTxt}>{t.negocio?.tipo === 'peluqueria' ? 'Busca y lleva' : 'A domicilio'}{t.direccion ? ` · ${t.direccion}` : ''}</Text>
          </View>
        ) : t.estado === 'confirmado' && t.negocio?.direccion ? (
          <View style={s.nota}>
            <Ionicons name="location-outline" size={14} color={TEXTO2} />
            <Text style={s.notaTxt}>{t.negocio.direccion}</Text>
          </View>
        ) : null}
        <View style={s.acciones}>
          {t.negocio?.idServicio ? (
            <TouchableOpacity style={s.btnSec} onPress={() => chat(t.negocio)}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={VERDE} />
              <Text style={s.btnSecTxt}>Chat</Text>
            </TouchableOpacity>
          ) : null}
          {['pendiente', 'confirmado'].includes(t.estado) && futuro ? (
            <TouchableOpacity style={[s.btnSec, { borderColor: ROJO }]} onPress={() => cancelarTurno(t)}>
              <Text style={[s.btnSecTxt, { color: ROJO }]}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
          {t.estado === 'completado' && t.informe ? (
            <TouchableOpacity style={s.btnPri} onPress={() => setInforme(t)}>
              <Ionicons name={t.negocio?.tipo === 'veterinaria' ? 'document-text' : 'images'} size={16} color={TEXTO} />
              <Text style={s.btnPriTxt}>{t.negocio?.tipo === 'veterinaria' ? 'Ver informe' : 'Ver cómo quedó'}</Text>
            </TouchableOpacity>
          ) : null}
          {['completado', 'rechazado', 'cancelado', 'ausente'].includes(t.estado) && t.negocio ? (
            <TouchableOpacity style={s.btnSec}
              onPress={() => navigation.navigate('ReservarTurno', { idNegocio: t.idNegocio, idItem: t.idItem, idMascota: t.idMascota })}>
              <Ionicons name="refresh" size={16} color={VERDE} />
              <Text style={s.btnSecTxt}>Volver a pedir</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderPedido = (p) => {
    const e = ESTADO_PEDIDO[p.estado] ?? ESTADO_PEDIDO.nuevo;
    const medio = MEDIOS_PAGO_NEGOCIO.find((m) => m.key === p.medioPago);
    const enCurso = ['nuevo', 'preparando', 'listo', 'en_camino', 'entregado'].includes(p.estado);
    return (
      <View key={p.id} style={[s.card, { marginBottom: 12 }]}>
        <View style={s.cardTop}><Estado e={e} /><Text style={s.numero}>#{p.id}</Text></View>
        <TouchableOpacity style={s.fila} activeOpacity={0.8}
          onPress={() => p.negocio && navigation.navigate('NegocioPublico', { idNegocio: p.idNegocio })}>
          <LogoNegocio negocio={p.negocio ?? { tipo: 'petshop' }} />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre} numberOfLines={1}>{p.negocio?.nombre ?? 'Pet shop'}</Text>
            <Text style={s.sub}>{cuandoTexto(p.creadoEn)} · {p.entrega === 'envio' ? 'Envío' : 'Retiro en el local'}{medio ? ` · ${medio.label}` : ''}</Text>
          </View>
          <Text style={s.precio}>{formatoPlata(p.total)}</Text>
        </TouchableOpacity>
        {enCurso ? <Seguimiento pedido={p} /> : null}
        <View style={s.lineas}>
          {p.items.map((x, i) => (
            <Text key={`${x.idItem}-${i}`} style={s.linea} numberOfLines={1}>
              <Text style={{ color: VERDE, fontWeight: '900' }}>{x.cantidad}×</Text> {x.nombre}
            </Text>
          ))}
          {p.envio > 0 ? <Text style={[s.linea, { color: TEXTO2 }]}>Envío {formatoPlata(p.envio)}</Text> : null}
        </View>
        {p.estado === 'listo' && p.negocio?.direccion ? (
          <View style={s.nota}>
            <Ionicons name="storefront-outline" size={14} color={TEXTO2} />
            <Text style={s.notaTxt}>Retiralo en {p.negocio.direccion}</Text>
          </View>
        ) : null}
        <View style={s.acciones}>
          {p.negocio?.idServicio ? (
            <TouchableOpacity style={s.btnSec} onPress={() => chat(p.negocio)}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={VERDE} />
              <Text style={s.btnSecTxt}>Chat</Text>
            </TouchableOpacity>
          ) : null}
          {p.estado === 'nuevo' ? (
            <TouchableOpacity style={[s.btnSec, { borderColor: ROJO }]} onPress={() => cancelarPedido(p)}>
              <Text style={[s.btnSecTxt, { color: ROJO }]}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
          {['entregado', 'cancelado', 'rechazado'].includes(p.estado) && p.negocio ? (
            <TouchableOpacity style={s.btnSec} onPress={() => navigation.navigate('NegocioPublico', { idNegocio: p.idNegocio })}>
              <Ionicons name="bag-handle-outline" size={16} color={VERDE} />
              <Text style={s.btnSecTxt}>Volver a comprar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const cargando = turnos === null || pedidos === null;
  const vacioTurnos = !listaTurnos.length;
  const vacioPedidos = !listaPedidos.length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={MENTA} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} hitSlop={10} accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={28} color="#0A0A0A" />
        </TouchableOpacity>
        <Text style={s.titulo}>Turnos y pedidos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Comunidad')} hitSlop={10} accessibilityLabel="Buscar servicios">
          <Ionicons name="search" size={24} color={TEXTO} />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {[
          { key: 'turnos', label: 'Turnos', badge: proximos.length },
          { key: 'pedidos', label: 'Pedidos', badge: pedidosActivos.length },
        ].map((x) => {
          const on = tab === x.key;
          return (
            <TouchableOpacity key={x.key} style={[s.tab, on && s.tabOn]} onPress={() => setTab(x.key)}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[s.tabTxt, on && s.tabTxtOn]}>{x.label}{x.badge ? ` · ${x.badge}` : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {aviso && (
        <View style={s.aviso}>
          <Ionicons name="checkmark-circle" size={18} color={VERDE} />
          <Text style={s.avisoTxt}>{aviso}</Text>
        </View>
      )}
      {error && <Text style={s.error}>{error}</Text>}

      {cargando ? <ActivityIndicator color={VERDE} style={{ marginTop: 30 }} /> : (
        <ScrollView contentContainerStyle={s.lista}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={VERDE} />}>
          {tab === 'turnos' ? (
            vacioTurnos ? (
              <View style={s.vacio}>
                <Ionicons name="calendar-outline" size={44} color={VERDE} />
                <Text style={s.vacioTitulo}>Todavía no pediste turnos</Text>
                <Text style={s.vacioTxt}>Buscá veterinarias y peluquerías en el mapa de Comunidad y pedí turno desde su ficha.</Text>
                <TouchableOpacity style={[s.btnPri, { marginTop: 14, paddingHorizontal: 22 }]} onPress={() => navigation.navigate('Comunidad')}>
                  <Text style={s.btnPriTxt}>Buscar en Comunidad</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {proximos.length ? <Text style={s.seccion}>Próximos</Text> : null}
                {proximos.map(renderTurno)}
                {anteriores.length ? <Text style={s.seccion}>Anteriores</Text> : null}
                {anteriores.map(renderTurno)}
              </>
            )
          ) : vacioPedidos ? (
            <View style={s.vacio}>
              <Ionicons name="bag-handle-outline" size={44} color={VERDE} />
              <Text style={s.vacioTitulo}>Todavía no hiciste pedidos</Text>
              <Text style={s.vacioTxt}>Los pet shops de Zooni te mandan alimento y accesorios o te los preparan para retirar.</Text>
              <TouchableOpacity style={[s.btnPri, { marginTop: 14, paddingHorizontal: 22 }]} onPress={() => navigation.navigate('Comunidad')}>
                <Text style={s.btnPriTxt}>Buscar pet shops</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pedidosActivos.length ? <Text style={s.seccion}>En curso</Text> : null}
              {pedidosActivos.map(renderPedido)}
              {pedidosViejos.length ? <Text style={s.seccion}>Anteriores</Text> : null}
              {pedidosViejos.map(renderPedido)}
            </>
          )}
        </ScrollView>
      )}

      <InformeDueno turno={informe} onCerrar={() => setInforme(null)} />
      <HamburgerDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}
        usuario={usuario} mascotaActiva={mascotaActiva} activeRoute="MisTurnos" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MENTA },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: VERDE },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: VERDE },
  tabTxt: { fontSize: 14, fontWeight: '700', color: TEXTO2 },
  tabTxtOn: { color: '#FFF', fontWeight: '800' },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  seccion: { fontSize: 13, fontWeight: '900', color: TEXTO2, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: VERDE,
  },
  avisoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXTO },
  error: { marginHorizontal: 16, padding: 12, borderRadius: 12, backgroundColor: '#FDECEE', color: ROJO, fontSize: 13 },

  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardUrgente: { borderWidth: 2, borderColor: ROJO },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoTxt: { fontSize: 12, fontWeight: '800' },
  urgenteTxt: { fontSize: 12, fontWeight: '900', color: ROJO },
  numero: { fontSize: 13, fontWeight: '800', color: TEXTO2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 52, height: 52, borderRadius: 26, backgroundColor: MENTA },
  nombre: { fontSize: 16, fontWeight: '800', color: TEXTO },
  sub: { fontSize: 13, color: TEXTO2, marginTop: 2 },
  cuando: { fontSize: 13, color: TEXTO, fontWeight: '700', marginTop: 2 },
  precio: { fontSize: 17, fontWeight: '900', color: TEXTO },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  notaTxt: { flex: 1, fontSize: 13, color: TEXTO },

  lineas: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F2F2F2', gap: 3 },
  linea: { fontSize: 13, color: TEXTO },

  seguimiento: { flexDirection: 'row', marginTop: 14 },
  paso: { flex: 1, alignItems: 'center' },
  pasoFila: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  pasoLinea: { flex: 1, height: 3, backgroundColor: '#E6E6E6' },
  pasoLineaVacia: { flex: 1 },
  pasoPunto: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#E6E6E6', alignItems: 'center', justifyContent: 'center',
  },
  pasoPuntoOn: { backgroundColor: VERDE },
  pasoPuntoActual: { borderWidth: 3, borderColor: '#C8F0D8', width: 24, height: 24, borderRadius: 12 },
  pasoTxt: { fontSize: 11, color: TEXTO2, marginTop: 4, textAlign: 'center' },

  acciones: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  btnSec: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 2, borderColor: VERDE,
  },
  btnSecTxt: { fontSize: 14, fontWeight: '800', color: VERDE },
  btnPri: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40,
    paddingHorizontal: 16, borderRadius: 20, backgroundColor: AMARILLO,
  },
  btnPriTxt: { fontSize: 14, fontWeight: '800', color: TEXTO },

  vacio: { alignItems: 'center', marginTop: 50, paddingHorizontal: 30, gap: 6 },
  vacioTitulo: { fontSize: 17, fontWeight: '800', color: TEXTO, marginTop: 6 },
  vacioTxt: { fontSize: 14, color: TEXTO2, textAlign: 'center', lineHeight: 20 },

  // Informe
  dato: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  datoTitulo: { fontSize: 13, fontWeight: '800', color: TEXTO2 },
  datoTxt: { fontSize: 15, color: TEXTO, marginTop: 2, lineHeight: 21 },
  medidas: { flexDirection: 'row', gap: 10 },
  medida: { flex: 1, alignItems: 'center', backgroundColor: '#F2FCF6', borderRadius: 14, paddingVertical: 12 },
  medidaValor: { fontSize: 20, fontWeight: '900', color: TEXTO },
  medidaTxt: { fontSize: 12, color: TEXTO2 },
  control: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF1DC', borderRadius: 14, padding: 12 },
  controlTxt: { flex: 1, fontSize: 14, fontWeight: '800', color: '#B07A00' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  fotoTrabajo: { width: '48%', aspectRatio: 1, borderRadius: 14, backgroundColor: MENTA },
});
