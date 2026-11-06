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
import * as ImagePicker from 'expo-image-picker';

import { toISODateLocal } from '../utils/fechaLocal';
import PetHero from '../components/PetHero';
import SelectorMascota from '../components/SelectorMascota';
import { subirImagenPublica } from '../utils/imagenStorage';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { haySesion } from '../config/session';
import { MASCOTA_VACIA } from '../constants/mascotaVacia';
import { fetchMascota, fetchConsultas, crearConsulta, eliminarConsulta } from '../services/fichaMedicaApi';
import FechaPicker from '../components/FechaPicker';
import { colores } from '../theme';
import Skeleton from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** "2026-03-19" → "19/3/2026" */
function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

// ─── COMPONENTE: SKELETON ─────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Skeleton style={s.skeletonCard}>
      <View style={s.skeletonLine1} />
      <View style={s.skeletonLine2} />
      <View style={s.skeletonLine3} />
    </Skeleton>
  );
}

// ─── COMPONENTE: TOAST ────────────────────────────────────────────────────────


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
          <Ionicons name="calendar-outline" size={12} color={colores.verde} />
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
            <Ionicons name="trash-outline" size={16} color={colores.blanco} />
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
      {consulta.imagen_url && (
        <Image source={{ uri: consulta.imagen_url }} style={s.cardImagen} resizeMode="cover" />
      )}
    </Animated.View>
  );
}

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function ConsultasScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  // Estado y no constante: el selector de arriba cambia de mascota sin salir
  // de la pantalla (`cargar` depende de idMascota y recarga solo).
  const [petId, setPetId] = useState(route.params?.petId || null);
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
  const [formImagenUri,   setFormImagenUri]   = useState(null);
  const [formErrors,      setFormErrors]      = useState({});
  const [guardando,       setGuardando]       = useState(false);
  const [showPickerFecha, setShowPickerFecha] = useState(false);
  const [focusMotivo, setFocusMotivo] = useState(false);
  const [focusVet,    setFocusVet]    = useState(false);
  const [focusNotas,  setFocusNotas]  = useState(false);
  const { toast, mostrarToast } = useToast();

  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const heroScale    = useRef(new Animated.Value(0.88)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;

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
      } else if (haySesion()) {
        // Logueado pero sin mascota activa todavía: pantalla vacía, no la
        // mascota de demo (era la de OTRA cuenta, con consultas ajenas).
        setMascota(MASCOTA_VACIA);
        setConsultas([]);
      } else {
        setMascota(DEMO_MASCOTA);
        setConsultas(DEMO_CONSULTAS);
      }
    } catch {
      // Un error de red no puede inventar la mascota ni sus consultas.
      setMascota((m) => m ?? MASCOTA_VACIA);
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


  // ── Modal ────────────────────────────────────────────────────────────────
  function abrirModal() {
    // La fecha arranca en el día de hoy (se calcula acá, al abrir, no al montar
    // la pantalla: si la app queda abierta de un día para el otro, el
    // formulario igual propone la fecha correcta).
    setFormMotivo(''); setFormFecha(new Date()); setFormVeterinario(''); setFormNotas('');
    setFormImagenUri(null); setFormErrors({});
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

  // ── Elegir imagen (galería) ────────────────────────────────────────────────
  async function elegirImagen() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      mostrarToast('Habilitá el acceso a la galería', colores.rojo);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setFormImagenUri(res.assets[0].uri);
  }

  // ── Guardar consulta ──────────────────────────────────────────────────────
  async function guardarConsulta() {
    const errors = {};
    if (!formMotivo.trim()) errors.motivo = 'Este campo es requerido';
    if (!formFecha)         errors.fecha  = 'Seleccioná la fecha de la consulta';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setGuardando(true);
    try {
      // Subir la imagen primero (si hay). Si falla, guardamos igual la consulta
      // sin imagen para no perder la anotación.
      let imagenUrl = null;
      if (formImagenUri) {
        try {
          imagenUrl = await subirImagenPublica(formImagenUri, 'consultas');
        } catch {
          mostrarToast('No se pudo subir la imagen, guardo sin ella', colores.ambar);
        }
      }
      const nueva = await crearConsulta(idMascota, {
        motivo:      formMotivo.trim(),
        fecha:       toISODateLocal(formFecha),
        veterinario: formVeterinario.trim() || null,
        notas:       formNotas.trim() || null,
        imagen_url:  imagenUrl,
      });
      // Insertar manteniendo el orden por fecha descendente
      setConsultas((prev) => [nueva, ...prev].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)));
      cerrarModal();
      mostrarToast('Consulta registrada correctamente', colores.verde);
    } catch (err) {
      // Mostramos el motivo real: con el mensaje genérico no había forma de
      // saber si faltaba una migración, un permiso o la conexión.
      const detalle = err?.message ? `: ${err.message}` : '';
      mostrarToast(`No se pudo guardar la consulta${detalle}`, colores.rojo);
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
      mostrarToast('Consulta eliminada', colores.rojo);
    } catch {
      mostrarToast('No se pudo eliminar la consulta', colores.rojo);
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

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Toast {...toast} />

      <View style={s.screenBg}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top:12, bottom:12, left:12, right:12 }}>
            <Ionicons name="arrow-back" size={26} color={colores.texto} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <SelectorMascota valor={petId} onCambiar={setPetId} style={{ marginBottom: 6 }} />

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={[colores.verde]} tintColor={colores.verde} />
          }>

          {/* ── HERO ── (compartido con Vacunas, Tratamientos y Curiosidades) */}
          <PetHero mascota={m} titulo="Consultas" anim={{ scale: heroScale, opacity: heroOpacity }} />

          {/* ── CARD BLANCO ── */}
          <View style={s.whiteCard}>

            {esDemo && (
              <View style={s.demoBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={colores.ambar} />
                <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
              </View>
            )}

            <View style={s.secRow}>
              <Text style={s.secTitulo}>Historial clínico</Text>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable style={s.btnAnadir}
                  onPressIn={pressInBtn} onPressOut={pressOutBtn} onPress={abrirModal}>
                  <Ionicons name="add" size={16} color={colores.blanco} />
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
                    placeholderTextColor={colores.textoTenue}
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
                    <Text style={[s.inputFechaTxt, !formFecha && { color: colores.textoTenue }]}>
                      {formFecha ? formatFecha(toISODateLocal(formFecha)) : 'Fecha de la consulta'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
                  </TouchableOpacity>
                  {formErrors.fecha && <Text style={s.errorTxt}>{formErrors.fecha}</Text>}

                  {/* Veterinario */}
                  <TextInput
                    style={[s.input, focusVet && s.inputFocus]}
                    placeholder="Veterinario/a o clínica (opcional)"
                    placeholderTextColor={colores.textoTenue}
                    value={formVeterinario}
                    onChangeText={setFormVeterinario}
                    onFocus={() => setFocusVet(true)}
                    onBlur={() => setFocusVet(false)}
                    returnKeyType="next"
                  />

                  {/* Descripción */}
                  <TextInput
                    style={[s.input, s.inputMulti, focusNotas && s.inputFocus]}
                    placeholder="Descripción: diagnóstico, indicaciones… (opcional)"
                    placeholderTextColor={colores.textoTenue}
                    value={formNotas}
                    onChangeText={setFormNotas}
                    onFocus={() => setFocusNotas(true)}
                    onBlur={() => setFocusNotas(false)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  {/* Imagen adjunta (estudio, receta, foto de la lesión, etc.) */}
                  {formImagenUri ? (
                    <View style={s.imgPreviewWrap}>
                      <Image source={{ uri: formImagenUri }} style={s.imgPreview} resizeMode="cover" />
                      <TouchableOpacity style={s.imgQuitar} onPress={() => setFormImagenUri(null)} accessibilityLabel="Quitar imagen">
                        <Ionicons name="close" size={16} color={colores.blanco} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.btnImagen} onPress={elegirImagen}>
                      <Ionicons name="image-outline" size={18} color={colores.verde} />
                      <Text style={s.btnImagenTxt}>Adjuntar imagen (opcional)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={s.btnGuardar} onPress={guardarConsulta} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color={colores.blanco} />
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
  safeArea:      { flex: 1, backgroundColor: colores.menta },
  screenBg:      { flex: 1, width: '100%', backgroundColor: colores.menta },
  scroll:        { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },

  // Hero → components/PetHero.jsx (compartido con Vacunas, Tratamientos y Curiosidades)

  // Card blanco
  whiteCard: {
    backgroundColor: colores.blanco,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
    minHeight: 400,
  },

  // Demo banner
  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16 },
  demoBannerTxt: { fontSize: 12, color: colores.ambar, textAlign: 'center' },

  // Sección row
  secRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitulo: { fontSize: 18, fontWeight: '700', color: colores.texto },

  // Botón Añadir
  btnAnadir: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colores.verde, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  btnAnadirTxt: { fontSize: 14, fontWeight: '700', color: colores.blanco },

  // Empty
  emptyWrap:   { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
  emptyTitulo: { fontSize: 15, fontWeight: '700', color: colores.textoSecundario },
  emptyTxt:    { fontSize: 13, color: colores.textoGris, textAlign: 'center', lineHeight: 19 },

  // Card consulta (celeste suave, distinta del ámbar de Tratamientos)
  cardConsulta: {
    backgroundColor: '#F2FBF6',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#D4EEDF',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardFechaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colores.blanco, borderRadius: 12,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#D4EEDF',
  },
  cardFechaTxt: { fontSize: 12, fontWeight: '700', color: colores.verde },
  cardMotivo:   { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 3 },
  cardField:    { fontSize: 12, color: colores.textoSecundario, marginBottom: 3 },
  cardNotas:    { fontSize: 13, color: '#4A4A4A', lineHeight: 19, marginTop: 2 },
  cardImagen:   { width: '100%', height: 180, borderRadius: 10, marginTop: 10, backgroundColor: colores.gris300 },

  // Botón eliminar
  btnEliminar: {
    backgroundColor: colores.rojo, width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },

  // Skeleton
  skeletonCard:  { backgroundColor: colores.gris300, borderRadius: 12, padding: 16, marginBottom: 10, gap: 8 },
  skeletonLine1: { height: 14, backgroundColor: colores.gris600, borderRadius: 6, width: '60%' },
  skeletonLine2: { height: 11, backgroundColor: colores.gris600, borderRadius: 6, width: '80%' },
  skeletonLine3: { height: 11, backgroundColor: colores.gris600, borderRadius: 6, width: '50%' },

  // Toast

  // Overlay modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: colores.blanco, borderRadius: 20,
    width: Math.min(SCREEN_WIDTH * 0.88, 360),
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
    maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colores.verde, textAlign: 'center', marginBottom: 20 },

  // Inputs del modal
  input: {
    borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colores.texto, backgroundColor: colores.blanco,
    marginBottom: 12,
  },
  inputFocus:   { borderColor: colores.verde },
  inputError:   { borderColor: colores.rojo },
  inputMulti:   { height: 92, textAlignVertical: 'top', marginBottom: 20 },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: colores.blanco,
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: colores.texto },
  errorTxt:  { fontSize: 11, color: colores.rojo, marginTop: -8, marginBottom: 8, marginLeft: 4 },

  // Adjuntar imagen
  btnImagen: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colores.verde, borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 12, marginBottom: 16, backgroundColor: colores.mentaFondo,
  },
  btnImagenTxt: { fontSize: 14, fontWeight: '600', color: colores.verde },
  imgPreviewWrap: { position: 'relative', marginBottom: 16 },
  imgPreview: { width: '100%', height: 160, borderRadius: 10, backgroundColor: colores.gris300 },
  imgQuitar: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Botones del modal
  btnGuardar: {
    width: '100%', height: 48, borderRadius: 30,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },
  btnCancelar:   { width: '100%', height: 44, borderRadius: 30, backgroundColor: colores.gris300, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: colores.texto },
});
