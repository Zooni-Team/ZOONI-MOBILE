/**
 * PetHero.jsx — Encabezado unificado de las pantallas de la Ficha Médica
 *
 * Lo usan Vacunas, Tratamientos, Consultas y Curiosidades para que las cuatro
 * se vean igual: ilustración de la mascota sobre el círculo verde, título
 * "<Sección> de <Nombre>" y las mismas tres líneas de datos (Edad, Peso, Raza).
 * Antes cada pantalla lo tenía copiado con variantes propias — Consultas, por
 * ejemplo, mostraba una sola línea y se comía el peso.
 */

import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import { calcularEdad } from '../utils/calcularEdad';
import { resolveMascotaVisual } from '../constants/petImages';

/** 20.4 → "20,40 kg" | null → "—" */
export function formatearPeso(peso) {
  if (peso == null) return '—';
  const n = parseFloat(peso);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

/**
 * @param {object}  mascota  { nombre, especie, raza, peso, fecha_nacimiento, imagen_asset }
 * @param {string}  titulo   Prefijo del título: "Tratamientos", "Consultas", …
 * @param {object}  anim     { scale, opacity } de la animación de entrada (opcional)
 */
export default function PetHero({ mascota, titulo, anim }) {
  const scaleLocal   = useRef(new Animated.Value(1)).current;
  const opacityLocal = useRef(new Animated.Value(1)).current;
  const scale   = anim?.scale   ?? scaleLocal;
  const opacity = anim?.opacity ?? opacityLocal;

  // Sin animación desde el padre, entra igual (Curiosidades no la manejaba)
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
  petCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#A8E6C0', opacity: 0.45, top: -15, alignSelf: 'center' },
  petImg:    { width: 110, height: 110, zIndex: 1 },
  titulo:    { fontSize: 24, fontWeight: '800', color: '#2C2C2C', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  info:      { alignItems: 'center', marginTop: 6, marginBottom: 22, gap: 2 },
  infoTxt:   { fontSize: 13, color: '#6B6B6B' },
});
