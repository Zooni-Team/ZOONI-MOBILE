/**
 * PiezasCloset.jsx — Piezas de la pantalla Closet (ClosetScreen): el
 * esqueleto de carga y la miniatura de cada avatar de la grilla.
 * Antes vivían dentro de la pantalla (informe de la devolución, FEC-GOD).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { resolveAvatarImage } from '../../constants/avatarImages';

import { colores } from '../../theme';

import Skeleton from '../ui/Skeleton';

export const SCREEN_WIDTH = Dimensions.get('window').width;

/** Lado de cada miniatura de la grilla de 3 columnas. */
export const THUMBNAIL_SIZE = (SCREEN_WIDTH - 48 - 24) / 3;

// El pulso es el de ui/Skeleton (antes había una copia propia que además
// nunca frenaba el loop al desmontar); acá sólo cambia el tono, el del Closet.
export function SkeletonBox({ style }) {
  return <Skeleton min={0.4} duracionMs={700} style={[{ backgroundColor: '#B8E8CA' }, style]} />;
}

export function SkeletonCloset() {
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
      <SkeletonBox style={{ height: 220, borderRadius: 24, marginBottom: 28 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <SkeletonBox
            key={i}
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: 16 }}
          />
        ))}
      </View>
    </View>
  );
}

export function AvatarThumbnail({ avatar, mascota, isSelected, isActual, onPress, entryDelay }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay: entryDelay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay: entryDelay, useNativeDriver: true, tension: 180, friction: 10 }),
    ]).start();
  }, [entryDelay, opacity, scale]);

  const handlePressIn = () =>
    Animated.timing(pressScale, { toValue: 0.92, duration: 90, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.timing(pressScale, { toValue: 1, duration: 130, useNativeDriver: true }).start();

  const isHighlighted = isSelected;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.thumbnail,
            isHighlighted && styles.thumbnailSelected,
            { transform: [{ scale: pressScale }] },
          ]}
        >
          <Animated.Image
            source={resolveAvatarImage(avatar.asset_name, mascota?.especie, mascota?.raza)}
            style={styles.thumbnailImage}
            resizeMode="contain"
          />
          {/* Badge de avatar actual */}
          {isActual && (
            <View style={styles.badgeActual}>
              <Ionicons name="checkmark" size={11} color={colores.blanco} />
            </View>
          )}
          {/* Nombre del avatar */}
          {avatar.nombre && (
            <Text style={styles.thumbnailLabel} numberOfLines={1}>
              {avatar.nombre}
            </Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE + 22, // espacio extra para el label
    backgroundColor: '#F9FFF9',
    borderRadius: 16,
    padding: 8,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colores.gris200,
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderWidth: 2.5,
    borderColor: colores.verde,
    backgroundColor: '#F0FDF5',
    shadowColor: colores.verde,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbnailImage: {
    width: '80%',
    height: THUMBNAIL_SIZE * 0.62,
  },
  badgeActual: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colores.verde,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: colores.verde,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  thumbnailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colores.textoSecundario,
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
  },
});
