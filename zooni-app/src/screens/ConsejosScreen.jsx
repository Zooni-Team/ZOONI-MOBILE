/**
 * ConsejosScreen.jsx — Pantalla "Curiosidades y Consejos" de Zooni
 *
 * Pantalla de SOLO LECTURA. Navega desde FichaMedicaScreen con { petId }.
 * Si el backend no responde o no hay petId, muestra consejos demo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
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
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { getCategoriaInfo } from '../constants/categoriasConsejos';
import { resolvePetImageSource, HOME_BACKGROUND } from '../constants/homeAssets';

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5165/api/v1',
  ios:     'http://localhost:5165/api/v1',
  default: 'http://localhost:5165/api/v1',
});

async function fetchConsejos(petId) {
  let token = null;
  try {
    token = Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null)
      : await SecureStore.getItemAsync('jwt_token');
  } catch (_) {}

  const res = await axios.get(`${BASE_URL}/mascotas/${petId}/consejos`, {
    timeout: 6000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
}

// ─── CONSEJOS DEMO ────────────────────────────────────────────────────────────
// Se muestran cuando el backend no está disponible o no hay petId.

const DEMO_MASCOTA = { nombre: 'Tu mascota', especie: 'perro', raza: null, fotoUrl: null };

const DEMO_CONSEJOS = [
  {
    id: 1, categoria: 'alimentacion',
    contenido: 'Establecé un horario fijo de comida. Las mascotas digieren mejor y se estresan menos cuando comen a la misma hora todos los días. Evitá darles sobras de mesa.',
  },
  {
    id: 2, categoria: 'salud',
    contenido: 'Llevá a tu mascota al veterinario al menos una vez al año aunque esté sana. Las vacunas y desparasitaciones al día son la mejor prevención contra enfermedades graves.',
  },
  {
    id: 3, categoria: 'ejercicio',
    contenido: 'El ejercicio diario no solo mantiene el peso saludable — también reduce la ansiedad y el aburrimiento. Un animal bien ejercitado es más tranquilo en casa.',
  },
  {
    id: 4, categoria: 'comportamiento',
    contenido: 'El refuerzo positivo es la herramienta más efectiva para enseñar. Premiá inmediatamente el comportamiento que querés repetir y simplemente ignorá el que no querés.',
  },
  {
    id: 5, categoria: 'cuidado',
    contenido: 'Revisá las orejas de tu mascota una vez por semana. Las infecciones de oído son comunes y muy molestas; detectarlas temprano evita tratamientos largos y costosos.',
  },
  {
    id: 6, categoria: 'general',
    contenido: 'Las mascotas perciben nuestras emociones con mucha precisión. Cuando estás tranquilo y seguro, tu compañero también lo estará. Tu estado de ánimo los afecta directamente.',
  },
  {
    id: 7, categoria: 'alimentacion',
    contenido: 'El agua fresca disponible las 24 horas es tan importante como la comida. La deshidratación puede causar problemas renales graves, especialmente en días de calor.',
  },
  {
    id: 8, categoria: 'salud',
    contenido: 'Revisá regularmente los dientes de tu mascota. La acumulación de sarro puede derivar en enfermedades cardíacas y renales. El cepillado 2 veces por semana marca la diferencia.',
  },
  {
    id: 9, categoria: 'cuidado',
    contenido: 'El pelaje necesita cepillado regular para evitar enredos, reducir la muda en casa y detectar parásitos a tiempo. La frecuencia depende de la raza y el largo del pelo.',
  },
  {
    id: 10, categoria: 'comportamiento',
    contenido: 'La socialización temprana es clave. Exponer a tu mascota a diferentes personas, animales y ambientes desde pequeña la hace más segura, adaptable y menos reactiva.',
  },
  {
    id: 11, categoria: 'ejercicio',
    contenido: 'Los juguetes de enriquecimiento mental como los Kong o los puzzles de comida cansan tanto como el ejercicio físico. Son ideales para días de lluvia o mascotas que viven en departamento.',
  },
  {
    id: 12, categoria: 'general',
    contenido: 'Nunca le des medicación humana a tu mascota sin consultar al veterinario. Muchos fármacos comunes para humanos — como ibuprofeno o paracetamol — son tóxicos para ellos.',
  },
];

// ─── COMPONENTE IMAGEN MASCOTA (mismo patrón que HomeScreen) ─────────────────

function PetIllustration({ source, label }) {
  if (Platform.OS === 'web') {
    return (
      <Image source={source} resizeMode="contain" accessibilityLabel={label}
        style={[st.petImage, { filter: 'drop-shadow(4px 10px 14px rgba(36,90,66,0.35))' }]} />
    );
  }
  return (
    <Image source={source} resizeMode="contain" accessibilityLabel={label}
      style={[st.petImage, {
        shadowColor: '#245a42', shadowOffset: { width: 4, height: 10 },
        shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
      }]} />
  );
}

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
          <View style={[st.emojiCircle, { backgroundColor: hexToRgba(info.acento, 0.15) }]}>
            <Text style={st.emojiTxt}>{info.emoji}</Text>
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
  const petId      = route.params?.petId;

  const [mascota,         setMascota]         = useState(null);
  const [consejos,        setConsejos]        = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  const [loading,         setLoading]         = useState(true);
  const [esDemo,          setEsDemo]          = useState(false);

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
    // Sin petId válido → mostrar demo directamente
    if (!petId || petId === 0) {
      setMascota(DEMO_MASCOTA);
      setConsejos(DEMO_CONSEJOS);
      setEsDemo(true);
      setLoading(false);
      animarEntrada();
      return;
    }

    try {
      const data = await fetchConsejos(petId);
      setMascota(data.mascota ?? DEMO_MASCOTA);
      const cons = data.consejos ?? [];
      // Si el backend no tiene consejos aún, mostrar los demo
      if (cons.length === 0) {
        setConsejos(DEMO_CONSEJOS);
        setEsDemo(true);
      } else {
        setConsejos(cons);
        setEsDemo(false);
      }
      animarEntrada();
    } catch {
      // Error de conexión → mostrar demo sin alert molesto
      setMascota(DEMO_MASCOTA);
      setConsejos(DEMO_CONSEJOS);
      setEsDemo(true);
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

  const tituloHeader = useMemo(() => {
    if (!mascota) return 'Curiosidades 🐾';
    if (mascota.raza && mascota.raza.toLowerCase() !== 'mestizo')
      return `Curiosidades de ${mascota.raza} 🐾`;
    const esp = mascota.especie
      ? mascota.especie.charAt(0).toUpperCase() + mascota.especie.slice(1).toLowerCase()
      : 'Mascota';
    return `Curiosidades de ${esp} 🐾`;
  }, [mascota]);

  const petImg = useMemo(
    () => resolvePetImageSource({ fotoUrl: mascota?.fotoUrl ?? null }),
    [mascota]
  );

  return (
    <SafeAreaView style={st.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={st.screenBackground}
        imageStyle={st.screenBackgroundImage}
        resizeMode="cover"
      >
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <Text style={st.headerTitle} numberOfLines={2}>{tituloHeader}</Text>
          <View style={st.headerBtn} />
        </View>

        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={st.hero}>
            <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity }}>
              <PetIllustration source={petImg}
                label={mascota ? `Ilustración de ${mascota.nombre}` : 'Mascota'} />
            </Animated.View>
          </View>

          {/* Card blanco */}
          <View style={st.whiteCard}>

            {/* Banner demo */}
            {esDemo && !loading && (
              <View style={st.demoBanner}>
                <Text style={st.demoBannerTxt}>
                  💡 Consejos generales — conectá el backend para ver los de tu mascota
                </Text>
              </View>
            )}

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
      </ImageBackground>
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#D4F5E2' },
  screenBackground:     { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  scroll:               { flex: 1, backgroundColor: 'transparent' },
  scrollContent:        { flexGrow: 1, backgroundColor: 'transparent' },

  header:      { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn:   { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, maxWidth: 220, fontSize: 15, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', lineHeight: 20 },

  hero:    { alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 0, paddingVertical: 16 },
  petImage: { width: 200, height: 200, backgroundColor: 'transparent' },

  whiteCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, minHeight: 400 },

  demoBanner:    { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 12 },
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
  emojiCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  emojiTxt:    { fontSize: 20 },
  cardCateg:   { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  cardSep:     { height: 1, backgroundColor: '#F0F0F0' },
  cardBody:    { paddingLeft: 24, paddingRight: 20, paddingTop: 14, paddingBottom: 16 },
  cardTxt:     { fontSize: 14, color: '#2C2C2C', lineHeight: 22 },

  skeletonCard:   { backgroundColor: '#F0F0F0', borderRadius: 18, marginHorizontal: 4, marginBottom: 14, overflow: 'hidden' },
  skeletonHeader: { height: 56, backgroundColor: '#E8E8E8' },
  skeletonBody:   { padding: 14, gap: 8 },
  skeletonLine:   { height: 12, backgroundColor: '#E0E0E0', borderRadius: 6, width: '100%' },
});
