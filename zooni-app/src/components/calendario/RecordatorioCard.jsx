import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Skeleton from '../ui/Skeleton';
import { colores } from '../../theme';
import { getColorByProximidad, getTextoDias } from '../../utils/colorProximidad';
import { fechaHoraTexto } from './formato';

export default function RecordatorioCard({ evento, index, onEditar, onEliminar, onVerDetalle }) {
  const esEditable = evento.origen !== 'eventos';
  const translateY = useRef(new Animated.Value(14)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 70, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const color   = getColorByProximidad(evento.fecha_hora);
  const texto   = getTextoDias(evento.fecha_hora);

  const detener = (fn) => (e) => { e?.stopPropagation?.(); fn(); };

  return (
    <Animated.View style={[s.card, { transform: [{ translateY }], opacity }]}>
      <View style={[s.cardBorde, { backgroundColor: color }]} />

      <Pressable onPress={() => onVerDetalle(evento)} accessibilityLabel={`Ver detalle de ${evento.titulo}`}>
        <View style={s.cardFila1}>
          <View style={s.cardTituloRow}>
            {!!evento.emoji && (
              <View style={[s.cardBadge, evento.color && { backgroundColor: `${evento.color}22` }]}>
                <Text style={s.cardBadgeTxt}>{evento.emoji}</Text>
              </View>
            )}
            <Text style={s.cardTitulo} numberOfLines={2}>{evento.titulo}</Text>
          </View>
          <View style={s.cardAcciones}>
            {esEditable && (
              <TouchableOpacity onPress={detener(() => onEditar(evento))} accessibilityLabel="Editar evento"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={22} color={colores.ambar} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={detener(() => onEliminar(evento.id))} accessibilityLabel="Eliminar evento"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color={colores.textoSecundario} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.cardFila2}>
          <Text style={[s.cardTipo, { color }]}>{evento.tipo}</Text>
          <View style={[s.badgeDias, { backgroundColor: `${color}22` }]}>
            <Text style={[s.badgeDiasTxt, { color }]}>{texto}</Text>
          </View>
        </View>

        <Text style={s.cardFecha}>{fechaHoraTexto(evento.fecha_hora)}</Text>

        {!!evento.descripcion && (
          <Text style={s.cardDescripcion} numberOfLines={2} ellipsizeMode="tail">{evento.descripcion}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function RecordatorioCargando() {
  return <Skeleton style={s.skeletonCard} min={0.5} />;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colores.blanco,
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16, paddingVertical: 14, paddingLeft: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  cardBorde: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardFila1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTituloRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  cardBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colores.gris100, alignItems: 'center', justifyContent: 'center',
  },
  cardBadgeTxt: { fontSize: 15 },
  cardTitulo: { flex: 1, fontSize: 16, fontWeight: '700', color: colores.texto },
  cardAcciones: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardFila2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardTipo: { fontSize: 13, fontWeight: '600' },
  badgeDias: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  badgeDiasTxt: { fontSize: 11, fontWeight: '700' },
  cardFecha: { fontSize: 13, color: colores.textoSecundario, marginTop: 4 },
  cardDescripcion: { fontSize: 13, color: colores.textoSecundario, marginTop: 2 },
  skeletonCard: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, height: 90, marginBottom: 12 },
});
