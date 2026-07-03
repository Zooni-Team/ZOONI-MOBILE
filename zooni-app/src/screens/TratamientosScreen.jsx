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
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { calcularEdad } from '../utils/calcularEdad';
import { resolvePetImage } from '../constants/petImages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5165/api/v1',
  ios:     'http://localhost:5165/api/v1',
  default: 'http://localhost:5165/api/v1',
});

async function getToken() {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    }
    return await SecureStore.getItemAsync('jwt_token');
  } catch { return null; }
}

async function apiCall(method, path, data = null) {
  const token = await getToken();
  return axios({
    method,
    url: `${BASE_URL}${path}`,
    data,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

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
  const fecha = new Date(fechaISO); fecha.setHours(0, 0, 0, 0);
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
  if (dias <= 0)  return '#E63946';
  if (dias === 0) return '#F5A623';
  return '#2C2C2C';
}

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

// ─── COMPONENTE: IMAGEN MASCOTA ───────────────────────────────────────────────

function PetIllustration({ source, label }) {
  return <Image source={source} style={s.petImg} resizeMode="contain" accessibilityLabel={label} />;
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

function CardAplicado({ tratamiento, onEliminar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const height     = useRef(new Animated.Value(1)).current; // usado para colapso

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
      {/* Botón eliminar */}
      <View style={s.cardRight}>
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

function CardSugerido({ sugerido, index }) {
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
      <Text style={s.sugeridoNombre}>{sugerido.nombre}</Text>
      <Text style={s.sugeridoFrec}>{sugerido.frecuencia_descripcion}</Text>
    </Animated.View>
  );
}

// ─── COMPONENTE: INPUT FECHA (toca para seleccionar con DatePicker nativo) ────
// DateTimePicker no está instalado → usamos un modal propio igual que FichaMedica

function FechaPicker({ visible, titulo, valor, onConfirmar, onCancelar }) {
  const hoyAnio = new Date().getFullYear();
  const anioMax = hoyAnio + 5; // tratamientos pueden ser futuros

  const [dia,  setDia]  = useState(valor ? valor.getDate() : new Date().getDate());
  const [mes,  setMes]  = useState(valor ? valor.getMonth() + 1 : new Date().getMonth() + 1);
  const [anio, setAnio] = useState(valor ? valor.getFullYear() : hoyAnio);

  useEffect(() => {
    if (valor) {
      setDia(valor.getDate());
      setMes(valor.getMonth() + 1);
      setAnio(valor.getFullYear());
    }
  }, [valor, visible]);

  const diasEnMes = new Date(anio, mes, 0).getDate();
  const dias  = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const anios = Array.from({ length: anioMax - (hoyAnio - 20) + 1 }, (_, i) => hoyAnio - 20 + i);

  const confirmar = () => onConfirmar(new Date(anio, mes - 1, Math.min(dia, diasEnMes)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={fp.overlay}>
        <View style={fp.container}>
          <Text style={fp.titulo}>{titulo}</Text>
          <View style={fp.row}>
            <View style={fp.col}>
              <Text style={fp.colLabel}>Día</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {dias.map((d) => (
                  <TouchableOpacity key={d} style={[fp.item, dia === d && fp.itemOn]} onPress={() => setDia(d)}>
                    <Text style={[fp.itemTxt, dia === d && fp.itemTxtOn]}>{String(d).padStart(2,'0')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={[fp.col, { flex: 2 }]}>
              <Text style={fp.colLabel}>Mes</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {meses.map((m, i) => (
                  <TouchableOpacity key={m} style={[fp.item, mes === i+1 && fp.itemOn]} onPress={() => setMes(i+1)}>
                    <Text style={[fp.itemTxt, mes === i+1 && fp.itemTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={fp.col}>
              <Text style={fp.colLabel}>Año</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {anios.map((a) => (
                  <TouchableOpacity key={a} style={[fp.item, anio === a && fp.itemOn]} onPress={() => setAnio(a)}>
                    <Text style={[fp.itemTxt, anio === a && fp.itemTxtOn]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={fp.btns}>
            <TouchableOpacity style={fp.btnCancel} onPress={onCancelar}>
              <Text style={fp.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fp.btnOk} onPress={confirmar}>
              <Text style={fp.btnOkTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container:    { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  titulo:       { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 16 },
  row:          { flexDirection: 'row', gap: 8, height: 180 },
  col:          { flex: 1 },
  colLabel:     { fontSize: 12, fontWeight: '600', color: '#6B6B6B', textAlign: 'center', marginBottom: 6 },
  list:         { flex: 1, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 10 },
  item:         { paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  itemOn:       { backgroundColor: '#F0FFF6' },
  itemTxt:      { fontSize: 14, color: '#2C2C2C' },
  itemTxtOn:    { color: '#2DBD72', fontWeight: '700' },
  btns:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#F0F0F0', alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
  btnOk:        { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#2DBD72', alignItems: 'center' },
  btnOkTxt:     { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function TratamientosScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId;

  // ── Estado ───────────────────────────────────────────────────────────────
  const [mascota,               setMascota]               = useState(null);
  const [tratamientosAplicados, setTratamientosAplicados] = useState([]);
  const [tratamientosSugeridos, setTratamientosSugeridos] = useState([]);
  const [loading,               setLoading]               = useState(true);
  const [modalVisible,          setModalVisible]          = useState(false);
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

  // ── Carga inicial (usa datos hardcodeados mientras no hay backend) ────────
  const cargar = useCallback(async () => {
    setLoading(true);
    // Simular un pequeño delay de red para ver los skeletons
    await new Promise((r) => setTimeout(r, 600));
    setMascota(DEMO_MASCOTA);
    setTratamientosAplicados(DEMO_APLICADOS);
    setTratamientosSugeridos(DEMO_SUGERIDOS);
    setLoading(false);
    animarHero();
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

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
  function abrirModal() {
    setFormNombre(''); setFormFechaInicio(null); setFormProximoControl(null);
    setFormVeterinaria(''); setFormDescripcion(''); setFormErrors({});
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
    // Simular delay de guardado
    await new Promise((r) => setTimeout(r, 500));

    const nuevo = {
      id:              Date.now(),
      nombre:          formNombre.trim(),
      descripcion:     formDescripcion.trim() || null,
      fecha_inicio:    toISO(formFechaInicio),
      proximo_control: formProximoControl ? toISO(formProximoControl) : null,
      veterinaria:     formVeterinaria.trim() || null,
    };
    setTratamientosAplicados((prev) => [nuevo, ...prev]);
    setGuardando(false);
    cerrarModal();
    mostrarToast('Tratamiento registrado correctamente', '#2DBD72');
  }

  // ── Eliminar tratamiento ─────────────────────────────────────────────────
  function eliminarTratamiento(id) {
    Alert.alert(
      '¿Eliminar tratamiento?',
      '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmarEliminar(id) },
      ],
    );
  }

  // ── Eliminar tratamiento (demo: solo estado local) ───────────────────────
  async function confirmarEliminar(id) {
    setTratamientosAplicados((prev) => prev.filter((t) => t.id !== id));
    mostrarToast('Tratamiento eliminado', '#E63946');
  }

  // ── Animación botón Añadir ───────────────────────────────────────────────
  const pressInBtn  = () => Animated.timing(btnScale, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  const pressOutBtn = () => Animated.timing(btnScale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  // ── Datos de la mascota (demo si no hay backend) ─────────────────────────
  const esDemo = !petId || !mascota;
  const m = mascota ?? {
    nombre: 'Tu mascota', especie: 'perro', raza: null,
    peso: null, fecha_nacimiento: null, imagen_asset: 'perro_default',
  };
  const edad    = calcularEdad(m.fecha_nacimiento);
  const petImg  = resolvePetImage(m.imagen_asset ?? m.imagenAsset);
  const pesoFmt = m.peso != null
    ? parseFloat(m.peso).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
    : '—';

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
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── HERO ── */}
          <View style={s.hero}>
            <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity, alignItems: 'center' }}>
              {/* Círculo decorativo */}
              <View style={s.petCircle} />
              <PetIllustration source={petImg} label={`Ilustración de ${m.nombre}`} />
              <Text style={s.heroTitulo} numberOfLines={1} ellipsizeMode="tail">
                Tratamientos de {m.nombre}
              </Text>
              <View style={s.heroInfo}>
                <Text style={s.heroInfoTxt}>Edad: {edad}</Text>
                <Text style={s.heroInfoTxt}>Peso: {pesoFmt}</Text>
                <Text style={s.heroInfoTxt}>Raza: {m.raza ?? '—'}</Text>
              </View>
            </Animated.View>
          </View>

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
                  onPressIn={pressInBtn} onPressOut={pressOutBtn} onPress={abrirModal}>
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
                <CardAplicado key={t.id} tratamiento={t} onEliminar={eliminarTratamiento} />
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
                <CardSugerido key={sug.id} sugerido={sug} index={i} />
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

                  <Text style={s.modalTitulo}>Nuevo tratamiento</Text>

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
                    placeholder="Notas u observaciones (opcional)"
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
                      : <Text style={s.btnGuardarTxt}>Guardar</Text>
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
      <FechaPicker visible={showPickerInicio} titulo="Fecha de inicio"
        valor={formFechaInicio ?? new Date()}
        onConfirmar={(d) => { setFormFechaInicio(d); setShowPickerInicio(false); if (formErrors.fechaInicio) setFormErrors((p) => ({ ...p, fechaInicio: null })); }}
        onCancelar={() => setShowPickerInicio(false)} />

      <FechaPicker visible={showPickerControl} titulo="Próximo control (opcional)"
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

  // Header — flota transparente sobre el contenido, sin barra de fondo
  header:    {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent',
  },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero:         { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  petCircle:    { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#A8E6C0', opacity: 0.45, top: 0, alignSelf: 'center' },
  petImg:       { width: 110, height: 110, zIndex: 1 },
  heroTitulo:   { fontSize: 24, fontWeight: '800', color: '#2C2C2C', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  heroInfo:     { alignItems: 'center', marginTop: 6, marginBottom: 22, gap: 2 },
  heroInfoTxt:  { fontSize: 13, color: '#6B6B6B' },

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
  cardRight:    { alignItems: 'center', justifyContent: 'center' },
  cardNombre:   { fontSize: 14, fontWeight: '700', color: '#2C2C2C', marginBottom: 4 },
  cardField:    { fontSize: 12, color: '#6B6B6B' },
  cardContador: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // Botón eliminar
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
  sugeridoNombre: { flex: 1, fontSize: 14, fontWeight: '700', color: '#2C2C2C', paddingRight: 8 },
  sugeridoFrec:   { fontSize: 12, color: '#6B6B6B', textAlign: 'right', flexShrink: 0, maxWidth: 90 },

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
