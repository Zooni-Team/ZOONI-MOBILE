import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View, ImageBackground, StatusBar, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { resolveAvatarImage } from '../constants/avatarImages';

import HamburgerDrawer from '../components/HamburgerDrawer';
import SelectorMascota from '../components/SelectorMascota';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { colores } from '../theme';
import Toast from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { useAvataresCloset } from '../hooks/useAvataresCloset';
import { alerta } from '../utils/dialogo';

import { SkeletonCloset, AvatarThumbnail } from '../components/closet/PiezasCloset';

// ─── Skeleton ────────────────────────────────────────────────────────────────

// ─── Thumbnail ───────────────────────────────────────────────────────────────

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ClosetScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Estado y no constante: el selector de arriba permite vestir a otra mascota
  // sin salir del closet (el efecto de carga depende de petId y recarga solo).
  const [petId, setPetId] = useState(route.params?.petId || null);

  // La carga y el "aplicar" viven en el hook; acá sólo selección y animaciones.
  const { mascota, avatares, cargando: loading, aplicando, aplicar } = useAvataresCloset(petId);
  const [avatarSeleccionado, setAvatarSeleccionado] = useState(null);
  const { toast, mostrarToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { usuario, mascotaActiva } = useUsuarioActivo();

  const previewScale = useRef(new Animated.Value(1)).current;
  const previewRotate = useRef(new Animated.Value(0)).current;
  const botonColor = useRef(new Animated.Value(0)).current;

  const esAvatarActual = avatarSeleccionado === mascota?.imagen_asset;

  // ── Carga inicial ──────────────────────────────────────────────────────────

  // Al cargar (o cambiar de mascota) queda seleccionado el avatar que tiene puesto
  useEffect(() => {
    if (mascota) setAvatarSeleccionado(mascota.imagen_asset);
  }, [mascota?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!petId) {
      alerta('Falta la mascota', 'No se recibió qué mascota vestir.');
      navigation.goBack();
    }
  }, [petId, navigation]);

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
  }, [botonColor, mascota?.imagen_asset, previewRotate, previewScale]);

  // ── Aplicar avatar ────────────────────────────────────────────────────────

  const handleAplicar = async () => {
    if (esAvatarActual || aplicando) return;
    const r = await aplicar(avatarSeleccionado);
    if (r.ok) {
      Animated.timing(botonColor, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      mostrarToast('¡Avatar aplicado! 🎉');
    } else if (r.error === 'sin_permiso') {
      navigation.navigate('Home');
    }
  };

  // ── Render thumbnail ──────────────────────────────────────────────────────

  const renderThumbnail = ({ item, index }) => (
    <AvatarThumbnail
      avatar={item}
      mascota={mascota}
      isSelected={avatarSeleccionado === item.asset_name}
      isActual={mascota?.imagen_asset === item.asset_name}
      onPress={() => seleccionarAvatar(item.asset_name)}
      entryDelay={index * 50}
    />
  );

  // ── Estilo dinámico del botón (amarillo → gris) ───────────────────────────

  const botonBg = botonColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colores.gris420, colores.amarillo],
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
        <Toast {...toast} />

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={30} color={colores.negroSuave} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerDivider} />

        <SelectorMascota valor={petId} onCambiar={setPetId} style={{ marginTop: 8 }} />

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
                    color={esAvatarActual ? colores.verdeExito : colores.textoSecundario}
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
                      source={resolveAvatarImage(avatarSeleccionado, mascota?.especie, mascota?.raza)}
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
                    <Ionicons name="paw" size={12} color={colores.verdeExito} style={{ marginRight: 4 }} />
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
                      shadowColor: esAvatarActual ? 'transparent' : colores.amarillo,
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
                      <ActivityIndicator color={colores.texto} size="small" />
                    ) : (
                      <View style={styles.botonContent}>
                        {!esAvatarActual && (
                          <Ionicons name="shirt-outline" size={18} color={colores.texto} style={{ marginRight: 8 }} />
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
        mascotaActiva={mascota ?? mascotaActiva}
        activeRoute="Closet"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colores.mentaClara },
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
    color: colores.texto,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  heroNombreMascota: {
    fontWeight: '800',
    color: colores.verdeExito,
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
    color: colores.verdeExito,
  },
  previewBadgeTextPreview: {
    color: colores.textoSecundario,
  },
  previewCard: {
    backgroundColor: colores.blanco,
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: colores.verde,
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
    backgroundColor: colores.menta,
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
    color: colores.texto,
    marginTop: 14,
    textAlign: 'center',
    zIndex: 1,
  },

  // ── Grid ──
  gridSection: {
    backgroundColor: colores.blanco,
    borderRadius: 28,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: colores.negro,
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
    color: colores.texto,
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
    color: colores.verdeExito,
    textTransform: 'capitalize',
  },
  gridContainer: {
    paddingHorizontal: 14,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
    // Centrado y no 'flex-start': la última fila casi nunca viene completa (con
    // 4 looks queda una sola tarjeta) y alineada a la izquierda se veía como un
    // hueco al costado en vez de parte de la grilla. Las filas llenas no
    // cambian: justifyContent solo reparte el espacio que sobra.
    justifyContent: 'center',
  },

  // ── Thumbnail ──

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
    color: colores.texto,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colores.textoSecundario,
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
    color: colores.texto,
    letterSpacing: 0.2,
  },
  botonHint: {
    fontSize: 12,
    color: colores.textoSecundario,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },

});
