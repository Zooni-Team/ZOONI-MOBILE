/**
 * OpcionPicker.jsx — Dropdown propio (modal con lista de opciones)
 *
 * Usado por el registro (razas, sexo) y por Ficha Médica (raza). Cada opción
 * puede ser un string simple o un objeto { id, nombre } (como las razas que
 * vienen de la tabla `razas` de Supabase).
 */

import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../theme';

export default function OpcionPicker({ visible, titulo, opciones, valor, onSeleccionar, onCerrar, cargando }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <TouchableOpacity style={p.overlay} activeOpacity={1} onPress={onCerrar}>
        <View style={p.container}>
          <Text style={p.titulo}>{titulo}</Text>
          {cargando ? (
            <ActivityIndicator color={colores.verde} style={{ paddingVertical: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {opciones.map((op) => (
                <TouchableOpacity key={op.id ?? op} style={[p.item, valor === (op.nombre ?? op) && p.itemOn]}
                  onPress={() => onSeleccionar(op)}>
                  <Text style={[p.itemTxt, valor === (op.nombre ?? op) && p.itemTxtOn]}>{op.nombre ?? op}</Text>
                  {valor === (op.nombre ?? op) && <Ionicons name="checkmark" size={16} color={colores.verde} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const p = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: colores.blanco, borderRadius: 16, width: '80%', paddingVertical: 12 },
  titulo: { fontSize: 15, fontWeight: '700', color: colores.texto, textAlign: 'center', marginBottom: 6 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18 },
  itemOn: { backgroundColor: colores.mentaFondo },
  itemTxt: { fontSize: 15, color: colores.texto },
  itemTxtOn: { color: colores.verde, fontWeight: '700' },
});
