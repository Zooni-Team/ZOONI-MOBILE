import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, ImageBackground, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Dimensions, SafeAreaView, StatusBar, Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { activarMascota, fetchHome, fetchHomeConfig, saveHomeConfig } from '../services/api';
import { getSeccion } from '../services/secciones';
import SkeletonLoader from '../components/SkeletonLoader';
import HamburgerDrawer from '../components/HamburgerDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import AddButtonModal from '../components/AddButtonModal';
import NavButton from '../components/NavButton';
import DraggableList from '../components/DraggableList';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { resolveMascotaVisual } from '../constants/petImages';
import { useTheme } from '../config/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_HEIGHT * 0.40, 340);
const PET_IMAGE_SIZE = 250;

const BOTONES_POR_DEFECTO = [
  { seccion: 'comunidad',   orden: 1, visible: true },
  { seccion: 'ficha_medica', orden: 2, visible: true },
  { seccion: 'match',       orden: 3, visible: true },
];

/*
  Antes acá vivía un DEMO_DATA con la mascota "Titán / Labrador Retriever" que
  se aplicaba ante CUALQUIER error o demora de más de 3 segundos. Con una red
  lenta eso pisaba la mascota real del usuario por una de mentira cada tanto —
  el "se me pone una mascota default" del reporte.

  Ahora un fallo no inventa datos: se conserva lo último que se cargó bien (o
  los skeletons, si es la primera carga) y se avisa que no se pudo actualizar.
*/
const TIMEOUT_MS = 12000;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { reduceMotion } = useTheme();

  // null (no los datos demo) para que el primer render nunca muestre a
  // "Titán" ni el orden de botones de mentira — antes arrancaba mostrando
  // eso literalmente hasta que la carga real terminaba.
  const [homeData, setHomeData] = useState(null);
  const [botones, setBotones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const petNameOpacity = useRef(new Animated.Value(1)).current;
  const petFloatY = useRef(new Animated.Value(0)).current;
  // Transición al alternar de mascota (deslizar + fundir la ilustración y el nombre)
  const petSwapX = useRef(new Animated.Value(0)).current;
  const petSwapOpacity = useRef(new Animated.Value(1)).current;
  const cambiandoMascota = useRef(false);

  // silencioso: refresca los datos sin volver a mostrar los skeletons
  // (lo usa el pull-to-refresh, que ya muestra su propio spinner).
  const loadData = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      // El timeout es solo un cortafuegos para que la pantalla no quede colgada
      // si el backend nunca responde. Es holgado a propósito: con 3 segundos,
      // una red de celular normal lo cruzaba seguido.
      let cortar;
      const data = await Promise.race([
        Promise.all([fetchHome(), fetchHomeConfig()]),
        new Promise((_, reject) => {
          cortar = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
        }),
      ]).finally(() => clearTimeout(cortar));

      setHomeData(data[0]);
      setBotones(data[1].botones);
      setErrorCarga(false);
    } catch (error) {
      // Nunca se reemplazan los datos del usuario por datos inventados: se deja
      // lo último bueno y se marca el error para poder reintentar.
      console.log('No se pudo actualizar Home:', error.message);
      setBotones((prev) => (prev.length ? prev : BOTONES_POR_DEFECTO));
      setErrorCarga(true);
    } finally {
      setLoading(false);
      // Dar 100ms para que termine de renderizar la imagen antes de animar
      setTimeout(() => {
        Animated.timing(petNameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 100);
    }
  }, []);

  // useEffect solo (mount-once) no alcanza: si volvés de Closet después de
  // aplicar un avatar nuevo, Home seguía mostrando los datos viejos porque
  // React Navigation no remonta la pantalla al volver atrás — solo la vuelve
  // a enfocar. useFocusEffect refresca los datos cada vez que Home
  // recupera el foco (incluye el primer montaje).
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    // "Reducir movimiento" activo: la mascota queda quieta
    if (reduceMotion) { petFloatY.setValue(0); return; }
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
  }, [petFloatY, loading, reduceMotion]);

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

  const handleNotifNavigate = (ruta) => {
    // Destino con parámetros ({ screen, params }): ej. el chat de un match
    if (typeof ruta === 'object' && ruta?.screen) {
      navigation.navigate(ruta.screen, ruta.params);
      return;
    }
    // api.js manda nombres de pantalla ('Mensajes', 'Comunidad'); se normaliza
    // a minúsculas para bancar también rutas viejas tipo 'perfil/...'.
    const screen = ruta.split('/')[0].toLowerCase();
    const map = { perfil: 'Perfil', match: 'Match', fichamedica: 'FichaMedica', comunidad: 'Comunidad', mensajes: 'Mensajes' };
    if (map[screen]) navigation.navigate(map[screen]);
  };

  const visibleBotones = botones.filter((b) => b.visible);
  const mascota = homeData?.mascotaActiva;
  const usuario = homeData?.usuario ?? null;
  const badge = homeData?.notificacionesNoLeidas ?? 0;
  const mascotas = homeData?.mascotas ?? (mascota ? [mascota] : []);

  /**
   * Alterna la mascota activa con las flechas del hero (circular).
   * Optimista: la UI cambia ya; el EsActiva se persiste en la base para que
   * TODA la app siga a esta mascota (cada pantalla relee la activa al entrar).
   */
  const persistirMascota = async (siguiente) => {
    try {
      await activarMascota(siguiente.id);
    } catch {
      // Si no se pudo persistir, recargar para volver al estado real
      loadData(true);
    }
  };

  const cambiarMascota = (direccion) => {
    if (mascotas.length < 2 || !mascota || cambiandoMascota.current) return;
    const i = mascotas.findIndex((m) => m.id === mascota.id);
    const siguiente = mascotas[(i + direccion + mascotas.length) % mascotas.length];

    // Sin animación (accesibilidad "reducir movimiento"): swap directo.
    if (reduceMotion) {
      setHomeData((d) => (d ? { ...d, mascotaActiva: siguiente } : d));
      persistirMascota(siguiente);
      return;
    }

    // La ilustración/nombre salen hacia el lado del gesto, se cambia la mascota
    // fuera de cuadro y entra desde el lado opuesto (fundido + deslizamiento).
    cambiandoMascota.current = true;
    const salida = direccion > 0 ? -70 : 70;
    Animated.parallel([
      Animated.timing(petSwapX, { toValue: salida, duration: 170, useNativeDriver: true }),
      Animated.timing(petSwapOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(petNameOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      setHomeData((d) => (d ? { ...d, mascotaActiva: siguiente } : d));
      petSwapX.setValue(-salida);
      Animated.parallel([
        Animated.spring(petSwapX, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(petSwapOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(petNameOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start(() => { cambiandoMascota.current = false; });
      persistirMascota(siguiente);
    });
  };

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
        onMarcarTodasLeidas={() => setHomeData((d) => (d ? { ...d, notificacionesNoLeidas: 0 } : d))}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!editMode}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={['#2DBD72']} tintColor="#2DBD72" />
        }
      >
        {/* Sustituye al viejo fallback de datos demo: se avisa que no se pudo
            actualizar en vez de mostrar una mascota que no es la del usuario. */}
        {errorCarga && (
          <TouchableOpacity style={styles.avisoError} onPress={() => loadData()} activeOpacity={0.8}>
            <Text style={styles.avisoErrorTxt}>
              No se pudieron actualizar los datos. Tocá para reintentar.
            </Text>
          </TouchableOpacity>
        )}

        {/* ── ZONA 2: HERO ── */}
        <View style={styles.heroZone}>
          {(mascota || loading) && (
            <Animated.View style={[styles.petNameWrap, { opacity: petNameOpacity, transform: [{ translateX: petSwapX }] }]}>
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
              { opacity: petSwapOpacity, transform: [{ translateY: petFloatY }, { translateX: petSwapX }] },
            ]}
          >
            {loading ? (
              <SkeletonLoader width={PET_IMAGE_SIZE} height={PET_IMAGE_SIZE} borderRadius={20} />
            ) : (
              <PetIllustration
                // Foto real subida si tiene, si no el look/avatar aplicado en
                // Closet — antes esto solo miraba la foto y por eso el avatar
                // nunca se veía acá aunque sí en Ficha Médica.
                source={resolveMascotaVisual(mascota ?? {})}
                label={mascota ? `Ilustración de ${mascota.nombre}` : 'Mascota'}
              />
            )}
          </Animated.View>

          {/* Flechas para alternar entre mascotas (solo si hay más de una) */}
          {!loading && mascotas.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.petArrow, styles.petArrowLeft]}
                onPress={() => cambiarMascota(-1)}
                accessibilityRole="button"
                accessibilityLabel="Mascota anterior"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={26} color="#2C2C2C" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.petArrow, styles.petArrowRight]}
                onPress={() => cambiarMascota(1)}
                accessibilityRole="button"
                accessibilityLabel="Mascota siguiente"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-forward" size={26} color="#2C2C2C" />
              </TouchableOpacity>
            </>
          )}
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

          {loading ? (
            // Mismo orden demo, pero como skeleton — así no se ve el orden
            // "de mentira" ya con etiquetas mientras carga la config real.
            <View style={{ gap: 12 }}>
              <SkeletonLoader width="100%" height={56} borderRadius={16} />
              <SkeletonLoader width="100%" height={56} borderRadius={16} />
              <SkeletonLoader width="100%" height={56} borderRadius={16} />
              <SkeletonLoader width="100%" height={56} borderRadius={16} />
            </View>
          ) : (
            <>
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
                      style={{ width: '100%', opacity: isDragging ? 0.85 : 1 }}
                      onDelete={() => handleDeleteButton(boton.seccion)}
                      onPress={() => {
                        if (editMode) return;
                        if (boton.seccion === 'ficha_medica' && mascota) {
                          navigation.navigate('FichaMedica', { mascotaId: mascota.id });
                        } else if (boton.seccion === 'closet' && mascota) {
                          // Closet exige petId (sin él muestra error y vuelve atrás)
                          navigation.navigate('Closet', { petId: mascota.id });
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
                label="SOS Veterinario"
                iconName="medical"
                variant="danger"
                onPress={() => navigation.navigate('SOS')}
                accessibilityLabel="Emergencia veterinaria"
              />
            </>
          )}
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

  if (Platform.OS === 'ios') {
    return (
      <Image
        source={source}
        style={[styles.petImage, styles.petImageWithShadow]}
        resizeMode="contain"
        accessibilityLabel={label}
      />
    );
  }

  // Android: `elevation` dibuja la sombra como un rectángulo detrás del PNG
  // transparente (no sigue el alfa), así que se omite para no mostrar un cuadrado.
  return (
    <Image
      source={source}
      style={styles.petImage}
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

  avisoError: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#F0D48A',
  },
  avisoErrorTxt: { color: '#7A5B00', fontSize: 13, textAlign: 'center' },

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
  // Flechas del selector de mascota (a la altura de la ilustración)
  petArrow: {
    position: 'absolute',
    bottom: PET_IMAGE_SIZE / 2 - 70,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  petArrowLeft:  { left: 14 },
  petArrowRight: { right: 14 },
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
