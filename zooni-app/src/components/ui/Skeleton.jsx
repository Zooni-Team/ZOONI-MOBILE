import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { colores } from '../../theme';

const GRIS_SKELETON = colores.gris410;

export function usePulso({ min = 0.45, duracionMs = 900 } = {}) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(valor, { toValue: 1, duration: duracionMs, useNativeDriver: true }),
      Animated.timing(valor, { toValue: 0, duration: duracionMs, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [valor, duracionMs]);
  return valor.interpolate({ inputRange: [0, 1], outputRange: [min, 1] });
}

export default function Skeleton({ style, children, min, duracionMs }) {
  const opacity = usePulso({ min, duracionMs });
  return (
    <Animated.View
      accessibilityLabel="Cargando"
      style={[style, { opacity }]}
    >
      {children}
    </Animated.View>
  );
}

export function SkeletonBloque({ width, height, borderRadius = 8, style }) {
  return (
    <Skeleton
      min={0.3}
      duracionMs={700}
      style={[{ width, height, borderRadius, backgroundColor: GRIS_SKELETON }, style]}
    />
  );
}
