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
  ImageBackground,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
  Animated,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { fetchHome, fetchEventos } from '../services/api';
import HamburgerDrawer from '../components/HamburgerDrawer';
import SelectorMascota from '../components/SelectorMascota';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { fetchMisMascotas } from '../services/petsApi';
import { haySesion } from '../config/session';
import {
  agregarEventoCalendario,
  getEventosCalendario,
} from '../services/calendarioStore';

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
  const [refreshing, setRefreshing]         = useState(false);
  const [ciudad, setCiudad]                 = useState(null);
  // Mascotas del usuario y a cuál se le agregan los eventos. Con más de una,
  // el evento tiene que poder ir al calendario de la que el usuario elija — no
  // siempre a la activa (el calendario es por mascota, ver CalendarioScreen).
  const [mascotas, setMascotas]             = useState([]);
  const [mascotaSel, setMascotaSel]         = useState(null);
  // Set de IDs de eventos ya agregados al calendario DE LA MASCOTA ELEGIDA
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
   * sincronizarAgregados — el estado de "ya agregado" se deriva del
   * calendario compartido (calendarioStore), no de un flag local fijo.
   * Así, si el usuario elimina el evento desde CalendarioScreen, acá vuelve
   * a aparecer disponible para agregar. Se llama al cargar y cada vez que
   * la pantalla recupera el foco (por ejemplo, al volver de Calendario).
   *
   * Se consulta el calendario de la mascota ELEGIDA: un evento puede estar
   * agregado para una mascota y no para otra, y el botón tiene que reflejar
   * la que se está viendo.
   */
  const sincronizarAgregados = useCallback(async (petIdActual) => {
    if (!petIdActual) { setEventosAgregados(new Set()); return; }

    const guardados = await getEventosCalendario(petIdActual, []);
    setEventosAgregados(new Set(
      guardados.filter((e) => e.origen === 'eventos').map((e) => e.origenId),
    ));
  }, []);

  // Mascotas del usuario, para poder elegir a cuál se le agrega cada evento.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!haySesion()) return;
      try {
        const { activas } = await fetchMisMascotas();
        if (cancelado) return;
        setMascotas(activas);
        // Preselección: la activa del usuario, si no la primera.
        setMascotaSel((actual) => actual
          ?? activas.find((m) => m.id === homeData?.mascotaActiva?.id)?.id
          ?? activas[0]?.id
          ?? null);
      } catch {
        // Sin la lista, la pantalla sigue funcionando con la mascota activa.
        if (!cancelado) setMascotaSel((actual) => actual ?? homeData?.mascotaActiva?.id ?? null);
      }
    })();
    return () => { cancelado = true; };
  }, [homeData?.mascotaActiva?.id]);

  /*
    Acá había además un "sembrado inicial" que copiaba solo al calendario todos
    los eventos con `ya_en_calendario: true`. Se eliminó por dos motivos:

      · agregaba eventos que el usuario nunca agregó — de ahí que Eventos
        mostrara "✓ Agregado al calendario" sin haber tocado nada;
      · corría desde dos lados (la carga inicial y este efecto de foco) sin
        coordinarse, así que las dos pasadas insertaban lo mismo antes de que
        ninguna marcara el sembrado como hecho: los eventos salían duplicados.

    El estado "ya agregado" ahora se deriva únicamente del calendario real.
  */
  useFocusEffect(
    useCallback(() => {
      sincronizarAgregados(mascotaSel);
    }, [mascotaSel, sincronizarAgregados]),
  );

  // Al cambiar de mascota hay que releer SU calendario: lo agregado para una no
  // vale para la otra. useFocusEffect ya cubre esto mientras la pantalla está
  // enfocada, que es el único momento en que el selector se puede tocar.

  /**
   * cargarDatos — obtiene el perfil del usuario y los eventos de su ciudad.
   *
   * El filtro por ciudad es EXACTO (`.eq('ciudad', ...)`), y la ubicación que
   * carga el usuario nunca coincide letra por letra con la del evento: los
   * eventos dicen "Buenos Aires" y los usuarios escriben "CABA, Buenos Aires",
   * "Almagro, Caba", "Caballito, Capital federal"… Con ese filtro la consulta
   * devolvía 0 filas para casi todos y la pantalla caía a EVENTOS_DEMO.
   *
   * Eso era lo que rompía la relación con el Calendario: los eventos de demo
   * llevan ids 1..4 que CHOCAN con los ids reales de la tabla `eventos`, así
   * que un evento de demo se veía como "✓ Agregado al calendario" solo porque
   * el usuario tenía guardado el evento REAL con ese mismo id, y agregar los
   * de demo que no existen en la base (3 y 4) fallaba contra la foreign key.
   *
   * Ahora: si el filtro por ciudad no trae nada, se reintenta SIN filtro (los
   * eventos son pocos y de alcance nacional). Los datos de demo quedan solo
   * para la vista previa sin sesión — con sesión iniciada nunca se muestran
   * eventos inventados, igual que en CalendarioScreen y FichaMedicaScreen.
   */
  async function cargarDatos(silencioso = false) {
    if (!silencioso) setLoading(true);
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
        // Sin resultados por ciudad, mostrar todos antes que no mostrar nada:
        // es preferible un evento de otra ciudad —que además dice dónde es— a
        // una pantalla vacía o, peor, a eventos inventados.
        if (eventosData.length === 0 && ciudadUsuario) {
          const todos = await fetchEventos(null);
          eventosData = todos.eventos ?? [];
        }
      } catch {
        // Backend no disponible
        eventosData = [];
      }

      // Los eventos de demo son solo para la vista previa sin login: sus ids no
      // existen en la base y no se pueden agregar a un calendario real.
      const eventosFinales = eventosData.length > 0
        ? eventosData
        : (haySesion() ? [] : EVENTOS_DEMO);

      setEventos(eventosFinales);
      // La mascota elegida manda; en el primer render todavía no está resuelta
      // y se cae a la activa (el efecto de foco vuelve a sincronizar apenas el
      // selector queda listo).
      await sincronizarAgregados(mascotaSel ?? datosHome?.mascotaActiva?.id);
    } catch (error) {
      console.error('Error al cargar eventos:', error);

      // 403 → token inválido → ir a Login
      if (error?.response?.status === 403) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // Con sesión, antes una lista vacía que eventos inventados que después no
      // se pueden agregar al calendario (ver el comentario de cargarDatos).
      setEventos(haySesion() ? [] : EVENTOS_DEMO);
      await sincronizarAgregados(undefined);
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

      // El evento va al calendario de la mascota ELEGIDA en el selector.
      const petId = mascotaSel ?? homeData?.mascotaActiva?.id;

      // Marcar como procesando
      setProcesandoIds((prev) => new Map(prev).set(evento.id, true));

      if (!petId) {
        Alert.alert('Sin mascota', 'Agregá una mascota para poder guardar eventos en su calendario.');
        setProcesandoIds((prev) => { const next = new Map(prev); next.delete(evento.id); return next; });
        return;
      }

      try {
        const payload = {
          titulo:      evento.titulo,
          descripcion: evento.descripcion
            ? `${evento.descripcion}\n📍 ${evento.ubicacion_nombre}`
            : `📍 ${evento.ubicacion_nombre}`,
          fecha_hora:  new Date(evento.fecha_hora).toISOString(),
          tipo:        'Evento',
          origenId:    evento.id,
          emoji:       '🎉',
          color:       '#9B59B6',
        };

        await agregarEventoCalendario(petId, payload);

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
    [eventosAgregados, homeData, mascotaSel, navigation],
  );

  // Nombre de la mascota elegida, para dejar claro a dónde va lo que se agrega.
  const nombreMascotaSel = mascotas.find((m) => m.id === mascotaSel)?.nombre ?? null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
        resizeMode="cover"
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setDrawerVisible(true)}
            accessibilityLabel="Abrir menú"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={30} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        {/* ── TÍTULO ── */}
        <View style={styles.tituloContainer}>
          <Text style={styles.titulo}>🎉 Eventos</Text>
          {mascotas.length > 1 && nombreMascotaSel && (
            <Text style={styles.subtitulo}>
              Se agregan al calendario de {nombreMascotaSel}
            </Text>
          )}
        </View>

        {/* Selector de mascota: cada una tiene su propio calendario, así que hay
            que poder elegir a cuál va el evento. Con una sola no se muestra.

            Sin fondo detrás de la tira: las pastillas van sueltas sobre el fondo
            de la pantalla. Son opacas, así que se leen igual cuando la lista
            pasa por atrás al desplazarse. */}
        <SelectorMascota
          mascotas={mascotas}
          valor={mascotaSel}
          onCambiar={setMascotaSel}
          style={{ marginBottom: 10 }}
        />

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await cargarDatos(true);
                  setRefreshing(false);
                }}
                colors={['#2DBD72']} tintColor="#2DBD72"
              />
            }
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
      </ImageBackground>

      {/* ── DRAWER ── */}
      <HamburgerDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        usuario={homeData?.usuario ?? null}
        mascotaActiva={homeData?.mascotaActiva ?? null}
        activeRoute="Eventos"
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Raíz — mismo fondo e igual estructura de header que Home ──
  safeArea: { flex: 1, backgroundColor: '#D4F5E2' },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },

  // ── Header ────────────────────────────────────────────────
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
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
