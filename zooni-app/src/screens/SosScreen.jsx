/**
 * SosScreen.jsx — Pantalla "S.O.S Veterinario" de Zooni (Instruction-SOS v1.0)
 *
 * Objetivo único: que el usuario pueda llamar a alguien en menos de 3 segundos
 * y con una sola mano. De ahí se derivan las reglas duras de esta pantalla:
 *
 *  - Las cards rojas (info + líneas de emergencia) van arriba de todo y NO
 *    scrollean en pantallas de 700px o más. Siempre se renderizan, en todos
 *    los estados, sin excepción.
 *  - Los números de las líneas tienen fallback local: si falla el GPS, la red
 *    o el backend, los dos botones de llamada siguen funcionando.
 *  - Nada de animaciones de entrada: la pantalla es tocable apenas monta.
 *  - El rojo está reservado para esta pantalla (tokens -fill/-text por AA).
 *
 * Variantes de estado (§3.4): V1 base · V2 cargando · V3 sin ubicación ·
 * V4 sin conexión (caché) · V5 búsqueda sin resultados · V6 sin veterinarias
 * cerca · V7 emergencia activa · V8 error del servidor con backoff.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import HamburgerDrawer from '../components/HamburgerDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import { resolvePetImage } from '../constants/petImages';
import {
  DEMO_VETS,
  LINEAS_FALLBACK,
  cancelarSos,
  distanciaM,
  estadoHorario,
  fetchLineasEmergencia,
  fetchSosActivo,
  fetchVeterinarias,
  logLlamadaSos,
  normalizar,
} from '../services/sosApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// En pantallas de 700px o más el bloque header + cards rojas queda fijo y solo
// scrollea el listado; en más bajas scrollea todo (con la card B compactada
// para que las líneas de emergencia entren sin scroll al montar). §3.2
const STICKY = SCREEN_HEIGHT >= 700;

// ─── TOKENS (§3.1 — única fuente de colores permitida en esta pantalla) ──────
const C = {
  sosRed: '#E63946',      // identidad: borde V7, punto pulsante — nunca texto
  sosRedFill: '#D62031',  // superficies rojas con texto blanco chico (AA 5.11)
  sosRedDark: '#C1121F',  // card de líneas y estados pressed
  sosRedText: '#B3121D',  // texto rojo sobre blanco o tint (AA 6.95)
  sosRedTint: '#FDECEE',  // chips y badges de urgencia sobre blanco
  bgMain: '#C8F0D8',
  bgScroll: '#F4FBF6',
  surface: '#FFFFFF',
  brand: '#2DBD72',       // solo rellenos decorativos (punto "abierto")
  brandText: '#177046',   // único verde legible como texto en las 3 superficies
  cta: '#F5C842',
  ctaSoft: '#F7D060',
  amber: '#F5A623',       // solo glifo de estrella y badge campana
  amberText: '#A05F00',
  text: '#2C2C2C',
  textSoft: '#6B6B6B',
  textInverse: '#FFFFFF',
  divider: '#E8EFE9',
  iconOff: '#AAAAAA',
};

const FILTROS = [
  { key: 'abierto', label: 'Abierto ahora' },
  { key: '24h', label: 'Atiende 24 hs' },
  { key: 'cerca', label: 'Más cerca' },
  { key: 'rating', label: 'Mejor puntuadas' },
  { key: 'urgencias', label: 'Urgencias' },
  { key: 'domicilio', label: 'Atiende a domicilio' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** 1180 → "1,2 km" · 640 → "640 m" */
function formatDistancia(m) {
  if (m == null) return null;
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

const PALABRAS_DIGITO = {
  0: 'cero', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro',
  5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve',
};

/** "911" → "nueve, uno, uno" — un lector leyendo dígitos sueltos es inútil. */
function deletrear(telefono) {
  return telefono
    .split('')
    .filter((ch) => PALABRAS_DIGITO[ch] != null)
    .map((ch) => PALABRAS_DIGITO[ch])
    .join(', ');
}

function hapticImpact(estilo) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(estilo).catch(() => {});
}

function formatCrono(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── COMPONENTE: PRESIÓN CON ESCALA (§3.5: 0.97, 120ms in / 160ms out) ───────

function PressableScale({ onPress, style, children, disabled, accessibilityLabel, accessibilityRole = 'button', accessibilityState }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.timing(scale, { toValue: 0.97, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={style}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── COMPONENTE: SKELETON (V2 — shimmer, sin spinner central) ────────────────

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return <Animated.View style={[s.skeletonCard, { opacity }]} />;
}

// ─── COMPONENTE: PUNTO PULSANTE (única animación permitida — V7) ─────────────

function PuntoPulsante() {
  const pulso = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulso]);
  return <Animated.View style={[s.puntoPulsante, { opacity: pulso }]} />;
}

// ─── PANTALLA ────────────────────────────────────────────────────────────────

export default function SosScreen() {
  const navigation = useNavigation();

  // Líneas de emergencia: arrancan con el fallback local para que los botones
  // funcionen desde el primer frame; el fetch solo puede mejorarlas. §2.2
  const [lineas, setLineas] = useState(LINEAS_FALLBACK);

  // 'cargando' | 'ok' | 'offline' | 'error'
  const [estado, setEstado] = useState('cargando');
  const [vets, setVets] = useState([]);
  const [esDemo, setEsDemo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [queryDebounced, setQueryDebounced] = useState('');
  const [buscadorEnfocado, setBuscadorEnfocado] = useState(false);
  const [filtros, setFiltros] = useState(new Set(['abierto']));

  const [ubicacion, setUbicacion] = useState(null);
  const [sinUbicacion, setSinUbicacion] = useState(false);

  const [sosActivo, setSosActivo] = useState(null);
  const [cronoSeg, setCronoSeg] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLlamada, setConfirmLlamada] = useState(null); // { telefono, nombre, clinicId }

  const cacheRef = useRef(null);       // últimos resultados OK (variante V4)
  const guardLlamadaRef = useRef(0);   // guard de 1500ms contra doble marcado
  const retryRef = useRef(0);          // reintentos con backoff 2s/4s/8s (V8)
  const retryTimerRef = useRef(null);
  const fadeLista = useRef(new Animated.Value(0)).current;

  // ── Carga de datos (nada bloquea el render) ────────────────────────────────

  useEffect(() => {
    fetchLineasEmergencia('AR').then(setLineas, () => {});
    fetchSosActivo().then(setSosActivo, () => {});
  }, []);

  const cargarVets = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado('cargando');
    try {
      const data = await Promise.race([
        fetchVeterinarias(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500)),
      ]);
      cacheRef.current = data;
      retryRef.current = 0;
      setVets(data);
      setEsDemo(false);
      setEstado('ok');
    } catch (e) {
      const esErrorRed = e?.message === 'timeout' || /network|fetch/i.test(e?.message ?? '');
      if (esErrorRed && cacheRef.current?.length) {
        // V4: sin conexión pero con caché — se sirven los datos guardados
        setVets(cacheRef.current);
        setEstado('offline');
      } else if (esErrorRed) {
        // V8: error de servidor/red sin caché — banner + backoff 2s/4s/8s
        setEstado('error');
        if (retryRef.current < 3) {
          const espera = [2000, 4000, 8000][retryRef.current];
          retryRef.current += 1;
          retryTimerRef.current = setTimeout(() => cargarVets(true), espera);
        }
      } else {
        // Sin tablas de SOS en Supabase todavía: datos de demo, igual que Home
        setVets(DEMO_VETS);
        setEsDemo(true);
        setEstado('ok');
      }
    }
  }, []);

  useEffect(() => {
    cargarVets();
    return () => clearTimeout(retryTimerRef.current);
  }, [cargarVets]);

  // Fade único de 150ms al aparecer resultados (sin stagger, §3.5)
  useEffect(() => {
    if (estado === 'cargando') fadeLista.setValue(0);
    else Animated.timing(fadeLista, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [estado, fadeLista]);

  // ── Ubicación (best-effort: sin expo-location se usa el geolocation web) ──

  const pedirUbicacion = useCallback(() => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) {
      setSinUbicacion(true);
      return;
    }
    geo.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSinUbicacion(false);
      },
      () => setSinUbicacion(true),
      { timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => { pedirUbicacion(); }, [pedirUbicacion]);

  // ── Debounce del buscador (300ms, §D) ─────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setQueryDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Cronómetro y polling de la emergencia activa (V7) ─────────────────────

  useEffect(() => {
    if (!sosActivo) return undefined;
    const inicio = new Date(sosActivo.startedAt).getTime();
    const tick = () => setCronoSeg(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    // Sin Realtime configurado: fallback a polling cada 20s (§4.5)
    const poll = setInterval(() => fetchSosActivo().then(setSosActivo, () => {}), 20000);
    return () => { clearInterval(t); clearInterval(poll); };
  }, [sosActivo]);

  // ── Llamadas (nunca bloqueadas por backend; guard de 1500ms) ──────────────

  const ejecutarLlamada = useCallback((telefono, { clinicId = null, lineId = null } = {}) => {
    const ahora = Date.now();
    if (ahora - guardLlamadaRef.current < 1500) return;
    guardLlamadaRef.current = ahora;
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    logLlamadaSos({ telefono, clinicId, lineId }); // fire-and-forget
    // Abre el marcador nativo con el número precargado; el usuario confirma
    // en el sistema (evita llamadas accidentales, §C1).
    Linking.openURL(`tel:${telefono.replace(/[^\d+]/g, '')}`).catch(() => {});
  }, []);

  const comoLlegar = useCallback((clinica) => {
    if (clinica.lat == null || clinica.lng == null) return;
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    const destino = `${clinica.lat},${clinica.lng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(clinica.nombre)}@${destino}`,
      android: `geo:0,0?q=${destino}(${encodeURIComponent(clinica.nombre)})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    });
    Linking.openURL(url).catch(() => {});
  }, []);

  // ── Filtros y listado derivado ────────────────────────────────────────────

  const toggleFiltro = useCallback((key) => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    setFiltros((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // "Más cerca" y "Mejor puntuadas" definen el orden: excluyentes (§E)
        if (key === 'cerca') next.delete('rating');
        if (key === 'rating') next.delete('cerca');
        next.add(key);
      }
      return next;
    });
  }, []);

  const listaFiltrada = useMemo(() => {
    const q = normalizar(queryDebounced.trim());
    let items = vets.map((v) => ({
      ...v,
      horario: estadoHorario(v),
      dist: ubicacion ? distanciaM(ubicacion.lat, ubicacion.lng, v.lat, v.lng) : null,
    }));

    if (q.length >= 2) {
      items = items.filter((v) =>
        normalizar(
          `${v.nombre} ${v.barrio ?? ''} ${v.direccion ?? ''} ${v.especialidades.join(' ')}`,
        ).includes(q),
      );
    }
    if (filtros.has('abierto')) items = items.filter((v) => v.horario.abierta !== false);
    if (filtros.has('24h')) items = items.filter((v) => v.is24h);
    if (filtros.has('urgencias')) items = items.filter((v) => v.urgencias);
    if (filtros.has('domicilio')) items = items.filter((v) => v.servicios.includes('domicilio'));

    const porDistancia = (a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity);
    const porRating = (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1);
    if (filtros.has('cerca')) {
      items.sort(porDistancia);
    } else if (filtros.has('rating')) {
      items.sort(porRating);
    } else {
      // Orden por defecto (§G): urgencias abiertas primero, después distancia
      // ascendente (o rating si no hay ubicación), a igualdad rating desc.
      items.sort((a, b) => {
        const ua = a.urgencias && a.horario.abierta !== false ? 1 : 0;
        const ub = b.urgencias && b.horario.abierta !== false ? 1 : 0;
        if (ua !== ub) return ub - ua;
        const cmp = ubicacion ? porDistancia(a, b) : porRating(a, b);
        return cmp !== 0 ? cmp : porRating(a, b);
      });
    }
    return items;
  }, [vets, queryDebounced, filtros, ubicacion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pedirUbicacion();
    retryRef.current = 0;
    await cargarVets(true);
    setRefreshing(false);
  }, [cargarVets, pedirUbicacion]);

  const cancelarEmergencia = useCallback(() => {
    Alert.alert('Cancelar emergencia', '¿Seguro que querés cancelar la emergencia en curso?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          await cancelarSos(sosActivo.id);
          setSosActivo(null);
        },
      },
    ]);
  }, [sosActivo]);

  const controlesDeshabilitados = estado === 'cargando' || estado === 'offline';
  const lineaZooni = lineas.find((l) => l.kind === 'zooni') ?? LINEAS_FALLBACK[0];
  const lineaNacional = lineas.find((l) => l.kind === 'national_emergency') ?? LINEAS_FALLBACK[1];

  // ── Bloques de UI ─────────────────────────────────────────────────────────

  const renderCardsRojas = () => (
    <View style={s.cardsRojasWrap}>
      {/* V7 — Emergencia activa: se AGREGA arriba de la card informativa */}
      {sosActivo && (
        <View style={s.cardEmergenciaActiva}>
          <View style={s.filaEmergencia}>
            <PuntoPulsante />
            <Text style={s.tituloEmergenciaActiva}>Emergencia en curso</Text>
            <Text style={s.cronoEmergencia}>{formatCrono(cronoSeg)}</Text>
          </View>
          <Text style={s.estadoEmergencia}>
            {sosActivo.status === 'searching' && 'Buscando veterinaria'}
            {sosActivo.status === 'confirmed' && `${sosActivo.clinicaNombre ?? 'La clínica'} confirmó`}
            {sosActivo.status === 'on_the_way' && 'En camino'}
          </Text>
          <View style={s.filaBotonesEmergencia}>
            <PressableScale
              style={s.btnVerDetalle}
              onPress={() =>
                Alert.alert('Emergencia en curso', `Estado: ${sosActivo.status} · ${formatCrono(cronoSeg)}`)
              }
              accessibilityLabel="Ver detalle de la emergencia en curso"
            >
              <Text style={s.btnVerDetalleTexto}>Ver detalle</Text>
            </PressableScale>
            <TouchableOpacity onPress={cancelarEmergencia} accessibilityRole="button" style={s.btnCancelarEmergencia}>
              <Text style={s.btnCancelarEmergenciaTexto}>Cancelar emergencia</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* B — Card informativa (no tocable) */}
      <View style={[s.cardInfo, !STICKY && s.cardInfoCompacta]} accessible accessibilityRole="text">
        <View style={s.circuloIcono}>
          <Ionicons name="medical" size={22} color={C.textInverse} />
        </View>
        <Text style={s.cardInfoTitulo}>Emergencia Veterinaria</Text>
        <Text style={s.cardInfoCuerpo}>Si tu mascota necesita atención urgente, contactá ahora mismo.</Text>
      </View>

      {/* C — Card de acciones: el componente más importante de la pantalla */}
      <View style={s.cardLineas}>
        <Ionicons name="call" size={20} color={C.textInverse} style={s.iconoLineas} />
        <Text style={s.cardLineasTitulo}>Líneas de Emergencia</Text>
        <Text style={s.cardLineasSub}>Veterinarias de emergencia 24 hs</Text>

        {/* C1 — Línea Zooni */}
        <PressableScale
          style={s.btnLlamada}
          onPress={() => ejecutarLlamada(lineaZooni.telefono, { lineId: lineaZooni.id })}
          accessibilityLabel={`Llamar a la línea de emergencia de Zooni, ${deletrear(lineaZooni.telefono)}`}
        >
          <Ionicons name="call" size={18} color={C.sosRedText} />
          <Text style={s.btnLlamadaTexto}>Llamar: {lineaZooni.telefono}</Text>
        </PressableScale>

        {/* C2 — Emergencias nacionales (configurable por país, §C2) */}
        <PressableScale
          style={[s.btnLlamada, s.btnLlamadaSegundo]}
          onPress={() => ejecutarLlamada(lineaNacional.telefono, { lineId: lineaNacional.id })}
          accessibilityLabel={`Llamar a emergencias, ${deletrear(lineaNacional.telefono)}`}
        >
          <Ionicons name="medkit" size={18} color={C.sosRedText} />
          <Text style={s.btnLlamadaTexto}>Emergencias: {lineaNacional.telefono}</Text>
        </PressableScale>
      </View>
    </View>
  );

  const renderHeaderLista = () => (
    <View>
      {!STICKY && <View style={s.fondoHero}>{renderCardsRojas()}</View>}

      {/* D — Buscador */}
      <View style={[s.buscador, controlesDeshabilitados && s.deshabilitado]}>
        <Ionicons name="search" size={18} color={C.textSoft} />
        <TextInput
          style={s.buscadorInput}
          value={query}
          onChangeText={setQuery}
          editable={!controlesDeshabilitados}
          placeholder="Buscar veterinaria o especialidad"
          placeholderTextColor={C.textSoft}
          onFocus={() => setBuscadorEnfocado(true)}
          onBlur={() => setBuscadorEnfocado(false)}
          returnKeyType="search"
          accessibilityLabel="Buscar veterinario por nombre, especialidad o zona"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
          >
            <Ionicons name="close" size={18} color={C.textSoft} />
          </TouchableOpacity>
        )}
      </View>
      {buscadorEnfocado && (
        <Text style={s.buscadorHint}>Podés buscar por nombre, especialidad o zona</Text>
      )}

      {/* E — Chips de filtro */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsFila}
        style={controlesDeshabilitados && s.deshabilitado}
      >
        {FILTROS.map((f) => {
          const activo = filtros.has(f.key);
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, activo && s.chipActivo]}
              onPress={() => !controlesDeshabilitados && toggleFiltro(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Filtro ${f.label}, ${activo ? 'activado' : 'desactivado'}`}
            >
              <Text style={[s.chipTexto, activo && s.chipTextoActivo]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* V3 — Sin permiso de ubicación */}
      {sinUbicacion && estado !== 'cargando' && (
        <View style={s.cardUbicacion}>
          <Ionicons name="location" size={24} color={C.brandText} />
          <View style={s.cardUbicacionTextos}>
            <Text style={s.cardUbicacionTitulo}>Activá tu ubicación</Text>
            <Text style={s.cardUbicacionCuerpo}>
              Así te mostramos las veterinarias más cercanas primero.
            </Text>
          </View>
          <PressableScale
            style={s.btnActivarUbicacion}
            onPress={() => {
              if (globalThis.navigator?.geolocation) pedirUbicacion();
              else Linking.openSettings().catch(() => {});
            }}
            accessibilityLabel="Activar ubicación"
          >
            <Text style={s.btnActivarUbicacionTexto}>Activar ubicación</Text>
          </PressableScale>
        </View>
      )}

      {/* V4 — Sin conexión (con datos de caché) */}
      {estado === 'offline' && (
        <View style={s.banner}>
          <Ionicons name="wifi" size={18} color={C.sosRedText} />
          <Text style={s.bannerTexto}>Sin conexión. Los botones de llamada siguen funcionando.</Text>
        </View>
      )}

      {/* V8 — Error del servidor */}
      {estado === 'error' && (
        <View style={s.banner}>
          <Ionicons name="cloud-offline-outline" size={18} color={C.sosRedText} />
          <Text style={s.bannerTexto}>No pudimos cargar las veterinarias.</Text>
          <TouchableOpacity
            onPress={() => { retryRef.current = 0; cargarVets(); }}
            accessibilityRole="button"
          >
            <Text style={s.bannerReintentar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* F — Header de sección */}
      {estado !== 'error' && listaFiltrada.length > 0 && (
        <View style={s.headerSeccion}>
          <Text style={s.headerSeccionTitulo}>Veterinarios Disponibles</Text>
          <Text style={s.headerSeccionContador}>
            {listaFiltrada.length} {ubicacion ? 'cerca tuyo' : 'en tu ciudad'}
          </Text>
        </View>
      )}
    </View>
  );

  // G — Card de veterinaria
  const renderVet = ({ item }) => {
    const { horario } = item;
    const distancia = formatDistancia(item.dist);
    return (
      <PressableScale
        style={s.cardVet}
        onPress={() => navigation.navigate('VeterinariaDetalle', { clinica: item })}
        accessibilityLabel={`Ver detalle de ${item.nombre}`}
      >
        {/* Fila superior: logo + nombre + rating (o badge URGENCIAS encima) */}
        <View style={s.vetFilaSuperior}>
          {item.logoUrl ? (
            <Image source={{ uri: item.logoUrl }} style={s.vetLogo} />
          ) : (
            <View style={s.vetLogoFallback}>
              <Text style={s.vetLogoInicial}>{item.nombre.charAt(0)}</Text>
            </View>
          )}
          <Text style={s.vetNombre} numberOfLines={2}>{item.nombre}</Text>
          <View style={s.vetColumnaDerecha}>
            {item.urgencias && (
              <View style={s.badgeUrgencias} accessibilityLabel="Atiende urgencias">
                <Text style={s.badgeUrgenciasTexto}>URGENCIAS</Text>
              </View>
            )}
            {item.ratingCount > 0 ? (
              <View style={s.vetRatingWrap}>
                <View style={s.vetRatingFila}>
                  <Ionicons name="star" size={14} color={C.amber} accessibilityElementsHidden />
                  <Text style={s.vetRatingNumero}>{item.ratingAvg?.toFixed(1)}</Text>
                </View>
                <Text style={s.vetRatingCantidad}>({item.ratingCount})</Text>
              </View>
            ) : (
              <View style={s.chipNuevo}>
                <Text style={s.chipNuevoTexto}>Nuevo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Especialidades — sin prefijo "Especialidad:" (§G.2) */}
        {item.especialidades.length > 0 && (
          <Text style={s.vetEspecialidad} numberOfLines={1}>
            {item.especialidades.join(' · ')}
          </Text>
        )}

        {/* Dirección y distancia — sin separador colgando si no hay distancia */}
        <View style={s.vetDireccionFila}>
          <Ionicons name="location-sharp" size={13} color={C.brandText} />
          <Text style={s.vetDireccion} numberOfLines={1}>
            {item.direccion}
            {item.barrio ? `, ${item.barrio}` : ''}
            {distancia ? ` · ${distancia}` : ''}
          </Text>
        </View>

        {/* Estado horario */}
        {horario.abierta != null && (
          <View style={s.vetHorarioFila}>
            <View
              style={[
                s.puntoHorario,
                {
                  backgroundColor: horario.abierta
                    ? horario.cierraEnMin != null && horario.cierraEnMin < 60 ? C.amber : C.brand
                    : C.iconOff,
                },
              ]}
            />
            <Text
              style={[
                s.vetHorarioTexto,
                horario.abierta
                  ? horario.cierraEnMin != null && horario.cierraEnMin < 60
                    ? { color: C.amberText }
                    : { color: C.brandText }
                  : { color: C.textSoft },
              ]}
            >
              {item.is24h
                ? 'Abierto 24 hs'
                : horario.abierta
                  ? horario.cierraEnMin != null && horario.cierraEnMin < 60
                    ? `Cierra en ${horario.cierraEnMin} min`
                    : 'Abierto ahora'
                  : `Cerrado${horario.abreA ? ` · Abre ${horario.abreA}` : ''}`}
            </Text>
            {estado === 'offline' && (
              <Text style={s.tagCache}>Datos guardados</Text>
            )}
          </View>
        )}

        {/* Fila de acciones */}
        <View style={s.vetAcciones}>
          {!!item.telefono && (
            <PressableScale
              style={s.btnVetLlamar}
              onPress={() =>
                // En las cards el toque accidental durante scroll es un riesgo
                // real: acá sí hay confirmación previa (§3.4, diálogo).
                setConfirmLlamada({ telefono: item.telefono, nombre: item.nombre, clinicId: item.id })
              }
              accessibilityLabel={`Llamar a ${item.nombre}, ${deletrear(item.telefono)}`}
            >
              <Ionicons name="call" size={16} color={C.textInverse} />
              <Text style={s.btnVetLlamarTexto}>Llamar</Text>
            </PressableScale>
          )}
          {item.lat != null && (
            <PressableScale
              style={s.btnVetLlegar}
              onPress={() => comoLlegar(item)}
              accessibilityLabel={`Cómo llegar a ${item.nombre}`}
            >
              <Ionicons name="navigate" size={16} color={C.brandText} />
              <Text style={s.btnVetLlegarTexto}>Cómo llegar</Text>
            </PressableScale>
          )}
        </View>
      </PressableScale>
    );
  };

  const renderVacio = () => {
    if (estado === 'cargando') {
      return (
        <View>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      );
    }
    if (estado === 'error') return null; // el banner V8 ya está arriba
    if (queryDebounced.trim().length >= 2) {
      // V5 — búsqueda sin resultados
      return (
        <View style={s.vacio}>
          <Image source={resolvePetImage('perro_default')} style={s.vacioImagen} resizeMode="contain" />
          <Text style={s.vacioTitulo}>No encontramos veterinarias con ese nombre</Text>
          <Text style={s.vacioCuerpo}>Probá con otra especialidad o zona.</Text>
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button">
            <Text style={s.vacioAccionTexto}>Limpiar búsqueda</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // V6 — sin veterinarias cerca
    return (
      <View style={s.vacio}>
        <Image source={resolvePetImage('perro_default')} style={s.vacioImagen} resizeMode="contain" />
        <Text style={s.vacioTitulo}>No hay veterinarias registradas cerca tuyo</Text>
        <Text style={s.vacioCuerpo}>
          Podés llamar a la línea de emergencia de arriba, está disponible las 24 hs.
        </Text>
        <PressableScale
          style={s.btnAmpliar}
          onPress={() => { setFiltros(new Set()); onRefresh(); }}
          accessibilityLabel="Ampliar la búsqueda a 20 kilómetros"
        >
          <Text style={s.btnAmpliarTexto}>Ampliar la búsqueda a 20 km</Text>
        </PressableScale>
      </View>
    );
  };

  const renderFooter = () => {
    if (estado === 'cargando' || listaFiltrada.length === 0) return null;
    return (
      <View>
        <Text style={s.finListado}>No hay más veterinarias cerca</Text>
        {/* H — CTA amarillo: reutiliza el mapa de Comunidad con otra capa */}
        <PressableScale
          style={s.ctaMapa}
          onPress={() => navigation.navigate('Comunidad')}
          accessibilityLabel="Ver todas las veterinarias en el mapa"
        >
          <Ionicons name="map-outline" size={18} color={C.text} />
          <Text style={s.ctaMapaTexto}>Ver todas en el mapa</Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bgMain} />

      {/* A — Header: mismo fondo que el hero, sin borde ni sombra */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={s.headerBoton}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={24} color={C.brandText} />
        </TouchableOpacity>

        {/* Centrado óptico respecto del ancho total, no del espacio libre */}
        <View style={s.headerTituloWrap} pointerEvents="none">
          <View style={s.headerCruz}>
            <Ionicons name="medical" size={18} color={C.sosRedText} />
          </View>
          <Text style={s.headerTitulo} numberOfLines={1}>S.O.S Veterinario</Text>
        </View>

        <TouchableOpacity
          onPress={() => setNotifOpen((v) => !v)}
          style={s.headerBoton}
          accessibilityRole="button"
          accessibilityLabel="Notificaciones"
        >
          <Ionicons name="notifications-outline" size={24} color={C.brandText} />
        </TouchableOpacity>
      </View>

      {/* Bloque fijo (≥700px): las acciones de llamado nunca requieren scroll */}
      {STICKY && <View style={s.fondoHero}>{renderCardsRojas()}</View>}

      <Animated.View style={[s.zonaScroll, { opacity: fadeLista }]}>
        <FlatList
          data={estado === 'cargando' ? [] : listaFiltrada}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVet}
          // Elementos (no componentes): si fueran funciones, FlatList los
          // remontaría en cada render y el buscador perdería el foco al tipear.
          ListHeaderComponent={renderHeaderLista()}
          ListEmptyComponent={renderVacio()}
          ListFooterComponent={renderFooter()}
          contentContainerStyle={s.listaContenido}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.brandText]}
              tintColor={C.brandText}
            />
          }
        />
      </Animated.View>

      {/* Diálogo de confirmación de llamada (solo cards individuales) */}
      <Modal
        visible={!!confirmLlamada}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmLlamada(null)}
      >
        <Pressable style={s.sheetOverlay} onPress={() => setConfirmLlamada(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitulo}>¿Llamar a {confirmLlamada?.telefono}?</Text>
            <Text style={s.sheetNombre} numberOfLines={1}>{confirmLlamada?.nombre}</Text>
            <PressableScale
              style={s.sheetBtnLlamar}
              onPress={() => {
                const c = confirmLlamada;
                setConfirmLlamada(null);
                ejecutarLlamada(c.telefono, { clinicId: c.clinicId });
              }}
              accessibilityLabel={`Confirmar llamada a ${confirmLlamada?.nombre ?? ''}`}
            >
              <Ionicons name="call" size={18} color={C.textInverse} />
              <Text style={s.sheetBtnLlamarTexto}>Llamar</Text>
            </PressableScale>
            <TouchableOpacity
              onPress={() => setConfirmLlamada(null)}
              style={s.sheetBtnCancelar}
              accessibilityRole="button"
            >
              <Text style={s.sheetBtnCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Overlays globales */}
      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={null}
        mascotaActiva={null}
        activeRoute="SOS"
      />
      <NotificationsPanel
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={(ruta) => {
          const screen = ruta.split('/')[0].toLowerCase();
          const map = { perfil: 'Perfil', match: 'Match', fichamedica: 'FichaMedica', comunidad: 'Comunidad', mensajes: 'Mensajes' };
          if (map[screen]) navigation.navigate(map[screen]);
        }}
        onMarcarTodasLeidas={() => {}}
      />
    </SafeAreaView>
  );
}

// ─── ESTILOS (medidas y radios de §3.1 y §3.3) ───────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgMain },

  // A — Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: C.bgMain,
  },
  headerBoton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTituloWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerCruz: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.sosRedTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: C.brandText,
  },

  // Cards rojas (B + C)
  fondoHero: { backgroundColor: C.bgMain },
  cardsRojasWrap: { paddingHorizontal: 20, paddingBottom: 16 },

  cardInfo: {
    backgroundColor: C.sosRedFill,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: C.sosRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  cardInfoCompacta: { paddingVertical: 14 },
  circuloIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoTitulo: {
    marginTop: 10,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: C.textInverse,
    textAlign: 'center',
  },
  cardInfoCuerpo: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: C.textInverse, // opacidad 1 siempre: nunca translúcido (§3.6)
    textAlign: 'center',
    maxWidth: 300,
  },

  cardLineas: {
    marginTop: 16,
    backgroundColor: C.sosRedDark,
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: C.sosRedDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  iconoLineas: { marginBottom: 2 },
  cardLineasTitulo: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
    color: C.textInverse,
    textAlign: 'center',
  },
  cardLineasSub: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: C.textInverse,
    textAlign: 'center',
  },
  btnLlamada: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 30,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  btnLlamadaSegundo: { marginTop: 12 },
  btnLlamadaTexto: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: C.sosRedText,
  },

  // V7 — Emergencia activa
  cardEmergenciaActiva: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.sosRed,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  filaEmergencia: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puntoPulsante: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.sosRed },
  tituloEmergenciaActiva: { flex: 1, fontSize: 16, fontWeight: '700', color: C.sosRedText },
  cronoEmergencia: { fontSize: 14, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  estadoEmergencia: { marginTop: 6, fontSize: 14, lineHeight: 20, color: C.textSoft },
  filaBotonesEmergencia: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  btnVerDetalle: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 18,
    backgroundColor: C.sosRedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnVerDetalleTexto: { fontSize: 14, fontWeight: '700', color: C.textInverse },
  btnCancelarEmergencia: { minHeight: 48, justifyContent: 'center' },
  btnCancelarEmergenciaTexto: { fontSize: 14, fontWeight: '600', color: C.textSoft },

  // Área scrolleable
  zonaScroll: { flex: 1, backgroundColor: C.bgScroll },
  listaContenido: { paddingBottom: 24 },
  deshabilitado: { opacity: 0.5 },

  // D — Buscador
  buscador: {
    marginTop: 20,
    marginHorizontal: 20,
    height: 48,
    borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.divider,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: C.text,
    paddingVertical: 0,
  },
  buscadorHint: {
    marginTop: 6,
    marginHorizontal: 20,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSoft,
  },

  // E — Chips
  chipsFila: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActivo: { backgroundColor: C.brandText, borderColor: C.brandText },
  chipTexto: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.textSoft },
  chipTextoActivo: { color: C.textInverse },

  // V3 — Sin ubicación
  cardUbicacion: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardUbicacionTextos: { flex: 1, minWidth: 160 },
  cardUbicacionTitulo: { fontSize: 15, fontWeight: '700', color: C.text },
  cardUbicacionCuerpo: { marginTop: 2, fontSize: 13, lineHeight: 18, color: C.textSoft },
  btnActivarUbicacion: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    backgroundColor: C.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActivarUbicacionTexto: { fontSize: 14, fontWeight: '700', color: C.text },

  // V4 / V8 — Banners
  banner: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: C.sosRedTint,
    borderWidth: 1,
    borderColor: '#F5C6CB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerTexto: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700', color: C.sosRedText },
  bannerReintentar: { fontSize: 14, fontWeight: '700', color: C.brandText },
  tagCache: { marginLeft: 'auto', fontSize: 11, fontWeight: '600', color: C.textSoft },

  // F — Header de sección
  headerSeccion: {
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerSeccionTitulo: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: C.text },
  headerSeccionContador: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.textSoft },

  // V2 — Skeleton
  skeletonCard: {
    height: 150,
    borderRadius: 16,
    backgroundColor: '#EDF3EE',
    marginHorizontal: 20,
    marginTop: 20,
  },

  // G — Card de veterinaria
  cardVet: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  vetFilaSuperior: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  vetLogo: { width: 44, height: 44, borderRadius: 12 },
  vetLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.sosRedTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vetLogoInicial: { fontSize: 18, fontWeight: '800', color: C.sosRedText },
  vetNombre: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text },
  vetColumnaDerecha: { alignItems: 'flex-end', gap: 4 },
  badgeUrgencias: {
    backgroundColor: C.sosRedTint,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeUrgenciasTexto: { fontSize: 11, fontWeight: '700', color: C.sosRedText },
  vetRatingWrap: { alignItems: 'flex-end' },
  vetRatingFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vetRatingNumero: { fontSize: 14, fontWeight: '600', color: C.text },
  vetRatingCantidad: { fontSize: 11, color: C.textSoft },
  chipNuevo: {
    backgroundColor: '#E8F7EE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipNuevoTexto: { fontSize: 11, fontWeight: '700', color: C.brandText },
  vetEspecialidad: { marginTop: 8, fontSize: 14, lineHeight: 20, color: C.textSoft },
  vetDireccionFila: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  vetDireccion: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.textSoft },
  vetHorarioFila: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  puntoHorario: { width: 8, height: 8, borderRadius: 4 },
  vetHorarioTexto: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  vetAcciones: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    flexDirection: 'row',
    gap: 10,
  },
  btnVetLlamar: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.sosRedFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnVetLlamarTexto: { fontSize: 15, fontWeight: '700', color: C.textInverse },
  btnVetLlegar: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.brandText,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnVetLlegarTexto: { fontSize: 15, fontWeight: '700', color: C.brandText },

  // V5 / V6 — Estados vacíos
  vacio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 32 },
  vacioImagen: { width: 120, height: 120 },
  vacioTitulo: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  vacioCuerpo: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSoft,
    textAlign: 'center',
  },
  vacioAccionTexto: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: C.brandText,
    padding: 12, // área táctil generosa
  },
  btnAmpliar: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 22,
    backgroundColor: C.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAmpliarTexto: { fontSize: 14, fontWeight: '700', color: C.text },

  // Fin del listado + H — CTA mapa
  finListado: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSoft,
    textAlign: 'center',
  },
  ctaMapa: {
    marginTop: 20,
    marginBottom: 24,
    marginHorizontal: 20,
    height: 54,
    borderRadius: 30,
    backgroundColor: C.cta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  // Texto gris oscuro, no blanco: blanco sobre amarillo da 1.59 y falla AA
  ctaMapaTexto: { fontSize: 16, fontWeight: '700', color: C.text },

  // Bottom sheet de confirmación de llamada
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    minHeight: 220,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  sheetTitulo: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  sheetNombre: { marginTop: 4, fontSize: 14, color: C.textSoft, textAlign: 'center' },
  sheetBtnLlamar: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 26,
    backgroundColor: C.sosRedFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetBtnLlamarTexto: { fontSize: 16, fontWeight: '700', color: C.textInverse },
  sheetBtnCancelar: { marginTop: 8, minHeight: 48, justifyContent: 'center' },
  sheetBtnCancelarTexto: { fontSize: 15, fontWeight: '600', color: C.textSoft },
});
