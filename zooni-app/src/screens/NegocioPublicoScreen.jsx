/**
 * NegocioPublicoScreen.jsx — La ficha de un negocio que ve el dueño
 *
 * Se llega desde el pin del negocio en Comunidad, desde "Turnos y pedidos" o
 * desde el chat. El negocio mismo la abre con { vistaPrevia: true } ("Ver mi
 * ficha como cliente"): se ve igual pero no se puede pedir ni comprar.
 *
 * Arriba, igual para los tres: logo, nombre, si está abierto ahora, cuántos
 * turnos atendió / pedidos entregó en Zooni, y los botones Chat · Llamar ·
 * Cómo llegar. Después cambia según el tipo:
 *
 *   Veterinaria  urgencias 24 h (llamar a la guardia / turno urgente),
 *                especialidades, matrícula, a domicilio, y los servicios con
 *                "Pedir turno" (→ ReservarTurno).
 *   Peluquería   sellos (busca y lleva, hipoalergénicos), tamaños que atiende,
 *                galería de trabajos y servicios con precio por tamaño.
 *   Pet shop     envíos (costo, gratis desde, demora), pedido mínimo, medios
 *                de pago y el catálogo con buscador, categorías y carrito. El
 *                pedido se arma en una hoja (retiro o envío, pago, notas).
 *
 * Al final, los horarios de toda la semana con el día de hoy marcado.
 *
 * Params: { idNegocio, vistaPrevia? }
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { getCurrentUserId } from '../config/session';
import {
  DIAS_SEMANA, MEDIOS_PAGO_NEGOCIO, TAMANOS, configNegocio,
} from '../constants/negocios';
import { ESPECIES_NEGOCIO } from '../components/negocio/CamposNegocio';
import {
  abiertoAhora, costoEnvio, crearPedido, fetchNegocioPublico, formatoPlata, horarioDelDia, textoPrecioItem,
} from '../services/negocioApi';
import { direccionDe } from '../services/paseadorApi';
import { alerta } from '../utils/dialogo';

const VERDE = '#2DBD72';
const MENTA = '#C8F0D8';
const AMARILLO = '#F5C842';
const ROJO = '#E63946';
const AMBAR = '#F5A623';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';

const DIA_JS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Abre mañana a las 09:00" / "Abre el lunes a las 09:00" (o null si nunca abre). */
function proximaApertura(horarios, ahora = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(ahora);
    d.setDate(ahora.getDate() + i);
    const h = horarioDelDia(horarios, d);
    if (!h.activo) continue;
    const [hh, mm] = h.desde.split(':').map(Number);
    const abre = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    if (abre <= ahora) continue;
    const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DIAS_SEMANA.find((x) => x.key === DIA_JS[d.getDay()]).label.toLowerCase()}`;
    return `Abre ${cuando} a las ${h.desde}`;
  }
  return null;
}

function Sello({ icono, texto, color = VERDE, fondo = '#E3F7EC' }) {
  return (
    <View style={[s.sello, { backgroundColor: fondo }]}>
      <Ionicons name={icono} size={13} color={color} />
      <Text style={[s.selloTxt, { color }]}>{texto}</Text>
    </View>
  );
}

function Titulo({ children, extra }) {
  return (
    <View style={s.tituloFila}>
      <Text style={s.titulo}>{children}</Text>
      {extra}
    </View>
  );
}

// ─── Hoja del pedido (pet shop) ─────────────────────────────────────────────

function HojaPedido({ visible, negocio, lineas, onCantidad, onCerrar, onHecho, soloVista }) {
  const d = negocio.datos ?? {};
  const medios = MEDIOS_PAGO_NEGOCIO.filter((m) => (d.mediosPago ?? []).includes(m.key));
  const [entrega, setEntrega] = useState(d.envios ? 'envio' : 'retiro');
  const [direccion, setDireccion] = useState('');
  const [medio, setMedio] = useState(null);
  const [notas, setNotas] = useState('');
  const [ubicando, setUbicando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (visible) setError(null); }, [visible]);

  const subtotal = lineas.reduce((a, x) => a + x.item.precio * x.cantidad, 0);
  const envio = entrega === 'envio' ? (costoEnvio(negocio, subtotal) ?? 0) : 0;
  const minimo = Number(d.pedidoMinimo) || 0;
  const faltaMinimo = minimo > 0 && subtotal < minimo;
  const gratisDesde = Number(d.envioGratisDesde) || 0;

  const usarUbicacion = () => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) return;
    setUbicando(true);
    geo.getCurrentPosition(async (p) => {
      const dir = await direccionDe(p.coords.latitude, p.coords.longitude);
      if (dir) setDireccion(dir);
      setUbicando(false);
    }, () => setUbicando(false), { enableHighAccuracy: true, timeout: 10000 });
  };

  const pedir = async () => {
    if (soloVista) { alerta('Vista previa', 'Así ven tus clientes el pedido. Desde acá no se puede comprar.'); return; }
    if (faltaMinimo) { setError(`El pedido mínimo es ${formatoPlata(minimo)}.`); return; }
    if (entrega === 'envio' && direccion.trim().length < 5) { setError('Escribí la dirección de entrega.'); return; }
    if (!medio) { setError('Elegí cómo vas a pagar.'); return; }
    setEnviando(true);
    setError(null);
    try {
      const id = await crearPedido({ negocio, carrito: lineas, entrega, direccion, medioPago: medio, notas });
      onHecho(id);
    } catch (err) {
      const m = err?.message;
      setError(m === 'sin_stock' ? `Se agotó: ${(err.productos ?? []).join(', ')}. Sacalo del pedido para seguir.`
        : m === 'pedido_minimo' ? `El pedido mínimo es ${formatoPlata(minimo)}.`
          : m === 'negocio_cerrado' ? `${negocio.nombre} no está tomando pedidos en este momento.`
            : m === 'sin_envios' ? 'Este pet shop no hace envíos: elegí retirar en el local.'
              : 'No se pudo hacer el pedido. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color={TEXTO} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Tu pedido</Text>
          <View style={{ width: 26 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <Text style={s.cardTitulo}>{negocio.nombre}</Text>
              {lineas.map(({ item, cantidad }) => (
                <View key={item.id} style={s.linea}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lineaNombre} numberOfLines={2}>{item.nombre}</Text>
                    <Text style={s.lineaPrecio}>{formatoPlata(item.precio)} c/u</Text>
                  </View>
                  <Stepper cantidad={cantidad} max={item.stock} onCambio={(n) => onCantidad(item, n)} />
                </View>
              ))}
            </View>

            <Text style={s.label}>¿Cómo lo recibís?</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity style={[s.opcion, entrega === 'retiro' && s.opcionOn]} onPress={() => setEntrega('retiro')}
                accessibilityRole="radio" accessibilityState={{ selected: entrega === 'retiro' }}>
                <Ionicons name="storefront" size={22} color={entrega === 'retiro' ? '#FFF' : VERDE} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.opcionTitulo, entrega === 'retiro' && { color: '#FFF' }]}>Retiro en el local · Gratis</Text>
                  <Text style={[s.opcionTxt, entrega === 'retiro' && { color: '#F0FFF6' }]} numberOfLines={1}>{negocio.direccion}</Text>
                </View>
              </TouchableOpacity>
              {d.envios ? (
                <TouchableOpacity style={[s.opcion, entrega === 'envio' && s.opcionOn]} onPress={() => setEntrega('envio')}
                  accessibilityRole="radio" accessibilityState={{ selected: entrega === 'envio' }}>
                  <Ionicons name="bicycle" size={22} color={entrega === 'envio' ? '#FFF' : VERDE} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.opcionTitulo, entrega === 'envio' && { color: '#FFF' }]}>
                      Envío a domicilio · {costoEnvio(negocio, subtotal) ? formatoPlata(costoEnvio(negocio, subtotal)) : 'Gratis'}
                    </Text>
                    <Text style={[s.opcionTxt, entrega === 'envio' && { color: '#F0FFF6' }]}>
                      {d.demoraEnvio ?? 'A coordinar'} · hasta {d.radioEnvioKm ?? 3} km
                      {gratisDesde && subtotal < gratisDesde ? ` · gratis desde ${formatoPlata(gratisDesde)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {entrega === 'envio' && (
              <>
                <Text style={s.label}>¿A dónde?</Text>
                <View style={s.inputFila}>
                  <TextInput style={s.inputFlex} value={direccion} onChangeText={(v) => setDireccion(v.slice(0, 300))}
                    placeholder="Calle, número y piso/depto" placeholderTextColor="#AAAAAA" />
                  <TouchableOpacity onPress={usarUbicacion} hitSlop={8} accessibilityLabel="Usar mi ubicación">
                    {ubicando ? <ActivityIndicator size="small" color={VERDE} /> : <Ionicons name="locate" size={22} color={VERDE} />}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={s.label}>¿Cómo pagás?</Text>
            <View style={s.chips}>
              {medios.map((m) => {
                const on = medio === m.key;
                return (
                  <TouchableOpacity key={m.key} style={[s.chip, on && s.chipOn]} onPress={() => setMedio(m.key)}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Ionicons name={m.icono} size={16} color={on ? '#FFF' : VERDE} />
                    <Text style={[s.chipTxt, on && { color: '#FFF' }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.ayuda}>Le pagás directo al pet shop al recibir o retirar.</Text>

            <Text style={s.label}>Notas (opcional)</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas}
              multiline maxLength={500} placeholderTextColor="#AAAAAA"
              placeholder="Ej: si no está el sabor pollo, traé carne. Timbre 3B." />

            <View style={[s.card, { marginTop: 18 }]}>
              <View style={s.totalFila}><Text style={s.totalTxt}>Productos</Text><Text style={s.totalTxt}>{formatoPlata(subtotal)}</Text></View>
              {entrega === 'envio' ? (
                <View style={s.totalFila}><Text style={s.totalTxt}>Envío</Text><Text style={s.totalTxt}>{envio ? formatoPlata(envio) : 'Gratis'}</Text></View>
              ) : null}
              <View style={[s.totalFila, s.totalFinal]}>
                <Text style={s.totalFinalTxt}>Total</Text>
                <Text style={s.totalFinalTxt}>{formatoPlata(subtotal + envio)}</Text>
              </View>
              {faltaMinimo ? (
                <Text style={s.minimo}>Te faltan {formatoPlata(minimo - subtotal)} para el pedido mínimo ({formatoPlata(minimo)}).</Text>
              ) : null}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.btn, (enviando || faltaMinimo || !lineas.length) && { opacity: 0.6 }]} onPress={pedir}
              disabled={enviando || !lineas.length} activeOpacity={0.85}>
              {enviando ? <ActivityIndicator color={TEXTO} />
                : <Text style={s.btnTxt}>Hacer pedido · {formatoPlata(subtotal + envio)}</Text>}
            </TouchableOpacity>
            <Text style={s.pie}>Te avisamos cuando {negocio.nombre} lo acepte y cuando esté {entrega === 'envio' ? 'en camino' : 'listo para retirar'}.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Stepper({ cantidad, max, onCambio }) {
  const tope = max == null ? 99 : max;
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onCambio(cantidad - 1)} accessibilityLabel="Uno menos">
        <Ionicons name={cantidad <= 1 ? 'trash-outline' : 'remove'} size={18} color={VERDE} />
      </TouchableOpacity>
      <Text style={s.stepNum}>{cantidad}</Text>
      <TouchableOpacity style={[s.stepBtn, cantidad >= tope && { opacity: 0.35 }]} disabled={cantidad >= tope}
        onPress={() => onCambio(cantidad + 1)} accessibilityLabel="Uno más">
        <Ionicons name="add" size={18} color={VERDE} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Pantalla ───────────────────────────────────────────────────────────────

export default function NegocioPublicoScreen() {
  const navigation = useNavigation();
  const { idNegocio, vistaPrevia = false } = useRoute().params ?? {};

  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [carrito, setCarrito] = useState({}); // idItem → cantidad
  const [verPedido, setVerPedido] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [foto, setFoto] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setNegocio(await fetchNegocioPublico(idNegocio));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [idNegocio]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const cfg = configNegocio(negocio?.tipo);
  const d = negocio?.datos ?? {};
  const soloVista = vistaPrevia || (negocio && negocio.idUser === getCurrentUserId());

  const items = negocio?.items ?? [];
  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria))], [items]);
  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return items.filter((i) => (!categoria || i.categoria === categoria)
      && (!q || normalizar(i.nombre).includes(q) || normalizar(i.descripcion).includes(q)));
  }, [items, busqueda, categoria]);

  const lineas = items.filter((i) => carrito[i.id] > 0).map((item) => ({ item, cantidad: carrito[item.id] }));
  const unidades = lineas.reduce((a, x) => a + x.cantidad, 0);
  const subtotal = lineas.reduce((a, x) => a + x.item.precio * x.cantidad, 0);

  const ponerCantidad = (item, n) => {
    const tope = item.stock == null ? 99 : item.stock;
    setCarrito((c) => {
      const nuevo = { ...c, [item.id]: Math.max(0, Math.min(tope, n)) };
      if (!nuevo[item.id]) delete nuevo[item.id];
      return nuevo;
    });
  };

  const soloVer = () => alerta('Vista previa', 'Así te ven tus clientes. Desde acá no se puede pedir ni comprar.');

  const chat = () => {
    if (soloVista) { soloVer(); return; }
    if (!negocio.idServicio) { alerta('Sin chat', 'Este negocio todavía no puede recibir mensajes.'); return; }
    navigation.navigate('Chat', { servicioId: negocio.idServicio, nombre: negocio.nombre, tipoServicio: cfg.label });
  };
  const llamar = (tel) => Linking.openURL(`tel:${String(tel).replace(/[^+\d]/g, '')}`).catch(() => {});
  const comoLlegar = () => Linking.openURL(negocio.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${negocio.lat},${negocio.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}`).catch(() => {});

  const pedirTurno = (item, urgente = false) => {
    if (soloVista) { soloVer(); return; }
    if (!negocio.abierto) {
      alerta('Sin turnos por ahora', `${negocio.nombre} no está tomando turnos nuevos. Escribile por chat para consultar.`);
      return;
    }
    navigation.navigate('ReservarTurno', { idNegocio: negocio.id, idItem: item?.id ?? null, urgente });
  };

  if (cargando) return <View style={[s.safe, s.centro]}><ActivityIndicator size="large" color={VERDE} /></View>;
  if (error || !negocio) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Ionicons name={error ? 'cloud-offline-outline' : 'storefront-outline'} size={44} color={TEXTO2} />
        <Text style={s.vacioTxt}>{error ? 'No se pudo cargar. Revisá tu conexión.' : 'Este negocio ya no está en Zooni.'}</Text>
        <TouchableOpacity style={[s.btn, { alignSelf: 'stretch', marginHorizontal: 24 }]}
          onPress={() => (error ? (setCargando(true), cargar()) : navigation.goBack())}>
          <Text style={s.btnTxt}>{error ? 'Reintentar' : 'Volver'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const abiertoYa = abiertoAhora(negocio.horarios);
  const hoy = horarioDelDia(negocio.horarios, new Date());
  const keyHoy = DIA_JS[new Date().getDay()];
  const realizadosTxt = negocio.realizados
    ? `${negocio.realizados} ${cfg.usaPedidos ? (negocio.realizados === 1 ? 'pedido entregado' : 'pedidos entregados') : (negocio.realizados === 1 ? 'turno atendido' : 'turnos atendidos')} en Zooni`
    : 'Nuevo en Zooni';

  // Sellos según el tipo
  const sellos = [];
  if (negocio.tipo === 'veterinaria') {
    if (d.urgencias24h) sellos.push({ icono: 'alert-circle', texto: 'Urgencias 24 h', color: ROJO, fondo: '#FDECEE' });
    if (d.aDomicilio) sellos.push({ icono: 'home', texto: 'Atiende a domicilio', color: '#2B6CB0', fondo: '#E6F0FA' });
    (d.especies ?? []).forEach((e) => {
      const esp = ESPECIES_NEGOCIO.find((x) => x.key === e);
      if (esp) sellos.push({ icono: esp.icono, texto: esp.label });
    });
  }
  if (negocio.tipo === 'peluqueria') {
    if (d.buscaYLleva) {
      sellos.push({
        icono: 'car',
        texto: `Busca y lleva${Number(d.buscaYLlevaCosto) ? ` · ${formatoPlata(d.buscaYLlevaCosto)}` : ' gratis'}`
          + (Number(d.buscaYLlevaRadioKm) > 0 ? ` · hasta ${d.buscaYLlevaRadioKm} km` : ''),
        color: '#2B6CB0', fondo: '#E6F0FA',
      });
    }
    if (d.hipoalergenicos) sellos.push({ icono: 'leaf', texto: 'Productos hipoalergénicos' });
    (d.especies ?? []).forEach((e) => {
      const esp = ESPECIES_NEGOCIO.find((x) => x.key === e);
      if (esp) sellos.push({ icono: esp.icono, texto: esp.label });
    });
    if (d.tamanos?.length && d.tamanos.length < TAMANOS.length) {
      sellos.push({ icono: 'resize', texto: `Sólo ${d.tamanos.map((t) => TAMANOS.find((x) => x.key === t)?.label.toLowerCase()).join(' y ')}`, color: TEXTO2, fondo: '#F1F1F1' });
    }
  }
  if (negocio.tipo === 'petshop') {
    if (d.envios) {
      sellos.push({
        icono: 'bicycle',
        texto: `Envíos ${Number(d.envioCosto) ? formatoPlata(d.envioCosto) : 'gratis'} · ${d.demoraEnvio ?? 'a coordinar'}`,
        color: '#2B6CB0', fondo: '#E6F0FA',
      });
      if (Number(d.envioGratisDesde)) sellos.push({ icono: 'gift', texto: `Envío gratis desde ${formatoPlata(d.envioGratisDesde)}` });
    } else {
      sellos.push({ icono: 'storefront', texto: 'Sólo retiro en el local', color: TEXTO2, fondo: '#F1F1F1' });
    }
    if (Number(d.pedidoMinimo)) sellos.push({ icono: 'cart', texto: `Mínimo ${formatoPlata(d.pedidoMinimo)}`, color: TEXTO2, fondo: '#F1F1F1' });
  }

  const porCategoria = categorias
    .map((c) => ({ categoria: c, items: visibles.filter((i) => i.categoria === c) }))
    .filter((g) => g.items.length);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={MENTA} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={TEXTO} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{cfg.label}</Text>
        <View style={{ width: 24 }} />
      </View>

      {soloVista ? (
        <View style={s.vista}>
          <Ionicons name="eye-outline" size={16} color="#2B6CB0" />
          <Text style={s.vistaTxt}>Vista previa: así ven tu ficha los clientes.</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[s.scroll, lineas.length && { paddingBottom: 110 }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Cabecera */}
        <View style={s.card}>
          <View style={s.heroFila}>
            {negocio.logo
              ? <Image source={{ uri: negocio.logo }} style={s.logo} />
              : <View style={[s.logo, { backgroundColor: cfg.fondoIcono, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name={cfg.icono} size={32} color={cfg.color} />
              </View>}
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{negocio.nombre}</Text>
              <View style={[s.tipoChip, { backgroundColor: cfg.fondoIcono }]}>
                <Ionicons name={cfg.icono} size={12} color={cfg.color} />
                <Text style={[s.tipoChipTxt, { color: cfg.color }]}>{cfg.label}{negocio.barrio ? ` · ${negocio.barrio}` : ''}</Text>
              </View>
              <View style={s.estadoFila}>
                <View style={[s.punto, { backgroundColor: abiertoYa ? VERDE : ROJO }]} />
                <Text style={[s.estadoTxt, { color: abiertoYa ? VERDE : ROJO }]}>
                  {abiertoYa ? `Abierto · hasta las ${hoy.hasta}` : 'Cerrado'}
                </Text>
                {!abiertoYa && proximaApertura(negocio.horarios)
                  ? <Text style={s.estadoSub}> · {proximaApertura(negocio.horarios)}</Text> : null}
              </View>
            </View>
          </View>
          <Text style={s.realizados}>
            <Ionicons name="ribbon-outline" size={13} color={TEXTO2} /> {realizadosTxt}
          </Text>
          {negocio.descripcion ? <Text style={s.descripcion}>{negocio.descripcion}</Text> : null}
          {sellos.length ? (
            <View style={s.sellos}>{sellos.map((x) => <Sello key={x.texto} {...x} />)}</View>
          ) : null}
          <View style={s.direccion}>
            <Ionicons name="location-outline" size={16} color={TEXTO2} />
            <Text style={s.direccionTxt}>{negocio.direccion}</Text>
          </View>

          <View style={s.acciones}>
            <TouchableOpacity style={s.accion} onPress={chat} accessibilityLabel="Chatear">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={VERDE} />
              <Text style={s.accionTxt}>Chat</Text>
            </TouchableOpacity>
            {negocio.telefono ? (
              <TouchableOpacity style={s.accion} onPress={() => llamar(negocio.telefono)} accessibilityLabel="Llamar">
                <Ionicons name="call-outline" size={20} color={VERDE} />
                <Text style={s.accionTxt}>Llamar</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.accion} onPress={comoLlegar} accessibilityLabel="Cómo llegar">
              <Ionicons name="navigate-outline" size={20} color={VERDE} />
              <Text style={s.accionTxt}>Cómo llegar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!negocio.abierto && (
          <View style={s.cerrado}>
            <Ionicons name="pause-circle" size={20} color={AMBAR} />
            <Text style={s.cerradoTxt}>
              {cfg.usaPedidos ? 'No está tomando pedidos' : 'No está tomando turnos'} por ahora. Podés escribirle por chat.
            </Text>
          </View>
        )}

        {/* ── Veterinaria ── */}
        {negocio.tipo === 'veterinaria' && d.urgencias24h && (
          <View style={s.urgencia}>
            <View style={s.urgenciaTop}>
              <Ionicons name="alert-circle" size={26} color={ROJO} />
              <View style={{ flex: 1 }}>
                <Text style={s.urgenciaTitulo}>Urgencias las 24 horas</Text>
                <Text style={s.urgenciaTxt}>Si tu mascota está mal, llamá a la guardia o pedí un turno urgente: le llega destacado.</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {d.telefonoUrgencias || negocio.telefono ? (
                <TouchableOpacity style={[s.btnChico, { backgroundColor: ROJO }]} onPress={() => llamar(d.telefonoUrgencias || negocio.telefono)}>
                  <Ionicons name="call" size={16} color="#FFF" />
                  <Text style={[s.btnChicoTxt, { color: '#FFF' }]}>Llamar a la guardia</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[s.btnChico, { borderWidth: 2, borderColor: ROJO, backgroundColor: '#FFF' }]}
                onPress={() => pedirTurno(items[0], true)}>
                <Text style={[s.btnChicoTxt, { color: ROJO }]}>Turno urgente</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {negocio.tipo === 'veterinaria' && (d.especialidades?.length || d.matricula) ? (
          <>
            <Titulo>Especialidades</Titulo>
            <View style={s.card}>
              <View style={s.sellos}>
                {(d.especialidades ?? []).map((e) => <Sello key={e} icono="medical-outline" texto={e} />)}
              </View>
              {d.matricula ? <Text style={s.matricula}>Matrícula {d.matricula}</Text> : null}
            </View>
          </>
        ) : null}

        {/* ── Peluquería: trabajos ── */}
        {negocio.tipo === 'peluqueria' && d.galeria?.length > 0 && (
          <>
            <Titulo>Trabajos</Titulo>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {d.galeria.map((g) => (
                <TouchableOpacity key={g.url} onPress={() => setFoto(g)} activeOpacity={0.85}>
                  <Image source={{ uri: g.url }} style={s.trabajo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Servicios (veterinaria / peluquería) ── */}
        {cfg.usaTurnos && (
          <>
            <Titulo>{negocio.tipo === 'veterinaria' ? 'Consultas y servicios' : 'Servicios y precios'}</Titulo>
            {negocio.tipo === 'peluqueria' && items.some((i) => i.precios) ? (
              <Text style={s.ayudaSeccion}>El precio depende del tamaño: chico hasta 10 kg, mediano 10–25 kg, grande +25 kg.</Text>
            ) : null}
            {!items.length ? (
              <View style={s.card}><Text style={s.vacioTxt}>Todavía no cargó sus servicios. Escribile por chat para consultar.</Text></View>
            ) : porCategoria.map((g) => (
              <View key={g.categoria} style={[s.card, { marginBottom: 12, paddingVertical: 6 }]}>
                <Text style={s.categoria}>{g.categoria}</Text>
                {g.items.map((it, i) => (
                  <View key={it.id} style={[s.servicio, i > 0 && s.servicioBorde]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.servicioNombre}>{it.nombre}</Text>
                      {it.descripcion ? <Text style={s.servicioDesc} numberOfLines={2}>{it.descripcion}</Text> : null}
                      <Text style={s.servicioDesc}>
                        <Ionicons name="time-outline" size={12} color={TEXTO2} /> {it.duracionMin} min
                      </Text>
                      {it.precios ? (
                        <Text style={s.porTamano}>
                          {TAMANOS.filter((t) => Number(it.precios[t.key]) > 0)
                            .map((t) => `${t.label} ${formatoPlata(it.precios[t.key])}`).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={s.servicioPrecio}>{textoPrecioItem(it)}</Text>
                      <TouchableOpacity style={s.btnTurno} onPress={() => pedirTurno(it)} accessibilityLabel={`Pedir turno para ${it.nombre}`}>
                        <Text style={s.btnTurnoTxt}>Pedir turno</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── Catálogo (pet shop) ── */}
        {cfg.usaPedidos && (
          <>
            <Titulo extra={<Text style={s.tituloExtra}>{items.length} productos</Text>}>Catálogo</Titulo>
            {(d.mediosPago ?? []).length ? (
              <Text style={s.ayudaSeccion}>
                Pagás con {MEDIOS_PAGO_NEGOCIO.filter((m) => d.mediosPago.includes(m.key)).map((m) => m.label.toLowerCase()).join(', ')}.
              </Text>
            ) : null}
            {items.length > 0 && (
              <>
                <View style={s.buscador}>
                  <Ionicons name="search" size={18} color={TEXTO2} />
                  <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
                    placeholder="Buscar alimento, juguete…" placeholderTextColor="#AAAAAA" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categorias}>
                  {[null, ...categorias].map((c) => {
                    const on = categoria === c;
                    return (
                      <TouchableOpacity key={c ?? 'todas'} style={[s.chip, on && s.chipOn]} onPress={() => setCategoria(c)}>
                        <Text style={[s.chipTxt, on && { color: '#FFF' }]}>{c ?? 'Todo'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {!items.length ? (
              <View style={s.card}><Text style={s.vacioTxt}>Todavía no cargó productos. Escribile por chat para consultar.</Text></View>
            ) : !visibles.length ? (
              <Text style={s.vacioTxt}>No hay productos con esa búsqueda.</Text>
            ) : visibles.map((it) => {
              const cant = carrito[it.id] ?? 0;
              const agotado = it.stock === 0;
              return (
                <View key={it.id} style={[s.producto, agotado && { opacity: 0.55 }]}>
                  {it.foto
                    ? <Image source={{ uri: it.foto }} style={s.productoFoto} />
                    : <View style={[s.productoFoto, s.productoSinFoto]}><Ionicons name="cube-outline" size={26} color={AMBAR} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.servicioNombre} numberOfLines={2}>{it.nombre}</Text>
                    {it.descripcion ? <Text style={s.servicioDesc} numberOfLines={2}>{it.descripcion}</Text> : null}
                    <Text style={s.servicioPrecio}>{formatoPlata(it.precio)}</Text>
                    {agotado ? <Text style={[s.stock, { color: ROJO }]}>Sin stock</Text>
                      : it.stock != null && it.stock <= 3 ? <Text style={s.stock}>¡Quedan {it.stock}!</Text> : null}
                  </View>
                  {agotado ? null : cant > 0 ? (
                    <Stepper cantidad={cant} max={it.stock} onCambio={(n) => ponerCantidad(it, n)} />
                  ) : (
                    <TouchableOpacity style={s.agregar} onPress={() => (soloVista ? soloVer() : ponerCantidad(it, 1))}
                      accessibilityLabel={`Agregar ${it.nombre}`}>
                      <Ionicons name="add" size={22} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Horarios */}
        <Titulo>Horarios</Titulo>
        <View style={s.card}>
          {DIAS_SEMANA.map((dia) => {
            const h = negocio.horarios?.[dia.key];
            const esHoy = dia.key === keyHoy;
            return (
              <View key={dia.key} style={[s.horario, esHoy && s.horarioHoy]}>
                <Text style={[s.horarioDia, esHoy && { fontWeight: '900', color: VERDE }]}>{dia.label}{esHoy ? ' (hoy)' : ''}</Text>
                <Text style={[s.horarioHora, !h?.activo && { color: TEXTO2 }]}>{h?.activo ? `${h.desde} – ${h.hasta}` : 'Cerrado'}</Text>
              </View>
            );
          })}
          {negocio.tipo === 'veterinaria' && d.urgencias24h ? (
            <Text style={s.horarioNota}>Fuera de horario: urgencias por la guardia 24 h.</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Carrito */}
      {lineas.length > 0 && (
        <View style={s.carritoBarra}>
          <TouchableOpacity style={s.carritoBtn} onPress={() => setVerPedido(true)} activeOpacity={0.9}>
            <View style={s.carritoCant}><Text style={s.carritoCantTxt}>{unidades}</Text></View>
            <Text style={s.carritoTxt}>Ver pedido</Text>
            <Text style={s.carritoTotal}>{formatoPlata(subtotal)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {cfg.usaPedidos && (
        <HojaPedido
          visible={verPedido}
          negocio={negocio}
          lineas={lineas}
          soloVista={soloVista}
          onCantidad={(item, n) => { ponerCantidad(item, n); if (n <= 0 && lineas.length === 1) setVerPedido(false); }}
          onCerrar={() => setVerPedido(false)}
          onHecho={(id) => {
            setVerPedido(false);
            setCarrito({});
            navigation.navigate('MisTurnos', {
              tab: 'pedidos', aviso: `¡Listo! ${negocio.nombre} recibió tu pedido #${id}. Te avisamos cuando lo acepte.`,
            });
          }}
        />
      )}

      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setFoto(null)}>
        <TouchableOpacity style={s.visor} activeOpacity={1} onPress={() => setFoto(null)}>
          {foto ? <Image source={{ uri: foto.url }} style={s.visorImg} resizeMode="contain" /> : null}
          {foto?.nota ? <Text style={s.visorNota}>{foto.nota}</Text> : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const sombra = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MENTA },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: VERDE },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  vista: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8,
    padding: 10, borderRadius: 12, backgroundColor: '#E6F0FA',
  },
  vistaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2B6CB0' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, ...sombra },
  cardTitulo: { fontSize: 17, fontWeight: '900', color: TEXTO, marginBottom: 6 },
  heroFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 76, height: 76, borderRadius: 22 },
  nombre: { fontSize: 21, fontWeight: '900', color: TEXTO },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, marginTop: 4,
  },
  tipoChipTxt: { fontSize: 12, fontWeight: '800' },
  estadoFila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  punto: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  estadoTxt: { fontSize: 13, fontWeight: '800' },
  estadoSub: { fontSize: 12, color: TEXTO2 },
  realizados: { fontSize: 13, color: TEXTO2, marginTop: 12, fontWeight: '600' },
  descripcion: { fontSize: 14, color: TEXTO, marginTop: 10, lineHeight: 20 },
  sellos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  selloTxt: { fontSize: 12, fontWeight: '800' },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  direccionTxt: { flex: 1, fontSize: 13, color: TEXTO },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 14 },
  accion: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16,
    borderWidth: 1.5, borderColor: MENTA, backgroundColor: '#F6FFF9',
  },
  accionTxt: { fontSize: 12, fontWeight: '800', color: VERDE },

  cerrado: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 14, borderRadius: 16,
    backgroundColor: '#FFF7E8', borderWidth: 1.5, borderColor: '#FCE7B2',
  },
  cerradoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXTO },

  urgencia: {
    marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: '#FFF7F8', borderWidth: 2, borderColor: '#F5B7BD',
  },
  urgenciaTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  urgenciaTitulo: { fontSize: 16, fontWeight: '900', color: ROJO },
  urgenciaTxt: { fontSize: 13, color: TEXTO, marginTop: 2, lineHeight: 18 },
  btnChico: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: 21,
  },
  btnChicoTxt: { fontSize: 14, fontWeight: '800' },
  matricula: { fontSize: 13, color: TEXTO2, marginTop: 10, fontWeight: '700' },

  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  titulo: { fontSize: 18, fontWeight: '900', color: TEXTO },
  tituloExtra: { fontSize: 13, color: TEXTO2, fontWeight: '700' },
  ayudaSeccion: { fontSize: 12, color: TEXTO2, marginTop: -4, marginBottom: 10 },
  trabajo: { width: 130, height: 130, borderRadius: 16, backgroundColor: '#FFF' },

  categoria: { fontSize: 13, fontWeight: '900', color: VERDE, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  servicio: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  servicioBorde: { borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  servicioNombre: { fontSize: 15, fontWeight: '800', color: TEXTO },
  servicioDesc: { fontSize: 12, color: TEXTO2, marginTop: 2 },
  porTamano: { fontSize: 12, color: TEXTO, marginTop: 4, fontWeight: '600' },
  servicioPrecio: { fontSize: 16, fontWeight: '900', color: TEXTO, marginTop: 2 },
  btnTurno: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: AMARILLO, justifyContent: 'center' },
  btnTurnoTxt: { fontSize: 13, fontWeight: '800', color: TEXTO },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 12,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: TEXTO, paddingVertical: 12 },
  categorias: { gap: 8, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipOn: { backgroundColor: VERDE },
  chipTxt: { fontSize: 13, fontWeight: '700', color: TEXTO },

  producto: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 18,
    padding: 12, marginBottom: 10, ...sombra,
  },
  productoFoto: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#F6F6F6' },
  productoSinFoto: { backgroundColor: '#FFF4DE', alignItems: 'center', justifyContent: 'center' },
  stock: { fontSize: 12, fontWeight: '800', color: AMBAR, marginTop: 2 },
  agregar: { width: 40, height: 40, borderRadius: 20, backgroundColor: VERDE, alignItems: 'center', justifyContent: 'center' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1.5, borderColor: MENTA,
    paddingHorizontal: 4, height: 40, backgroundColor: '#FFF',
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepNum: { minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '900', color: TEXTO },

  horario: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  horarioHoy: { backgroundColor: '#F2FCF6' },
  horarioDia: { fontSize: 14, color: TEXTO, fontWeight: '600' },
  horarioHora: { fontSize: 14, color: TEXTO, fontWeight: '800', fontVariant: ['tabular-nums'] },
  horarioNota: { fontSize: 12, color: ROJO, marginTop: 8, fontWeight: '700' },

  carritoBarra: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 },
  carritoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: 30, paddingHorizontal: 12,
    backgroundColor: AMARILLO, ...sombra, shadowOpacity: 0.18,
  },
  carritoCant: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  carritoCantTxt: { fontSize: 15, fontWeight: '900', color: TEXTO },
  carritoTxt: { flex: 1, fontSize: 16, fontWeight: '800', color: TEXTO },
  carritoTotal: { fontSize: 16, fontWeight: '900', color: TEXTO, marginRight: 6 },

  // Hoja del pedido
  linea: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  lineaNombre: { fontSize: 14, fontWeight: '700', color: TEXTO },
  lineaPrecio: { fontSize: 12, color: TEXTO2, marginTop: 2 },
  label: { fontSize: 15, fontWeight: '800', color: TEXTO, marginTop: 22, marginBottom: 10 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 18, padding: 14 },
  opcionOn: { backgroundColor: VERDE },
  opcionTitulo: { fontSize: 15, fontWeight: '800', color: TEXTO },
  opcionTxt: { fontSize: 12, color: TEXTO2, marginTop: 2 },
  inputFila: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14 },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: TEXTO },
  input: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, fontSize: 15, color: TEXTO },
  ayuda: { fontSize: 12, color: TEXTO2, marginTop: 8 },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalTxt: { fontSize: 14, color: TEXTO2, fontWeight: '600' },
  totalFinal: { borderTopWidth: 1, borderTopColor: '#F2F2F2', marginTop: 6, paddingTop: 10 },
  totalFinalTxt: { fontSize: 18, fontWeight: '900', color: TEXTO },
  minimo: { fontSize: 13, color: ROJO, fontWeight: '700', marginTop: 8 },
  error: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FDECEE', fontSize: 13, color: ROJO },
  btn: {
    marginTop: 20, height: 56, borderRadius: 30, backgroundColor: AMARILLO, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: TEXTO },
  pie: { fontSize: 12, color: TEXTO2, textAlign: 'center', marginTop: 10 },
  vacioTxt: { fontSize: 14, color: TEXTO2, textAlign: 'center', lineHeight: 20 },

  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  visorImg: { width: '100%', height: '75%' },
  visorNota: { fontSize: 15, fontWeight: '700', color: '#FFF', marginTop: 14, textAlign: 'center' },
});
