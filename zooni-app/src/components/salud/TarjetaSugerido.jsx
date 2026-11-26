import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores, sombras } from '../../theme';
import { useEntrada } from './useEntrada';

export default function TarjetaSugerido({ nombre, detalle, estado, frecuencia, aplicada, orden, onRegistrar }) {
  const entrada = useEntrada(orden);
  return (
    <Animated.View style={[s.tarjeta, entrada]}>
      <View style={s.izquierda}>
        <Text style={s.nombre}>{nombre}</Text>
        {detalle ? <Text style={s.detalle}>{detalle}</Text> : null}
      </View>
      <View style={s.derecha}>
        {estado ? <Text style={[s.estado, { color: estado.color }]}>{estado.texto}</Text> : null}
        {frecuencia ? <Text style={s.frecuencia}>{frecuencia}</Text> : null}
        {aplicada ? (
          <View style={s.badge}>
            <Ionicons name="checkmark" size={12} color={colores.verdeOscuro} />
            <Text style={s.badgeTxt}>Aplicada</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.boton} onPress={onRegistrar} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel={`Registrar ${nombre}`}>
            <Text style={s.botonTxt}>Registrar</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.blanco,
    borderRadius: 12, borderWidth: 1, borderColor: colores.gris100,
    ...sombras.sutil,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  izquierda: { flex: 1, minWidth: 0, paddingRight: 8 },
  derecha: { maxWidth: '45%', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  nombre: { fontSize: 14, fontWeight: '700', color: colores.texto },
  detalle: { fontSize: 12, color: colores.verdeOscuro, fontWeight: '700', marginTop: 2 },
  estado: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  frecuencia: { fontSize: 12, color: colores.textoSecundario, textAlign: 'right' },
  boton: {
    backgroundColor: colores.verde, borderRadius: 18,
    minHeight: 36, justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 14,
    ...sombras.sutil,
  },
  botonTxt: { fontSize: 13, fontWeight: '700', color: colores.blanco },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colores.mentaTarjeta, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10,
  },
  badgeTxt: { fontSize: 12, fontWeight: '700', color: colores.verdeOscuro },
});
