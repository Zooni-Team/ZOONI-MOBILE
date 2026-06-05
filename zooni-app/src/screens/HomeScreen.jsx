import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, ImageBackground, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Dimensions, SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { fetchHome, fetchHomeConfig, saveHomeConfig } from '../services/api';
import { getSeccion } from '../services/secciones';
import SkeletonLoader from '../components/SkeletonLoader';
import HamburgerDrawer from '../components/HamburgerDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import AddButtonModal from '../components/AddButtonModal';
import NavButton from '../components/NavButton';
import DraggableList from '../components/DraggableList';
import { HOME_BACKGROUND, resolvePetImageSource } from '../constants/homeAssets';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_HEIGHT * 0.40, 340);
const PET_IMAGE_SIZE = 250;

// Datos de demo para cuando no hay backend conectado
const DEMO_DATA = {
  usuario: { id: 1, nombre: 'Sofía', apellido: 'García', fotoPerfil: null },
  mascotaActiva: {
    id: 1,
    nombre: 'Titán',
    especie: 'perro',
    raza: 'Labrador Retriever',
    fotoUrl: null,
    edadAnios: 4,
    edadMeses: 2,
  },
  notificacionesNoLeidas: 3,
};

const DEMO_CONFIG = {
  botones: [
    { seccion: 'comunidad',   orden: 1, visible: true },
    { seccion: 'ficha_medica', orden: 2, visible: true },
    { seccion: 'match',       orden: 3, visible: true },
  ],
};

export default function HomeScreen() {
  const navigation = useNavigation();

  const [homeData, setHomeData] = useState(DEMO_DATA);
  const [botones, setBotones] = useState(DEMO_CONFIG.botones);
  const [loading, setLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const petNameOpacity = useRef(new Animated.Value(1)).current;
  const petFloatY = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      // Timeout de 3 segundos: si el backend no responde, usar datos demo
      const dataPromise = Promise.race([
        Promise.all([fetchHome(), fetchHomeConfig()]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        )
      ]);
      
      const [data, config] = await dataPromise;
      setHomeData(data);
      setBotones(config.botones);
    } catch (error) {
      // Sin backend o timeout: usar datos de demo
      console.log('Usando datos de demo:', error.message);
      setHomeData(DEMO_DATA);
      setBotones(DEMO_CONFIG.botones);
    } finally {
      setLoading(false);
      // Dar 100ms para que termine de renderizar la imagen antes de animar
      setTimeout(() => {
        Animated.timing(petNameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 100);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    // Solo iniciar la animación flotante después de que termine la carga inicial
    if (!loading) {
      const bob = Animated.loop(
        Animated.sequence([
          Animated.timing(petFloatY, {
            toValue: 10,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(petFloatY, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      bob.start();
      return () => bob.stop();
    }
  }, [petFloatY, loading]);

  const handleDeleteButton = (seccion) => {
    setBotones((prev) => prev.filter((b) => b.seccion !== seccion));
  };

  const handleAddButton = (seccionKey) => {
    // Máximo 4 botones amarillos (SOS es fijo, total = 5)
    if (botones.filter((b) => b.visible).length >= 4) return;
    setBotones((prev) => [
      ...prev,
      { seccion: seccionKey, orden: prev.length + 1, visible: true },
    ]);
  };

  const handleSaveConfig = async () => {
    const updated = botones.map((b, i) => ({ ...b, orden: i + 1, visible: true }));
    setBotones(updated);
    setEditMode(false);
    try { await saveHomeConfig({ botones: updated }); } catch { /* sin backend */ }
  };

  const handleMoveButton = (index, direction) => {
    const newBotones = [...botones];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newBotones.length) return;
    [newBotones[index], newBotones[swapIndex]] = [newBotones[swapIndex], newBotones[index]];
    setBotones(newBotones);
  };

  const handleNotifNavigate = (ruta) => {    const screen = ruta.split('/')[0];
    const map = { perfil: 'Perfil', match: 'Match', fichamedica: 'FichaMedica', comunidad: 'Comunidad' };
    if (map[screen]) navigation.navigate(map[screen]);
  };

  const visibleBotones = botones.filter((b) => b.visible);
  const mascota = homeData?.mascotaActiva;
  const usuario = homeData?.usuario ?? null;
  const badge = homeData?.notificacionesNoLeidas ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
        resizeMode="cover"
      >
      {/* ── ZONA 1: HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel="Abrir menú"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={30} color="#0A0A0A" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setNotifOpen((v) => !v)}
          accessibilityLabel="Notificaciones"
          style={styles.bellWrap}
        >
          <Ionicons name="notifications" size={30} color="#F5C842" />
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <NotificationsPanel
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={handleNotifNavigate}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!editMode}
      >

        {/* ── ZONA 2: HERO ── */}
        <View style={styles.heroZone}>
          {mascota && (
            <Animated.View style={[styles.petNameWrap, { opacity: petNameOpacity }]}>
              {loading ? (
                <SkeletonLoader width={140} height={36} borderRadius={10} />
              ) : (
                <Text style={styles.petName} numberOfLines={1}>
                  {mascota.nombre.length > 20
                    ? mascota.nombre.slice(0, 20) + '…'
                    : mascota.nombre}
                </Text>
              )}
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.petImageWrap,
              { transform: [{ translateY: petFloatY }] },
            ]}
          >
            {loading ? (
              <SkeletonLoader width={PET_IMAGE_SIZE} height={PET_IMAGE_SIZE} borderRadius={20} />
            ) : (
              <PetIllustration
                source={resolvePetImageSource(mascota)}
                label={mascota ? `Ilustración de ${mascota.nombre}` : 'Mascota'}
              />
            )}
          </Animated.View>
        </View>

        <View style={styles.heroButtonsGap} />

        {/* ── ZONA 3: BOTONES ── */}
        <View style={styles.buttonsZone}>

          {/* Botón guardar — arriba, verde, solo en modo edición */}
          {editMode && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConfig}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          )}

          {/* Botones dinámicos con drag & drop */}
          <DraggableList
            items={visibleBotones}
            disabled={!editMode}
            onReorder={(newItems) => setBotones(newItems)}
            renderItem={({ item: boton, isDragging }) => {
              const seccion = getSeccion(boton.seccion);
              if (!seccion) return null;
              return (
                <NavButton
                  label={seccion.label}
                  iconName={seccion.icono}
                  editMode={editMode}
                  style={{ flex: 1, opacity: isDragging ? 0.85 : 1 }}
                  onDelete={() => handleDeleteButton(boton.seccion)}
                  onPress={() => {
                    if (editMode) return;
                    if (boton.seccion === 'ficha_medica' && mascota) {
                      navigation.navigate('FichaMedica', { mascotaId: mascota.id });
                    } else {
                      navigation.navigate(seccion.ruta);
                    }
                  }}
                  accessibilityLabel={`Ir a ${seccion.label}`}
                />
              );
            }}
          />

          {/* SOS — siempre visible, siempre último */}
          <NavButton
            label="S.O.S Veterinario"
            iconName="alert-circle-outline"
            variant="danger"
            onPress={() => { /* TODO: flujo SOS */ }}
            accessibilityLabel="Emergencia veterinaria"
          />
        </View>
      </ScrollView>

      {/* ── ZONA 4: FABs ── */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, editMode && styles.fabActive]}
          onPress={() => setEditMode((v) => !v)}
          accessibilityLabel="Personalizar orden de botones"
        >
          <Ionicons name="grid-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setAddModalOpen(true)}
          accessibilityLabel="Agregar sección"
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      </ImageBackground>

      {/* ── OVERLAYS ── */}
      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascota ?? null}
        activeRoute="Home"
      />
      <AddButtonModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        botonesActivos={botones}
        onAdd={handleAddButton}
      />
    </SafeAreaView>
  );
}

/** Sombra que sigue la silueta del PNG (no un cuadrado del contenedor). */
function PetIllustration({ source, label }) {
  if (Platform.OS === 'web') {
    return (
      <Image
        source={source}
        style={[styles.petImage, styles.petImageDropShadow]}
        resizeMode="contain"
        accessibilityLabel={label}
      />
    );
  }

  // Single image with shadow (50% más rápido)
  return (
    <Image
      source={source}
      style={[styles.petImage, styles.petImageWithShadow]}
      resizeMode="contain"
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#D4F5E2' },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    backgroundColor: 'transparent', zIndex: 10,
  },
  bellWrap: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#E63946', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, backgroundColor: 'transparent' },

  // Hero — ~45% pantalla (Instruction-Home)
  heroZone: {
    overflow: 'visible',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 4,
    height: HERO_HEIGHT,
  },
  petNameWrap: { marginTop: 8, marginBottom: 12, alignItems: 'center', zIndex: 3, paddingHorizontal: 20 },
  petName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  petImageContainer: {
    width: PET_IMAGE_SIZE,
    height: PET_IMAGE_SIZE,
    maxWidth: SCREEN_WIDTH * 0.68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petImageShadowLayer: {
    position: 'absolute',
    top: 12,
    opacity: 0.28,
    tintColor: '#2a5c48',
  },
  petImageDropShadow: {
    filter: 'drop-shadow(4px 10px 14px rgba(36, 90, 66, 0.35))',
  },
  petImageWithShadow: {
    shadowColor: '#245a42',
    shadowOffset: { width: 4, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  petImageWrap: {
    position: 'absolute',
    bottom: -48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  petImage: {
    width: PET_IMAGE_SIZE,
    height: PET_IMAGE_SIZE,
    maxWidth: SCREEN_WIDTH * 0.68,
    maxHeight: PET_IMAGE_SIZE,
    backgroundColor: 'transparent',
  },

  // Buttons zone — fondo transparente (se ve home_background.png)
  buttonsZone: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 100, backgroundColor: 'transparent' },

  // Save button — verde, arriba de los botones
  saveBtn: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 54,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  // FABs
  fabContainer: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', gap: 10 },
  fab: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2DBD72',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabActive: { backgroundColor: '#27AE60' },
});
