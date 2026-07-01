import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ImageBackground, useWindowDimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import HamburgerDrawer from '../components/HamburgerDrawer';
import SkeletonLoader from '../components/SkeletonLoader';
import MatchSwipeStack from '../components/match/MatchSwipeStack';
import MatchActionButtons from '../components/match/MatchActionButtons';
import MatchCelebrationOverlay from '../components/match/MatchCelebrationOverlay';
import MatchProfileDetailModal from '../components/match/MatchProfileDetailModal';
import {
  fetchMatchPerfiles, postMatchLike, postMatchSkip, getDemoPerfilesSnapshot,
} from '../services/matchApi';
import { DEMO_CURRENT_USER } from '../data/matchDemo';
import { DEMO_MASCOTA_ACTIVA } from '../constants/demoUsuario';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { getMatchCardLayout } from '../utils/matchLayout';
import { consumeMatchReloadFromFilters } from '../utils/matchNavigation';

const DEFAULT_LAT = -34.5889;
const DEFAULT_LNG = -58.4306;

export default function MatchScreen() {
  const navigation = useNavigation();
  const stackRef = useRef(null);
  const processingRef = useRef(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { cardHeight, cardWidth } = getMatchCardLayout(screenWidth, screenHeight);

  const [perfiles, setPerfiles] = useState(getDemoPerfilesSnapshot);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [usuario, setUsuario] = useState(DEMO_CURRENT_USER);
  const [matchOverlay, setMatchOverlay] = useState(null);
  const [detailPerfil, setDetailPerfil] = useState(null);

  const loadPerfiles = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const data = await fetchMatchPerfiles(DEFAULT_LAT, DEFAULT_LNG);
      setPerfiles(data.perfiles ?? getDemoPerfilesSnapshot());
      setIndex(0);
      setHistory([]);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPerfiles(false);
  }, [loadPerfiles]);

  useFocusEffect(
    useCallback(() => {
      if (consumeMatchReloadFromFilters()) {
        loadPerfiles(true);
      }
    }, [loadPerfiles])
  );

  /** Avanza al siguiente perfil al instante; like/skip al servidor en segundo plano. */
  const commitSwipe = useCallback((action) => {
    if (processingRef.current) return;

    const currentIndex = index;
    const perfil = perfiles[currentIndex];
    if (!perfil) return;

    processingRef.current = true;
    setHistory((h) => [...h, { index: currentIndex, perfil }]);
    setIndex((i) => i + 1);

    const usuarioId = perfil.usuario_id;
    setTimeout(() => { processingRef.current = false; }, 180);

    void (async () => {
      try {
        if (action === 'like') {
          const res = await postMatchLike(usuarioId);
          if (res?.match) {
            setMatchOverlay({
              ...res.usuario_match,
              chatId: res.chat_id,
            });
          }
        } else {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch { /* web */ }
          await postMatchSkip(usuarioId);
        }
      } catch {
        /* demo/offline */
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
            <Ionicons name="menu-outline" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={styles.headerCenter} />
          <TouchableOpacity
            style={styles.filtersBtn}
            onPress={() => navigation.navigate('MatchFilters')}
            accessibilityLabel="Abrir filtros"
          >
            <Ionicons name="funnel-outline" size={16} color="#2C2C2C" />
            <Text style={styles.filtersText}>Filtros</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.body}>
          {loading ? (
            <SkeletonLoader
              width={cardWidth}
              height={cardHeight}
              borderRadius={24}
              style={{ alignSelf: 'center' }}
            />
          ) : isEmpty ? (
            <View style={styles.empty}>
              <Ionicons name="paw" size={64} color="#27AE60" />
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
          {!loading && !isEmpty && (
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
          setMatchOverlay(null);
          Alert.alert('Chat', 'El chat estará disponible próximamente.');
        }}
        onKeepExploring={() => setMatchOverlay(null)}
      />

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={DEMO_MASCOTA_ACTIVA}
        activeRoute="Match"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#D4F5E2' },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: 'transparent', zIndex: 10,
  },
  headerCenter: { flex: 1 },
  filtersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5C842', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  filtersText: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20 },
  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', paddingVertical: 6,
  },
  actionsWrap: { flexShrink: 0 },
  empty: { alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  emptyTitle: { fontSize: 16, color: '#6B6B6B', textAlign: 'center', lineHeight: 24 },
  emptyBtn: {
    backgroundColor: '#2DBD72', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
