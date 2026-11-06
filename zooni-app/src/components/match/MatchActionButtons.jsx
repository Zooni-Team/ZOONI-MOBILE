/**
 * Botones de acción inferiores: volver, skip, like, estrella.
 */

import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../theme';

export default function MatchActionButtons({
  canUndo,
  onUndo,
  onSkip,
  onLike,
}) {
  const likeScale = useRef(new Animated.Value(1)).current;

  const pulseLike = () => {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLike();
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btnSmall, !canUndo && styles.btnDisabled]}
        onPress={canUndo ? onUndo : undefined}
        disabled={!canUndo}
        accessibilityLabel="Volver al anterior"
      >
        <Ionicons name="arrow-undo" size={22} color={canUndo ? colores.textoTenue : colores.gris500} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnMedium}
        onPress={onSkip}
        accessibilityLabel="Saltear perfil"
      >
        <Ionicons name="close" size={28} color={colores.rojo} />
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ scale: likeScale }] }}>
        <TouchableOpacity
          style={styles.btnLike}
          onPress={pulseLike}
          accessibilityLabel="Dar like"
        >
          <Ionicons name="heart" size={32} color={colores.blanco} />
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        style={[styles.btnSmall, styles.btnStar]}
        disabled
        accessibilityLabel="Favorito (próximamente)"
      >
        <Ionicons name="star" size={22} color={colores.amarillo} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingVertical: 8, paddingBottom: 10,
  },
  btnSmall: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colores.blanco,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  btnMedium: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colores.blanco,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  btnLike: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colores.verde,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  btnStar: { opacity: 0.5 },
  btnDisabled: { opacity: 0.3 },
});
