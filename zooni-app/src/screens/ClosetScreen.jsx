import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { resolveAvatarImage } from '../constants/avatarImages';
import { fetchAvatares, aplicarAvatar } from '../services/api';
import HamburgerDrawer from '../components/HamburgerDrawer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 40 - 24) / 3;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBox({ style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#D0EDD8', opacity: anim }, style]} />;
}

function SkeletonCloset() {
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
      <SkeletonBox style={{ height: 230, borderRadius: 20, marginBottom: 28 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <SkeletonBox
            key={i}
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: 14 }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.toastText}>¡Avatar aplicado!</Text>
    </Animated.View>
  );
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────

function AvatarThumbnail({ avatar, isSelected, isActual, onPress, entryDelay }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, delay: entryDelay, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 200, delay: entryDelay, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.timing(pressScale, { toValue: 0.94, duration: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(pressScale, { toValue: 1, duration: 130, useNativeDriver: true }).start();
  };

  const borderStyle = isSelected
    ? { borderWidth: 2.5, borderColor: '#2DBD72', shadowColor: '#2DBD72', shadowOpacity: 0.18, shadowRadius: 6 }
    : { borderWidth: 1, borderColor: '#EFEFEF' };

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
            borderStyle,
            { transform: [{ scale: pressScale }] },
          ]}
        >
          <Animated.Image
            source={resolveAvatarImage(avatar.asset_name)}
            style={styles.thumbnailImage}
            resizeMode="contain"
          />
          {isActual && (
            <View style={styles.badgeActual}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ClosetScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const petId = route.params?.petId;

  const [mascota, setMascota] = useState(null);
  const [avatares, setAvatares] = useState([]);
  const [avatarSeleccionado, setAvatarSeleccionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const previewScale = useRef(new Animated.Value(1)).current;
  const botonColor = useRef(new Animated.Value(0)).current;

  const esAvatarActual = avatarSeleccionado === mascota?.imagen_asset;

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!petId) {
      Alert.alert('Error', 'No se recibió el ID de la mascota.');
      navigation.goBack();
      return;
    }
    cargarDatos();
  }, [petId]);

  async function cargarDatos() {
    try {
      setLoading(true);
      const data = await fetchAvatares(petId);
      setMascota(data.mascota);
      setAvatares(data.avatares);
      setAvatarSeleccionado(data.mascota.imagen_asset);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los avatares. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── Animar preview al seleccionar ─────────────────────────────────────────

  const seleccionarAvatar = useCallback((assetName) => {
    setAvatarSeleccionado(assetName);
    previewScale.setValue(0.85);
    Animated.timing(previewScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    const esActual = assetName === mascota?.imagen_asset;
    Animated.timing(botonColor, {
      toValue: esActual ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [mascota]);

  // ── Aplicar avatar ────────────────────────────────────────────────────────

  const handleAplicar = async () => {
    if (esAvatarActual || aplicando) return;
    try {
      setAplicando(true);
      await aplicarAvatar(petId, avatarSeleccionado);

      setMascota(prev => ({ ...prev, imagen_asset: avatarSeleccionado }));
      Animated.timing(botonColor, { toValue: 0, duration: 200, useNativeDriver: false }).start();

      setShowToast(true);
      setTimeout(() => setShowToast(false), 2700);
    } catch (err) {
      if (err?.response?.status === 403) {
        Alert.alert('Sin permiso', 'No tenés permiso para modificar esta mascota.');
        navigation.navigate('Home');
      } else if (!err?.response) {
        Alert.alert('Sin conexión', 'Sin conexión. Intentá de nuevo más tarde.');
      } else {
        Alert.alert('Error', 'No se pudo aplicar el avatar. Intentá de nuevo.');
      }
    } finally {
      setAplicando(false);
    }
  };

  // ── Render thumbnail ──────────────────────────────────────────────────────

  const renderThumbnail = ({ item, index }) => (
    <AvatarThumbnail
      avatar={item}
      isSelected={avatarSeleccionado === item.asset_name}
      isActual={mascota?.imagen_asset === item.asset_name}
      onPress={() => seleccionarAvatar(item.asset_name)}
      entryDelay={index * 50}
    />
  );

  // ── Estilo dinámico del botón ─────────────────────────────────────────────

  const botonBg = botonColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C0C0C0', '#2DBD72'],
  });

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <Toast visible={showToast} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Ionicons name="menu" size={26} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Título */}
        <Text style={styles.titulo}>👕 Closet de Avatares</Text>
        <Text style={styles.subtitulo}>
          Elegí el avatar para {mascota?.nombre ?? '...'}
        </Text>

        {loading ? (
          <SkeletonCloset />
        ) : (
          <>
            {/* Card preview */}
            <View style={styles.previewCard}>
              <View style={styles.previewCircle} />
              <Animated.Image
                source={resolveAvatarImage(avatarSeleccionado, mascota?.especie)}
                style={[styles.previewImage, { transform: [{ scale: previewScale }] }]}
                resizeMode="contain"
              />
              <Text style={styles.previewLabel}>
                {esAvatarActual ? 'Avatar actual' : 'Vista previa'}
              </Text>
            </View>

            {/* Grid */}
            <Text style={styles.gridLabel}>Elegí un avatar:</Text>

            {avatares.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🎨</Text>
                <Text style={styles.emptyText}>
                  Próximamente habrá avatares para tu {mascota?.especie ?? 'mascota'} 🐾
                </Text>
              </View>
            ) : (
              <FlatList
                data={avatares}
                keyExtractor={(item) => item.asset_name}
                renderItem={renderThumbnail}
                numColumns={3}
                columnWrapperStyle={styles.gridRow}
                scrollEnabled={false}
                contentContainerStyle={styles.gridContainer}
              />
            )}

            {/* Botón aplicar */}
            <Animated.View
              style={[
                styles.botonWrapper,
                {
                  backgroundColor: botonBg,
                  opacity: esAvatarActual ? 0.7 : 1,
                  shadowColor: esAvatarActual ? 'transparent' : '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: esAvatarActual ? 0 : 0.12,
                  shadowRadius: 6,
                  elevation: esAvatarActual ? 0 : 4,
                },
              ]}
            >
              <TouchableOpacity
                onPress={handleAplicar}
                disabled={esAvatarActual || aplicando}
                activeOpacity={0.85}
                style={styles.boton}
              >
                {aplicando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.botonTexto}>Aplicar Avatar</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </ScrollView>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mascotaActiva={mascota}
        activeRoute="Closet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#C8F0D8' },

  header: {
    height: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  hamburger: { padding: 12, alignSelf: 'flex-start' },

  scroll: { paddingBottom: 40 },

  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Preview card
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  previewCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#A8E6C0',
    opacity: 0.35,
  },
  previewImage: { width: 140, height: 140 },
  previewLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 12,
  },

  // Grid
  gridLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
    marginHorizontal: 20,
    marginBottom: 14,
  },
  gridContainer: { paddingHorizontal: 20 },
  gridRow: { gap: 12, marginBottom: 12 },

  // Thumbnail
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  thumbnailImage: { width: '85%', height: '85%' },
  badgeActual: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 16,
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 8,
  },

  // Botón
  botonWrapper: {
    width: '70%',
    alignSelf: 'center',
    height: 52,
    borderRadius: 30,
    marginTop: 28,
    marginBottom: 40,
    overflow: 'hidden',
  },
  boton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Toast
  toast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2DBD72',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 100,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
