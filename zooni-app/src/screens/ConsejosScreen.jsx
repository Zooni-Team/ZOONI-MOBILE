/**
 * ConsejosScreen.jsx — Pantalla "Curiosidades y Consejos" de Zooni
 *
 * Pantalla de SOLO LECTURA. El usuario NO puede agregar, editar ni eliminar consejos.
 * El contenido es administrado por el equipo de Zooni.
 *
 * Navegación: FichaMedicaScreen → ConsejosScreen con { petId } como parámetro de ruta.
 *
 * Estructura visual:
 *   1. Header transparente con título dinámico y menú hamburguesa
 *   2. Hero con ilustración de la mascota + círculo decorativo + animación de entrada
 *   3. Card blanco (fondo redondeado arriba) que contiene:
 *      a. Chips de filtro por categoría (scroll horizontal)
 *      b. Lista de cards de consejos con diseño rico por categoría
 *      c. Estado vacío / estado de error / skeletons de carga
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { getCategoriaInfo } from '../constants/categoriasConsejos';
import { resolvePetImageSource } from '../constants/homeAssets';

// ─── API ──────────────────────────────────────────────────────────────────────
// Llamamos al backend directamente con axios + token del SecureStore.
// Mismo patrón de BASE_URL que en services/api.js del proyecto.
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5165/api/v1',
  ios: 'http://localhost:5165/api/v1',
  default: 'http://localhost:5165/api/v1',
});

async function fetchConsejosPorMascota(petId) {
  let token = null;
  try {
    if (Platform.OS === 'web') {
      token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    } else {
      token = await SecureStore.getItemAsync('jwt_token');
    }
  } catch (_) { /* sin token */ }

  const response = await axios.get(`${BASE_URL}/mascotas/${petId}/consejos`, {
    timeout: 10000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 180;

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

/** Skeleton con animación shimmer para la carga inicial */
function ConsejosSkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      {/* Simula el encabezado de categoría */}
      <View style={styles.skeletonHeader} />
      {/* Simula el cuerpo del texto */}
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '80%' }]} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
    </Animated.View>
  );
}

/** Card de consejo individual con diseño enriquecido por categoría */
function ConsejoCard({ consejo, index }) {
  const info = getCategoriaInfo(consejo.categoria);
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Animación de entrada con stagger
  useEffect(() => {
    const delay = index * 80;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, translateY, opacity]);

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  // Color del círculo del emoji: acento con ~15% de opacidad
  const emojiCircleBg = hexToRgba(info.acento, 0.15);

  return (
    <Animated.View
      style={[
        styles.consejoCardContainer,
        {
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessible
        accessibilityLabel={`Consejo de ${info.nombre}: ${consejo.contenido}`}
        accessibilityRole="text"
      >
        {/* Borde izquierdo de acento — identifica visualmente la categoría */}
        <View
          style={[styles.consejoCardAccentBorder, { backgroundColor: info.acento }]}
        />

        {/* Encabezado coloreado */}
        <View
          style={[styles.consejoCardHeader, { backgroundColor: info.fondo }]}
        >
          <View style={[styles.emojiCircle, { backgroundColor: emojiCircleBg }]}>
            <Text style={styles.emojiText}>{info.emoji}</Text>
          </View>
          <Text style={[styles.categoriaNombre, { color: info.acento }]}>
            {info.nombre}
          </Text>
        </View>

        {/* Separador */}
        <View style={styles.consejoSeparator} />

        {/* Cuerpo del consejo */}
        <View style={styles.consejoCardBody}>
          <Text style={styles.consejoTexto}>{consejo.contenido}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Chip de filtro de categoría */
function FiltroChip({ label, activo, onPress, acento, fondo, isAll }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Animación de escala del chip activo: 1.0 → 1.05 → 1.0
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 70,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  const chipBg = isAll
    ? activo ? '#2DBD72' : '#F0F0F0'
    : activo ? acento : fondo;

  const chipTextColor = isAll
    ? activo ? '#FFFFFF' : '#6B6B6B'
    : activo ? '#FFFFFF' : acento;

  const chipFontWeight = activo ? '700' : '400';

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: chipBg }]}
        onPress={handlePress}
        accessibilityLabel={`Filtrar por ${label}`}
        accessibilityState={{ selected: activo }}
      >
        <Text style={[styles.chipText, { color: chipTextColor, fontWeight: chipFontWeight }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Card de estado vacío (sin consejos disponibles) */
function EstadoVacioCard({ especie }) {
  const especieMayuscula = capitalizar(especie ?? 'mascota');
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>Próximamente</Text>
      <Text style={styles.emptySubtitle}>
        {`Estamos preparando consejos especiales para tu ${especieMayuscula}. ¡Volvé pronto!`}
      </Text>
    </View>
  );
}

/** Botón de reintentar cuando falla la carga */
function BotonReintentar({ onPress }) {
  return (
    <TouchableOpacity style={styles.retryButton} onPress={onPress} accessibilityRole="button">
      <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
      <Text style={styles.retryButtonText}>Reintentar</Text>
    </TouchableOpacity>
  );
}

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function ConsejosScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { petId } = route.params ?? {};

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [mascota, setMascota] = useState(null);
  const [consejos, setConsejos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ── Animaciones del hero ─────────────────────────────────────────────────────
  const heroScale = useRef(new Animated.Value(0.88)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  // ── Categorías únicas presentes en los datos ──────────────────────────────
  const categoriasPresentes = useMemo(() => {
    if (!consejos.length) return [];
    return [...new Set(consejos.map((c) => c.categoria))];
  }, [consejos]);

  // ── Consejos filtrados según el chip activo ───────────────────────────────
  const consejosFiltrados = useMemo(() => {
    if (categoriaActiva === 'todos') return consejos;
    return consejos.filter((c) => c.categoria === categoriaActiva);
  }, [consejos, categoriaActiva]);

  // ── Carga de datos ───────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchConsejosPorMascota(petId);
      setMascota(data.mascota);
      setConsejos(data.consejos ?? []);

      // Animación de entrada del hero
      Animated.parallel([
        Animated.timing(heroScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      setError(true);
      const status = err?.response?.status;
      if (status === 403) {
        Alert.alert(
          'Sin permiso',
          'No tenés permiso para ver esta mascota.',
          [{ text: 'Volver', onPress: () => navigation.goBack() }]
        );
      } else if (status !== 404) {
        Alert.alert(
          'Error de conexión',
          'No se pudieron cargar los consejos. Verificá tu conexión.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [petId, navigation, heroScale, heroOpacity]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Seleccionar categoría ────────────────────────────────────────────────
  const seleccionarCategoria = useCallback((key) => {
    if (key === categoriaActiva) return;
    setCategoriaActiva(key);
  }, [categoriaActiva]);

  // ── Título dinámico del header ────────────────────────────────────────────
  const tituloHeader = useMemo(() => {
    if (!mascota) return 'Curiosidades 🐾';
    return getTituloHeader(mascota);
  }, [mascota]);

  // ── Fuente de imagen de la mascota ────────────────────────────────────────
  const petImageSource = useMemo(() => {
    if (!mascota) return null;
    // Usamos resolvePetImageSource del patrón de homeAssets:
    // si hay fotoUrl usa esa, sino el placeholder
    return resolvePetImageSource({ fotoUrl: mascota.fotoUrl ?? null });
  }, [mascota]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          accessibilityLabel="Volver"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={26} color="#2C2C2C" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={2}>
          {tituloHeader}
        </Text>

        {/* Espacio derecho vacío para centrar el título */}
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO CON MASCOTA ── */}
        <View style={styles.heroContainer}>
          {/* Círculo decorativo detrás */}
          <View style={styles.heroDecorCircle} />

          {/* Ilustración de la mascota con animación de entrada */}
          <Animated.View
            style={[
              styles.heroPetWrapper,
              {
                transform: [{ scale: heroScale }],
                opacity: heroOpacity,
              },
            ]}
          >
            {petImageSource ? (
              <Image
                source={petImageSource}
                style={styles.heroPetImage}
                resizeMode="contain"
                accessibilityLabel={mascota ? `Ilustración de ${mascota.nombre}` : 'Mascota'}
              />
            ) : (
              // Placeholder mientras carga o si no hay mascota
              <View style={styles.heroPetPlaceholder}>
                <Text style={{ fontSize: 48 }}>🐾</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* ── CARD BLANCO INFERIOR ── */}
        <View style={styles.whiteCard}>

          {/* ── CHIPS DE FILTRO ── */}
          {!loading && !error && consejos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsContent}
            >
              {/* Chip "Todos" */}
              <FiltroChip
                label="Todos"
                activo={categoriaActiva === 'todos'}
                onPress={() => seleccionarCategoria('todos')}
                isAll
              />

              {/* Chips dinámicos por categoría presente */}
              {categoriasPresentes.map((key) => {
                const info = getCategoriaInfo(key);
                return (
                  <FiltroChip
                    key={key}
                    label={info.nombre}
                    activo={categoriaActiva === key}
                    onPress={() => seleccionarCategoria(key)}
                    acento={info.acento}
                    fondo={info.fondo}
                  />
                );
              })}
            </ScrollView>
          )}

          {/* ── ESTADOS ── */}

          {/* Carga: 3 skeleton cards */}
          {loading && (
            <View style={styles.listContainer}>
              <ConsejosSkeletonCard />
              <ConsejosSkeletonCard />
              <ConsejosSkeletonCard />
            </View>
          )}

          {/* Error de red con botón de reintentar */}
          {!loading && error && (
            <View style={styles.listContainer}>
              <ConsejosSkeletonCard />
              <ConsejosSkeletonCard />
              <ConsejosSkeletonCard />
              <BotonReintentar onPress={cargarDatos} />
            </View>
          )}

          {/* Sin consejos en DB */}
          {!loading && !error && consejos.length === 0 && (
            <View style={styles.listContainer}>
              <EstadoVacioCard especie={mascota?.especie} />
            </View>
          )}

          {/* Lista de consejos */}
          {!loading && !error && consejos.length > 0 && (
            <View style={styles.listContainer}>
              {consejosFiltrados.length === 0 ? (
                // Edge case: filtro activo sin resultados
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>
                    No hay consejos en esta categoría.
                  </Text>
                </View>
              ) : (
                consejosFiltrados.map((consejo, index) => (
                  <ConsejoCard key={consejo.id} consejo={consejo} index={index} />
                ))
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Capitaliza la primera letra de un string */
function capitalizar(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Genera el título del header según la raza/especie de la mascota */
function getTituloHeader(mascota) {
  if (mascota.raza && mascota.raza.toLowerCase() !== 'mestizo') {
    return `Curiosidades de ${mascota.raza} 🐾`;
  }
  return `Curiosidades de ${capitalizar(mascota.especie)} 🐾`;
}

/** Convierte un color hex a rgba con opacidad dada */
function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#C8F0D8',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    maxWidth: 220,
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    backgroundColor: '#C8F0D8',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#C8F0D8',
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  heroContainer: {
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 0,
    backgroundColor: '#C8F0D8',
    position: 'relative',
  },
  heroDecorCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#A8E6C0',
    opacity: 0.45,
  },
  heroPetWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPetImage: {
    width: 110,
    height: 110,
  },
  heroPetPlaceholder: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Card blanco inferior ──────────────────────────────────────────────────
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 400,
  },

  // ── Chips de filtro ──────────────────────────────────────────────────────
  chipsScroll: {
    marginBottom: 4,
  },
  chipsContent: {
    paddingBottom: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 13,
  },

  // ── Lista de cards ────────────────────────────────────────────────────────
  listContainer: {
    paddingTop: 4,
  },

  // ── Card de consejo ───────────────────────────────────────────────────────
  consejoCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 4,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  consejoCardAccentBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: '100%',
    zIndex: 1,
  },
  consejoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 20,
  },
  categoriaNombre: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  consejoSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  consejoCardBody: {
    paddingLeft: 24,
    paddingRight: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  consejoTexto: {
    fontSize: 14,
    color: '#2C2C2C',
    lineHeight: 22,
    textAlign: 'left',
  },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    marginHorizontal: 4,
    marginBottom: 14,
    overflow: 'hidden',
  },
  skeletonHeader: {
    height: 56,
    backgroundColor: '#E8E8E8',
  },
  skeletonBody: {
    padding: 14,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    width: '100%',
  },

  // ── Estado vacío ──────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 4,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2DBD72',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Sin resultados en filtro ──────────────────────────────────────────────
  noResultsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },

  // ── Botón reintentar ──────────────────────────────────────────────────────
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2DBD72',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    marginHorizontal: 4,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
