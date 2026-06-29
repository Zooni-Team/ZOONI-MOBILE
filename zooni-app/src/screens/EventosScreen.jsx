/**
 * EventosScreen.jsx — Pantalla de Eventos públicos de Zooni
 *
 * Muestra actividades, jornadas y encuentros para mascotas organizados
 * por perfiles verificados. El usuario puede:
 *   - Ver eventos cercanos a su ciudad.
 *   - Leer el detalle de cada evento.
 *   - Agregar un evento a su Calendario de Cuidados.
 *
 * Esta pantalla es de SOLO LECTURA (no hay creación de eventos).
 * La única acción interactiva es "Agregar al calendario".
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { fetchHome, fetchEventos, agregarEventoAlCalendario } from '../services/api';
import HamburgerDrawer from '../components/HamburgerDrawer';

// ─────────────────────────────────────────────────────────────
// DATOS DE EJEMPLO — se usan cuando el backend no está disponible
// o no devuelve eventos. Eliminá este bloque en producción.
// ─────────────────────────────────────────────────────────────
const EVENTOS_DEMO = [
  {
    id: 1,
    titulo: 'Jornada de Vacunación Gratuita',
    descripcion:
      'El Gobierno de la Ciudad organiza una jornada de vacunación gratuita para perros y gatos. Se aplicarán vacunas antirrábicas, séxtuple y contra la leptospirosis. Traé el carnet sanitario de tu mascota y llegá con correa o transportín.',
    imagen_url: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?w=800&q=80',
    fecha_hora: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // en 3 días
    ubicacion_nombre: 'Parque Centenario, Av. Díaz Vélez 4900, CABA',
    lat: -34.6063,
    lng: -58.4345,
    ciudad: 'Buenos Aires',
    categoria_tag: 'PERROS Y GATOS',
    organizador_nombre: 'Gobierno Ciudad Autónoma de Buenos Aires',
    organizador_es_oficial: true,
    ya_en_calendario: false,
  },
  {
    id: 2,
    titulo: 'Expo Mascotas Buenos Aires 2026',
    descripcion:
      'La feria de mascotas más grande del año. Más de 200 expositores, concursos de razas, shows de entrenamiento, adopciones responsables y todo lo que necesitás para tu compañero peludo. Entrada libre y gratuita para menores de 12 años.',
    imagen_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
    fecha_hora: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // en 12 días
    ubicacion_nombre: 'La Rural, Av. Sarmiento 2704, Palermo, CABA',
    lat: -34.5765,
    lng: -58.4101,
    ciudad: 'Buenos Aires',
    categoria_tag: 'TODAS LAS MASCOTAS',
    organizador_nombre: 'Zooni Oficial',
    organizador_es_oficial: false,
    ya_en_calendario: true,
  },
  {
    id: 3,
    titulo: 'Taller de Primeros Auxilios para Mascotas',
    descripcion:
      'Aprendé a actuar ante emergencias con tu mascota: maniobra de Heimlich canina, RCP, cómo tratar heridas y cuándo ir urgente al veterinario. Cupos limitados a 20 personas. Llevá foto de tu mascota.',
    imagen_url: 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?w=800&q=80',
    fecha_hora: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // en 20 días
    ubicacion_nombre: 'Centro Cívico Palermo, Thames 1750, CABA',
    lat: -34.5851,
    lng: -58.4271,
    ciudad: 'Buenos Aires',
    categoria_tag: null, // sin pill de categoría
    organizador_nombre: 'Municipalidad de Córdoba',
    organizador_es_oficial: true,
    ya_en_calendario: false,
  },
  {
    id: 4,
    titulo: 'Encuentro de Golden Retrievers en Palermo',
    descripcion:
      'El encuentro mensual de la comunidad Golden Retriever de Buenos Aires. Traé a tu golden, conocé otros dueños, intercambiá tips y disfrutá de una tarde en el parque. Hay fotógrafo y habrá un concurso de disfraces.',
    imagen_url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
    fecha_hora: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // en 45 días
    ubicacion_nombre: 'Parque Tres de Febrero, Av. del Libertador s/n, Palermo',
    lat: -34.5648,
    lng: -58.4184,
    ciudad: 'Buenos Aires',
    categoria_tag: 'GOLDEN RETRIEVER',
    organizador_nombre: 'Zooni Oficial',
    organizador_es_oficial: false,
    ya_en_calendario: false,
  },
];

// ─────────────────────────────────────────────────────────────
// COMPONENTE: SkeletonCard
// Simula la forma de un card de evento mientras carga.
// ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      {/* Foto */}
      <View style={styles.skeletonFoto} />
      {/* Título */}
      <View style={styles.skeletonTitulo} />
      {/* Fecha */}
      <View style={styles.skeletonFecha} />
      {/* Descripción */}
      <View style={styles.skeletonDescripcion} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE: EventoCard
// Renderiza un evento individual con toda su información y
// el botón de agregar al calendario.
// ─────────────────────────────────────────────────────────────
function EventoCard({
  evento,
  yaAgregado,
  expandido,
  onToggleDescripcion,
  onAgregarAlCalendario,
  procesando,
}) {
  // Animación del botón Agregar → Agregado
  const btnColorAnim = useRef(new Animated.Value(yaAgregado ? 1 : 0)).current;
  // Escala del botón al presionar
  const btnScale = useRef(new Animated.Value(1)).current;
  // Estado de imagen rota
  const [imgError, setImgError] = useState(false);

  // Actualizar color del botón cuando cambia yaAgregado
  useEffect(() => {
    Animated.timing(btnColorAnim, {
      toValue: yaAgregado ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // backgroundColor no admite nativeDriver
    }).start();
  }, [yaAgregado]);

  const btnBackground = btnColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2DBD72', '#A8D8B8'],
  });

  // ── Formateo de fecha y hora ───────────────────────────────
  const fechaEvento = new Date(evento.fecha_hora);

  const fechaFormateada = (() => {
    const raw = fechaEvento.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // Capitalizar primera letra del día
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  const horaFormateada =
    fechaEvento.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' hs';

  // ── Handler de ubicación → abre Google Maps ────────────────
  const handleAbrirMapa = useCallback(() => {
    let url;
    if (evento.lat && evento.lng) {
      url = `https://www.google.com/maps/search/?api=1&query=${evento.lat},${evento.lng}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        evento.ubicacion_nombre,
      )}`;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No se pudo abrir Google Maps.'),
    );
  }, [evento.lat, evento.lng, evento.ubicacion_nombre]);

  // ── Handler del botón Agregar ─────────────────────────────
  const handlePressBtnIn = () => {
    Animated.timing(btnScale, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
  const handlePressBtnOut = () => {
    Animated.timing(btnScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  // ── Descripción: truncar a 4 líneas con "Ver más" ─────────
  const DESCRIPCION_MAX_LINES = 4;

  return (
    <View style={styles.card}>
      {/* ── FOTO DEL EVENTO ── */}
      <View style={styles.fotoContainer}>
        {!imgError && evento.imagen_url ? (
          <Image
            source={{ uri: evento.imagen_url }}
            style={styles.fotoEvento}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.fotoPlaceholder}>
            <Ionicons name="image-outline" size={48} color="#AAAAAA" />
          </View>
        )}

        {/* Pill de categoría (solo si existe) */}
        {evento.categoria_tag ? (
          <View style={styles.pillCategoria}>
            <Text style={styles.pillCategoriaTexto}>
              {evento.categoria_tag.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── CONTENIDO ── */}
      <View style={styles.cardContenido}>
        {/* Título */}
        <Text style={styles.eventoTitulo}>{evento.titulo}</Text>

        {/* Fila fecha + hora */}
        <View style={styles.filaFechaHora}>
          <View style={styles.chip}>
            <Ionicons name="calendar-outline" size={13} color="#2DBD72" />
            <Text style={styles.chipTexto}> {fechaFormateada}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="time-outline" size={13} color="#2DBD72" />
            <Text style={styles.chipTexto}> {horaFormateada}</Text>
          </View>
        </View>

        {/* Pill de ubicación */}
        <TouchableOpacity
          style={styles.pillUbicacion}
          onPress={handleAbrirMapa}
          activeOpacity={0.75}
          accessibilityLabel={`Ver ${evento.ubicacion_nombre} en Google Maps`}
          accessibilityRole="link"
        >
          <Ionicons name="location-outline" size={14} color="#2DBD72" />
          <Text style={styles.pillUbicacionTexto} numberOfLines={2}>
            {evento.ubicacion_nombre}
          </Text>
        </TouchableOpacity>

        {/* Descripción con "Ver más / Ver menos" */}
        {evento.descripcion ? (
          <View style={styles.descripcionContainer}>
            <Text
              style={styles.descripcionTexto}
              numberOfLines={expandido ? undefined : DESCRIPCION_MAX_LINES}
            >
              {evento.descripcion}
            </Text>
            <Text
              style={styles.verMasTexto}
              onPress={() => onToggleDescripcion(evento.id)}
              suppressHighlighting
            >
              {expandido ? 'Ver menos' : 'Ver más'}
            </Text>
          </View>
        ) : null}

        {/* Pill del organizador */}
        <View style={styles.pillOrganizador}>
          <Ionicons name="business-outline" size={15} color="#6B6B6B" />
          <Text
            style={styles.pillOrganizadorTexto}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {evento.organizador_nombre}
          </Text>
          {/* Verificación checkmark */}
          <Ionicons name="checkmark-circle" size={14} color="#2DBD72" />
        </View>

        {/* Botón Agregar al calendario */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            disabled={yaAgregado || procesando}
            onPressIn={handlePressBtnIn}
            onPressOut={handlePressBtnOut}
            onPress={() => !yaAgregado && onAgregarAlCalendario(evento)}
            activeOpacity={0.9}
            accessibilityLabel={
              yaAgregado ? 'Evento ya agregado al calendario' : 'Agregar al calendario'
            }
            accessibilityRole="button"
          >
            <Animated.View
              style={[
                styles.btnAgregar,
                { backgroundColor: btnBackground },
                yaAgregado && styles.btnAgregarDeshabilitado,
              ]}
            >
              {procesando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={
                      yaAgregado ? 'checkmark-circle-outline' : 'calendar-outline'
                    }
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.btnAgregarTexto}>
                    {yaAgregado ? '✓ Agregado al calendario' : 'Agregar al calendario'}
                  </Text>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: EventosScreen
// ─────────────────────────────────────────────────────────────
export default function EventosScreen() {
  const navigation = useNavigation();

  // ── Estado ───────────────────────────────────────────────────
  const [drawerVisible, setDrawerVisible]   = useState(false);
  const [homeData, setHomeData]             = useState(null);       // { usuario, mascotaActiva }
  const [eventos, setEventos]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [ciudad, setCiudad]                 = useState(null);
  // Set de IDs de eventos ya agregados al calendario
  const [eventosAgregados, setEventosAgregados] = useState(new Set());
  // Set de IDs de eventos con descripción expandida
  const [descripcionExpandida, setDescripcionExpandida] = useState(new Set());
  // Map de eventoId → boolean (procesando la llamada POST)
  const [procesandoIds, setProcesandoIds]   = useState(new Map());

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    cargarDatos();
  }, []);

  /**
   * cargarDatos — obtiene el perfil del usuario y los eventos de su ciudad.
   * Si no hay ciudad, carga todos los eventos.
   * Si el backend falla o no devuelve eventos, usa EVENTOS_DEMO como fallback.
   */
  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Obtener datos del usuario (ciudad + mascota activa)
      let ciudadUsuario = null;
      let datosHome     = null;

      try {
        datosHome = await fetchHome();
        setHomeData(datosHome);
        ciudadUsuario =
          datosHome?.usuario?.ubicacion ||
          datosHome?.usuario?.ciudad    ||
          null;
        setCiudad(ciudadUsuario);
      } catch {
        // Si fetchHome falla, seguimos sin ciudad
      }

      // 2. Cargar eventos con (o sin) filtro de ciudad
      let eventosData = [];
      try {
        const data = await fetchEventos(ciudadUsuario);
        eventosData = data.eventos ?? [];
      } catch {
        // Backend no disponible — usar datos de demo
        eventosData = [];
      }

      // Fallback a datos de demo si el backend no devuelve nada
      const eventosFinales = eventosData.length > 0 ? eventosData : EVENTOS_DEMO;

      setEventos(eventosFinales);

      // Inicializar los eventos ya agregados al calendario
      const yaAgregados = new Set(
        eventosFinales
          .filter((e) => e.ya_en_calendario)
          .map((e) => e.id),
      );
      setEventosAgregados(yaAgregados);
    } catch (error) {
      console.error('Error al cargar eventos:', error);

      // 403 → token inválido → ir a Login
      if (error?.response?.status === 403) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // En caso de error total, mostrar demo igual
      setEventos(EVENTOS_DEMO);
      const yaAgregados = new Set(
        EVENTOS_DEMO.filter((e) => e.ya_en_calendario).map((e) => e.id),
      );
      setEventosAgregados(yaAgregados);
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle descripción expandida ─────────────────────────────
  const toggleDescripcion = useCallback((eventoId) => {
    setDescripcionExpandida((prev) => {
      const next = new Set(prev);
      if (next.has(eventoId)) {
        next.delete(eventoId);
      } else {
        next.add(eventoId);
      }
      return next;
    });
  }, []);

  // ── Agregar al calendario ─────────────────────────────────────
  const agregarAlCalendario = useCallback(
    async (evento) => {
      // Guardia: ya agregado
      if (eventosAgregados.has(evento.id)) return;

      // Guardia: sin mascota activa
      const petId = homeData?.mascotaActiva?.id;

      // Marcar como procesando
      setProcesandoIds((prev) => new Map(prev).set(evento.id, true));

      try {
        // Si no hay petId (modo demo / sin backend), simular éxito localmente
        if (petId) {
          await agregarEventoAlCalendario(petId, {
            titulo:      evento.titulo,
            descripcion: evento.descripcion
              ? `${evento.descripcion}\n📍 ${evento.ubicacion_nombre}`
              : `📍 ${evento.ubicacion_nombre}`,
            fecha_hora:  new Date(evento.fecha_hora).toISOString(),
            tipo:        'Evento',
          });
        }

        // Actualizar estado local: agregar al Set
        setEventosAgregados((prev) => new Set(prev).add(evento.id));
      } catch (error) {
        console.error('Error al agregar al calendario:', error);

        if (error?.response?.status === 403) {
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }

        const mensaje =
          error?.message === 'Network Error'
            ? 'Sin conexión. Verificá tu internet e intentá de nuevo.'
            : 'No se pudo agregar al calendario. Intentá de nuevo.';

        Alert.alert('Error', mensaje);
      } finally {
        setProcesandoIds((prev) => {
          const next = new Map(prev);
          next.delete(evento.id);
          return next;
        });
      }
    },
    [eventosAgregados, homeData, navigation],
  );

  // ── Indicador de ciudad ───────────────────────────────────────
  const textoIndicadorCiudad = ciudad
    ? `📍 Eventos en ${ciudad}`
    : '📍 Eventos cerca tuyo';

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#C8F0D8" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.hamburger}
          onPress={() => setDrawerVisible(true)}
          accessibilityLabel="Abrir menú"
          accessibilityRole="button"
        >
          <Ionicons name="menu-outline" size={26} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      {/* ── TÍTULO Y SUBTÍTULO ── */}
      <View style={styles.tituloContainer}>
        <Text style={styles.titulo}>🎉 Eventos</Text>
        <Text style={styles.subtitulo}>
          Actividades y jornadas para vos y tu mascota
        </Text>
        <Text style={styles.indicadorCiudad}>{textoIndicadorCiudad}</Text>
      </View>

      {/* ── CONTENIDO PRINCIPAL ── */}
      {loading ? (
        /* Skeleton loaders */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : eventos.length === 0 ? (
        /* Estado vacío */
        <View style={styles.emptyContainer}>
          <Ionicons name="storefront-outline" size={60} color="#AAAAAA" />
          <Text style={styles.emptyTitulo}>No hay eventos por ahora</Text>
          <Text style={styles.emptySubtexto}>
            Cuando haya actividades cerca tuyo, las vas a ver acá 🐾
          </Text>
        </View>
      ) : (
        /* Lista de eventos */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {eventos.map((evento) => (
            <EventoCard
              key={evento.id}
              evento={evento}
              yaAgregado={eventosAgregados.has(evento.id)}
              expandido={descripcionExpandida.has(evento.id)}
              onToggleDescripcion={toggleDescripcion}
              onAgregarAlCalendario={agregarAlCalendario}
              procesando={procesandoIds.get(evento.id) === true}
            />
          ))}
        </ScrollView>
      )}

      {/* ── DRAWER ── */}
      <HamburgerDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        usuario={homeData?.usuario}
        mascotaActiva={homeData?.mascotaActiva}
        activeRoute="Eventos"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Raíz ──────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: '#C8F0D8',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  hamburger: {
    padding: 12,
  },

  // ── Título y subtítulo ────────────────────────────────────
  tituloContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 8,
  },
  indicadorCiudad: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
  },

  // ── ScrollView ────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 32,
  },

  // ── Card de evento ────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden', // CRÍTICO: hace que la foto respete el borderRadius
  },

  // ── Foto ──────────────────────────────────────────────────
  fotoContainer: {
    position: 'relative',
  },
  fotoEvento: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  fotoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pill de categoría sobre la foto
  pillCategoria: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#2DBD72',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pillCategoriaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Contenido del card ────────────────────────────────────
  cardContenido: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  // Título del evento
  eventoTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 12,
  },

  // Fila fecha + hora
  filaFechaHora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipTexto: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2C2C2C',
  },

  // Pill de ubicación
  pillUbicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  pillUbicacionTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#2DBD72',
  },

  // Descripción
  descripcionContainer: {
    marginBottom: 16,
  },
  descripcionTexto: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    lineHeight: 22,
  },
  verMasTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2DBD72',
    marginTop: 4,
  },

  // Pill del organizador
  pillOrganizador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
    width: '100%',
  },
  pillOrganizadorTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#6B6B6B',
  },

  // Botón Agregar al calendario
  btnAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    height: 48,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  btnAgregarDeshabilitado: {
    shadowOpacity: 0,
    elevation: 0,
  },
  btnAgregarTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Estado vacío ──────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtexto: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 6,
  },

  // ── Skeleton ──────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  skeletonFoto: {
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  skeletonTitulo: {
    height: 20,
    width: '70%',
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    marginTop: 14,
    marginHorizontal: 16,
  },
  skeletonFecha: {
    height: 14,
    width: '50%',
    backgroundColor: '#EBEBEB',
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 16,
  },
  skeletonDescripcion: {
    height: 60,
    backgroundColor: '#EBEBEB',
    borderRadius: 6,
    marginTop: 12,
    marginHorizontal: 16,
  },
});
