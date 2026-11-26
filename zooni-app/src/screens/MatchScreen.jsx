import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  Image, ImageBackground, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { elegirImagen } from '../utils/elegirImagen';

import HamburgerDrawer from '../components/HamburgerDrawer';
import SelectorMascota from '../components/SelectorMascota';
import { SkeletonBloque } from '../components/ui/Skeleton';
import MatchSwipeStack from '../components/match/MatchSwipeStack';
import MatchActionButtons from '../components/match/MatchActionButtons';
import MatchCelebrationOverlay from '../components/match/MatchCelebrationOverlay';
import MatchProfileDetailModal from '../components/match/MatchProfileDetailModal';
import MatchProfileSetup from '../components/match/MatchProfileSetup';
import MiTarjetaMatchModal from '../components/match/MiTarjetaMatchModal';
import PetMatchOnboarding from '../components/match/PetMatchOnboarding';
import EditarPerfilModal from '../components/perfil/EditarPerfilModal';
import {
  fetchMatchPerfiles, postMatchLike, postMatchSkip,
  fetchMiPerfilMatch, perfilMatchCompleto, actualizarMiUbicacionMatch,
  fetchMisMascotasMatch,
} from '../services/matchApi';
import { setFotoPrincipalMascota } from '../services/petsApi';
import { activarMascota } from '../services/api';
import { resolveMascotaVisual } from '../constants/petImages';
import { alerta } from '../utils/dialogo';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { getMatchCardLayout } from '../utils/matchLayout';
import { consumeMatchReloadFromFilters } from '../utils/matchNavigation';
import { colores } from '../theme';

export default function MatchScreen() {
  const navigation = useNavigation();
  const stackRef = useRef(null);
  const processingRef = useRef(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { cardHeight, cardWidth } = getMatchCardLayout(screenWidth, screenHeight);

  const { usuario, mascotaActiva } = useUsuarioActivo();
  const [perfiles, setPerfiles] = useState([]);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matchOverlay, setMatchOverlay] = useState(null);
  const [detailPerfil, setDetailPerfil] = useState(null);
  const [perfilListo, setPerfilListo] = useState(null);
  const [perfilMatch, setPerfilMatch] = useState(null);
  const [miTarjetaVisible, setMiTarjetaVisible] = useState(false);
  const [editarPerfilVisible, setEditarPerfilVisible] = useState(false);

  const [misMascotas, setMisMascotas] = useState([]);
  const [setupMascota, setSetupMascota] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const activaIdRef = useRef(null);

  const loadPerfiles = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    try {
      const data = await fetchMatchPerfiles();
      setPerfiles(data.perfiles ?? []);
      setIndex(0);
      setHistory([]);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const perfil = await fetchMiPerfilMatch();
        if (!cancelado) { setPerfilMatch(perfil); setPerfilListo(perfilMatchCompleto(perfil)); }
      } catch {
        if (!cancelado) setPerfilListo(true);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (perfilListo) loadPerfiles(true);
  }, [perfilListo, loadPerfiles]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { actualizarMiUbicacionMatch(pos.coords.latitude, pos.coords.longitude).catch(() => {}); },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const loadMisMascotas = useCallback(async () => {
    try {
      const lista = await fetchMisMascotasMatch();
      setMisMascotas(lista);
      const activa = lista.find((m) => m.esActiva) ?? lista[0] ?? null;
      if (activa && activaIdRef.current && activaIdRef.current !== activa.id) {
        loadPerfiles(true);
      }
      activaIdRef.current = activa?.id ?? null;
    } catch {  }
  }, [loadPerfiles]);

  useEffect(() => {
    if (perfilListo) loadMisMascotas();
  }, [perfilListo, loadMisMascotas]);

  useFocusEffect(
    useCallback(() => {
      loadMisMascotas();
      if (consumeMatchReloadFromFilters()) {
        loadPerfiles(true);
      }
    }, [loadPerfiles, loadMisMascotas])
  );

  const commitSwipe = useCallback((action) => {
    if (processingRef.current) return;

    const currentIndex = index;
    const perfil = perfiles[currentIndex];
    if (!perfil) return;

    processingRef.current = true;
    setHistory((h) => [...h, { index: currentIndex, perfil }]);
    setIndex((i) => i + 1);

    const mascotaId = perfil.mascota.id;
    setTimeout(() => { processingRef.current = false; }, 180);

    void (async () => {
      try {
        if (action === 'like') {
          const res = await postMatchLike(mascotaId);
          if (res?.match) {
            setMatchOverlay({
              ...res.usuario_match,
              chatId: res.chat_id,
            });
          }
        } else {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {  }
          await postMatchSkip(mascotaId);
        }
      } catch {
      }
    })();
  }, [perfiles, index]);

  const handleSwipeLeft = useCallback(() => commitSwipe('skip'), [commitSwipe]);
  const handleSwipeRight = useCallback(() => commitSwipe('like'), [commitSwipe]);

  const triggerAction = useCallback((action) => {
    if (processingRef.current || stackRef.current?.isLocked?.()) return;
    if (!perfiles[index]) return;
    const direction = action === 'like' ? 'right' : 'left';
    if (stackRef.current) {
      stackRef.current.flyOut(direction, () => commitSwipe(action));
    } else {
      commitSwipe(action);
    }
  }, [perfiles, index, commitSwipe]);

  const handleUndo = () => {
    if (!history.length || processingRef.current) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setIndex(last.index);
    setPerfiles((list) => {
      const exists = list.some((p) => p.usuario_id === last.perfil.usuario_id);
      if (exists) return list;
      const copy = [...list];
      copy.splice(last.index, 0, last.perfil);
      return copy;
    });
  };

  const current = perfiles[index];
  const isEmpty = !loading && !current;

  const mascotaActivaMatch = misMascotas.find((m) => m.esActiva) ?? null;
  const activaSinPerfil = mascotaActivaMatch && !mascotaActivaMatch.perfilCreado;
  const activaSinFoto = mascotaActivaMatch && !activaSinPerfil && !mascotaActivaMatch.fotoUrl;

  const [cambiandoMascota, setCambiandoMascota] = useState(false);

  const elegirMascota = async (id) => {
    if (id === mascotaActivaMatch?.id || cambiandoMascota) return;
    setCambiandoMascota(true);
    setMisMascotas((prev) => prev.map((m) => ({ ...m, esActiva: m.id === id })));
    try {
      await activarMascota(id);
      activaIdRef.current = id;
      await loadPerfiles(true);
      await loadMisMascotas();
    } catch {
      alerta('No se pudo cambiar', 'Intentá de nuevo en un momento.');
      await loadMisMascotas();
    } finally {
      setCambiandoMascota(false);
    }
  };

  const marcarPerfilCreado = (id) => {
    setMisMascotas((prev) => prev.map((m) => (m.id === id ? { ...m, perfilCreado: true } : m)));
    setSetupMascota(null);
  };

  const subirFotoMascota = async () => {
    try {
      const uri = await elegirImagen();
      if (!uri) return;
      setSubiendoFoto(true);
      const url = await setFotoPrincipalMascota(mascotaActivaMatch.id, uri);
      setMisMascotas((prev) => prev.map((m) => (m.id === mascotaActivaMatch.id ? { ...m, fotoUrl: url } : m)));
    } catch {
      alerta('No pudimos subir la foto', 'Probá de nuevo.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  if (perfilListo === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.checking}>
          <ActivityIndicator size="large" color={colores.verde} />
        </View>
      </SafeAreaView>
    );
  }

  if (perfilListo === false) {
    return (
      <MatchProfileSetup
        perfilActual={perfilMatch}
        onCancelar={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Home');
        }}
        onListo={async () => {
          setPerfilListo(true);
          try { setPerfilMatch(await fetchMiPerfilMatch()); } catch {  }
        }}
      />
    );
  }

  if (setupMascota) {
    return (
      <PetMatchOnboarding
        mascota={setupMascota}
        onCancelar={() => setSetupMascota(null)}
        onListo={(id) => {
          marcarPerfilCreado(id);
          loadMisMascotas();
          loadPerfiles(true);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
        resizeMode="cover"
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={30} color={colores.negroSuave} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.miPerfilBtn}
            onPress={() => setMiTarjetaVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Ver mi perfil como lo ven los demás"
          >
            {perfilMatch?.fotoPerfilUrl
              ? <Image source={{ uri: perfilMatch.fotoPerfilUrl }} style={styles.miPerfilFoto} />
              : (
                <View style={[styles.miPerfilFoto, styles.miPerfilFotoVacia]}>
                  <Ionicons name="person" size={16} color={colores.textoSecundario} />
                </View>
              )}
            <Text style={styles.miPerfilTxt}>Mi perfil</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter} />
          <TouchableOpacity
            style={styles.filtersBtn}
            onPress={() => navigation.navigate('MatchFilters')}
            accessibilityLabel="Abrir filtros"
          >
            <Ionicons name="funnel-outline" size={16} color={colores.texto} />
            <Text style={styles.filtersText}>Filtros</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerDivider} />

        <SelectorMascota
          mascotas={misMascotas}
          valor={mascotaActivaMatch?.id}
          onCambiar={elegirMascota}
          deshabilitado={cambiandoMascota}
          style={{ marginTop: 10 }}
        />

        <View style={styles.body}>
          {activaSinPerfil ? (
            <View style={styles.empty}>
              <View style={styles.setupAvatarWrap}>
                <ImageBackground
                  source={resolveMascotaVisual(mascotaActivaMatch)}
                  style={styles.setupAvatar}
                  imageStyle={{ borderRadius: 60 }}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {mascotaActivaMatch.nombre} todavía no tiene perfil de Match.{'\n'}
                Crealo para empezar a conocer otras mascotas.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setSetupMascota(mascotaActivaMatch)}
                accessibilityRole="button"
                accessibilityLabel={`Crear perfil de Match de ${mascotaActivaMatch.nombre}`}
              >
                <Text style={styles.emptyBtnText}>Crear perfil de {mascotaActivaMatch.nombre}</Text>
              </TouchableOpacity>
            </View>
          ) : activaSinFoto ? (
            <View style={styles.empty}>
              <View style={styles.setupAvatarWrap}>
                <ImageBackground
                  source={resolveMascotaVisual(mascotaActivaMatch)}
                  style={styles.setupAvatar}
                  imageStyle={{ borderRadius: 60, opacity: 0.5 }}
                />
                <View style={styles.camaraBadge}>
                  <Ionicons name="camera" size={22} color={colores.blanco} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>
                Para aparecer en Match, {mascotaActivaMatch.nombre} necesita{'\n'}una foto real (no el dibujo).
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={subirFotoMascota}
                disabled={subiendoFoto}
                accessibilityRole="button"
                accessibilityLabel={`Subir foto real de ${mascotaActivaMatch.nombre}`}
              >
                {subiendoFoto
                  ? <ActivityIndicator size="small" color={colores.blanco} />
                  : <Text style={styles.emptyBtnText}>Subir foto de {mascotaActivaMatch.nombre}</Text>}
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <SkeletonBloque
              width={cardWidth}
              height={cardHeight}
              borderRadius={24}
              style={{ alignSelf: 'center' }}
            />
          ) : isEmpty ? (
            <View style={styles.empty}>
              <Ionicons name="paw" size={64} color={colores.verdeExito} />
              <Text style={styles.emptyTitle}>
                No hay más perfiles por ahora. Volvé más tarde 🐾
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('MatchFilters')}
              >
                <Text style={styles.emptyBtnText}>Ajustar filtros</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MatchSwipeStack
              ref={stackRef}
              perfiles={perfiles}
              currentIndex={index}
              cardHeight={cardHeight}
              cardWidth={cardWidth}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onCardPress={setDetailPerfil}
            />
          )}
        </View>

        <View style={styles.actionsWrap}>
          {!loading && !isEmpty && !activaSinPerfil && !activaSinFoto && (
            <MatchActionButtons
              canUndo={history.length > 0 && !processingRef.current}
              onUndo={handleUndo}
              onSkip={() => triggerAction('skip')}
              onLike={() => triggerAction('like')}
            />
          )}
        </View>
      </ImageBackground>

      <MatchProfileDetailModal
        visible={!!detailPerfil}
        perfil={detailPerfil}
        onClose={() => setDetailPerfil(null)}
      />

      <MatchCelebrationOverlay
        visible={!!matchOverlay}
        matchUser={matchOverlay}
        currentUserPhoto={usuario?.fotoPerfil ?? usuario?.foto_perfil_url}
        onSendMessage={() => {
          const chat = matchOverlay;
          setMatchOverlay(null);
          navigation.navigate('Chat', {
            chatId: chat.chatId,
            nombre: chat.nombre,
            fotoPerfilUrl: chat.foto_perfil_url,
          });
        }}
        onKeepExploring={() => setMatchOverlay(null)}
      />

      <MiTarjetaMatchModal
        visible={miTarjetaVisible}
        onClose={() => setMiTarjetaVisible(false)}
        onEditarPerfil={() => { setMiTarjetaVisible(false); setEditarPerfilVisible(true); }}
      />

      <EditarPerfilModal
        visible={editarPerfilVisible}
        onCerrar={(motivo) => {
          setEditarPerfilVisible(false);
          if (motivo !== 'navegacion') setMiTarjetaVisible(true);
        }}
        onGuardado={(_, motivo) => {
          setEditarPerfilVisible(false);
          if (motivo !== 'navegacion') setMiTarjetaVisible(true);
        }}
        onError={(msg) => alerta('No se pudo guardar', msg)}
      />

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascotaActiva}
        activeRoute="Match"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.mentaClara },
  checking: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: 'transparent', zIndex: 10,
  },
  headerCenter: { flex: 1 },
  filtersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colores.amarillo, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  filtersText: { fontSize: 14, fontWeight: '700', color: colores.texto },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20 },

  miPerfilBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12,
    paddingRight: 10, paddingVertical: 4, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  miPerfilFoto: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colores.gris100,
    borderWidth: 1.5, borderColor: colores.verde,
  },
  miPerfilFotoVacia: { alignItems: 'center', justifyContent: 'center' },
  miPerfilTxt: { fontSize: 12, fontWeight: '700', color: colores.texto },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', paddingVertical: 6,
  },
  actionsWrap: { flexShrink: 0 },
  empty: { alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  petBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colores.mentaBorde, borderRadius: 14,
    marginHorizontal: 20, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  petBannerTxt: { flex: 1, fontSize: 13, color: colores.verdeOscuro, fontWeight: '600' },
  petBannerBtn: {
    fontSize: 13, fontWeight: '700', color: colores.verdeOscuro,
    textDecorationLine: 'underline', padding: 4,
  },
  setupAvatarWrap: { alignItems: 'center', justifyContent: 'center' },
  setupAvatar: {
    width: 120, height: 120, borderRadius: 60, overflow: 'hidden',
    borderWidth: 3, borderColor: colores.verde, backgroundColor: '#E4F9EA',
  },
  camaraBadge: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colores.blanco,
  },
  emptyTitle: { fontSize: 16, color: colores.textoSecundario, textAlign: 'center', lineHeight: 24 },
  emptyBtn: {
    backgroundColor: colores.verde, borderRadius: 30, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  emptyBtnText: { color: colores.blanco, fontWeight: '700', fontSize: 15 },
});
