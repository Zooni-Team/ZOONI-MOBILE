/**
 * Toast.jsx — Aviso flotante breve ("Vacuna guardada ✓").
 *
 * Se usa SIEMPRE junto con el hook useToast (src/hooks/useToast.js), que
 * maneja el estado y el temporizador:
 *
 *   const { toast, mostrarToast } = useToast();
 *   mostrarToast('Guardado');                     // verde
 *   mostrarToast('No se pudo guardar', colores.rojo);
 *   ...
 *   <Toast {...toast} />
 *
 * Catálogo de componentes compartidos: docs/claude/componentes.md
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores } from '../../theme';

export default function Toast({ visible, mensaje, color = colores.verde, icono = 'checkmark-circle' }) {
  const translateY = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duracion = visible ? 220 : 200;
    Animated.parallel([
      Animated.timing(translateY, { toValue: visible ? 0 : -12, duration: duracion, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: duracion, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[s.toast, { backgroundColor: color, opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name={icono} size={18} color={colores.blanco} />
      <Text style={s.texto}>{mensaje}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8, zIndex: 100,
  },
  texto: { fontSize: 14, fontWeight: '700', color: colores.blanco },
});
