import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Dimensions, SafeAreaView, StatusBar,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  const [homeData, setHomeData] = useState(null);
  const [botones, setBotones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const petNameOpacity = useRef(new Animated.Value(0)).current;
  const petImageScale = useRef(new Animated.Value(0.9)).current;

  const loadData = useCallback(async () => {
    try {
      const [data, config] = await Promise.all([fetchHome(), fetchHomeConfig()]);
      setHomeData(data);
      setBotones(config.botones);
    } catch {
      // Sin backend: usar datos de demo
      setHomeData(DEMO_DATA);
      setBotones(DEMO_CONFIG.botones);
    } finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(petNameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(petImageScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteButton = (seccion) => {
    setBotones((prev) => prev.filter((b) => b.seccion !== seccion));
  };

  const handleAddButton = (seccionKey) => {
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

  const handleNotifNavigate = (ruta) => {
    const screen = ruta.split('/')[0];
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

      {/* ── ZONA 1: HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel="Abrir menú"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu-outline" size={28} color="#2C2C2C" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setNotifOpen(true)}
          accessibilityLabel="Notificaciones"
          style={styles.bellWrap}
        >
          <Ionicons name="notifications-outline" size={26} color="#F5A623" />
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── ZONA 2: HERO ── */}
        <View style={styles.heroZone}>
          {/* Fondo verde — reemplazar con imagen cuando el equipo la provea */}
          <View style={styles.heroBg} />

          {/* Nombre mascota */}
          <Animated.View style={[styles.petNameWrap, { opacity: petNameOpacity }]}>
            {loading ? (
              <SkeletonLoader width={140} height={36} borderRadius={10} />
            ) : mascota ? (
              <Text style={styles.petName} numberOfLines={1}>
                {mascota.nombre.length > 20 ? mascota.nombre.slice(0, 20) + '…' : mascota.nombre}
              </Text>
            ) : null}
          </Animated.View>

          {/* Imagen mascota */}
          <Animated.View style={[styles.petImageWrap, { transform: [{ scale: petImageScale }] }]}>
            {loading ? (
              <SkeletonLoader width={180} height={190} borderRadius={90} />
            ) : (
              <View style={styles.petPlaceholder}>
                <Ionicons name="paw" size={90} color="#27AE60" />
              </View>
            )}
          </Animated.View>
        </View>

        {/* ── ZONA 3: BOTONES ── */}
        <View style={styles.buttonsZone}>

          {/* Estado vacío — sin mascota */}
          {!loading && !mascota && (
            <View style={styles.emptyState}>
              <Ionicons name="paw-outline" size={56} color="#AAAAAA" />
              <Text style={styles.emptyTitle}>¡Agregá tu primera mascota!</Text>
              <Text style={styles.emptySubtitle}>Registrá a tu compañero para empezar a usar Zooni.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('MisMascotas')}>
                <Text style={styles.emptyBtnText}>Agregar mascota</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botones dinámicos */}
          {visibleBotones.map((boton) => {
            const seccion = getSeccion(boton.seccion);
            if (!seccion) return null;
            return (
              <NavButton
                key={boton.seccion}
                label={seccion.label}
                iconName={seccion.icono}
                editMode={editMode}
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
          })}

          {/* Botón guardar en modo edición */}
          {editMode && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConfig}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          )}

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

      {/* ── OVERLAYS ── */}
      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascota ?? null}
        activeRoute="Home"
      />
      <NotificationsPanel
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={handleNotifNavigate}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#C8F0D8' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    backgroundColor: 'transparent', zIndex: 10,
  },
  bellWrap: { position: 'relative' },
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: '#E63946', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero
  heroZone: { height: SCREEN_HEIGHT * 0.42, overflow: 'hidden', alignItems: 'center' },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#B8EDD0',
    // Degradado simulado con dos capas
  },
  petNameWrap: { marginTop: 20, alignItems: 'center', zIndex: 2 },
  petName: { fontSize: 30, fontWeight: '800', color: '#27AE60', textAlign: 'center' },
  petImageWrap: { position: 'absolute', bottom: 0, alignItems: 'center' },
  petPlaceholder: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },

  // Buttons zone
  buttonsZone: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100, backgroundColor: '#C8F0D8' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2C', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', paddingHorizontal: 16 },
  emptyBtn: { marginTop: 8, backgroundColor: '#F5C842', borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },

  // Save button
  saveBtn: {
    backgroundColor: '#F5C842', borderRadius: 30, height: 54,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#2C2C2C' },

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
