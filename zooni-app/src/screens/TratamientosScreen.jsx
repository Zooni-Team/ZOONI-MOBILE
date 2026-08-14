/**
 * TratamientosScreen.jsx — Pantalla "Tratamientos" de Zooni
 *
 * Navega desde FichaMedicaScreen con { petId }.
 * Muestra tratamientos aplicados (cards ámbar) y sugeridos (cards blancos).
 * Solo permite agregar y eliminar — no editar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { parseFechaLocal } from '../utils/fechaLocal';
import PetHero from '../components/PetHero';
import {
  fetchTratamientos,
  crearTratamiento,
  editarTratamiento as editarTratamientoApi,
  eliminarTratamiento as eliminarTratamientoApi,
} from '../services/fichaMedicaApi';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import FechaPicker from '../components/FechaPicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** "2026-03-19" → "19/3/2026" */
function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

/** Date → "YYYY-MM-DD" */
function toISO(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Días restantes hasta proximo_control */
function calcularDiasRestantes(fechaISO) {
  if (!fechaISO) return null;
  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = parseFechaLocal(fechaISO); fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

function formatearContadorDias(dias) {
  if (dias === null) return null;
  if (dias > 1)  return `Faltan ${dias} días`;
  if (dias === 1) return 'Falta 1 día';
  if (dias === 0) return 'Vence hoy';
  return `Vencido hace ${Math.abs(dias)} día(s)`;
}

function colorContador(dias) {
  if (dias === null) return '#2C2C2C';
  if (dias < 0)   return '#E63946';  // vencido
  if (dias === 0) return '#F5A623';  // vence hoy
  return '#2C2C2C';
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
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Animated.View style={[s.skeletonCard, { opacity }]}>
      <View style={s.skeletonLine1} />
      <View style={s.skeletonLine2} />
      <View style={s.skeletonLine3} />
    </Animated.View>
  );
}

// ─── COMPONENTE: TOAST ────────────────────────────────────────────────────────

function Toast({ visible, mensaje, color }) {
  const translateY = useRef(new Animated.Value(-12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0,   duration: 220, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1,   duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  return (
    <Animated.View style={[s.toast, { backgroundColor: color, opacity, transform: [{ translateY }] }]}>
      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
      <Text style={s.toastTxt}>{mensaje}</Text>
    </Animated.View>
  );
}

// ─── COMPONENTE: CARD TRATAMIENTO APLICADO ────────────────────────────────────

function CardAplicado({ tratamiento, onEditar, onEliminar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const scaleEdit  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  const dias   = calcularDiasRestantes(tratamiento.proximo_control);
  const cuenta = formatearContadorDias(dias);
  const colDias = dias !== null && dias <= 0 ? '#E63946' : dias === 0 ? '#F5A623' : '#2C2C2C';

  const colorProxControl = () => {
    if (!tratamiento.proximo_control) return '#6B6B6B';
    if (dias !== null && dias < 0) return '#E63946';
    if (dias !== null && dias <= 7) return '#F5A623';
    return '#6B6B6B';
  };

  const pressInElim  = () => Animated.timing(scale, { toValue: 0.90, duration: 100, useNativeDriver: true }).start();
  const pressOutElim = () => Animated.timing(scale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.cardAplicado, { transform: [{ translateY }], opacity }]}>
      {/* Columna izquierda */}
      <View style={s.cardLeft}>
        <Text style={s.cardNombre}>{tratamiento.nombre}</Text>
        {tratamiento.descripcion ? (
          <Text style={s.cardDesc}>{tratamiento.descripcion}</Text>
        ) : null}
        <Text style={s.cardField}>Inicio: {formatFecha(tratamiento.fecha_inicio) ?? '—'}</Text>
        <Text style={[s.cardField, { color: colorProxControl() }]}>
          Próximo control: {tratamiento.proximo_control ? formatFecha(tratamiento.proximo_control) : 'Sin fecha'}
        </Text>
        <Text style={s.cardField} numberOfLines={1} ellipsizeMode="tail">
          Veterinaria: {tratamiento.veterinaria ?? 'Sin registro'}
        </Text>
        {cuenta !== null && (
          <Text style={[s.cardContador, { color: colDias }]}>{cuenta}</Text>
        )}
      </View>
      {/* Botones editar / eliminar */}
      <View style={s.cardRight}>
        <Animated.View style={{ transform: [{ scale: scaleEdit }] }}>
          <Pressable
            style={s.btnEditar}
            onPressIn={() => Animated.timing(scaleEdit, { toValue: 0.90, duration: 100, useNativeDriver: true }).start()}
            onPressOut={() => Animated.timing(scaleEdit, { toValue: 1, duration: 150, useNativeDriver: true }).start()}
            onPress={() => onEditar(tratamiento)}
            accessibilityLabel="Editar tratamiento"
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            style={s.btnEliminar}
            onPressIn={pressInElim}
            onPressOut={pressOutElim}
            onPress={() => onEliminar(tratamiento.id)}
            accessibilityLabel="Eliminar tratamiento"
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── COMPONENTE: CARD SUGERIDO ────────────────────────────────────────────────

function CardSugerido({ sugerido, index, onRegistrar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  return (
    <Animated.View style={[s.cardSugerido, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardSugeridoInfo}>
        <Text style={s.sugeridoNombre}>{sugerido.nombre}</Text>
        <Text style={s.sugeridoFrecInline}>{sugerido.frecuencia_descripcion}</Text>
      </View>
      {sugerido.applied ? (
        <View style={s.badgeAplicada}>
          <Ionicons name="checkmark" size={12} color="#2DBD72" />
          <Text style={s.badgeAplicadaTxt}>Aplicada</Text>
        </View>
      ) : (
        <TouchableOpacity style={s.btnRegistrar} onPress={onRegistrar} accessibilityLabel={`Registrar ${sugerido.nombre}`}>
          <Text style={s.btnRegistrarTxt}>Registrar</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function TratamientosScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId;
  const { mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();
  const idMascota = petId ?? mascotaActivaDemo?.id;

  // ── Estado ───────────────────────────────────────────────────────────────
  const [mascota,               setMascota]               = useState(null);
  const [tratamientosAplicados, setTratamientosAplicados] = useState([]);
  const [tratamientosSugeridos, setTratamientosSugeridos] = useState([]);
  const [loading,               setLoading]               = useState(true);
  const [refreshing,            setRefreshing]            = useState(false);
  const [modalVisible,          setModalVisible]          = useState(false);
  // Sugerido que se está registrando desde el botón "Registrar" (null si se
  // abrió el modal desde "Añadir" a secas) — se usa para marcarlo "Aplicada"
  // al guardar, igual que hace Vacunas con vacunaPreseleccionada.
  const [sugeridoEnRegistro,    setSugeridoEnRegistro]    = useState(null);
  // Única fuente de verdad para saber si el modal edita o crea: si hay un
  // tratamiento acá, es edición; si es null, es alta. (Antes había además un
  // `modalModo` separado y los dos podían desincronizarse: el botón decía
  // "Guardar cambios" pero se creaba un duplicado en vez de actualizar.)
  const [tratamientoEnEdicion,  setTratamientoEnEdicion]  = useState(null);
  const [formNombre,            setFormNombre]            = useState('');
  const [formFechaInicio,       setFormFechaInicio]       = useState(null);
  const [formProximoControl,    setFormProximoControl]    = useState(null);
  const [formVeterinaria,       setFormVeterinaria]       = useState('');
  const [formDescripcion,       setFormDescripcion]       = useState('');
  const [formErrors,            setFormErrors]            = useState({});
  const [guardando,             setGuardando]             = useState(false);
  const [showPickerInicio,      setShowPickerInicio]      = useState(false);
  const [showPickerControl,     setShowPickerControl]     = useState(false);
  const [focusNombre,           setFocusNombre]           = useState(false);
  const [focusVet,              setFocusVet]              = useState(false);
  const [focusDesc,             setFocusDesc]             = useState(false);
  const [toastVisible,          setToastVisible]          = useState(false);
  const [toastMensaje,          setToastMensaje]          = useState('');
  const [toastColor,            setToastColor]            = useState('#2DBD72');

  // Animaciones del modal
  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const heroScale    = useRef(new Animated.Value(0.88)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const toastTimer   = useRef(null);

  // ── Datos hardcodeados para preview visual ───────────────────────────────
  const DEMO_MASCOTA = {
    id: 1, nombre: 'Titán', especie: 'perro',
    raza: 'Labrador Retriever', peso: 20.40,
    fecha_nacimiento: '2022-02-15', imagen_asset: 'perro_default',
  };

  const DEMO_APLICADOS = [
    {
      id: 1,
      nombre: 'Desparasitación Interna',
      descripcion: 'Pastilla Milbemax administrada en consulta.',
      fecha_inicio: '2026-03-19',
      proximo_control: '2026-09-10',
      veterinaria: 'Clínica Veterinaria Central',
    },
    {
      id: 2,
      nombre: 'Control de Pulgas y Garrapatas',
      descripcion: null,
      fecha_inicio: '2026-04-01',
      proximo_control: '2026-06-30',
      veterinaria: null,
    },
    {
      id: 3,
      nombre: 'Profilaxis Cardiaca',
      descripcion: 'Heartgard Plus mensual.',
      fecha_inicio: '2026-01-10',
      proximo_control: '2026-06-28', // vence muy pronto → naranja/rojo según fecha actual
      veterinaria: 'VetSalud Palermo',
    },
  ];

  const DEMO_SUGERIDOS = [
    { id: 1,  nombre: 'Desparasitación Interna',                frecuencia_descripcion: 'Cada 3 meses'  },
    { id: 2,  nombre: 'Desparasitación Externa',                frecuencia_descripcion: 'Cada 2 meses'  },
    { id: 3,  nombre: 'Control Dental',                         frecuencia_descripcion: 'Cada 6 meses'  },
    { id: 4,  nombre: 'Chequeo General Veterinario',            frecuencia_descripcion: 'Cada 6 meses'  },
    { id: 5,  nombre: 'Chequeo Articular y de Cadera',          frecuencia_descripcion: 'Cada 12 meses' },
    { id: 6,  nombre: 'Control de Peso',                        frecuencia_descripcion: 'Cada 6 meses'  },
    { id: 7,  nombre: 'Profilaxis Cardiaca',                    frecuencia_descripcion: 'Cada 6 meses'  },
    { id: 8,  nombre: 'Control de Pulgas y Garrapatas',         frecuencia_descripcion: 'Cada 2 meses'  },
    { id: 9,  nombre: 'Chequeo Dermatológico',                  frecuencia_descripcion: 'Cada 12 meses' },
    { id: 10, nombre: 'Evaluación Conductual',                  frecuencia_descripcion: 'Cada 12 meses' },
    { id: 11, nombre: 'Esterilización / Castración Preventiva', frecuencia_descripcion: 'Cada 12 meses' },
  ];

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      if (idMascota) {
        const { mascota: m, aplicados, sugeridos } = await fetchTratamientos(idMascota);
        setMascota(m);
        setTratamientosAplicados(aplicados);
        setTratamientosSugeridos(sugeridos);
      } else {
        setMascota(DEMO_MASCOTA);
        setTratamientosAplicados(DEMO_APLICADOS);
        setTratamientosSugeridos(DEMO_SUGERIDOS);
      }
    } catch {
      setMascota(DEMO_MASCOTA);
      setTratamientosAplicados(DEMO_APLICADOS);
      setTratamientosSugeridos(DEMO_SUGERIDOS);
    }
    setLoading(false);
    animarHero();
  }, [idMascota]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar(true);
    setRefreshing(false);
  }, [cargar]);

  function animarHero() {
    Animated.parallel([
      Animated.timing(heroScale,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  function mostrarToast(mensaje, color = '#2DBD72') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMensaje(mensaje);
    setToastColor(color);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  // nombrePrefill: al tocar "Registrar" en un tratamiento sugerido, se abre
  // el mismo modal con el nombre ya cargado (el usuario todavía puede
  // editarlo, elegir la fecha y guardar).
  function abrirModal(nombrePrefill = '', sugerido = null) {
    // La fecha de inicio arranca SIEMPRE en el día de hoy (se calcula al abrir
    // el modal, no al montar la pantalla: si la app queda abierta de un día
    // para el otro, el formulario igual propone la fecha correcta).
    setFormNombre(nombrePrefill); setFormFechaInicio(new Date()); setFormProximoControl(null);
    setFormVeterinaria(''); setFormDescripcion(''); setFormErrors({});
    setSugeridoEnRegistro(sugerido);
    setTratamientoEnEdicion(null);
    animarAperturaModal();
  }

  function abrirModalEditar(t) {
    setFormNombre(t.nombre ?? '');
    setFormFechaInicio(t.fecha_inicio ? parseFechaLocal(t.fecha_inicio) : null);
    setFormProximoControl(t.proximo_control ? parseFechaLocal(t.proximo_control) : null);
    setFormVeterinaria(t.veterinaria ?? '');
    setFormDescripcion(t.descripcion ?? '');
    setFormErrors({});
    setSugeridoEnRegistro(null);
    setTratamientoEnEdicion(t);
    animarAperturaModal();
  }

  function animarAperturaModal() {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(modalScale,   { toValue: 1,    duration: 220, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 1,    duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function cerrarModal() {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(modalScale,   { toValue: 0.92, duration: 160, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0,    duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      // Reset anims para próxima apertura
      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
    });
  }

  // ── Guardar tratamiento (demo: solo estado local) ────────────────────────
  async function guardarTratamiento() {
    const errors = {};
    if (!formNombre.trim()) errors.nombre = 'Este campo es requerido';
    if (!formFechaInicio)   errors.fechaInicio = 'Seleccioná una fecha de inicio';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setGuardando(true);
    const datos = {
      nombre:          formNombre.trim(),
      descripcion:     formDescripcion.trim() || null,
      fecha_inicio:    toISO(formFechaInicio),
      proximo_control: formProximoControl ? toISO(formProximoControl) : null,
      veterinaria:     formVeterinaria.trim() || null,
    };
    try {
      if (tratamientoEnEdicion) {
        const editado = await editarTratamientoApi(tratamientoEnEdicion.id, datos);
        setTratamientosAplicados((prev) => prev.map((t) => (t.id === tratamientoEnEdicion.id ? editado : t)));
        cerrarModal();
        mostrarToast('Tratamiento actualizado correctamente', '#2DBD72');
      } else {
        const nuevo = await crearTratamiento(idMascota, datos);
        setTratamientosAplicados((prev) => [nuevo, ...prev]);
        if (sugeridoEnRegistro) {
          setTratamientosSugeridos((prev) => prev.map((sg) => (
            sg.id === sugeridoEnRegistro.id
              ? { ...sg, applied: true, tratamiento_aplicado_id: nuevo.id }
              : sg
          )));
        }
        cerrarModal();
        mostrarToast('Tratamiento registrado correctamente', '#2DBD72');
      }
    } catch {
      mostrarToast('No se pudo guardar el tratamiento', '#E63946');
    } finally {
      setGuardando(false);
    }
  }

  // ── Eliminar tratamiento ─────────────────────────────────────────────────
  // OJO: esta función y la importada de fichaMedicaApi se llamaban IGUAL
  // ("eliminarTratamiento"), y la de acá abajo tapaba a la importada dentro
  // de este archivo — confirmarEliminar terminaba llamándose a sí misma en
  // vez de borrar de verdad en Supabase. Por eso el botón nunca funcionó,
  // ni siquiera en el celular. Se renombró para que no vuelva a pasar.
  function pedirConfirmacionEliminar(id) {
    // Alert.alert con botones es un no-op en react-native-web: en el
    // navegador nunca aparecía el diálogo.
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) confirmarEliminar(id);
      return;
    }
    Alert.alert(
      '¿Eliminar tratamiento?',
      '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmarEliminar(id) },
      ],
    );
  }

  async function confirmarEliminar(id) {
    try {
      await eliminarTratamientoApi(id);
      setTratamientosAplicados((prev) => prev.filter((t) => t.id !== id));
      // Si venía de un sugerido "Aplicada", esa tarjeta tiene que volver a
      // mostrar el botón "Registrar" — igual que ya se arregló en Vacunas.
      setTratamientosSugeridos((prev) => prev.map((sg) => (
        sg.tratamiento_aplicado_id === id
          ? { ...sg, applied: false, tratamiento_aplicado_id: null }
          : sg
      )));
      mostrarToast('Tratamiento eliminado', '#E63946');
    } catch {
      mostrarToast('No se pudo eliminar el tratamiento', '#E63946');
    }
  }

  // ── Animación botón Añadir ───────────────────────────────────────────────
  const pressInBtn  = () => Animated.timing(btnScale, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  const pressOutBtn = () => Animated.timing(btnScale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  // ── Datos de la mascota (demo si no hay backend) ─────────────────────────
  const esDemo = !idMascota || !mascota;
  const m = mascota ?? {
    nombre: 'Tu mascota', especie: 'perro', raza: null,
    peso: null, fecha_nacimiento: null, imagen_asset: 'perro_default',
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Toast */}
      <Toast visible={toastVisible} mensaje={toastMensaje} color={toastColor} />

      <View style={s.screenBg}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top:12, bottom:12, left:12, right:12 }}>
            <Ionicons name="arrow-back" size={26} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={['#2DBD72']} tintColor="#2DBD72" />
          }>

          {/* ── HERO ── (compartido con Vacunas, Consultas y Curiosidades) */}
          <PetHero mascota={m} titulo="Tratamientos" anim={{ scale: heroScale, opacity: heroOpacity }} />

          {/* ── CARD BLANCO ── */}
          <View style={s.whiteCard}>

            {/* Banner demo */}
            {esDemo && (
              <View style={s.demoBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#F5A623" />
                <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
              </View>
            )}

            {/* ── Sección aplicados ── */}
            <View style={s.secRow}>
              <Text style={s.secTitulo}>Tratamientos</Text>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable style={s.btnAnadir}
                  onPressIn={pressInBtn} onPressOut={pressOutBtn} onPress={() => abrirModal()}>
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={s.btnAnadirTxt}>Añadir</Text>
                </Pressable>
              </Animated.View>
            </View>

            {loading ? (
              <View>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </View>
            ) : tratamientosAplicados.length === 0 ? (
              <Text style={s.emptyTxt}>No hay tratamientos registrados</Text>
            ) : (
              tratamientosAplicados.map((t) => (
                <CardAplicado key={t.id} tratamiento={t} onEditar={abrirModalEditar} onEliminar={pedirConfirmacionEliminar} />
              ))
            )}

            {/* ── Sección sugeridos ── */}
            <View style={s.secSugeridosRow}>
              <Ionicons name="clipboard-outline" size={16} color="#2C2C2C" />
              <Text style={s.secSugeridosTitulo}>Tratamientos sugeridos</Text>
            </View>

            {loading ? (
              <View><SkeletonCard /><SkeletonCard /></View>
            ) : tratamientosSugeridos.length === 0 ? (
              <Text style={s.emptyTxt}>No hay tratamientos sugeridos para esta especie</Text>
            ) : (
              tratamientosSugeridos.map((sug, i) => (
                <CardSugerido key={sug.id} sugerido={sug} index={i} onRegistrar={() => abrirModal(sug.nombre, sug)} />
              ))
            )}

          </View>
        </ScrollView>
      </View>

      {/* ── MODAL AÑADIR ── */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={cerrarModal}>
            <TouchableOpacity activeOpacity={1}>
              <Animated.View style={[s.modalCard, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                  <Text style={s.modalTitulo}>{tratamientoEnEdicion ? 'Editar tratamiento' : 'Nuevo tratamiento'}</Text>

                  {/* Nombre */}
                  <TextInput
                    style={[s.input, focusNombre && s.inputFocus, formErrors.nombre && s.inputError]}
                    placeholder="Nombre del tratamiento"
                    placeholderTextColor="#AAAAAA"
                    value={formNombre}
                    onChangeText={(v) => { setFormNombre(v); if (formErrors.nombre) setFormErrors((p) => ({ ...p, nombre: null })); }}
                    onFocus={() => setFocusNombre(true)}
                    onBlur={() => setFocusNombre(false)}
                    returnKeyType="next"
                  />
                  {formErrors.nombre && <Text style={s.errorTxt}>{formErrors.nombre}</Text>}

                  {/* Fecha inicio */}
                  <TouchableOpacity
                    style={[s.inputFecha, formErrors.fechaInicio && s.inputError]}
                    onPress={() => setShowPickerInicio(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formFechaInicio && { color: '#AAAAAA' }]}>
                      {formFechaInicio ? toISO(formFechaInicio).split('-').reverse().join('/').replace(/^(\d+)\/(\d+)\/(\d+)$/, (_, d, m, y) => `${parseInt(d)}/${parseInt(m)}/${y}`) : 'dd/mm/aaaa'}
                    </Text>
                    <Text style={s.inputFechaLabel}>Inicio</Text>
                    <Ionicons name="calendar-outline" size={18} color="#6B6B6B" />
                  </TouchableOpacity>
                  {formErrors.fechaInicio && <Text style={s.errorTxt}>{formErrors.fechaInicio}</Text>}

                  {/* Próximo control */}
                  <TouchableOpacity
                    style={s.inputFecha}
                    onPress={() => setShowPickerControl(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formProximoControl && { color: '#AAAAAA' }]}>
                      {formProximoControl ? toISO(formProximoControl).split('-').reverse().join('/').replace(/^(\d+)\/(\d+)\/(\d+)$/, (_, d, m, y) => `${parseInt(d)}/${parseInt(m)}/${y}`) : 'Próximo control (opcional)'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#6B6B6B" />
                  </TouchableOpacity>

                  {/* Veterinaria */}
                  <TextInput
                    style={[s.input, focusVet && s.inputFocus]}
                    placeholder="Veterinaria (opcional)"
                    placeholderTextColor="#AAAAAA"
                    value={formVeterinaria}
                    onChangeText={setFormVeterinaria}
                    onFocus={() => setFocusVet(true)}
                    onBlur={() => setFocusVet(false)}
                    returnKeyType="next"
                  />

                  {/* Descripción */}
                  <TextInput
                    style={[s.input, s.inputMulti, focusDesc && s.inputFocus]}
                    placeholder="Descripción (opcional)"
                    placeholderTextColor="#AAAAAA"
                    value={formDescripcion}
                    onChangeText={setFormDescripcion}
                    onFocus={() => setFocusDesc(true)}
                    onBlur={() => setFocusDesc(false)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {/* Botón Guardar */}
                  <TouchableOpacity style={s.btnGuardar} onPress={guardarTratamiento} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={s.btnGuardarTxt}>{tratamientoEnEdicion ? 'Guardar cambios' : 'Guardar'}</Text>
                    }
                  </TouchableOpacity>

                  {/* Botón Cancelar */}
                  <TouchableOpacity style={s.btnCancelar} onPress={cerrarModal}>
                    <Text style={s.btnCancelarTxt}>Cancelar</Text>
                  </TouchableOpacity>

                </ScrollView>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fecha pickers */}
      {/* Los tratamientos sí pueden tener fechas futuras (próximo control) */}
      <FechaPicker visible={showPickerInicio} titulo="Fecha de inicio" aniosAdelante={5}
        valor={formFechaInicio ?? new Date()}
        onConfirmar={(d) => { setFormFechaInicio(d); setShowPickerInicio(false); if (formErrors.fechaInicio) setFormErrors((p) => ({ ...p, fechaInicio: null })); }}
        onCancelar={() => setShowPickerInicio(false)} />

      <FechaPicker visible={showPickerControl} titulo="Próximo control (opcional)" aniosAdelante={5}
        valor={formProximoControl ?? new Date()}
        onConfirmar={(d) => { setFormProximoControl(d); setShowPickerControl(false); }}
        onCancelar={() => setShowPickerControl(false)} />

    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#C8F0D8' },
  screenBg:      { flex: 1, width: '100%', backgroundColor: '#C8F0D8' },
  scroll:        { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },

  // Hero → components/PetHero.jsx (compartido con Vacunas, Consultas y Curiosidades)

  // Card blanco
  whiteCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
    minHeight: 400,
  },

  // Demo banner
  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16 },
  demoBannerTxt: { fontSize: 12, color: '#F5A623', textAlign: 'center' },

  // Sección row
  secRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitulo: { fontSize: 18, fontWeight: '700', color: '#2C2C2C' },

  // Botón Añadir
  btnAnadir: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2DBD72', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  btnAnadirTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Empty
  emptyTxt: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginTop: 4, marginBottom: 18 },

  // Card aplicado (ámbar)
  cardAplicado: {
    backgroundColor: '#FFFBE6',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#F5E6A3',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardLeft:     { flex: 1, paddingRight: 10, gap: 3 },
  cardRight:    { flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' },
  cardNombre:   { fontSize: 14, fontWeight: '700', color: '#2C2C2C', marginBottom: 4 },
  cardDesc:     { fontSize: 12, color: '#2C2C2C', fontStyle: 'italic', marginBottom: 4 },
  cardField:    { fontSize: 12, color: '#6B6B6B' },
  cardContador: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // Botones editar / eliminar
  btnEditar: {
    backgroundColor: '#5BC8D0', width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnEliminar: {
    backgroundColor: '#E63946', width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },

  // Sección sugeridos
  secSugeridosRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  secSugeridosTitulo: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },

  // Card sugerido (blanco)
  cardSugerido: {
    backgroundColor: '#FFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#EFEFEF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardSugeridoInfo:   { flex: 1, minWidth: 0, paddingRight: 8 },
  sugeridoNombre:     { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  sugeridoFrecInline: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  btnRegistrar: {
    backgroundColor: '#2DBD72', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnRegistrarTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  badgeAplicada: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8F8F0', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10,
  },
  badgeAplicadaTxt: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },

  // Skeleton
  skeletonCard:  { backgroundColor: '#E8E8E8', borderRadius: 12, padding: 16, marginBottom: 10, gap: 8 },
  skeletonLine1: { height: 14, backgroundColor: '#D8D8D8', borderRadius: 6, width: '60%' },
  skeletonLine2: { height: 11, backgroundColor: '#D8D8D8', borderRadius: 6, width: '80%' },
  skeletonLine3: { height: 11, backgroundColor: '#D8D8D8', borderRadius: 6, width: '50%' },

  // Toast
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8, zIndex: 100,
  },
  toastTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Overlay modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 20,
    width: Math.min(SCREEN_WIDTH * 0.88, 360),
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
    maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#2DBD72', textAlign: 'center', marginBottom: 20 },

  // Inputs del modal
  input: {
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#2C2C2C', backgroundColor: '#FFF',
    marginBottom: 12,
  },
  inputFocus:   { borderColor: '#2DBD72' },
  inputError:   { borderColor: '#E63946' },
  inputMulti:   { height: 72, textAlignVertical: 'top', marginBottom: 20 },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: '#FFF',
  },
  inputFechaTxt:   { flex: 1, fontSize: 14, color: '#2C2C2C' },
  inputFechaLabel: { fontSize: 11, color: '#AAAAAA', marginRight: 6 },
  errorTxt:  { fontSize: 11, color: '#E63946', marginTop: -8, marginBottom: 8, marginLeft: 4 },

  // Botones del modal
  btnGuardar: {
    width: '100%', height: 48, borderRadius: 30,
    backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnCancelar:   { width: '100%', height: 44, borderRadius: 30, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
});
