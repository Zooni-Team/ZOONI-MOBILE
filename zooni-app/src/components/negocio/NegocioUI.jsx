/**
 * NegocioUI.jsx — Piezas de Zooni Negocios (mismo diseño que PaseadorUI)
 *
 *   EstadoChip    estado de un turno o un pedido, con su color
 *   Segmento      control segmentado (Pendientes / Agenda / Historial…)
 *   TurnoCard     un turno: mascota, dueño, servicio, hora, precio, urgencia
 *   PedidoCard    un pedido: productos, total, entrega y pago
 *   MotivoModal   pide un motivo opcional antes de rechazar / cancelar
 *   Etiqueta      etiqueta chiquita de color (Urgencia, A domicilio, Sin stock)
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, PillButton, sombra } from '../paseador/PaseadorUI';
import { ESTADOS_PEDIDO, ESTADOS_TURNO, MEDIOS_PAGO_NEGOCIO } from '../../constants/negocios';
import { cuandoTexto, formatoPlata, horaTexto, unidadesDe } from '../../services/negocioApi';

export function EstadoChip({ estado, tipo = 'turno', style }) {
  const e = (tipo === 'pedido' ? ESTADOS_PEDIDO : ESTADOS_TURNO)[estado];
  if (!e) return null;
  return (
    <View style={[ui.chip, { backgroundColor: e.fondo }, style]}>
      <Ionicons name={e.icono} size={12} color={e.color} />
      <Text style={[ui.chipTxt, { color: e.color }]}>{e.label}</Text>
    </View>
  );
}

export function Etiqueta({ texto, icono, color = C.rojo, fondo = '#FDECEE' }) {
  return (
    <View style={[ui.chip, { backgroundColor: fondo }]}>
      {icono ? <Ionicons name={icono} size={12} color={color} /> : null}
      <Text style={[ui.chipTxt, { color }]}>{texto}</Text>
    </View>
  );
}

export function Segmento({ opciones, valor, onCambio, style }) {
  return (
    <View style={[ui.segmento, style]}>
      {opciones.map((o) => {
        const on = valor === o.key;
        return (
          <TouchableOpacity key={o.key} style={[ui.segBtn, on && ui.segBtnOn]} onPress={() => onCambio(o.key)}
            accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[ui.segTxt, on && ui.segTxtOn]} numberOfLines={1}>
              {o.label}{o.badge ? ` · ${o.badge}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Props: turno · mostrarFecha (default: sólo la hora) · onPress · onChat ·
 *        children (botones de acción abajo)
 */
export function TurnoCard({ turno, mostrarFecha = false, onPress, onChat, children }) {
  const pasado = new Date(turno.fecha).getTime() < Date.now();
  return (
    <TouchableOpacity style={[ui.card, turno.urgencia && turno.estado === 'pendiente' && ui.cardUrgente]}
      onPress={onPress} disabled={!onPress} activeOpacity={0.9}>
      <View style={ui.fila}>
        <View style={ui.horaCol}>
          <Text style={[ui.hora, pasado && turno.estado === 'confirmado' && { color: C.ambar }]}>{horaTexto(turno.fecha)}</Text>
          <Text style={ui.duracion}>{turno.duracionMin} min</Text>
        </View>
        <Avatar fuente={turno.mascota.visual} nombre={turno.mascota.nombre} size={46} borde />
        <View style={{ flex: 1 }}>
          <Text style={ui.titulo} numberOfLines={1}>{turno.mascota.nombre}</Text>
          <Text style={ui.sub} numberOfLines={1}>
            {turno.servicio}{turno.mascota.raza ? ` · ${turno.mascota.raza}` : ''}
          </Text>
          <Text style={ui.sub} numberOfLines={1}>
            {mostrarFecha ? `${cuandoTexto(turno.fecha)} · ` : ''}{turno.dueno.nombre}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={ui.precio}>{formatoPlata(turno.precio)}</Text>
          {onChat ? (
            <TouchableOpacity style={ui.chat} onPress={onChat} accessibilityLabel={`Chat con ${turno.dueno.nombre}`}>
              <Ionicons name="chatbubble-ellipses" size={18} color={C.teal} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={ui.etiquetas}>
        <EstadoChip estado={turno.estado} />
        {turno.urgencia ? <Etiqueta texto="Urgencia" icono="alert-circle" /> : null}
        {turno.aDomicilio ? <Etiqueta texto="A domicilio" icono="home" color="#2B6CB0" fondo="#E6F0FA" /> : null}
      </View>
      {turno.notas ? (
        <View style={ui.notas}>
          <Ionicons name="document-text-outline" size={14} color={C.texto2} />
          <Text style={ui.notasTxt}>{turno.notas}</Text>
        </View>
      ) : null}
      {turno.aDomicilio && turno.direccion ? (
        <View style={ui.notas}>
          <Ionicons name="location-outline" size={14} color={C.texto2} />
          <Text style={ui.notasTxt}>{turno.direccion}</Text>
        </View>
      ) : null}
      {children ? <View style={ui.acciones}>{children}</View> : null}
    </TouchableOpacity>
  );
}

export function PedidoCard({ pedido, onChat, children, mostrarCliente = true }) {
  const medio = MEDIOS_PAGO_NEGOCIO.find((m) => m.key === pedido.medioPago);
  const n = unidadesDe(pedido);
  return (
    <View style={ui.card}>
      <View style={ui.fila}>
        {mostrarCliente
          ? <Avatar uri={pedido.dueno.foto} nombre={pedido.dueno.nombre} size={44} />
          : <View style={ui.iconoPedido}><Ionicons name="bag-handle" size={22} color={C.teal} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={ui.titulo} numberOfLines={1}>
            Pedido #{pedido.id}{mostrarCliente ? ` · ${pedido.dueno.nombre}` : ''}
          </Text>
          <Text style={ui.sub}>{cuandoTexto(pedido.creadoEn)} · {n} {n === 1 ? 'producto' : 'productos'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={ui.precio}>{formatoPlata(pedido.total)}</Text>
          {onChat ? (
            <TouchableOpacity style={ui.chat} onPress={onChat} accessibilityLabel="Chat con el cliente">
              <Ionicons name="chatbubble-ellipses" size={18} color={C.teal} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={ui.lineas}>
        {pedido.items.map((x, i) => (
          <View key={`${x.idItem}-${i}`} style={ui.linea}>
            <Text style={ui.lineaCant}>{x.cantidad}×</Text>
            <Text style={ui.lineaNombre} numberOfLines={1}>{x.nombre}</Text>
            <Text style={ui.lineaPrecio}>{formatoPlata(x.precio * x.cantidad)}</Text>
          </View>
        ))}
        {pedido.envio > 0 ? (
          <View style={ui.linea}>
            <Text style={ui.lineaCant} />
            <Text style={[ui.lineaNombre, { color: C.texto2 }]}>Envío</Text>
            <Text style={ui.lineaPrecio}>{formatoPlata(pedido.envio)}</Text>
          </View>
        ) : null}
      </View>

      <View style={ui.etiquetas}>
        <EstadoChip estado={pedido.estado} tipo="pedido" />
        <Etiqueta
          texto={pedido.entrega === 'envio' ? 'Envío' : 'Retira en el local'}
          icono={pedido.entrega === 'envio' ? 'bicycle' : 'storefront'}
          color="#2B6CB0" fondo="#E6F0FA"
        />
        {medio ? <Etiqueta texto={medio.label} icono={medio.icono} color={C.texto2} fondo="#F1F1F1" /> : null}
      </View>
      {pedido.entrega === 'envio' && pedido.direccion ? (
        <View style={ui.notas}>
          <Ionicons name="location-outline" size={14} color={C.texto2} />
          <Text style={ui.notasTxt}>{pedido.direccion}</Text>
        </View>
      ) : null}
      {pedido.notas ? (
        <View style={ui.notas}>
          <Ionicons name="document-text-outline" size={14} color={C.texto2} />
          <Text style={ui.notasTxt}>{pedido.notas}</Text>
        </View>
      ) : null}
      {children ? <View style={ui.acciones}>{children}</View> : null}
    </View>
  );
}

/**
 * Pide un motivo (opcional) y confirma. Props: visible · titulo · texto ·
 * textoOk · onConfirmar(motivo) · onCerrar
 */
export function MotivoModal({ visible, titulo, texto, textoOk = 'Confirmar', placeholder, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (visible) setMotivo(''); }, [visible]);

  const ok = async () => {
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={ui.overlay} onPress={onCerrar}>
          <Pressable style={ui.dialogo} onPress={() => {}}>
            <Text style={ui.dialogoTitulo}>{titulo}</Text>
            {texto ? <Text style={ui.dialogoTexto}>{texto}</Text> : null}
            <TextInput style={ui.input} value={motivo} onChangeText={setMotivo} maxLength={200} multiline
              placeholder={placeholder ?? 'Motivo (opcional): se lo mandamos al cliente'} placeholderTextColor={C.gris} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <PillButton titulo="Volver" variante="secundario" chico onPress={onCerrar} style={{ flex: 1 }} />
              <PillButton titulo={textoOk} variante="peligro" chico cargando={enviando} onPress={ok} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ui = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  chipTxt: { fontSize: 12, fontWeight: '800' },

  segmento: {
    flexDirection: 'row', padding: 4, backgroundColor: '#FFFFFF', borderRadius: 30,
    borderWidth: 1, borderColor: C.borde,
  },
  segBtn: { flex: 1, height: 38, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segBtnOn: { backgroundColor: C.teal },
  segTxt: { fontSize: 13, fontWeight: '700', color: C.texto2 },
  segTxtOn: { color: '#FFFFFF', fontWeight: '800' },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12, ...sombra },
  cardUrgente: { borderWidth: 2, borderColor: C.rojo },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  horaCol: { alignItems: 'center', minWidth: 48 },
  hora: { fontSize: 18, fontWeight: '900', color: C.texto, fontVariant: ['tabular-nums'] },
  duracion: { fontSize: 11, color: C.texto2, fontWeight: '600' },
  titulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 1 },
  precio: { fontSize: 16, fontWeight: '900', color: C.texto },
  chat: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  notas: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'flex-start' },
  notasTxt: { flex: 1, fontSize: 13, color: C.texto, lineHeight: 18 },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 12 },

  iconoPedido: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  lineas: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F2F2F2', gap: 4 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineaCant: { width: 28, fontSize: 13, fontWeight: '800', color: C.teal },
  lineaNombre: { flex: 1, fontSize: 14, color: C.texto },
  lineaPrecio: { fontSize: 13, fontWeight: '700', color: C.texto },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialogo: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  dialogoTitulo: { fontSize: 18, fontWeight: '900', color: C.texto },
  dialogoTexto: { fontSize: 14, color: C.texto2, marginTop: 6, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, padding: 12, marginTop: 14,
    fontSize: 15, color: C.texto, minHeight: 70, textAlignVertical: 'top',
  },
});
