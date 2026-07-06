/**
 * ConsultasScreen.jsx — Historial de consultas veterinarias de la mascota
 *
 * Anotaciones de consultas pasadas (motivo, notas del veterinario, fecha)
 * para tener el historial clínico a mano — se incluyen también en el PDF
 * de la Ficha Médica. Navega desde FichaMedicaScreen con { petId }.
 * Mismo patrón visual que TratamientosScreen.
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

import { calcularEdad } from '../utils/calcularEdad';
import { toISODateLocal } from '../utils/fechaLocal';
import { resolvePetImage } from '../constants/petImages';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { fetchMascota, fetchConsultas, crearConsulta, eliminarConsulta } from '../services/fichaMedicaApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** "2026-03-19" → "19/3/2026" */
function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
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

// ─── COMPONENTE: CARD CONSULTA ────────────────────────────────────────────────

function CardConsulta({ consulta, index, onEliminar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const pressInElim  = () => Animated.timing(scale, { toValue: 0.90, duration: 100, useNativeDriver: true }).start();
  const pressOutElim = () => Animated.timing(scale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.cardConsulta, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardTop}>
        <View style={s.cardFechaChip}>
          <Ionicons name="calendar-outline" size={12} color="#2DBD72" />
          <Text style={s.cardFechaTxt}>{formatFecha(consulta.fecha) ?? '—'}</Text>
        </View>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            style={s.btnEliminar}
            onPressIn={pressInElim}
            onPressOut={pressOutElim}
            onPress={() => onEliminar(consulta.id)}
            accessibilityLabel="Eliminar consulta"
          >
            <Ionicons name="trash-outline" size={16} color="#FFF" />
          </Pressable>
        </Animated.View>
      </View>

      <Text style={s.cardMotivo}>{consulta.motivo}</Text>
      {consulta.veterinario && (
        <Text style={s.cardField}>Veterinario/a: {consulta.veterinario}</Text>
      )}
      {consulta.notas && (
        <Text style={s.cardNotas}>{consulta.notas}</Text>
      )}
    </Animated.View>
  );
}

// ─── COMPONENTE: FECHA PICKER (modal propio, igual que Tratamientos) ──────────

function FechaPicker({ visible, titulo, valor, onConfirmar, onCancelar }) {
  const hoyAnio = new Date().getFullYear();

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
  // Consultas pasadas: desde 20 años atrás hasta el año actual
  const anios = Array.from({ length: 21 }, (_, i) => hoyAnio - i);

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

export default function ConsultasScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId;
  const { mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();
  const idMascota = petId ?? mascotaActivaDemo?.id;

  // ── Estado ───────────────────────────────────────────────────────────────
  const [mascota,      setMascota]      = useState(null);
  const [consultas,    setConsultas]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formMotivo,      setFormMotivo]      = useState('');
  const [formFecha,       setFormFecha]       = useState(null);
  const [formVeterinario, setFormVeterinario] = useState('');
  const [formNotas,       setFormNotas]       = useState('');
  const [formErrors,      setFormErrors]      = useState({});
  const [guardando,       setGuardando]       = useState(false);
  const [showPickerFecha, setShowPickerFecha] = useState(false);
  const [focusMotivo, setFocusMotivo] = useState(false);
  const [focusVet,    setFocusVet]    = useState(false);
  const [focusNotas,  setFocusNotas]  = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastColor,   setToastColor]   = useState('#2DBD72');

  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const heroScale    = useRef(new Animated.Value(0.88)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const toastTimer   = useRef(null);

  // ── Datos hardcodeados para preview visual (sin backend) ─────────────────
  const DEMO_MASCOTA = {
    id: 1, nombre: 'Titán', especie: 'perro',
    raza: 'Labrador Retriever', peso: 20.40,
    fecha_nacimiento: '2022-02-15', imagen_asset: 'perro_default',
  };

  const DEMO_CONSULTAS = [
    {
      id: 1,
      fecha: '2026-05-20',
      motivo: 'Control anual + vacunación',
      notas: 'Todo en orden. Se aplicó refuerzo séxtuple. Mantener antiparasitario mensual.',
      veterinario: 'Dra. Paula Gómez — Clínica Veterinaria Central',
    },
    {
      id: 2,
      fecha: '2026-02-08',
      motivo: 'Dermatitis en pata trasera',
      notas: 'Se indicó crema con corticoide 2 veces por día durante 10 días. Volver si no mejora.',
      veterinario: 'VetSalud Palermo',
    },
  ];

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      if (idMascota) {
        const [m, lista] = await Promise.all([fetchMascota(idMascota), fetchConsultas(idMascota)]);
        setMascota(m);
        setConsultas(lista);
      } else {
        setMascota(DEMO_MASCOTA);
        setConsultas(DEMO_CONSULTAS);
      }
    } catch {
      setMascota(DEMO_MASCOTA);
      setConsultas(DEMO_CONSULTAS);
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
  function abrirModal() {
    setFormMotivo(''); setFormFecha(null); setFormVeterinario(''); setFormNotas('');
    setFormErrors({});
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
    });
  }

  // ── Guardar consulta ──────────────────────────────────────────────────────
  async function guardarConsulta() {
    const errors = {};
    if (!formMotivo.trim()) errors.motivo = 'Este campo es requerido';
    if (!formFecha)         errors.fecha  = 'Seleccioná la fecha de la consulta';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setGuardando(true);
    try {
      const nueva = await crearConsulta(idMascota, {
        motivo:      formMotivo.trim(),
        fecha:       toISODateLocal(formFecha),
        veterinario: formVeterinario.trim() || null,
        notas:       formNotas.trim() || null,
      });
      // Insertar manteniendo el orden por fecha descendente
      setConsultas((prev) => [nueva, ...prev].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)));
      cerrarModal();
      mostrarToast('Consulta registrada correctamente', '#2DBD72');
    } catch {
      mostrarToast('No se pudo guardar la consulta', '#E63946');
    } finally {
      setGuardando(false);
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  function pedirConfirmacionEliminar(id) {
    // Alert.alert con botones es un no-op en react-native-web → window.confirm
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar esta consulta? Esta acción no se puede deshacer.')) confirmarEliminar(id);
      return;
    }
    Alert.alert(
      '¿Eliminar consulta?',
      '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmarEliminar(id) },
      ],
    );
  }

  async function confirmarEliminar(id) {
    try {
      await eliminarConsulta(id);
      setConsultas((prev) => prev.filter((c) => c.id !== id));
      mostrarToast('Consulta eliminada', '#E63946');
    } catch {
      mostrarToast('No se pudo eliminar la consulta', '#E63946');
    }
  }

  // ── Animación botón Añadir ───────────────────────────────────────────────
  const pressInBtn  = () => Animated.timing(btnScale, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  const pressOutBtn = () => Animated.timing(btnScale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  // ── Datos mascota (demo si no hay backend) ────────────────────────────────
  const esDemo = !idMascota || !mascota;
  const m = mascota ?? {
    nombre: 'Tu mascota', especie: 'perro', raza: null,
    peso: null, fecha_nacimiento: null, imagen_asset: 'perro_default',
  };
  const edad   = calcularEdad(m.fecha_nacimiento);
  const petImg = resolvePetImage(m.imagen_asset ?? m.imagenAsset);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

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

          {/* ── HERO ── */}
          <View style={s.hero}>
            <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity, alignItems: 'center' }}>
              <View style={s.petCircle} />
              <PetIllustration source={petImg} label={`Ilustración de ${m.nombre}`} />
              <Text style={s.heroTitulo} numberOfLines={1} ellipsizeMode="tail">
                Consultas de {m.nombre}
              </Text>
              <View style={s.heroInfo}>
                <Text style={s.heroInfoTxt}>{capitalizar(m.especie)} · {m.raza ?? 'Sin raza definida'} · {edad}</Text>
              </View>
            </Animated.View>
          </View>

          {/* ── CARD BLANCO ── */}
          <View style={s.whiteCard}>

            {esDemo && (
              <View style={s.demoBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#F5A623" />
                <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
              </View>
            )}

            <View style={s.secRow}>
              <Text style={s.secTitulo}>Historial clínico</Text>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable style={s.btnAnadir}
                  onPressIn={pressInBtn} onPressOut={pressOutBtn} onPress={abrirModal}>
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={s.btnAnadirTxt}>Añadir</Text>
                </Pressable>
              </Animated.View>
            </View>

            {loading ? (
              <View><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : consultas.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="clipboard-outline" size={42} color="#CCCCCC" />
                <Text style={s.emptyTitulo}>Sin consultas registradas</Text>
                <Text style={s.emptyTxt}>
                  Anotá acá cada visita al veterinario (motivo, indicaciones, notas)
                  para tener el historial clínico completo de {m.nombre}.
                </Text>
              </View>
            ) : (
              consultas.map((c, i) => (
                <CardConsulta key={c.id} consulta={c} index={i} onEliminar={pedirConfirmacionEliminar} />
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

                  <Text style={s.modalTitulo}>Nueva consulta</Text>

                  {/* Motivo */}
                  <TextInput
                    style={[s.input, focusMotivo && s.inputFocus, formErrors.motivo && s.inputError]}
                    placeholder="Motivo de la consulta"
                    placeholderTextColor="#AAAAAA"
                    value={formMotivo}
                    onChangeText={(v) => { setFormMotivo(v); if (formErrors.motivo) setFormErrors((p) => ({ ...p, motivo: null })); }}
                    onFocus={() => setFocusMotivo(true)}
                    onBlur={() => setFocusMotivo(false)}
                    returnKeyType="next"
                  />
                  {formErrors.motivo && <Text style={s.errorTxt}>{formErrors.motivo}</Text>}

                  {/* Fecha */}
                  <TouchableOpacity
                    style={[s.inputFecha, formErrors.fecha && s.inputError]}
                    onPress={() => setShowPickerFecha(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formFecha && { color: '#AAAAAA' }]}>
                      {formFecha ? formatFecha(toISODateLocal(formFecha)) : 'Fecha de la consulta'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#6B6B6B" />
                  </TouchableOpacity>
                  {formErrors.fecha && <Text style={s.errorTxt}>{formErrors.fecha}</Text>}

                  {/* Veterinario */}
                  <TextInput
                    style={[s.input, focusVet && s.inputFocus]}
                    placeholder="Veterinario/a o clínica (opcional)"
                    placeholderTextColor="#AAAAAA"
                    value={formVeterinario}
                    onChangeText={setFormVeterinario}
                    onFocus={() => setFocusVet(true)}
                    onBlur={() => setFocusVet(false)}
                    returnKeyType="next"
                  />

                  {/* Notas */}
                  <TextInput
                    style={[s.input, s.inputMulti, focusNotas && s.inputFocus]}
                    placeholder="Notas: diagnóstico, indicaciones, medicación… (opcional)"
                    placeholderTextColor="#AAAAAA"
                    value={formNotas}
                    onChangeText={setFormNotas}
                    onFocus={() => setFocusNotas(true)}
                    onBlur={() => setFocusNotas(false)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity style={s.btnGuardar} onPress={guardarConsulta} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={s.btnGuardarTxt}>Guardar</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity style={s.btnCancelar} onPress={cerrarModal}>
                    <Text style={s.btnCancelarTxt}>Cancelar</Text>
                  </TouchableOpacity>

                </ScrollView>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fecha picker */}
      <FechaPicker visible={showPickerFecha} titulo="Fecha de la consulta"
        valor={formFecha ?? new Date()}
        onConfirmar={(d) => { setFormFecha(d); setShowPickerFecha(false); if (formErrors.fecha) setFormErrors((p) => ({ ...p, fecha: null })); }}
        onCancelar={() => setShowPickerFecha(false)} />

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

  // Hero
  hero:         { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  petCircle:    { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#A8E6C0', opacity: 0.45, top: -15, alignSelf: 'center' },
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
  emptyWrap:   { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
  emptyTitulo: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
  emptyTxt:    { fontSize: 13, color: '#9A9A9A', textAlign: 'center', lineHeight: 19 },

  // Card consulta (celeste suave, distinta del ámbar de Tratamientos)
  cardConsulta: {
    backgroundColor: '#F2FBF6',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#D4EEDF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardFechaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#D4EEDF',
  },
  cardFechaTxt: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },
  cardMotivo:   { fontSize: 14, fontWeight: '700', color: '#2C2C2C', marginBottom: 3 },
  cardField:    { fontSize: 12, color: '#6B6B6B', marginBottom: 3 },
  cardNotas:    { fontSize: 13, color: '#4A4A4A', lineHeight: 19, marginTop: 2 },

  // Botón eliminar
  btnEliminar: {
    backgroundColor: '#E63946', width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },

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
  inputMulti:   { height: 92, textAlignVertical: 'top', marginBottom: 20 },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: '#FFF',
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: '#2C2C2C' },
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
