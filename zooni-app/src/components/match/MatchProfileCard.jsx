/**
 * Tarjeta de perfil para la pantalla Match (vertical, sin scroll).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { especieIcono } from '../../data/matchDemo';
import { resolveMascotaVisual } from '../../constants/petImages';

export default function MatchProfileCard({ perfil, cardHeight, cardWidth, onPress }) {
  const { nombre, edad, barrio, ciudad, foto_perfil_url, mascota, intereses } = perfil;

  const tags = [mascota.raza, ...intereses];
  const visibleTags = tags.slice(0, 3);
  const extraCount = tags.length - visibleTags.length;

  // Carrusel: todas las fotos reales (portada + galería). Si una mascota vieja
  // no tiene ninguna, cae en su ilustración por especie/raza — nunca ajena.
  const fotos = (mascota.fotos?.length ? mascota.fotos : null);
  const [fotoIdx, setFotoIdx] = useState(0);
  const idx = fotos ? Math.min(fotoIdx, fotos.length - 1) : 0;
  const petPhotoSource = fotos ? { uri: fotos[idx] } : resolveMascotaVisual(mascota);
  const totalFotos = fotos?.length ?? 0;

  const cardContent = (
    <>
      <Image source={petPhotoSource} style={styles.petPhoto} />

      {/* Zonas táctiles izquierda/derecha para pasar fotos (como Tinder) */}
      {totalFotos > 1 && (
        <>
          <TouchableOpacity style={styles.navIzq} activeOpacity={1}
            onPress={() => setFotoIdx((i) => Math.max(0, i - 1))} accessibilityLabel="Foto anterior" />
          <TouchableOpacity style={styles.navDer} activeOpacity={1}
            onPress={() => setFotoIdx((i) => Math.min(totalFotos - 1, i + 1))} accessibilityLabel="Foto siguiente" />
          <View style={styles.dotsRow}>
            {fotos.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotOn]} />
            ))}
          </View>
        </>
      )}

      <View style={styles.ownerPhotoWrap}>
        {foto_perfil_url ? (
          <Image source={{ uri: foto_perfil_url }} style={styles.ownerPhoto} />
        ) : (
          <View style={styles.ownerPhotoFallback}>
            <Text style={styles.ownerInitial}>{nombre[0]}</Text>
          </View>
        )}
        {/* Acá iba un círculo chico con la ilustración de la mascota, pegado
            abajo del avatar del dueño. Se sacó: la foto grande de la tarjeta ya
            es la mascota, así que repetía lo mismo y encima tapaba parte de la
            foto de perfil. */}
      </View>

      <View style={styles.infoOverlay}>
        <View style={styles.infoBlock}>
          <Text style={styles.nameText} numberOfLines={1}>
            {nombre}, {edad}
          </Text>
          <Text style={styles.locationText} numberOfLines={1}>
            📍 {barrio}, {ciudad}
          </Text>
          <View style={styles.tagsRow}>
            {visibleTags.map((tag, index) => (
              <View key={tag} style={styles.tag}>
                {index === 0 && (
                  <Ionicons name={especieIcono(mascota.especie)} size={12} color="#FFFFFF" style={styles.tagIcon} />
                )}
                <Text style={styles.tagText} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
            {extraCount > 0 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>+{extraCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { height: cardHeight, width: cardWidth },
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${nombre} y ${mascota.nombre}`}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.card, { height: cardHeight, width: cardWidth }]}
      accessibilityLabel={`Perfil de ${nombre} con su ${mascota.raza}`}
    >
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.99 }] },
  petPhoto: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  navIzq: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '33%', zIndex: 3 },
  navDer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '33%', zIndex: 3 },
  dotsRow: {
    position: 'absolute', top: 10, left: 0, right: 0, zIndex: 4,
    flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 12,
  },
  dot: { flex: 1, maxWidth: 40, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { backgroundColor: '#FFFFFF' },
  ownerPhotoWrap: { position: 'absolute', top: 14, left: 14, zIndex: 2 },
  ownerPhoto: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: '#FFFFFF',
  },
  ownerPhotoFallback: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: '#FFFFFF',
    backgroundColor: '#C8F0D8', alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontSize: 26, fontWeight: '800', color: '#27AE60' },
  infoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 48,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  infoBlock: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  nameText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  locationText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    maxWidth: '48%',
  },
  tagIcon: { marginRight: 4 },
  tagText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
