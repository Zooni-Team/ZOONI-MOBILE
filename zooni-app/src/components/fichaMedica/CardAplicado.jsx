import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../theme';

/**
 * Tarjeta de un ítem "aplicado" (vacuna o tratamiento): nombre, descripción
 * opcional, líneas de datos y botones editar/eliminar con su animación de
 * entrada y de presión. Antes estaba duplicada en VacunasScreen y
 * TratamientosScreen (faltaporhacer.md §2); cada pantalla sigue dueña de su
 * propio `StyleSheet` (`styles`) y de qué significan sus líneas.
 *
 * @param {object} styles - el `s` de la pantalla que llama (mismas claves que
 *   usaban los componentes viejos: cardAplicado, cardLeft, cardRight,
 *   cardNombre, cardDesc, cardField, cardContador, btnEditar, btnEliminar).
 * @param {{texto: string, color?: string, unaLinea?: boolean}[]} lineas
 * @param {{texto: string, color: string}=} contador
 */
export default function CardAplicado({
  styles: s,
  nombre,
  descripcion,
  lineas,
  contador,
  onEditar,
  onEliminar,
  editarLabel,
  eliminarLabel,
}) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scaleEdit = useRef(new Animated.Value(1)).current;
  const scaleDel = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  const pressIn = (scale) => Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }).start();
  const pressOut = (scale) => Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.cardAplicado, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardLeft}>
        <Text style={s.cardNombre}>{nombre}</Text>
        {descripcion ? <Text style={s.cardDesc}>{descripcion}</Text> : null}
        {lineas.map((l, i) => (
          <Text
            key={i}
            style={[s.cardField, l.color ? { color: l.color } : null]}
            numberOfLines={l.unaLinea ? 1 : undefined}
            ellipsizeMode={l.unaLinea ? 'tail' : undefined}
          >
            {l.texto}
          </Text>
        ))}
        {contador ? <Text style={[s.cardContador, { color: contador.color }]}>{contador.texto}</Text> : null}
      </View>
      <View style={s.cardRight}>
        <Animated.View style={{ transform: [{ scale: scaleEdit }] }}>
          <Pressable
            style={s.btnEditar}
            onPressIn={() => pressIn(scaleEdit)}
            onPressOut={() => pressOut(scaleEdit)}
            onPress={onEditar}
            accessibilityLabel={editarLabel}
          >
            <Ionicons name="create-outline" size={18} color={colores.blanco} />
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: scaleDel }] }}>
          <Pressable
            style={s.btnEliminar}
            onPressIn={() => pressIn(scaleDel)}
            onPressOut={() => pressOut(scaleDel)}
            onPress={onEliminar}
            accessibilityLabel={eliminarLabel}
          >
            <Ionicons name="trash-outline" size={18} color={colores.blanco} />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
