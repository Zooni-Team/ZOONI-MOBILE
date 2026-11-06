/**
 * Skeleton.jsx — Placeholders de carga con "pulso" (la opacidad sube y baja).
 *
 * La animación vive en un solo lugar (usePulso). Cada pantalla arma la FORMA
 * de su placeholder con <Skeleton> y sus propios estilos:
 *
 *   <Skeleton style={s.skeletonCard}>
 *     <View style={s.skeletonLinea} />
 *   </Skeleton>
 *
 *   <SkeletonBloque width={120} height={18} />   // rectángulo suelto
 *
 * Catálogo: docs/claude/componentes.md
 */

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const GRIS_SKELETON = '#D0D0D0';

/** Opacidad animada en loop entre `min` y 1. Se detiene al desmontar. */
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

/** Contenedor que pulsa: la forma la dan `style` y los hijos. */
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

/** Rectángulo gris suelto (nombre de mascota, imagen, etc.). */
export function SkeletonBloque({ width, height, borderRadius = 8, style }) {
  return (
    <Skeleton
      min={0.3}
      duracionMs={700}
      style={[{ width, height, borderRadius, backgroundColor: GRIS_SKELETON }, style]}
    />
  );
}
