/**
 * EspecieTile.jsx — Tarjeta para elegir la especie de una mascota (perro,
 * gato, …). La usan el registro (RegisterStep1) y el alta de mascota; antes
 * cada pantalla tenía una copia idéntica con sus mismos estilos.
 *
 * `especie`: { label, imagen?, icono? } — imagen (require) o, si no hay, emoji.
 * Va dentro de una fila con flexWrap: cada tarjeta ocupa ~la mitad.
 */

import { useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colores } from '../theme';

export default function EspecieTile({ especie, seleccionada, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[s.tileWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[s.tile, seleccionada && s.tileOn]}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityLabel={`Tipo de mascota: ${especie.label}`}
      >
        {especie.imagen ? (
          <Image source={especie.imagen} style={s.tileImg} resizeMode="contain" />
        ) : (
          <Text style={s.tileEmoji}>{especie.icono}</Text>
        )}
        <Text style={[s.tileLabel, seleccionada && s.tileLabelOn]}>{especie.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  tileWrap: { width: '47%', flexGrow: 1 },
  tile: {
    backgroundColor: colores.blanco, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colores.gris200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    minHeight: 92,
  },
  tileOn: { backgroundColor: colores.verde, borderColor: colores.verde },
  tileEmoji: { fontSize: 32, marginBottom: 6 },
  tileImg: { width: 40, height: 40, marginBottom: 6 },
  tileLabel: { fontSize: 14, fontWeight: '700', color: colores.texto },
  tileLabelOn: { color: colores.blanco },
});
