import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function useEntrada(orden = 0) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const opciones = { duration: 280, delay: orden * 60, useNativeDriver: true };
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, ...opciones }),
      Animated.timing(opacity, { toValue: 1, ...opciones }),
    ]).start();
  }, [orden, translateY, opacity]);

  return { transform: [{ translateY }], opacity };
}
