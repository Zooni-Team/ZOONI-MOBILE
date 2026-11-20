/**
 * HojaPedido.jsx — La hoja del pedido de un pet shop en la ficha pública del
 * negocio (NegocioPublicoScreen): el carrito, la entrega, el medio de pago y
 * el envío del pedido; y el Stepper +/− de cantidades que usa también la
 * lista de productos. Antes vivían dentro de la pantalla (devolución, FEC-GOD).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MEDIOS_PAGO_NEGOCIO } from '../../constants/negocios';

import { costoEnvio } from '../../domain/negocios';
import { crearPedido } from '../../services/negocioApi';
import { formatoPlata } from '../../domain/paseos';
import { direccionDe } from '../../services/geocodificacion';
import { alerta } from '../../utils/dialogo';
import { colores, sombras } from '../../theme';

export function HojaPedido({ visible, negocio, lineas, onCantidad, onCerrar, onHecho, soloVista }) {
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
            <Ionicons name="close" size={26} color={colores.texto} />
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
                <Ionicons name="storefront" size={22} color={entrega === 'retiro' ? colores.blanco : colores.verde} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.opcionTitulo, entrega === 'retiro' && { color: colores.blanco }]}>Retiro en el local · Gratis</Text>
                  <Text style={[s.opcionTxt, entrega === 'retiro' && { color: colores.mentaFondo }]} numberOfLines={1}>{negocio.direccion}</Text>
                </View>
              </TouchableOpacity>
              {d.envios ? (
                <TouchableOpacity style={[s.opcion, entrega === 'envio' && s.opcionOn]} onPress={() => setEntrega('envio')}
                  accessibilityRole="radio" accessibilityState={{ selected: entrega === 'envio' }}>
                  <Ionicons name="bicycle" size={22} color={entrega === 'envio' ? colores.blanco : colores.verde} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.opcionTitulo, entrega === 'envio' && { color: colores.blanco }]}>
                      Envío a domicilio · {costoEnvio(negocio, subtotal) ? formatoPlata(costoEnvio(negocio, subtotal)) : 'Gratis'}
                    </Text>
                    <Text style={[s.opcionTxt, entrega === 'envio' && { color: colores.mentaFondo }]}>
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
                    placeholder="Calle, número y piso/depto" placeholderTextColor={colores.textoTenue} />
                  <TouchableOpacity onPress={usarUbicacion} hitSlop={8} accessibilityLabel="Usar mi ubicación">
                    {ubicando ? <ActivityIndicator size="small" color={colores.verde} /> : <Ionicons name="locate" size={22} color={colores.verde} />}
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
                    <Ionicons name={m.icono} size={16} color={on ? colores.blanco : colores.verde} />
                    <Text style={[s.chipTxt, on && { color: colores.blanco }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.ayuda}>Le pagás directo al pet shop al recibir o retirar.</Text>

            <Text style={s.label}>Notas (opcional)</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas}
              multiline maxLength={500} placeholderTextColor={colores.textoTenue}
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
              {enviando ? <ActivityIndicator color={colores.texto} />
                : <Text style={s.btnTxt}>Hacer pedido · {formatoPlata(subtotal + envio)}</Text>}
            </TouchableOpacity>
            <Text style={s.pie}>Te avisamos cuando {negocio.nombre} lo acepte y cuando esté {entrega === 'envio' ? 'en camino' : 'listo para retirar'}.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Stepper({ cantidad, max, onCambio }) {
  const tope = max == null ? 99 : max;
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onCambio(cantidad - 1)} accessibilityLabel="Uno menos">
        <Ionicons name={cantidad <= 1 ? 'trash-outline' : 'remove'} size={18} color={colores.verde} />
      </TouchableOpacity>
      <Text style={s.stepNum}>{cantidad}</Text>
      <TouchableOpacity style={[s.stepBtn, cantidad >= tope && { opacity: 0.35 }]} disabled={cantidad >= tope}
        onPress={() => onCambio(cantidad + 1)} accessibilityLabel="Uno más">
        <Ionicons name="add" size={18} color={colores.verde} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.menta },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: colores.verde },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  card: { backgroundColor: colores.blanco, borderRadius: 20, padding: 16, ...sombras.tarjeta },
  cardTitulo: { fontSize: 17, fontWeight: '900', color: colores.texto, marginBottom: 6 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colores.gris100 },
  lineaNombre: { fontSize: 14, fontWeight: '700', color: colores.texto },
  lineaPrecio: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  label: { fontSize: 15, fontWeight: '800', color: colores.texto, marginTop: 22, marginBottom: 10 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colores.blanco, borderRadius: 18, padding: 14 },
  opcionOn: { backgroundColor: colores.verde },
  opcionTitulo: { fontSize: 15, fontWeight: '800', color: colores.texto },
  opcionTxt: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  inputFila: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colores.blanco, borderRadius: 16, paddingHorizontal: 14 },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: colores.texto },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colores.blanco, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipOn: { backgroundColor: colores.verde },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colores.texto },
  ayuda: { fontSize: 12, color: colores.textoSecundario, marginTop: 8 },
  input: { backgroundColor: colores.blanco, borderRadius: 16, padding: 14, fontSize: 15, color: colores.texto },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalTxt: { fontSize: 14, color: colores.textoSecundario, fontWeight: '600' },
  totalFinal: { borderTopWidth: 1, borderTopColor: colores.gris100, marginTop: 6, paddingTop: 10 },
  totalFinalTxt: { fontSize: 18, fontWeight: '900', color: colores.texto },
  minimo: { fontSize: 13, color: colores.rojo, fontWeight: '700', marginTop: 8 },
  error: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colores.rojoFondo, fontSize: 13, color: colores.rojo },
  btn: {
    marginTop: 20, height: 56, borderRadius: 30, backgroundColor: colores.amarillo, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: colores.texto },
  pie: { fontSize: 12, color: colores.textoSecundario, textAlign: 'center', marginTop: 10 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1.5, borderColor: colores.menta,
    paddingHorizontal: 4, height: 40, backgroundColor: colores.blanco,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepNum: { minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '900', color: colores.texto },
});
