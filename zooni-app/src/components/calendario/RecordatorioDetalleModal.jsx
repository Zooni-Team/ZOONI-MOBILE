/**
 * RecordatorioDetalleModal.jsx — El recordatorio completo (la tarjeta de la
 * lista corta la descripción a dos renglones).
 */

import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores, sombras } from '../../theme';
import { getColorByProximidad, getTextoDias } from '../../utils/colorProximidad';
import { fechaHoraTexto } from './formato';

export default function RecordatorioDetalleModal({ visible, evento, onCerrar }) {
  if (!evento) return null;

  const color = getColorByProximidad(evento.fecha_hora);
  const texto = getTextoDias(evento.fecha_hora);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <TouchableOpacity style={dt.overlay} activeOpacity={1} onPress={onCerrar}>
        <TouchableOpacity activeOpacity={1} style={dt.card}>
          <View style={[dt.borde, { backgroundColor: color }]} />

          <View style={dt.headerRow}>
            <View style={dt.tituloRow}>
              {!!evento.emoji && (
                <View style={[dt.badge, evento.color && { backgroundColor: `${evento.color}22` }]}>
                  <Text style={dt.badgeTxt}>{evento.emoji}</Text>
                </View>
              )}
              <Text style={dt.titulo}>{evento.titulo}</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar detalle"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colores.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={dt.scroll}>
            <View style={dt.filaTipo}>
              <Text style={[dt.tipo, { color }]}>{evento.tipo}</Text>
              <View style={[dt.badgeDias, { backgroundColor: `${color}22` }]}>
                <Text style={[dt.badgeDiasTxt, { color }]}>{texto}</Text>
              </View>
            </View>

            <View style={dt.filaFecha}>
              <Ionicons name="calendar-outline" size={16} color={colores.textoSecundario} />
              <Text style={dt.fecha}>{fechaHoraTexto(evento.fecha_hora)}</Text>
            </View>

            {!!evento.descripcion && (
              <Text style={dt.descripcion}>{evento.descripcion}</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={dt.btnCerrar} onPress={onCerrar}>
            <Text style={dt.btnCerrarTxt}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: colores.blanco, borderRadius: 20, width: '100%', maxWidth: 380, maxHeight: '80%',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18,
    ...sombras.modal,
    overflow: 'hidden',
  },
  borde: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingLeft: 6 },
  tituloRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colores.gris100, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 19 },
  titulo: { flex: 1, fontSize: 19, fontWeight: '800', color: colores.texto },
  scroll: { paddingLeft: 6 },
  filaTipo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tipo: { fontSize: 14, fontWeight: '700' },
  badgeDias: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  badgeDiasTxt: { fontSize: 12, fontWeight: '700' },
  filaFecha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  fecha: { fontSize: 14, color: colores.textoSecundario },
  descripcion: { fontSize: 14, color: colores.texto, lineHeight: 21 },
  btnCerrar: {
    marginTop: 16, width: '100%', height: 44, borderRadius: 30,
    backgroundColor: colores.gris200, alignItems: 'center', justifyContent: 'center',
  },
  btnCerrarTxt: { fontSize: 15, fontWeight: '700', color: colores.texto },
});
