/**
 * ConsejosScreen.jsx — Pantalla "Curiosidades y Consejos" de Zooni
 *
 * Pantalla de SOLO LECTURA. Navega desde FichaMedicaScreen con { petId }.
 * Si el backend no responde o no hay petId, muestra consejos demo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { generarConsejos } from '../constants/consejosData';
import { fetchMascota } from '../services/fichaMedicaApi';
import PetHero from '../components/PetHero';
import SelectorMascota from '../components/SelectorMascota';

// Mascota de respaldo si no hay petId o falla la carga: los consejos generales
// de perro son un punto de partida razonable.
const DEMO_MASCOTA = { nombre: 'Tu mascota', especie: 'perro', raza: null, fotoUrl: null };

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <Animated.View style={[st.skeletonCard, { opacity }]}>
      <View style={st.skeletonHeader} />
      <View style={st.skeletonBody}>
        <View style={st.skeletonLine} />
        <View style={[st.skeletonLine, { width: '80%' }]} />
        <View style={[st.skeletonLine, { width: '55%' }]} />
      </View>
    </Animated.View>
  );
}

// ─── CARD DE CONSEJO ──────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function ConsejoCard({ consejo, index }) {
  const info       = getCategoriaInfo(consejo.categoria);
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const pressIn  = () => Animated.timing(scale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }).start();

  return (
    <Animated.View style={[st.card, { transform: [{ translateY }, { scale }], opacity }]}>
      <TouchableOpacity activeOpacity={1} onPressIn={pressIn} onPressOut={pressOut}
        accessible accessibilityLabel={`${info.nombre}: ${consejo.contenido}`} accessibilityRole="text">
        {/* Borde izquierdo */}
        <View style={[st.cardBorder, { backgroundColor: info.acento }]} />
        {/* Encabezado */}
        <View style={[st.cardHead, { backgroundColor: info.fondo }]}>
          <View style={[st.iconoCircle, { backgroundColor: hexToRgba(info.acento, 0.15) }]}>
            <Ionicons name={info.icono} size={18} color={info.acento} />
          </View>
          <Text style={[st.cardCateg, { color: info.acento }]}>{info.nombre}</Text>
        </View>
        <View style={st.cardSep} />
        <View style={st.cardBody}>
          <Text style={st.cardTxt}>{consejo.contenido}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── CHIP DE FILTRO ───────────────────────────────────────────────────────────

function Chip({ label, activo, onPress, acento, fondo, isAll }) {
  const sc = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue: 1.05, duration: 80, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const bg  = isAll ? (activo ? '#2DBD72' : '#F0F0F0') : (activo ? acento  : fondo);
  const clr = isAll ? (activo ? '#FFF'    : '#6B6B6B') : (activo ? '#FFF'  : acento);

  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <TouchableOpacity style={[st.chip, { backgroundColor: bg }]} onPress={press}>
        <Text style={[st.chipTxt, { color: clr, fontWeight: activo ? '700' : '400' }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function ConsejosScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  // Estado y no constante: el selector de arriba cambia de mascota sin salir
  // de la pantalla (el efecto de carga depende de petId y recarga solo).
  const [petId, setPetId] = useState(route.params?.petId || null);

  const [mascota,         setMascota]         = useState(null);
  const [consejos,        setConsejos]        = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  const [loading,         setLoading]         = useState(true);

  const heroScale   = useRef(new Animated.Value(0.88)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const animarEntrada = useCallback(() => {
    Animated.parallel([
      Animated.timing(heroScale,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [heroScale, heroOpacity]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Traemos la mascota real (especie + raza) para armar consejos a medida.
      // Si no hay petId o falla, caemos a la mascota de respaldo.
      let m = null;
      if (petId && petId !== 0) {
        m = await fetchMascota(petId).catch(() => null);
      }
      const mascotaFinal = m ?? DEMO_MASCOTA;
      setMascota(mascotaFinal);
      setConsejos(generarConsejos({ especie: mascotaFinal.especie, raza: mascotaFinal.raza }));
      animarEntrada();
    } finally {
      setLoading(false);
    }
  }, [petId, animarEntrada]);

  useEffect(() => { cargar(); }, [cargar]);

  const categoriasPresentes = useMemo(
    () => [...new Set(consejos.map((c) => c.categoria))],
    [consejos]
  );

  const consejosFiltrados = useMemo(
    () => categoriaActiva === 'todos' ? consejos : consejos.filter((c) => c.categoria === categoriaActiva),
    [consejos, categoriaActiva]
  );


  return (
    <SafeAreaView style={st.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={st.screenBackground}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
        </View>

        <SelectorMascota valor={petId} onCambiar={setPetId} style={{ marginBottom: 6 }} />

        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Hero — el mismo de Vacunas, Tratamientos y Consultas */}
          <PetHero mascota={mascota} titulo="Curiosidades"
            anim={{ scale: heroScale, opacity: heroOpacity }} />

          {/* Card blanco */}
          <View style={st.whiteCard}>

            {/* Chips */}
            {!loading && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.chipsRow}>
                <Chip label="Todos" activo={categoriaActiva === 'todos'}
                  onPress={() => setCategoriaActiva('todos')} isAll />
                {categoriasPresentes.map((key) => {
                  const info = getCategoriaInfo(key);
                  return (
                    <Chip key={key} label={info.nombre}
                      activo={categoriaActiva === key}
                      onPress={() => setCategoriaActiva(categoriaActiva === key ? 'todos' : key)}
                      acento={info.acento} fondo={info.fondo} />
                  );
                })}
              </ScrollView>
            )}

            {/* Loading */}
            {loading && (
              <View style={st.list}>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </View>
            )}

            {/* Consejos */}
            {!loading && (
              <View style={st.list}>
                {consejosFiltrados.map((c, i) => (
                  <ConsejoCard key={c.id} consejo={c} index={i} />
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#C8F0D8' },
  screenBackground:     { flex: 1, width: '100%', backgroundColor: '#C8F0D8' },
  scroll:               { flex: 1, backgroundColor: 'transparent' },
  scrollContent:        { flexGrow: 1, backgroundColor: 'transparent' },

  header:      { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn:   { width: 40, alignItems: 'center', justifyContent: 'center' },

  // Hero → components/PetHero.jsx (compartido con Vacunas, Tratamientos y Consultas)

  // Mismo bottom sheet que Vacunas, Tratamientos y Consultas
  whiteCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40, minHeight: 400 },

  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 12 },
  demoBannerTxt: { fontSize: 12, color: '#F5A623', textAlign: 'center' },

  chipsRow: { paddingBottom: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:     { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipTxt:  { fontSize: 13 },

  list: { paddingTop: 4 },

  card: {
    backgroundColor: '#FFF', borderRadius: 18, marginHorizontal: 4, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    overflow: 'hidden',
  },
  cardBorder:  { position: 'absolute', left: 0, top: 0, width: 4, height: '100%', zIndex: 1 },
  cardHead:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 16, paddingVertical: 12, gap: 10 },
  iconoCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardCateg:   { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  cardSep:     { height: 1, backgroundColor: '#F0F0F0' },
  cardBody:    { paddingLeft: 24, paddingRight: 20, paddingTop: 14, paddingBottom: 16 },
  cardTxt:     { fontSize: 14, color: '#2C2C2C', lineHeight: 22 },

  skeletonCard:   { backgroundColor: '#F0F0F0', borderRadius: 18, marginHorizontal: 4, marginBottom: 14, overflow: 'hidden' },
  skeletonHeader: { height: 56, backgroundColor: '#E8E8E8' },
  skeletonBody:   { padding: 14, gap: 8 },
  skeletonLine:   { height: 12, backgroundColor: '#E0E0E0', borderRadius: 6, width: '100%' },
});
