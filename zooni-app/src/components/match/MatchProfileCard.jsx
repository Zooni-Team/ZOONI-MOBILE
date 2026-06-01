/**
 * Tarjeta de perfil para la pantalla Match (vertical, sin scroll).
 */

import React from 'react';
import {
  View, Text, StyleSheet, Image, Pressable,
} from 'react-native';
import { especieEmoji } from '../../data/matchDemo';
import { resolvePetPhotoSource } from '../../constants/matchAssets';

export default function MatchProfileCard({ perfil, cardHeight, cardWidth, onPress }) {
  const { nombre, edad, barrio, ciudad, foto_perfil_url, mascota, intereses } = perfil;

  const tags = [
    `${especieEmoji(mascota.especie)} ${mascota.raza}`,
    ...intereses,
  ];
  const visibleTags = tags.slice(0, 3);
  const extraCount = tags.length - visibleTags.length;
  const petPhotoSource = resolvePetPhotoSource(mascota);

  const cardContent = (
    <>
      <Image source={petPhotoSource} style={styles.petPhoto} />

      <View style={styles.ownerPhotoWrap}>
        {foto_perfil_url ? (
          <Image source={{ uri: foto_perfil_url }} style={styles.ownerPhoto} />
        ) : (
          <View style={styles.ownerPhotoFallback}>
            <Text style={styles.ownerInitial}>{nombre[0]}</Text>
          </View>
        )}
        <View style={styles.petAvatarWrap}>
          {mascota.avatar_url ? (
            <Image source={{ uri: mascota.avatar_url }} style={styles.petAvatar} />
          ) : (
            <View style={styles.petAvatarFallback}>
              <Text style={styles.petAvatarEmoji}>{especieEmoji(mascota.especie)}</Text>
            </View>
          )}
        </View>
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
            {visibleTags.map((tag) => (
              <View key={tag} style={styles.tag}>
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
  ownerPhotoWrap: { position: 'absolute', top: 12, left: 12, zIndex: 2 },
  ownerPhoto: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 3, borderColor: '#FFFFFF',
  },
  ownerPhotoFallback: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 3, borderColor: '#FFFFFF',
    backgroundColor: '#C8F0D8', alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontSize: 18, fontWeight: '800', color: '#27AE60' },
  petAvatarWrap: { position: 'absolute', bottom: -12, right: -12 },
  petAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  petAvatarFallback: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#FFFFFF',
    backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center',
  },
  petAvatarEmoji: { fontSize: 14 },
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    maxWidth: '48%',
  },
  tagText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
