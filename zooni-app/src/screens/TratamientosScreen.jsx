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
import SelectorMascota from '../components/SelectorMascota';
import {
  fetchTratamientos,
  crearTratamiento,
  editarTratamiento as editarTratamientoApi,
  eliminarTratamiento as eliminarTratamientoApi,
} from '../services/fichaMedicaApi';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { MASCOTA_VACIA } from '../constants/mascotaVacia';
import FechaPicker from '../components/FechaPicker';
import { colores } from '../theme';
import Skeleton from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { diasHasta, formatearFecha, toISODateLocal } from '../utils/fechaLocal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatearContadorDias(dias) {
  if (dias === null) return null;
  if (dias > 1)  return `Faltan ${dias} días`;
  if (dias === 1) return 'Falta 1 día';
  if (dias === 0) return 'Vence hoy';
  return `Vencido hace ${Math.abs(dias)} día(s)`;
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

  const dias   = diasHasta(tratamiento.proximo_control);
  const cuenta = formatearContadorDias(dias);
  const colDias = dias !== null && dias <= 0 ? colores.rojo : dias === 0 ? colores.ambar : colores.texto;

  const colorProxControl = () => {
    if (!tratamiento.proximo_control) return colores.textoSecundario;
    if (dias !== null && dias < 0) return colores.rojo;
    if (dias !== null && dias <= 7) return colores.ambar;
    return colores.textoSecundario;
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
        <Text style={s.cardField}>Inicio: {formatearFecha(tratamiento.fecha_inicio) ?? '—'}</Text>
        <Text style={[s.cardField, { color: colorProxControl() }]}>
          Próximo control: {tratamiento.proximo_control ? formatearFecha(tratamiento.proximo_control) : 'Sin fecha'}
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
            <Ionicons name="create-outline" size={18} color={colores.blanco} />
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
            <Ionicons name="trash-outline" size={18} color={colores.blanco} />
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
          <Ionicons name="checkmark" size={12} color={colores.verde} />
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
  // Estado y no constante: el selector de arriba cambia de mascota sin salir
  // de la pantalla (`cargar` depende de idMascota y recarga solo).
  const [petId, setPetId] = useState(route.params?.petId || null);
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
  const { toast, mostrarToast } = useToast();

  // Animaciones del modal
  const modalScale   = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const heroScale    = useRef(new Animated.Value(0.88)).current;
  const heroOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;

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
        // Logueado pero sin mascota activa todavía: pantalla vacía, no la
        // mascota de demo (era la de OTRA cuenta, con tratamientos ajenos).
        setMascota(MASCOTA_VACIA);
        setTratamientosAplicados([]);
        setTratamientosSugeridos([]);
      }
    } catch {
      // Un error de red no puede inventar la mascota ni sus tratamientos.
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
      fecha_inicio:    toISODateLocal(formFechaInicio),
      proximo_control: formProximoControl ? toISODateLocal(formProximoControl) : null,
      veterinaria:     formVeterinaria.trim() || null,
    };
    try {
      if (tratamientoEnEdicion) {
        const editado = await editarTratamientoApi(tratamientoEnEdicion.id, datos);
        setTratamientosAplicados((prev) => prev.map((t) => (t.id === tratamientoEnEdicion.id ? editado : t)));
        cerrarModal();
        mostrarToast('Tratamiento actualizado correctamente', colores.verde);
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
        mostrarToast('Tratamiento registrado correctamente', colores.verde);
      }
    } catch {
      mostrarToast('No se pudo guardar el tratamiento', colores.rojo);
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
      mostrarToast('Tratamiento eliminado', colores.rojo);
    } catch {
      mostrarToast('No se pudo eliminar el tratamiento', colores.rojo);
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

          {/* ── HERO ── (compartido con Vacunas, Consultas y Curiosidades) */}
          <PetHero mascota={m} titulo="Tratamientos" anim={{ scale: heroScale, opacity: heroOpacity }} />

          {/* ── CARD BLANCO ── */}
          <View style={s.whiteCard}>

            {/* Banner demo */}
            {esDemo && (
              <View style={s.demoBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={colores.ambar} />
                <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
              </View>
            )}

            {/* ── Sección aplicados ── */}
            <View style={s.secRow}>
              <Text style={s.secTitulo}>Tratamientos</Text>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable style={s.btnAnadir}
                  onPressIn={pressInBtn} onPressOut={pressOutBtn} onPress={() => abrirModal()}>
                  <Ionicons name="add" size={16} color={colores.blanco} />
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
              <Ionicons name="clipboard-outline" size={16} color={colores.texto} />
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
                    placeholderTextColor={colores.textoTenue}
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
                    <Text style={[s.inputFechaTxt, !formFechaInicio && { color: colores.textoTenue }]}>
                      {formFechaInicio ? formatearFecha(formFechaInicio) : 'dd/mm/aaaa'}
                    </Text>
                    <Text style={s.inputFechaLabel}>Inicio</Text>
                    <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
                  </TouchableOpacity>
                  {formErrors.fechaInicio && <Text style={s.errorTxt}>{formErrors.fechaInicio}</Text>}

                  {/* Próximo control */}
                  <TouchableOpacity
                    style={s.inputFecha}
                    onPress={() => setShowPickerControl(true)}
                  >
                    <Text style={[s.inputFechaTxt, !formProximoControl && { color: colores.textoTenue }]}>
                      {formProximoControl ? formatearFecha(formProximoControl) : 'Próximo control (opcional)'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
                  </TouchableOpacity>

                  {/* Veterinaria */}
                  <TextInput
                    style={[s.input, focusVet && s.inputFocus]}
                    placeholder="Veterinaria (opcional)"
                    placeholderTextColor={colores.textoTenue}
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
                    placeholderTextColor={colores.textoTenue}
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
                      ? <ActivityIndicator size="small" color={colores.blanco} />
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
  safeArea:      { flex: 1, backgroundColor: colores.menta },
  screenBg:      { flex: 1, width: '100%', backgroundColor: colores.menta },
  scroll:        { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },

  // Hero → components/PetHero.jsx (compartido con Vacunas, Consultas y Curiosidades)

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
  emptyTxt: { fontSize: 14, color: colores.textoSecundario, textAlign: 'center', marginTop: 4, marginBottom: 18 },

  // Card aplicado (ámbar)
  cardAplicado: {
    backgroundColor: '#FFFBE6',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#F5E6A3',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardLeft:     { flex: 1, paddingRight: 10, gap: 3 },
  cardRight:    { flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' },
  cardNombre:   { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 4 },
  cardDesc:     { fontSize: 12, color: colores.texto, fontStyle: 'italic', marginBottom: 4 },
  cardField:    { fontSize: 12, color: colores.textoSecundario },
  cardContador: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // Botones editar / eliminar
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

  // Card sugerido (blanco)
  cardSugerido: {
    backgroundColor: colores.blanco,
    borderRadius: 12, borderWidth: 1, borderColor: colores.gris200,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardSugeridoInfo:   { flex: 1, minWidth: 0, paddingRight: 8 },
  sugeridoNombre:     { fontSize: 14, fontWeight: '700', color: colores.texto },
  sugeridoFrecInline: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  btnRegistrar: {
    backgroundColor: colores.verde, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnRegistrarTxt: { fontSize: 13, fontWeight: '700', color: colores.blanco },

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
  inputMulti:   { height: 72, textAlignVertical: 'top', marginBottom: 20 },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: colores.blanco,
  },
  inputFechaTxt:   { flex: 1, fontSize: 14, color: colores.texto },
  inputFechaLabel: { fontSize: 11, color: colores.textoTenue, marginRight: 6 },
  errorTxt:  { fontSize: 11, color: colores.rojo, marginTop: -8, marginBottom: 8, marginLeft: 4 },

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
