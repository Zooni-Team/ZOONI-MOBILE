/**
 * CalendarioScreen.jsx — Pantalla "Calendario de Cuidados" de Zooni
 *
 * Navega desde FichaMedicaScreen o desde el drawer con { petId } opcional
 * (si no viene, usa la mascota activa del usuario).
 * Lista los eventos programados de la mascota (turnos, paseos, medicación, etc.)
 * coloreados según la proximidad de su fecha, con alta/edición/baja vía FAB.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
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
import { useFocusEffect, useRoute } from '@react-navigation/native';

import { getColorByProximidad, getTextoDias } from '../utils/colorProximidad';
import HamburgerDrawer from '../components/HamburgerDrawer';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { haySesion } from '../config/session';
import { fetchMisMascotas } from '../services/petsApi';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import FechaPicker from '../components/FechaPicker';
import HoraPicker from '../components/HoraPicker';
import {
  getEventosCalendario,
  crearEventoCalendario,
  actualizarEventoCalendario,
  eliminarEventoCalendario,
} from '../services/calendarioStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIPOS = ['Vacuna', 'Turno Veterinario', 'Desparasitación', 'Peluquería', 'Paseo', 'Medicación', 'Control', 'Otro'];

// Referencia visual opcional del evento: emoji + color, para diferenciarlo a simple vista.
const EMOJIS = ['🐾', '💉', '🚶', '🛁', '💊', '🩺', '✂️', '🎉', '📌', '❤️'];
const COLORES = ['#2DBD72', '#5BC8D0', '#F5A623', '#E63946', '#9B59B6', '#3498DB'];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Date → "DD/MM/YYYY HH:MM" */
function formatFechaHora(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function combinarFechaHora(fecha, hora) {
  const d = new Date(fecha);
  d.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
  return d;
}

/** Alert.alert no muestra nada en react-native-web (es un no-op) → fallback a window.confirm. */
function confirmarAccion(titulo, mensaje, onConfirmar) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onConfirmar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: onConfirmar },
  ]);
}

// ─── COMPONENTE: SKELETON ─────────────────────────────────────────────────────

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return <Animated.View style={[s.skeletonCard, { opacity }]} />;
}

// ─── COMPONENTE: TOAST ────────────────────────────────────────────────────────

function Toast({ visible, mensaje, color }) {
  const translateY = useRef(new Animated.Value(-12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: visible ? 0 : -12, duration: visible ? 220 : 200, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: visible ? 1 : 0,   duration: visible ? 220 : 200, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, opacity]);

  return (
    <Animated.View style={[s.toast, { backgroundColor: color, opacity, transform: [{ translateY }] }]}>
      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
      <Text style={s.toastTxt}>{mensaje}</Text>
    </Animated.View>
  );
}

// ─── COMPONENTE: CARD EVENTO ───────────────────────────────────────────────────

function EventoCard({ evento, index, onEditar, onEliminar, onVerDetalle }) {
  const esEditable = evento.origen !== 'eventos';
  const translateY = useRef(new Animated.Value(14)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 70, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const color   = getColorByProximidad(evento.fecha_hora);
  const texto   = getTextoDias(evento.fecha_hora);

  // Evita que el tap en los íconos de editar/eliminar además dispare la
  // apertura del detalle (el evento de click burbujea hacia el Pressable padre).
  const detener = (fn) => (e) => { e?.stopPropagation?.(); fn(); };

  return (
    <Animated.View style={[s.card, { transform: [{ translateY }], opacity }]}>
      <View style={[s.cardBorde, { backgroundColor: color }]} />

      <Pressable onPress={() => onVerDetalle(evento)} accessibilityLabel={`Ver detalle de ${evento.titulo}`}>
        <View style={s.cardFila1}>
          <View style={s.cardTituloRow}>
            {!!evento.emoji && (
              <View style={[s.cardBadge, evento.color && { backgroundColor: `${evento.color}22` }]}>
                <Text style={s.cardBadgeTxt}>{evento.emoji}</Text>
              </View>
            )}
            <Text style={s.cardTitulo} numberOfLines={2}>{evento.titulo}</Text>
          </View>
          <View style={s.cardAcciones}>
            {esEditable && (
              <TouchableOpacity onPress={detener(() => onEditar(evento))} accessibilityLabel="Editar evento"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={22} color="#F5A623" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={detener(() => onEliminar(evento.id))} accessibilityLabel="Eliminar evento"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.cardFila2}>
          <Text style={[s.cardTipo, { color }]}>{evento.tipo}</Text>
          <View style={[s.badgeDias, { backgroundColor: `${color}22` }]}>
            <Text style={[s.badgeDiasTxt, { color }]}>{texto}</Text>
          </View>
        </View>

        <Text style={s.cardFecha}>{formatFechaHora(evento.fecha_hora)}</Text>

        {!!evento.descripcion && (
          <Text style={s.cardDescripcion} numberOfLines={2} ellipsizeMode="tail">{evento.descripcion}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── COMPONENTE: MODAL DETALLE DE EVENTO ─────────────────────────────────────

function EventoDetalleModal({ visible, evento, onCerrar }) {
  if (!evento) return null;

  const color = getColorByProximidad(evento.fecha_hora);
  const texto = getTextoDias(evento.fecha_hora);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <TouchableOpacity style={dt.overlay} activeOpacity={1} onPress={onCerrar}>
        <TouchableOpacity activeOpacity={1} style={dt.card}>
          <View style={[dt.borde, { backgroundColor: color }]} />

          <View style={dt.headerRow}>
            <View style={dt.tituloRow}>
              {!!evento.emoji && (
                <View style={[dt.badge, evento.color && { backgroundColor: `${evento.color}22` }]}>
                  <Text style={dt.badgeTxt}>{evento.emoji}</Text>
                </View>
              )}
              <Text style={dt.titulo}>{evento.titulo}</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar detalle"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={dt.scroll}>
            <View style={dt.filaTipo}>
              <Text style={[dt.tipo, { color }]}>{evento.tipo}</Text>
              <View style={[dt.badgeDias, { backgroundColor: `${color}22` }]}>
                <Text style={[dt.badgeDiasTxt, { color }]}>{texto}</Text>
              </View>
            </View>

            <View style={dt.filaFecha}>
              <Ionicons name="calendar-outline" size={16} color="#6B6B6B" />
              <Text style={dt.fecha}>{formatFechaHora(evento.fecha_hora)}</Text>
            </View>

            {!!evento.descripcion && (
              <Text style={dt.descripcion}>{evento.descripcion}</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={dt.btnCerrar} onPress={onCerrar}>
            <Text style={dt.btnCerrarTxt}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, width: '100%', maxWidth: 380, maxHeight: '80%',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
    overflow: 'hidden',
  },
  borde: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingLeft: 6 },
  tituloRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 19 },
  titulo: { flex: 1, fontSize: 19, fontWeight: '800', color: '#2C2C2C' },
  scroll: { paddingLeft: 6 },
  filaTipo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tipo: { fontSize: 14, fontWeight: '700' },
  badgeDias: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  badgeDiasTxt: { fontSize: 12, fontWeight: '700' },
  filaFecha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  fecha: { fontSize: 14, color: '#6B6B6B' },
  descripcion: { fontSize: 14, color: '#2C2C2C', lineHeight: 21 },
  btnCerrar: {
    marginTop: 16, width: '100%', height: 44, borderRadius: 30,
    backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center',
  },
  btnCerrarTxt: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
});

// ─── COMPONENTE: SELECTOR DE TIPO (dropdown propio) ──────────────────────────

function TipoPicker({ visible, valor, onSeleccionar, onCerrar }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <TouchableOpacity style={tp.overlay} activeOpacity={1} onPress={onCerrar}>
        <View style={tp.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {TIPOS.map((t) => (
              <TouchableOpacity key={t} style={[tp.item, valor === t && tp.itemOn]} onPress={() => onSeleccionar(t)}>
                <Text style={[tp.itemTxt, valor === t && tp.itemTxtOn]}>{t}</Text>
                {valor === t && <Ionicons name="checkmark" size={16} color="#2DBD72" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const tp = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#FFF', borderRadius: 16, width: '75%', maxHeight: '60%', paddingVertical: 8 },
  item:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18 },
  itemOn:    { backgroundColor: '#F0FFF6' },
  itemTxt:   { fontSize: 15, color: '#2C2C2C' },
  itemTxtOn: { color: '#2DBD72', fontWeight: '700' },
});

// ─── DATOS DEMO (sin backend de calendario conectado) ────────────────────────

const DEMO_EVENTOS = [
  {
    id: 1,
    origen: 'manual',
    titulo: 'Veterinario',
    descripcion: 'Veterinario para Titán',
    fecha_hora: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    tipo: 'Turno Veterinario',
    emoji: '🩺',
    color: '#5BC8D0',
  },
];

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function CalendarioScreen() {
  const route = useRoute();
  const petId = route.params?.petId;

  const { usuario, mascotaActiva } = useUsuarioActivo();

  const [eventos, setEventos] = useState([]);
  // Mascota cuyo calendario se está viendo, y a la que se asignan los eventos
  // nuevos. Con varias mascotas, cada una tiene su propio calendario.
  const [mascotas,   setMascotas]   = useState([]);
  const [mascotaSel, setMascotaSel] = useState(petId ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [modalVisible,     setModalVisible]     = useState(false);
  const [modalModo,        setModalModo]        = useState('añadir'); // 'añadir' | 'editar'
  const [eventoEnEdicion,  setEventoEnEdicion]  = useState(null);

  const [detalleVisible, setDetalleVisible] = useState(false);
  const [eventoDetalle,  setEventoDetalle]  = useState(null);

  const [formTitulo,      setFormTitulo]      = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFechaHora,   setFormFechaHora]   = useState(null);
  const [formTipo,        setFormTipo]        = useState('Vacuna');
  const [formEmoji,       setFormEmoji]       = useState(null);
  const [formColor,       setFormColor]       = useState(null);
  const [formErrors,      setFormErrors]      = useState({});
  // Mascota a la que se asigna el evento que se esta creando/editando
  const [formMascota,     setFormMascota]     = useState(null);

  const [guardando,       setGuardando]       = useState(false);
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [showTimePicker,  setShowTimePicker]  = useState(false);
  const [showTipoPicker,  setShowTipoPicker]  = useState(false);
  const [fechaTemporal,   setFechaTemporal]   = useState(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastColor,   setToastColor]   = useState('#2DBD72');
  const toastTimer = useRef(null);

  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const tieneEventos = eventos.length > 0;
  const fabScale = useRef(new Animated.Value(0.5)).current;
  const fabFade  = useRef(new Animated.Value(0)).current;

  // ── Carga inicial ────────────────────────────────────────────────────────
  // Sin backend de calendario conectado todavía: los eventos se leen de un
  // almacenamiento local compartido con EventosScreen (ver calendarioStore.js),
  // que se reemplaza por la API real cuando se conecte la base de datos.
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    // Sin fallback a eventos de demo: mostraban un "Veterinario para Titán"
    // inventado en el calendario del usuario. Sin datos, la lista va vacía.
    const guardados = mascotaSel ? await getEventosCalendario(mascotaSel, []) : [];
    setEventos(guardados.slice().sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)));
    setLoading(false);
  }, [mascotaSel]);

  // Mascotas del usuario, para poder elegir de quién es cada evento.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!haySesion()) return;
      try {
        const { activas } = await fetchMisMascotas();
        if (cancelado) return;
        setMascotas(activas);
        // Preselección: la que vino por parámetro, si no la activa, si no la primera.
        setMascotaSel((actual) => actual
          ?? petId
          ?? (activas.find((m) => m.id === mascotaActiva?.id)?.id)
          ?? activas[0]?.id
          ?? null);
      } catch {
        // Sin la lista, el calendario sigue funcionando con la mascota activa.
        if (!cancelado) setMascotaSel((actual) => actual ?? petId ?? mascotaActiva?.id ?? null);
      }
    })();
    return () => { cancelado = true; };
  }, [petId, mascotaActiva?.id]);

  // Recarga cada vez que la pantalla vuelve a estar en foco (por ejemplo, al
  // volver de Eventos después de agregar uno al calendario).
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar(true);
    setRefreshing(false);
  }, [cargar]);

  // ── Aparición del FAB (una sola vez, al terminar de cargar) ────────────────
  useEffect(() => {
    if (loading) return;
    Animated.parallel([
      Animated.timing(fabScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(fabFade,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [loading, fabScale, fabFade]);

  // ── Toast ────────────────────────────────────────────────────────────────
  function mostrarToast(mensaje, color = '#2DBD72') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMensaje(mensaje);
    setToastColor(color);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function abrirModalAnadir() {
    setFormTitulo(''); setFormDescripcion(''); setFormFechaHora(null);
    setFormTipo('Vacuna'); setFormEmoji(null); setFormColor(null); setFormErrors({});
    setFormMascota(mascotaSel);
    setEventoEnEdicion(null);
    setModalModo('añadir');
    abrirModal();
  }

  function abrirModalEditar(evento) {
    setFormTitulo(evento.titulo);
    setFormDescripcion(evento.descripcion ?? '');
    setFormFechaHora(new Date(evento.fecha_hora));
    setFormTipo(evento.tipo ?? 'Vacuna');
    setFormEmoji(evento.emoji ?? null);
    setFormColor(evento.color ?? null);
    setFormErrors({});
    setFormMascota(evento.mascotaId ?? mascotaSel);
    setEventoEnEdicion(evento);
    setModalModo('editar');
    abrirModal();
  }

  // ── Detalle (ver evento completo) ───────────────────────────────────────
  function abrirDetalle(evento) {
    setEventoDetalle(evento);
    setDetalleVisible(true);
  }

  function cerrarDetalle() {
    setDetalleVisible(false);
  }

  function abrirModal() {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(modalScale,   { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function cerrarModal() {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(modalScale,   { toValue: 0.92, duration: 160, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0,    duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
      setTimeout(() => setFormErrors({}), 200);
    });
  }

  // ── Selección de fecha + hora (dos pasos) ──────────────────────────────────
  function onFechaConfirmada(date) {
    setFechaTemporal(date);
    setShowDatePicker(false);
    setTimeout(() => setShowTimePicker(true), 300);
  }

  function onHoraConfirmada(hora) {
    setFormFechaHora(combinarFechaHora(fechaTemporal, hora));
    setShowTimePicker(false);
    if (formErrors.fechaHora) setFormErrors((p) => ({ ...p, fechaHora: null }));
  }

  // ── Guardar (añadir / editar) ───────────────────────────────────────────────
  async function guardarEvento() {
    const errors = {};
    if (!formTitulo.trim()) errors.titulo    = 'Este campo es requerido';
    if (!formFechaHora)     errors.fechaHora = 'Seleccioná fecha y hora';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    // El evento va a la mascota elegida en el modal, no siempre a la activa.
    const idMascota = formMascota ?? mascotaSel;
    if (!idMascota) {
      mostrarToast('Elegí una mascota para el evento', '#E63946');
      return;
    }
    setGuardando(true);

    try {
      const datos = {
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim() || null,
        fecha_hora: formFechaHora.toISOString(),
        tipo: formTipo,
        emoji: formEmoji,
        color: formColor,
      };

      if (modalModo === 'añadir') {
        const nuevo = await crearEventoCalendario(idMascota, datos);
        // Si se asignó a OTRA mascota, el evento no va en la lista que se está
        // viendo: se cambia a su calendario para que el usuario vea que quedó.
        if (idMascota !== mascotaSel) {
          setMascotaSel(idMascota);
        } else {
          setEventos([...eventos, nuevo].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)));
        }
        cerrarModal();
        mostrarToast('Evento registrado correctamente', '#2DBD72');
      } else {
        const editado = await actualizarEventoCalendario(eventoEnEdicion.id, datos);
        const actualizados = eventos
          .map((e) => (e.id === eventoEnEdicion.id ? editado : e))
          .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        setEventos(actualizados);
        cerrarModal();
        mostrarToast('Evento actualizado correctamente', '#2DBD72');
      }
    } catch {
      mostrarToast('No se pudo guardar el evento', '#E63946');
    } finally {
      setGuardando(false);
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  function eliminarEvento(eventoId) {
    confirmarAccion(
      '¿Eliminar evento?',
      '¿Seguro que querés eliminar este evento? Esta acción no se puede deshacer.',
      () => confirmarEliminar(eventoId),
    );
  }

  async function confirmarEliminar(eventoId) {
    try {
      await eliminarEventoCalendario(eventoId);
      setEventos((prev) => prev.filter((e) => e.id !== eventoId));
      mostrarToast('Evento eliminado', '#E63946');
    } catch {
      mostrarToast('No se pudo eliminar el evento', '#E63946');
    }
  }

  const tituloModal = modalModo === 'editar' ? 'Editar evento' : 'Nuevo evento';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Toast visible={toastVisible} mensaje={toastMensaje} color={toastColor} />

      <ImageBackground source={HOME_BACKGROUND} style={s.screenBg} imageStyle={s.screenBgImage} resizeMode="cover">

        {/* Header mínimo */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={s.headerBtn}
            accessibilityLabel="Abrir menú" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="menu" size={30} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        <Text style={s.titulo}>Calendario de Cuidados</Text>

        {/* Selector de mascota: cada una tiene su propio calendario. Con una
            sola mascota no se muestra, para no agregar ruido. */}
        {mascotas.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.petTabs} contentContainerStyle={s.petTabsContent}>
            {mascotas.map((mx) => (
              <TouchableOpacity
                key={mx.id}
                style={[s.petTab, mascotaSel === mx.id && s.petTabOn]}
                onPress={() => setMascotaSel(mx.id)}
                accessibilityLabel={`Ver el calendario de ${mx.nombre}`}
              >
                <Text style={[s.petTabTxt, mascotaSel === mx.id && s.petTabTxtOn]} numberOfLines={1}>
                  {mx.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={['#2DBD72']} tintColor="#2DBD72" />
          }>

          {loading ? (
            <View><SkeletonCard /><SkeletonCard /></View>
          ) : eventos.length === 0 ? (
            <Text style={s.emptyTxt}>
              {mascotaSel
                ? 'No hay eventos programados.'
                : 'Agregá una mascota para empezar a usar el calendario.'}
            </Text>
          ) : (
            eventos.map((evento, i) => (
              <EventoCard key={evento.id} evento={evento} index={i}
                onEditar={abrirModalEditar} onEliminar={eliminarEvento} onVerDetalle={abrirDetalle} />
            ))
          )}

        </ScrollView>

        <Animated.View style={[
          s.fab,
          tieneEventos ? s.fabCorner : s.fabCentro,
          { opacity: fabFade, transform: [{ scale: fabScale }] },
        ]}>
          <Pressable style={s.fabBtn} onPress={abrirModalAnadir} accessibilityLabel="Añadir evento">
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </ImageBackground>

      {/* ── MODAL AÑADIR / EDITAR ── */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={cerrarModal}>
            <TouchableOpacity activeOpacity={1}>
              <Animated.View style={[s.modalCard, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                  <Text style={s.modalTitulo}>{tituloModal}</Text>

                  {/* Título */}
                  <TextInput
                    style={[s.input, formErrors.titulo && s.inputError]}
                    placeholder="Título del evento"
                    placeholderTextColor="#AAAAAA"
                    value={formTitulo}
                    onChangeText={(v) => { setFormTitulo(v); if (formErrors.titulo) setFormErrors((p) => ({ ...p, titulo: null })); }}
                    returnKeyType="next"
                  />
                  {formErrors.titulo && <Text style={s.errorTxt}>{formErrors.titulo}</Text>}

                  {/* Descripción */}
                  <TextInput
                    style={[s.input, s.inputMulti]}
                    placeholder="Descripción opcional"
                    placeholderTextColor="#AAAAAA"
                    value={formDescripcion}
                    onChangeText={setFormDescripcion}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {/* Fecha y hora */}
                  <TouchableOpacity
                    style={[s.inputFecha, formErrors.fechaHora && s.inputError]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formFechaHora && { color: '#AAAAAA' }]}>
                      {formFechaHora ? formatFechaHora(formFechaHora) : 'dd/mm/aaaa --:--'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#6B6B6B" />
                  </TouchableOpacity>
                  {formErrors.fechaHora && <Text style={s.errorTxt}>{formErrors.fechaHora}</Text>}

                  {/* Tipo */}
                  <TouchableOpacity style={s.inputFecha} onPress={() => setShowTipoPicker(true)}>
                    <Text style={s.inputFechaTxt}>{formTipo}</Text>
                    <Ionicons name="chevron-down" size={16} color="#6B6B6B" />
                  </TouchableOpacity>

                  {/* Referencia visual: emoji + color (opcional) */}
                  <Text style={s.pickerLabel}>Referencia (opcional)</Text>
                  <View style={s.emojiRow}>
                    {EMOJIS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[s.emojiChip, formEmoji === e && s.emojiChipOn]}
                        onPress={() => setFormEmoji((prev) => (prev === e ? null : e))}
                        accessibilityLabel={`Usar emoji ${e}`}
                      >
                        <Text style={s.emojiChipTxt}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={s.colorRow}>
                    {COLORES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[s.colorSwatch, { backgroundColor: c }, formColor === c && s.colorSwatchOn]}
                        onPress={() => setFormColor((prev) => (prev === c ? null : c))}
                        accessibilityLabel={`Usar color ${c}`}
                      />
                    ))}
                  </View>

                  {/* Mascota a la que pertenece el evento */}
                  {mascotas.length > 1 && (
                    <>
                      <Text style={s.pickerLabel}>¿Para qué mascota?</Text>
                      <View style={s.petPickRow}>
                        {mascotas.map((mx) => (
                          <TouchableOpacity
                            key={mx.id}
                            style={[s.petPick, formMascota === mx.id && s.petPickOn]}
                            onPress={() => setFormMascota(mx.id)}
                            accessibilityLabel={`Asignar el evento a ${mx.nombre}`}
                          >
                            <Text style={[s.petPickTxt, formMascota === mx.id && s.petPickTxtOn]}
                              numberOfLines={1}>
                              {mx.nombre}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                </ScrollView>

                {/*
                  Los botones van FUERA del ScrollView, en un pie fijo: adentro
                  quedaban debajo del contenido y en pantallas chicas había que
                  scrollear para llegar a "Cancelar" — que ni siquiera se
                  intuía que estuviera ahí. Cancelar a la izquierda y más
                  angosto: la acción principal es guardar.
                */}
                <View style={s.modalPie}>
                  <TouchableOpacity style={s.btnCancelar} onPress={cerrarModal} disabled={guardando}>
                    <Text style={s.btnCancelarTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnGuardar} onPress={guardarEvento} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={s.btnGuardarTxt}>{modalModo === 'editar' ? 'Guardar cambios' : 'Guardar'}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <FechaPicker
        visible={showDatePicker}
        titulo="Fecha del evento"
        valor={fechaTemporal ?? formFechaHora}
        aniosAtras={1}
        aniosAdelante={6}
        onConfirmar={onFechaConfirmada}
        onCancelar={() => setShowDatePicker(false)}
      />

      <HoraPicker
        visible={showTimePicker}
        valor={formFechaHora}
        onConfirmar={onHoraConfirmada}
        onCancelar={() => setShowTimePicker(false)}
      />

      <TipoPicker
        visible={showTipoPicker}
        valor={formTipo}
        onSeleccionar={(t) => { setFormTipo(t); setShowTipoPicker(false); }}
        onCerrar={() => setShowTipoPicker(false)}
      />

      <EventoDetalleModal
        visible={detalleVisible}
        evento={eventoDetalle}
        onCerrar={cerrarDetalle}
      />

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascotaActiva}
        activeRoute="Calendario"
      />
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#C8F0D8' },
  screenBg: { flex: 1, width: '100%' },
  screenBgImage: { width: '100%', height: '100%' },
  scroll:   { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 100 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },

  titulo: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', textAlign: 'center', marginTop: 8, marginBottom: 20, paddingHorizontal: 20 },

  emptyTxt: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginTop: 60 },

  // Card evento
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16, paddingVertical: 14, paddingLeft: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  cardBorde: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardFila1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTituloRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  cardBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
  },
  cardBadgeTxt: { fontSize: 15 },
  cardTitulo: { flex: 1, fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  cardAcciones: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardFila2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardTipo: { fontSize: 13, fontWeight: '600' },
  badgeDias: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  badgeDiasTxt: { fontSize: 11, fontWeight: '700' },
  cardFecha: { fontSize: 13, color: '#6B6B6B', marginTop: 4 },
  cardDescripcion: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },

  // Skeleton
  skeletonCard: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, height: 90, marginBottom: 12 },

  // FAB
  fab:       { position: 'absolute', width: 56, height: 56 },
  fabCentro: { alignSelf: 'center', top: '42%' },
  fabCorner: { bottom: 32, right: 20 },
  fabBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 8, elevation: 6,
  },

  // Toast
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8, zIndex: 100,
  },
  toastTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 20,
    width: Math.min(SCREEN_WIDTH * 0.90, 380),
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
    maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#2DBD72', textAlign: 'center', marginBottom: 20 },

  input: {
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#2C2C2C', backgroundColor: '#FFF',
    marginBottom: 12,
  },
  inputError: { borderColor: '#E63946' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: '#FFF',
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: '#2C2C2C' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -8, marginBottom: 8, marginLeft: 4 },

  pickerLabel: { fontSize: 13, color: '#6B6B6B', marginBottom: 8 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  emojiChip: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#DDDDDD',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  emojiChipOn: { borderColor: '#2DBD72', backgroundColor: '#F0FFF6' },
  emojiChipTxt: { fontSize: 18 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchOn: { borderColor: '#2C2C2C' },

  // Pie fijo del modal, siempre visible sin scrollear
  modalPie: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  btnGuardar: {
    flex: 1, height: 48, borderRadius: 30,
    backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnCancelar: {
    paddingHorizontal: 22, height: 48, borderRadius: 30, backgroundColor: '#EFEFEF',
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },

  // Selector de mascota (pestañas de la pantalla y chips del modal)
  petTabs: { flexGrow: 0, marginBottom: 6 },
  petTabsContent: { paddingHorizontal: 20, gap: 8 },
  petTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1.5, borderColor: 'transparent',
  },
  petTabOn: { backgroundColor: '#FFFFFF', borderColor: '#2DBD72' },
  petTabTxt: { fontSize: 13, color: '#6B6B6B', fontWeight: '600', maxWidth: 130 },
  petTabTxtOn: { color: '#2DBD72', fontWeight: '700' },

  petPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  petPick: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: 'transparent',
  },
  petPickOn: { backgroundColor: '#F0FFF6', borderColor: '#2DBD72' },
  petPickTxt: { fontSize: 13, color: '#6B6B6B', fontWeight: '600', maxWidth: 130 },
  petPickTxtOn: { color: '#2DBD72', fontWeight: '700' },
});
