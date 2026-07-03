/**
 * Vista ampliada del perfil al tocar la tarjeta Match.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { especieIcono, PET_TYPE_OPTIONS } from '../../data/matchDemo';
import { resolvePetPhotoSource } from '../../constants/matchAssets';

function especieLabel(especie) {
  return PET_TYPE_OPTIONS.find((p) => p.key === especie)?.label ?? especie;
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function MatchProfileDetailModal({ visible, perfil, onClose }) {
  const { width, height } = useWindowDimensions();
  const cardWidth = width - 32;
  const photoHeight = Math.min(height * 0.42, 360);

  if (!visible || !perfil) return null;

  const {
    nombre, edad, barrio, ciudad, distancia_km, foto_perfil_url, mascota, intereses,
  } = perfil;
  const petPhotoSource = resolvePetPhotoSource(mascota);
  const petAgeLabel = `${mascota.edad_anios} año${mascota.edad_anios === 1 ? '' : 's'}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { width: cardWidth }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Cerrar detalle"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color="#2C2C2C" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={[styles.photoSection, { height: photoHeight }]}>
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
                      <Ionicons name={especieIcono(mascota.especie)} size={18} color="#2C2C2C" />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.photoCaption}>
                <Text style={styles.photoCaptionName}>{nombre}, {edad}</Text>
                <Text style={styles.photoCaptionLoc}>📍 {barrio}, {ciudad}</Text>
              </View>
            </View>

            <View style={styles.bodySection}>
              <Text style={styles.sectionTitle}>Mascota</Text>
              <View style={styles.petNameCard}>
                <View style={styles.petEmojiWrap}>
                  <Ionicons name={especieIcono(mascota.especie)} size={26} color="#27AE60" />
                </View>
                <View style={styles.petNameBlock}>
                  <Text style={styles.petName}>{mascota.nombre}</Text>
                  <Text style={styles.petBreed}>{mascota.raza}</Text>
                </View>
              </View>

              <DetailRow label="Especie" value={especieLabel(mascota.especie)} />
              <DetailRow label="Edad" value={petAgeLabel} />
              <DetailRow label="Distancia" value={`${distancia_km} km`} />

              {intereses?.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Intereses</Text>
                  <View style={styles.tagsRow}>
                    {intereses.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  scrollContent: { paddingBottom: 20 },
  photoSection: {
    width: '100%',
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
  petPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  ownerPhotoWrap: { position: 'absolute', top: 16, left: 16, zIndex: 2 },
  ownerPhoto: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3, borderColor: '#FFFFFF',
  },
  ownerPhotoFallback: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3, borderColor: '#FFFFFF',
    backgroundColor: '#C8F0D8', alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontSize: 22, fontWeight: '800', color: '#27AE60' },
  petAvatarWrap: { position: 'absolute', bottom: -14, right: -14 },
  petAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  petAvatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#FFFFFF',
    backgroundColor: '#F5C842', alignItems: 'center', justifyContent: 'center',
  },
  photoCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoCaptionName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  photoCaptionLoc: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  bodySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B6B6B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionTitleSpaced: { marginTop: 8 },
  petNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FFF9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(45,189,114,0.2)',
  },
  petEmojiWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E4F9EC',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  petNameBlock: { flex: 1 },
  petName: { fontSize: 22, fontWeight: '800', color: '#27AE60' },
  petBreed: { fontSize: 15, color: '#2C2C2C', marginTop: 2, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  detailLabel: { fontSize: 14, color: '#6B6B6B', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#2C2C2C', fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: '#2DBD72',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
