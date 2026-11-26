import { useRef } from 'react';
import { Animated, Image, Text, TouchableOpacity } from 'react-native';

export default function EspecieTile({ styles: s, especie, seleccionada, onPress }) {
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
