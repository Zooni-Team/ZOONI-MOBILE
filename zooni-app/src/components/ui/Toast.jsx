import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores } from '../../theme';

export default function Toast({
  visible, mensaje, color = colores.verde, icono = 'checkmark-circle',
  accion = null, onCerrar = null, posicion = 'arriba',
}) {
  const abajo = posicion === 'abajo';
  const fuera = abajo ? 12 : -12;
  const translateY = useRef(new Animated.Value(fuera)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duracion = visible ? 220 : 200;
    Animated.parallel([
      Animated.timing(translateY, { toValue: visible ? 0 : fuera, duration: duracion, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: duracion, useNativeDriver: true }),
    ]).start();
  }, [visible, fuera, translateY, opacity]);

  const tocable = visible && (accion || onCerrar);
  return (
    <Animated.View
      pointerEvents={tocable ? 'box-none' : 'none'}
      accessibilityLiveRegion="polite"
      style={[s.toast, abajo ? s.abajo : s.arriba,
        { backgroundColor: color, opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name={icono} size={18} color={colores.blanco} />
      <Text style={[s.texto, (accion || onCerrar) && s.textoFlexible]}>{mensaje}</Text>
      {accion && (
        <TouchableOpacity onPress={accion.onPress} accessibilityRole="button" accessibilityLabel={accion.texto}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.accion}>{accion.texto}</Text>
        </TouchableOpacity>
      )}
      {onCerrar && (
        <TouchableOpacity onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar aviso"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colores.blanco} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute', alignSelf: 'center', maxWidth: 520,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8, zIndex: 100,
  },
  arriba: { top: 56 },
  abajo: { bottom: 16, left: 20, right: 20 },
  texto: { fontSize: 14, fontWeight: '700', color: colores.blanco },
  textoFlexible: { flexShrink: 1 },
  accion: { fontSize: 14, fontWeight: '800', color: colores.blanco, textDecorationLine: 'underline' },
});
