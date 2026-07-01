/**
 * Overlay de celebración cuando hay match mutuo.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MatchCelebrationOverlay({
  visible,
  matchUser,
  currentUserPhoto,
  onSendMessage,
  onKeepExploring,
}) {
  const titleScale = useRef(new Animated.Value(0)).current;
  const avatarLeft = useRef(new Animated.Value(-80)).current;
  const avatarRight = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (!visible) return;
    titleScale.setValue(0);
    avatarLeft.setValue(-80);
    avatarRight.setValue(80);
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(avatarLeft, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(avatarRight, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [visible, titleScale, avatarLeft, avatarRight]);

  if (!visible || !matchUser) return null;

  const renderAvatar = (uri, fallbackLetter) => (
    uri ? (
      <Image source={{ uri }} style={styles.avatar} />
    ) : (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarLetter}>{fallbackLetter}</Text>
      </View>
    )
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.Text style={[styles.title, { transform: [{ scale: titleScale }] }]}>
          ¡Es un Match!
        </Animated.Text>
        <Text style={styles.subtitle}>
          A vos y a {matchUser.nombre} les gustaron sus mascotas
        </Text>

        <View style={styles.avatarsRow}>
          <Animated.View style={{ transform: [{ translateX: avatarLeft }] }}>
            {renderAvatar(currentUserPhoto, 'Vos')}
          </Animated.View>
          <Ionicons name="heart" size={32} color="#2DBD72" style={styles.heartIcon} />
          <Animated.View style={{ transform: [{ translateX: avatarRight }] }}>
            {renderAvatar(matchUser.foto_perfil_url, matchUser.nombre?.[0] ?? '?')}
          </Animated.View>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={onSendMessage}>
          <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" style={styles.btnIcon} />
          <Text style={styles.btnPrimaryText}>Enviar mensaje</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={onKeepExploring}>
          <Text style={styles.btnSecondaryText}>Seguir explorando</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  subtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center',
    marginTop: 12, marginBottom: 28,
  },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#FFFFFF' },
  avatarFallback: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#C8F0D8',
    borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: '#27AE60' },
  heartIcon: { marginHorizontal: 12 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52, width: 240, marginBottom: 12,
  },
  btnIcon: { marginRight: 8 },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnSecondary: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30, height: 52, width: 240,
    borderWidth: 1, borderColor: '#FFFFFF',
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
