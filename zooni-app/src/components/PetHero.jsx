import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import { calcularEdad } from '../utils/calcularEdad';
import { resolveMascotaVisual } from '../constants/petImages';
import { formatearPeso } from '../constants/pesoPorEspecie';
import { colores } from '../theme';

export { formatearPeso };

export default function PetHero({ mascota, titulo, anim }) {
  const scaleLocal   = useRef(new Animated.Value(1)).current;
  const opacityLocal = useRef(new Animated.Value(1)).current;
  const scale   = anim?.scale   ?? scaleLocal;
  const opacity = anim?.opacity ?? opacityLocal;

  useEffect(() => {
    if (anim) return;
    scaleLocal.setValue(0.88);
    opacityLocal.setValue(0);
    Animated.parallel([
      Animated.timing(scaleLocal,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(opacityLocal, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [anim, scaleLocal, opacityLocal]);

  const m = mascota ?? {};
  const nombre = m.nombre ?? 'tu mascota';

  return (
    <View style={h.hero}>
      <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
        <View style={h.petCircle} />
        <Image
          source={resolveMascotaVisual(m)}
          style={h.petImg}
          resizeMode="contain"
          accessibilityLabel={`Ilustración de ${nombre}`}
        />
        <Text style={h.titulo} numberOfLines={1} ellipsizeMode="tail">
          {titulo} de {nombre}
        </Text>
        <View style={h.info}>
          <Text style={h.infoTxt}>Edad: {calcularEdad(m.fecha_nacimiento)}</Text>
          <Text style={h.infoTxt}>Peso: {formatearPeso(m.peso)}</Text>
          <Text style={h.infoTxt}>Raza: {m.raza ?? '—'}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const h = StyleSheet.create({
  hero:      { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  petCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colores.verdeBurbuja, opacity: 0.45, top: -15, alignSelf: 'center' },
  petImg:    { width: 110, height: 110, zIndex: 1 },
  titulo:    { fontSize: 24, fontWeight: '800', color: colores.texto, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  info:      { alignItems: 'center', marginTop: 6, marginBottom: 22, gap: 2 },
  infoTxt:   { fontSize: 13, color: colores.textoSecundario },
});
