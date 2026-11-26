import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores } from '../../theme';

export default function AvisoError({ mensaje = 'No pudimos cargar los datos. Revisá tu conexión.', onReintentar }) {
  return (
    <View style={s.caja} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colores.rojoOscuro} />
      <Text style={s.texto}>{mensaje}</Text>
      <TouchableOpacity onPress={onReintentar} style={s.boton} activeOpacity={0.8}
        accessibilityRole="button" accessibilityLabel="Reintentar">
        <Text style={s.botonTxt}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  caja: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colores.rojoFondo, borderColor: colores.rojoBorde, borderWidth: 1,
    borderRadius: 12, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, marginBottom: 16,
  },
  texto: { flex: 1, fontSize: 13, color: colores.rojoOscuro },
  boton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10 },
  botonTxt: { fontSize: 13, fontWeight: '700', color: colores.rojoOscuro },
});
