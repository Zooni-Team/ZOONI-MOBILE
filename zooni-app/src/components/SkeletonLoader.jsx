/**
 * SkeletonLoader.jsx — Placeholder animado de carga
 *
 * Muestra un rectángulo gris pulsante mientras se cargan los datos.
 * Se usa en HomeScreen para el nombre y la imagen de la mascota
 * mientras se espera la respuesta del backend.
 *
 * Props:
 *   width        → ancho del skeleton en px
 *   height       → alto del skeleton en px
 *   borderRadius → redondeo de esquinas (default 8)
 *   style        → estilos adicionales opcionales
 *
 * Animación: opacidad oscila entre 0.3 y 1 en loop (efecto "pulso")
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function SkeletonLoader({ width, height, borderRadius = 8, style }) {
  // Valor animado para el efecto de pulso
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Loop infinito: sube a 1 → baja a 0.3 → repite
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    // Limpia la animación al desmontar el componente
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.skeleton, { width, height, borderRadius, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#D0D0D0', // Gris claro
  },
});
