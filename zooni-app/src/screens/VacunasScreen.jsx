/**
 * VacunasScreen.jsx — Pantalla "Vacunas" de Zooni
 *
 * Navega desde FichaMedicaScreen con { petId }.
 * Muestra vacunas aplicadas (editables/eliminables) y el calendario sugerido
 * según la especie de la mascota, con opción de marcar cada una como aplicada.
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
import SelectorMascota from '../components/SelectorMascota';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { MASCOTA_VACIA } from '../constants/mascotaVacia';
import FechaPicker from '../components/FechaPicker';
import {
  fetchVacunas,
  crearVacunaAplicada,
  marcarVacunaSugerida,
  editarVacunaAplicada,
  eliminarVacunaAplicada,
} from '../services/fichaMedicaApi';
import { colores } from '../theme';
import Skeleton from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { diasHasta, formatearFecha, toISODateLocal } from '../utils/fechaLocal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Color de la línea "Próxima dosis" de un card aplicado. */
function colorProximaDosis(fechaISO) {
  if (!fechaISO) return colores.textoSecundario;
  const dias = diasHasta(fechaISO);
  if (dias < 0) return colores.rojo;
  if (dias <= 30) return colores.ambar;
  return colores.textoSecundario;
}

/** Estado + color de una vacuna sugerida (calendario). */
function estadoSugerida(sugerida) {
  // La lista ya viene filtrada por edad, peso y raza (fetchVacunas): si
  // aparece y no está aplicada, le corresponde y falta. Antes decía "Aún no
  // corresponde" a un perro de 1 año y 7 meses sin la Séxtuple.
  if (!sugerida.applied) return { texto: 'Pendiente', color: colores.ambar };
  const dias = diasHasta(sugerida.proximo_refuerzo);
  if (dias === null) return { texto: 'Al día', color: colores.verde };
  if (dias < 0) return { texto: 'Vencida', color: colores.rojo };
  if (dias <= 30) return { texto: 'Refuerzo próximo', color: colores.ambar };
  return { texto: 'Al día', color: colores.verde };
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

// ─── COMPONENTE: CARD VACUNA APLICADA ─────────────────────────────────────────

function CardAplicado({ vacuna, onEditar, onEliminar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scaleEdit  = useRef(new Animated.Value(1)).current;
  const scaleDel   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  const pressIn  = (scale) => Animated.timing(scale, { toValue: 0.90, duration: 100, useNativeDriver: true }).start();
  const pressOut = (scale) => Animated.timing(scale, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.cardAplicado, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardLeft}>
        <Text style={s.cardNombre}>{vacuna.nombre}</Text>
        {vacuna.descripcion ? (
          <Text style={s.cardDesc}>{vacuna.descripcion}</Text>
        ) : null}
        <Text style={s.cardField}>Aplicada: {formatearFecha(vacuna.fecha_aplicacion) ?? '—'}</Text>
        <Text style={[s.cardField, { color: colorProximaDosis(vacuna.proximo_refuerzo) }]}>
          Próxima dosis: {vacuna.proximo_refuerzo ? formatearFecha(vacuna.proximo_refuerzo) : '—'}
        </Text>
        <Text style={s.cardField} numberOfLines={1} ellipsizeMode="tail">
          Veterinaria: {vacuna.veterinaria ?? 'Sin registro'}
        </Text>
      </View>
      <View style={s.cardRight}>
        <Animated.View style={{ transform: [{ scale: scaleEdit }] }}>
          <Pressable
            style={s.btnEditar}
            onPressIn={() => pressIn(scaleEdit)}
            onPressOut={() => pressOut(scaleEdit)}
            onPress={() => onEditar(vacuna)}
            accessibilityLabel="Editar vacuna"
          >
            <Ionicons name="create-outline" size={18} color={colores.blanco} />
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: scaleDel }] }}>
          <Pressable
            style={s.btnEliminar}
            onPressIn={() => pressIn(scaleDel)}
            onPressOut={() => pressOut(scaleDel)}
            onPress={() => onEliminar(vacuna.id)}
            accessibilityLabel="Eliminar vacuna"
          >
            <Ionicons name="trash-outline" size={18} color={colores.blanco} />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── COMPONENTE: CARD VACUNA SUGERIDA ─────────────────────────────────────────

function CardSugerido({ sugerido, index, onMarcar }) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scaleBtn   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const estado = estadoSugerida(sugerido);

  const press = () => {
    Animated.sequence([
      Animated.timing(scaleBtn, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleBtn, { toValue: 1,    duration: 150, useNativeDriver: true }),
    ]).start();
    onMarcar(sugerido);
  };

  return (
    <Animated.View style={[s.cardSugerido, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardSugeridoLeft}>
        <Text style={s.sugeridoNombre}>{sugerido.nombre}</Text>
        {/* "1 de 3", "Refuerzo": ubica la vacuna dentro del plan. Sin esto,
            tres dosis de la misma vacuna se leían como tres vacunas sueltas. */}
        {!!sugerido.dosis && <Text style={s.sugeridoDosis}>{sugerido.dosis}</Text>}
      </View>
      <View style={s.cardSugeridoRight}>
        <Text style={[s.sugeridoEstado, { color: estado.color }]}>{estado.texto}</Text>
        <Text style={s.sugeridoFrec}>{sugerido.frecuencia_descripcion}</Text>
        {sugerido.applied ? (
          <View style={s.badgeAplicada}>
            <Ionicons name="checkmark" size={12} color={colores.verde} />
            <Text style={s.badgeAplicadaTxt}>Aplicada</Text>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleBtn }] }}>
            <Pressable style={s.btnMarcar} onPress={press}>
              <Text style={s.btnMarcarTxt}>Marcar</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── DATOS DEMO (sin backend de vacunas conectado) ───────────────────────────

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function VacunasScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Estado y no constante: con más de una mascota el selector de arriba la
  // cambia sin salir de la pantalla (`cargar` depende de idMascota y recarga).
  const [petId, setPetId] = useState(route.params?.petId || null);

  const { mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();

  const [mascota,          setMascota]          = useState(null);
  const [vacunasAplicadas, setVacunasAplicadas] = useState([]);
  const [vacunasSugeridas, setVacunasSugeridas] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);

  const [modalVisible,          setModalVisible]          = useState(false);
  const [modalModo,              setModalModo]             = useState('añadir'); // 'añadir' | 'marcar' | 'editar'
  const [vacunaEnEdicion,        setVacunaEnEdicion]       = useState(null);
  const [vacunaPreseleccionada,  setVacunaPreseleccionada] = useState(null);

  const [formTitulo,      setFormTitulo]      = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha,       setFormFecha]       = useState(null);
  const [formTipo,        setFormTipo]        = useState('Vacuna');
  const [formVeterinaria, setFormVeterinaria] = useState('');
  const [formErrors,      setFormErrors]      = useState({});

  const [guardando,        setGuardando]        = useState(false);
  const [showFechaPicker,  setShowFechaPicker]  = useState(false);

  const { toast, mostrarToast } = useToast();

  const heroScale   = useRef(new Animated.Value(0.88)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const idMascota = petId ?? mascotaActivaDemo?.id;

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      if (idMascota) {
        const { mascota: m, aplicadas, sugeridas } = await fetchVacunas(idMascota);
        setMascota(m);
        setVacunasAplicadas(aplicadas);
        setVacunasSugeridas(sugeridas);
      } else {
        // Logueado pero sin mascota activa todavía: pantalla vacía, no la
        // mascota de demo (era la de OTRA cuenta, con vacunas ajenas).
        setMascota(MASCOTA_VACIA);
        setVacunasAplicadas([]);
        setVacunasSugeridas([]);
      }
    } catch {
      // Un error de red no puede inventar la mascota ni sus vacunas: se conserva
      // lo último bueno y, si no había nada, queda el placeholder neutro.
      setMascota((m) => m ?? MASCOTA_VACIA);
    }
    setLoading(false);
    Animated.parallel([
      Animated.timing(heroScale,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [heroOpacity, heroScale, idMascota]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar(true);
    setRefreshing(false);
  }, [cargar]);

  // ── Modal ────────────────────────────────────────────────────────────────
  // La fecha de aplicación arranca en el día de hoy (se calcula al abrir el
  // modal, así el valor sigue siendo correcto si la app quedó abierta de un
  // día para el otro). Igual que en Tratamientos y Consultas.
  function abrirModalAnadir() {
    setFormTitulo(''); setFormDescripcion(''); setFormFecha(new Date());
    setFormTipo('Vacuna'); setFormVeterinaria(''); setFormErrors({});
    setVacunaEnEdicion(null); setVacunaPreseleccionada(null);
    setModalModo('añadir');
    abrirModal();
  }

  function abrirModalMarcar(sugerida) {
    setFormTitulo(sugerida.nombre); setFormDescripcion(''); setFormFecha(new Date());
    setFormTipo('Vacuna'); setFormVeterinaria(''); setFormErrors({});
    setVacunaPreseleccionada(sugerida); setVacunaEnEdicion(null);
    setModalModo('marcar');
    abrirModal();
  }

  function abrirModalEditar(vacuna) {
    setFormTitulo(vacuna.nombre);
    setFormDescripcion(vacuna.descripcion ?? '');
    setFormFecha(parseFechaLocal(vacuna.fecha_aplicacion));
    setFormTipo(vacuna.tipo ?? 'Vacuna');
    setFormVeterinaria(vacuna.veterinaria ?? '');
    setFormErrors({});
    setVacunaEnEdicion(vacuna); setVacunaPreseleccionada(null);
    setModalModo('editar');
    abrirModal();
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

  // ── Guardar (añadir / marcar / editar) ─────────────────────────────────────
  async function guardarVacuna() {
    const errors = {};
    if (!formTitulo.trim()) errors.titulo = 'Este campo es requerido';
    if (!formFecha)         errors.fecha  = 'Seleccioná una fecha';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setGuardando(true);

    const fechaISO = toISODateLocal(formFecha);
    const frecuenciaMeses = vacunaPreseleccionada?.frecuencia_descripcion?.includes('6 meses') ? 6 : 12;
    const proximoRefuerzo = (() => {
      const d = new Date(formFecha);
      d.setMonth(d.getMonth() + frecuenciaMeses);
      return toISODateLocal(d);
    })();

    try {
      if (modalModo === 'añadir') {
        const nueva = await crearVacunaAplicada(idMascota, {
          nombre: formTitulo.trim(),
          descripcion: formDescripcion.trim() || null,
          fecha_aplicacion: fechaISO,
          proximo_refuerzo: null,
          tipo: formTipo,
          veterinaria: formVeterinaria.trim() || null,
        });
        setVacunasAplicadas((prev) => [nueva, ...prev]);
        cerrarModal();
        mostrarToast('Vacuna registrada correctamente', colores.verde);
      } else if (modalModo === 'marcar') {
        const nueva = await marcarVacunaSugerida(idMascota, vacunaPreseleccionada.id, {
          descripcion: formDescripcion.trim() || null,
          fecha_aplicacion: fechaISO,
          proximo_refuerzo: proximoRefuerzo,
          tipo: formTipo,
          veterinaria: formVeterinaria.trim() || null,
        });
        setVacunasAplicadas((prev) => [nueva, ...prev]);
        setVacunasSugeridas((prev) => prev.map((sg) => (
          sg.id === vacunaPreseleccionada.id
            ? { ...sg, applied: true, proximo_refuerzo: proximoRefuerzo }
            : sg
        )));
        cerrarModal();
        mostrarToast('Vacuna registrada correctamente', colores.verde);
      } else {
        const editada = await editarVacunaAplicada(vacunaEnEdicion.id, {
          nombre: formTitulo.trim(),
          descripcion: formDescripcion.trim() || null,
          fecha_aplicacion: fechaISO,
          tipo: formTipo,
          veterinaria: formVeterinaria.trim() || null,
        });
        setVacunasAplicadas((prev) => prev.map((v) => (v.id === vacunaEnEdicion.id ? editada : v)));
        cerrarModal();
        mostrarToast('Vacuna actualizada correctamente', colores.verde);
      }
    } catch {
      mostrarToast('No se pudo guardar la vacuna', colores.rojo);
    } finally {
      setGuardando(false);
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  function eliminarVacuna(vacunaId) {
    // Alert.alert con botones es un no-op en react-native-web: en el navegador
    // nunca aparecía el diálogo (ni el botón "Eliminar" se llegaba a tocar).
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) confirmarEliminar(vacunaId);
      return;
    }
    Alert.alert(
      '¿Eliminar vacuna?',
      '¿Seguro que querés eliminar este registro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmarEliminar(vacunaId) },
      ],
    );
  }

  async function confirmarEliminar(vacunaId) {
    const vacuna = vacunasAplicadas.find((v) => v.id === vacunaId);
    try {
      await eliminarVacunaAplicada(vacunaId);
      setVacunasAplicadas((prev) => prev.filter((v) => v.id !== vacunaId));
      // Si venía del calendario sugerido, esa tarjeta tiene que volver a
      // mostrarse como pendiente — si no, quedaba marcada "Aplicada" para
      // siempre y no dejaba volver a registrarla.
      if (vacuna?.vacuna_sugerida_id != null) {
        setVacunasSugeridas((prev) => prev.map((sg) => (
          sg.id === vacuna.vacuna_sugerida_id
            ? { ...sg, applied: false, proximo_refuerzo: null }
            : sg
        )));
      }
      mostrarToast('Vacuna eliminada', colores.rojo);
    } catch {
      mostrarToast('No se pudo eliminar la vacuna', colores.rojo);
    }
  }

  // ── Datos de la mascota ────────────────────────────────────────────────────
  const m = mascota ?? mascotaActivaDemo ?? {
    nombre: 'Tu mascota', especie: 'perro', raza: null,
    peso: null, fecha_nacimiento: null, imagen_asset: 'perro_default',
  };

  const tituloModal = modalModo === 'editar' ? 'Editar vacuna'
    : modalModo === 'marcar' ? 'Marcar vacuna'
    : 'Nueva vacuna';
  const tituloEditable = modalModo === 'añadir' || modalModo === 'editar';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Toast {...toast} />

      <View style={s.screenBg}>

        {/* Header mínimo */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={26} color={colores.texto} />
          </TouchableOpacity>
        </View>

        <SelectorMascota valor={petId} onCambiar={setPetId} style={{ marginBottom: 6 }} />

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={[colores.verde]} tintColor={colores.verde} />
          }>

          {/* ── HERO ── (compartido con Tratamientos, Consultas y Curiosidades) */}
          <PetHero mascota={m} titulo="Vacunas" anim={{ scale: heroScale, opacity: heroOpacity }} />

          {/* ── CARD BLANCO ── */}
          <View style={s.whiteCard}>

            {/* ── SECCIÓN VACUNAS APLICADAS ── */}
            <View style={s.secRow}>
              <Text style={s.secTitulo}>Vacunas</Text>
              <TouchableOpacity style={s.btnAnadir} onPress={abrirModalAnadir}>
                <Ionicons name="add" size={16} color={colores.blanco} />
                <Text style={s.btnAnadirTxt}>Añadir</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View><SkeletonCard /><SkeletonCard /></View>
            ) : vacunasAplicadas.length === 0 ? (
              <View style={s.emptyRow}>
                <Ionicons name="create-outline" size={14} color={colores.textoSecundario} />
                <Text style={s.emptyTxt}>No hay vacunas registradas</Text>
              </View>
            ) : (
              vacunasAplicadas.map((v) => (
                <CardAplicado key={v.id} vacuna={v} onEditar={abrirModalEditar} onEliminar={eliminarVacuna} />
              ))
            )}

            {/* ── SECCIÓN CALENDARIO SUGERIDO ── */}
            <View style={s.secSugeridosRow}>
              <Ionicons name="calendar-outline" size={16} color={colores.texto} />
              <Text style={s.secSugeridosTitulo}>Vacunas sugeridas</Text>
            </View>

            {loading ? (
              <View><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : vacunasSugeridas.length === 0 ? (
              <Text style={s.emptyTxt}>No hay vacunas sugeridas para esta especie</Text>
            ) : (
              vacunasSugeridas.map((sug, i) => (
                <CardSugerido key={sug.id} sugerido={sug} index={i} onMarcar={abrirModalMarcar} />
              ))
            )}

          </View>
        </ScrollView>
      </View>

      {/* ── MODAL AÑADIR / MARCAR / EDITAR ── */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={cerrarModal}>
            <TouchableOpacity activeOpacity={1}>
              <Animated.View style={[s.modalCard, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                  <Text style={s.modalTitulo}>{tituloModal}</Text>

                  {/* Título / nombre */}
                  <TextInput
                    style={[s.input, !tituloEditable && s.inputDisabled, formErrors.titulo && s.inputError]}
                    placeholder="Nombre de la vacuna"
                    placeholderTextColor={colores.textoTenue}
                    value={formTitulo}
                    editable={tituloEditable}
                    onChangeText={(v) => { setFormTitulo(v); if (formErrors.titulo) setFormErrors((p) => ({ ...p, titulo: null })); }}
                    returnKeyType="next"
                  />
                  {formErrors.titulo && <Text style={s.errorTxt}>{formErrors.titulo}</Text>}

                  {/* Descripción */}
                  <TextInput
                    style={[s.input, s.inputMulti]}
                    placeholder="Descripción opcional"
                    placeholderTextColor={colores.textoTenue}
                    value={formDescripcion}
                    onChangeText={setFormDescripcion}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {/* Fecha */}
                  <TouchableOpacity
                    style={[s.inputFecha, formErrors.fecha && s.inputError]}
                    onPress={() => setShowFechaPicker(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formFecha && { color: colores.textoTenue }]}>
                      {formFecha ? formatearFecha(formFecha) : 'dd/mm/aaaa'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
                  </TouchableOpacity>
                  {formErrors.fecha && <Text style={s.errorTxt}>{formErrors.fecha}</Text>}

                  {/* Tipo — fijo en "Vacuna": esta pantalla es específicamente de
                      vacunas, no tiene sentido registrar acá un tratamiento o una
                      desparasitación (para eso está la pantalla de Tratamientos). */}
                  <View style={[s.inputFecha, s.inputDisabled]}>
                    <Text style={s.inputFechaTxt}>{formTipo}</Text>
                  </View>

                  {/* Veterinaria */}
                  <TextInput
                    style={s.input}
                    placeholder="Veterinaria (opcional)"
                    placeholderTextColor={colores.textoTenue}
                    value={formVeterinaria}
                    onChangeText={setFormVeterinaria}
                    returnKeyType="done"
                  />

                  {/* Botón Guardar */}
                  <TouchableOpacity style={s.btnGuardar} onPress={guardarVacuna} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color={colores.blanco} />
                      : <Text style={s.btnGuardarTxt}>{modalModo === 'editar' ? 'Guardar cambios' : 'Guardar'}</Text>
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

      <FechaPicker
        visible={showFechaPicker}
        titulo="Fecha de aplicación"
        valor={formFecha ?? new Date()}
        onConfirmar={(d) => { setFormFecha(d); setShowFechaPicker(false); if (formErrors.fecha) setFormErrors((p) => ({ ...p, fecha: null })); }}
        onCancelar={() => setShowFechaPicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: colores.menta },
  screenBg:      { flex: 1, width: '100%', backgroundColor: colores.menta },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },

  // Hero → components/PetHero.jsx (compartido con Tratamientos, Consultas y Curiosidades)

  // Card blanco (mismo bottom sheet que Tratamientos y Consultas)
  whiteCard: {
    backgroundColor: colores.blanco,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
    minHeight: 400,
  },

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
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 18 },
  emptyTxt: { fontSize: 14, color: colores.textoSecundario, textAlign: 'center', marginTop: 4, marginBottom: 18 },

  // Card aplicado
  cardAplicado: {
    backgroundColor: colores.blanco,
    borderRadius: 14, borderWidth: 1, borderColor: colores.gris200,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardLeft:   { flex: 1, paddingRight: 10, gap: 3 },
  cardRight:  { flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' },
  cardNombre: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 4 },
  cardDesc:   { fontSize: 12, color: colores.texto, fontStyle: 'italic', marginBottom: 4 },
  cardField:  { fontSize: 12, color: colores.textoSecundario },

  btnEditar: {
    backgroundColor: colores.turquesa, width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnEliminar: {
    backgroundColor: colores.rojo, width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },

  // Sección sugeridos
  secSugeridosRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  secSugeridosTitulo: { fontSize: 16, fontWeight: '700', color: colores.texto },

  // Card sugerido
  cardSugerido: {
    backgroundColor: colores.blanco,
    borderRadius: 12, borderWidth: 1, borderColor: colores.gris200,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  // minWidth: 0 + maxWidth en la columna de al lado: sin esto, un texto largo
  // en cualquiera de los dos lados (nombre o frecuencia) puede empujar al otro
  // a un ancho casi nulo y el texto se parte letra por letra (bug real visto
  // con una frecuencia larga).
  cardSugeridoLeft:  { flex: 1, minWidth: 0, paddingRight: 8 },
  cardSugeridoRight: { maxWidth: '45%', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  sugeridoNombre: { fontSize: 14, fontWeight: '700', color: colores.texto },
  sugeridoDosis:  { fontSize: 11, color: colores.verdeOscuro, fontWeight: '700', marginTop: 2 },
  sugeridoEstado: { fontSize: 12, textAlign: 'right' },
  sugeridoFrec:   { fontSize: 12, color: colores.textoSecundario, textAlign: 'right' },

  btnMarcar: {
    backgroundColor: colores.verde, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnMarcarTxt: { fontSize: 13, fontWeight: '700', color: colores.blanco },

  badgeAplicada: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8F8F0', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10,
  },
  badgeAplicadaTxt: { fontSize: 12, fontWeight: '700', color: colores.verde },

  // Skeleton
  skeletonCard:  { backgroundColor: colores.gris300, borderRadius: 12, padding: 16, marginBottom: 10, gap: 8 },
  skeletonLine1: { height: 14, backgroundColor: colores.gris600, borderRadius: 6, width: '60%' },
  skeletonLine2: { height: 11, backgroundColor: colores.gris600, borderRadius: 6, width: '80%' },
  skeletonLine3: { height: 11, backgroundColor: colores.gris600, borderRadius: 6, width: '50%' },

  // Toast

  // Modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: colores.blanco, borderRadius: 20,
    width: Math.min(SCREEN_WIDTH * 0.88, 360),
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
    maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colores.verde, textAlign: 'center', marginBottom: 20 },

  input: {
    borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colores.texto, backgroundColor: colores.blanco,
    marginBottom: 12,
  },
  inputDisabled: { backgroundColor: colores.gris50, color: colores.texto },
  inputError:    { borderColor: colores.rojo },
  inputMulti:    { height: 80, textAlignVertical: 'top' },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: colores.blanco,
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: colores.texto },
  errorTxt:      { fontSize: 11, color: colores.rojo, marginTop: -8, marginBottom: 8, marginLeft: 4 },

  btnGuardar: {
    width: '100%', height: 48, borderRadius: 30,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },
  btnCancelar:   { width: '100%', height: 44, borderRadius: 30, backgroundColor: colores.gris300, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: colores.texto },
});
