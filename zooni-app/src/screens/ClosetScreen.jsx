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
  ImageBackground,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { resolveAvatarImage } from '../constants/avatarImages';
import { fetchAvatares, aplicarAvatar } from '../services/api';
import HamburgerDrawer from '../components/HamburgerDrawer';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 48 - 24) / 3;

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
  return <Animated.View style={[{ backgroundColor: '#B8E8CA', opacity: anim }, style]} />;
}

function SkeletonCloset() {
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

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
    >
      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.toastText}>¡Avatar aplicado! 🎉</Text>
    </Animated.View>
  );
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────

function AvatarThumbnail({ avatar, isSelected, isActual, onPress, entryDelay }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay: entryDelay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay: entryDelay, useNativeDriver: true, tension: 180, friction: 10 }),
    ]).start();
  }, []);

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
            source={resolveAvatarImage(avatar.asset_name)}
            style={styles.thumbnailImage}
            resizeMode="contain"
          />
          {/* Badge de avatar actual */}
          {isActual && (
            <View style={styles.badgeActual}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
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
  const { usuario, mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();


  const previewScale = useRef(new Animated.Value(1)).current;
  const previewRotate = useRef(new Animated.Value(0)).current;
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

    // Animación de "rebote" en el preview
    previewScale.setValue(0.82);
    previewRotate.setValue(-2);
    Animated.parallel([
      Animated.spring(previewScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
      Animated.spring(previewRotate, { toValue: 0, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();

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

  // ── Estilo dinámico del botón (amarillo → gris) ───────────────────────────

  const botonBg = botonColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CCCCCC', '#F5C842'],
  });

  const rotateDeg = previewRotate.interpolate({
    inputRange: [-10, 10],
    outputRange: ['-10deg', '10deg'],
  });

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
        resizeMode="cover"
      >
        <Toast visible={showToast} />

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={30} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── HERO SECTION ── */}
          <View style={styles.heroSection}>
            <Text style={styles.heroSubtitulo}>
              {mascota?.nombre ? (
                <>
                  {'Personalizá a '}
                  <Text style={styles.heroNombreMascota}>{mascota.nombre}</Text>
                  {' con un nuevo look 🐾'}
                </>
              ) : (
                'Elegí el look de tu mascota 🐾'
              )}
            </Text>
          </View>

          {loading ? (
            <SkeletonCloset />
          ) : (
            <>
              {/* ── PREVIEW CARD ── */}
              <View style={styles.previewCardOuter}>
                {/* Etiqueta de estado */}
                <View style={[
                  styles.previewBadge,
                  esAvatarActual ? styles.previewBadgeActual : styles.previewBadgePreview,
                ]}>
                  <Ionicons
                    name={esAvatarActual ? 'checkmark-circle' : 'eye-outline'}
                    size={13}
                    color={esAvatarActual ? '#27AE60' : '#6B6B6B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[
                    styles.previewBadgeText,
                    esAvatarActual ? styles.previewBadgeTextActual : styles.previewBadgeTextPreview,
                  ]}>
                    {esAvatarActual ? 'Avatar actual' : 'Vista previa'}
                  </Text>
                </View>

                <View style={styles.previewCard}>
                  {/* Contenedor centrado para círculo + avatar */}
                  <View style={styles.previewAvatarWrap}>
                    {/* Círculo decorativo centrado absolutamente */}
                    <View style={styles.previewCircleOuter} />
                    <View style={styles.previewCircleInner} />

                    {/* Avatar grande animado */}
                    <Animated.Image
                      source={resolveAvatarImage(avatarSeleccionado, mascota?.especie)}
                      style={[
                        styles.previewImage,
                        {
                          transform: [
                            { scale: previewScale },
                            { rotate: rotateDeg },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Nombre del avatar seleccionado */}
                  {avatarSeleccionado && avatares.length > 0 && (
                    <Text style={styles.previewAvatarName}>
                      {avatares.find(a => a.asset_name === avatarSeleccionado)?.nombre ?? ''}
                    </Text>
                  )}
                </View>
              </View>

              {/* ── SECCIÓN GRID ── */}
              <View style={styles.gridSection}>
                <View style={styles.gridHeaderRow}>
                  <Text style={styles.gridLabel}>Elegí un look</Text>
                  <View style={styles.gridSpecieChip}>
                    <Ionicons name="paw" size={12} color="#27AE60" style={{ marginRight: 4 }} />
                    <Text style={styles.gridSpecieText}>
                      {mascota?.especie ?? ''}
                    </Text>
                  </View>
                </View>

                {avatares.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>🎨</Text>
                    <Text style={styles.emptyTitle}>¡Próximamente!</Text>
                    <Text style={styles.emptyText}>
                      Estamos diseñando avatares únicos para tu {mascota?.especie ?? 'mascota'}.
                      ¡Volvé pronto! 🐾
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
              </View>

              {/* ── BOTÓN APLICAR ── */}
              <View style={styles.botonSection}>
                <Animated.View
                  style={[
                    styles.botonWrapper,
                    {
                      backgroundColor: botonBg,
                      opacity: esAvatarActual ? 0.55 : 1,
                      shadowColor: esAvatarActual ? 'transparent' : '#F5C842',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: esAvatarActual ? 0 : 0.4,
                      shadowRadius: 12,
                      elevation: esAvatarActual ? 0 : 6,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={handleAplicar}
                    disabled={esAvatarActual || aplicando}
                    activeOpacity={0.82}
                    style={styles.boton}
                  >
                    {aplicando ? (
                      <ActivityIndicator color="#2C2C2C" size="small" />
                    ) : (
                      <View style={styles.botonContent}>
                        {!esAvatarActual && (
                          <Ionicons name="shirt-outline" size={18} color="#2C2C2C" style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.botonTexto}>
                          {esAvatarActual ? 'Ya aplicado ✓' : 'Aplicar Avatar'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {!esAvatarActual && (
                  <Text style={styles.botonHint}>
                    El cambio se verá en toda la app
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </ImageBackground>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascota ?? mascotaActivaDemo}
        activeRoute="Closet"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#D4F5E2' },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },

  // ── Header ──
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 20,
  },

  // ── Scroll ──
  scroll: { paddingBottom: 48 },

  // ── Hero ──
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  heroSubtitulo: {
    fontSize: 15,
    color: '#2C2C2C',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  heroNombreMascota: {
    fontWeight: '800',
    color: '#27AE60',
  },

  // ── Preview card ──
  previewCardOuter: {
    marginHorizontal: 24,
    marginBottom: 28,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  previewBadgeActual: {
    backgroundColor: 'rgba(45, 189, 114, 0.15)',
  },
  previewBadgePreview: {
    backgroundColor: 'rgba(107, 107, 107, 0.12)',
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewBadgeTextActual: {
    color: '#27AE60',
  },
  previewBadgeTextPreview: {
    color: '#6B6B6B',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#2DBD72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  // Wrapper que contiene el círculo y el avatar, ambos centrados
  previewAvatarWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCircleOuter: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E8F8F0',
    opacity: 0.95,
  },
  previewCircleInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#C8F0D8',
    opacity: 0.7,
  },
  previewImage: {
    width: 150,
    height: 150,
    zIndex: 1,
  },
  previewAvatarName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
    marginTop: 14,
    textAlign: 'center',
    zIndex: 1,
  },

  // ── Grid ──
  gridSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  gridLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C2C2C',
    letterSpacing: 0.2,
  },
  gridSpecieChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 189, 114, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gridSpecieText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#27AE60',
    textTransform: 'capitalize',
  },
  gridContainer: {
    paddingHorizontal: 14,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },

  // ── Thumbnail ──
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
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderWidth: 2.5,
    borderColor: '#2DBD72',
    backgroundColor: '#F0FDF5',
    shadowColor: '#2DBD72',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbnailImage: {
    width: '80%',
    height: THUMBNAIL_SIZE * 0.62,
  },
  thumbnailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
  },
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
    zIndex: 2,
    shadowColor: '#2DBD72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C2C2C',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Botón ──
  botonSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  botonWrapper: {
    width: '78%',
    height: 56,
    borderRadius: 30,
    overflow: 'hidden',
  },
  boton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2C2C',
    letterSpacing: 0.2,
  },
  botonHint: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Toast ──
  toast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2DBD72',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    zIndex: 200,
    shadowColor: '#2DBD72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
