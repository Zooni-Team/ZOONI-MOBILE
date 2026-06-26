/**
 * CalendarioScreen.jsx — Calendario de Cuidados de Zooni
 *
 * Permite ver, agregar, editar y eliminar eventos del calendario de una mascota.
 * Navegar desde FichaMedicaScreen pasando route.params.petId.
 *
 * Características:
 * - Cards flotando sobre fondo verde menta #C8F0D8
 * - Color dinámico por proximidad de fecha
 * - FAB centrado (sin eventos) o bottom-right (con eventos)
 * - Modal de añadir/editar con DateTimePicker en dos pasos
 * - Toast de confirmación animado
 * - Skeleton loaders durante la carga inicial
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Animated,
  Platform, SafeAreaView, StatusBar, KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import {
  getColorByProximidad,
  getTextoDias,
  hexToRgba,
} from '../utils/colorProximidad';
// TODO: reemplazar por imports reales cuando se conecte la BD
// import {
//   fetchEventos, createEvento, updateEvento, deleteEvento,
// } from '../api/backend/routes/eventos';

// ─── Datos estáticos de demo ───────────────────────────────────────────────────
const EVENTOS_DEMO = [
  {
    id: 1,
    titulo: 'Turno veterinario',
    descripcion: 'Control anual de Titán. Llevar carnet de vacunas.',
    fecha_hora: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // mañana
    tipo: 'Turno Veterinario',
  },
  {
    id: 2,
    titulo: 'Vacuna antirrábica',
    descripcion: null,
    fecha_hora: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // en 6 días
    tipo: 'Vacuna',
  },
  {
    id: 3,
    titulo: 'Peluquería canina',
    descripcion: 'Baño y corte de pelo.',
    fecha_hora: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // en 12 días
    tipo: 'Peluquería',
  },
  {
    id: 4,
    titulo: 'Paseo en el parque',
    descripcion: null,
    fecha_hora: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // pasado
    tipo: 'Paseo',
  },
];

let _nextId = 5; // contador de IDs para nuevos eventos demo

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIPOS_EVENTO = [
  'Vacuna', 'Turno Veterinario', 'Desparasitación',
  'Peluquería', 'Paseo', 'Medicación', 'Control', 'Otro',
];

// ─── Formato de fecha a "DD/MM/YYYY HH:MM" ────────────────────────────────────
function formatFechaHora(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ─── Skeleton loader de un card ───────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]} />
  );
}

// ─── Card de evento individual ────────────────────────────────────────────────
function EventoCard({ evento, onEditar, onEliminar, entryDelay }) {
  const translateY = useRef(new Animated.Value(14)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const collapseH  = useRef(new Animated.Value(1)).current; // scale para colapso

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0, duration: 280, delay: entryDelay, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 280, delay: entryDelay, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const color = getColorByProximidad(evento.fecha_hora);
  const texto = getTextoDias(evento.fecha_hora);
  const eHoy  = texto === '¡Hoy!';

  // Pulso suave para eventos de hoy
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!eHoy) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [eHoy]);

  return (
    <Animated.View style={[
      styles.card,
      { transform: [{ translateY }], opacity },
    ]}>
      {/* Borde izquierdo de proximidad */}
      <View style={[styles.cardBorder, { backgroundColor: color }]} />

      {/* Fila 1: título + íconos */}
      <View style={styles.cardRow1}>
        <Text style={styles.cardTitulo} numberOfLines={2}>{evento.titulo}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onEditar(evento)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Editar evento"
          >
            <Ionicons name="create-outline" size={22} color="#F5A623" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onEliminar(evento.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Eliminar evento"
          >
            <Ionicons name="trash-outline" size={20} color="#8A8A8A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Fila 2: tipo + badge */}
      <View style={styles.cardRow2}>
        <Text style={[styles.cardTipo, { color }]}>{evento.tipo}</Text>
        <Animated.View style={[
          styles.badge,
          { backgroundColor: hexToRgba(color, 0.12) },
          eHoy && { opacity: pulseOpacity },
        ]}>
          <Text style={[styles.badgeText, { color }]}>{texto}</Text>
        </Animated.View>
      </View>

      {/* Fila 3: fecha y hora */}
      <Text style={styles.cardFecha}>{formatFechaHora(evento.fecha_hora)}</Text>

      {/* Fila 4: descripción (opcional) */}
      {!!evento.descripcion && (
        <Text style={styles.cardDesc} numberOfLines={2} ellipsizeMode="tail">
          {evento.descripcion}
        </Text>
      )}
    </Animated.View>
  );
}

// ─── Toast de confirmación ────────────────────────────────────────────────────
function Toast({ visible, mensaje, color }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[
      styles.toast,
      { backgroundColor: color || '#2DBD72', opacity, transform: [{ translateY }] },
    ]}>
      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.toastText}>{mensaje}</Text>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function CalendarioScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId ?? 1; // fallback demo

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [eventos,        setEventos]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [modalVisible,   setModalVisible]   = useState(false);
  const [modalModo,      setModalModo]      = useState('añadir'); // 'añadir' | 'editar'
  const [eventoEnEdicion, setEventoEnEdicion] = useState(null);
  const [formTitulo,     setFormTitulo]     = useState('');
  const [formDesc,       setFormDesc]       = useState('');
  const [formFechaHora,  setFormFechaHora]  = useState(null);
  const [formTipo,       setFormTipo]       = useState('Vacuna');
  const [formErrors,     setFormErrors]     = useState({ titulo: null, fechaHora: null });
  const [guardando,      setGuardando]      = useState(false);
  // Inputs de texto para fecha y hora (sin dependencia externa)
  const [formFechaStr,   setFormFechaStr]   = useState(''); // "DD/MM/AAAA"
  const [formHoraStr,    setFormHoraStr]    = useState(''); // "HH:MM"

  // Toast
  const [toast, setToast] = useState({ visible: false, mensaje: '', color: '#2DBD72' });
  const toastTimer = useRef(null);

  // Animación del FAB (posición central ↔ bottom-right)
  const fabRight  = useRef(new Animated.Value(SCREEN_WIDTH / 2 - 28)).current;
  const fabBottom = useRef(new Animated.Value(220)).current;

  const tieneEventos = eventos.length > 0;

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    cargarEventos();
  }, [petId]);

  const cargarEventos = useCallback(async () => {
    setLoading(true);
    // TODO: reemplazar con fetchEventos(petId) cuando se conecte la BD
    setTimeout(() => {
      const ordenados = [...EVENTOS_DEMO].sort(
        (a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)
      );
      setEventos(ordenados);
      setLoading(false);
    }, 600); // simula latencia de red
  }, []);

  // ── Animación del FAB según tieneEventos ─────────────────────────────────────
  useEffect(() => {
    Animated.timing(fabRight, {
      toValue: tieneEventos ? 20 : SCREEN_WIDTH / 2 - 28,
      duration: 300, useNativeDriver: false,
    }).start();
    Animated.timing(fabBottom, {
      toValue: tieneEventos ? 32 : 220,
      duration: 300, useNativeDriver: false,
    }).start();
  }, [tieneEventos]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const mostrarToast = (mensaje, color = '#2DBD72') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, mensaje, color });
    toastTimer.current = setTimeout(() => {
      setToast(t => ({ ...t, visible: false }));
    }, 2500);
  };

  // ── Apertura de modales ──────────────────────────────────────────────────────
  const abrirModalAñadir = () => {
    setFormTitulo('');
    setFormDesc('');
    setFormFechaHora(null);
    setFormFechaStr('');
    setFormHoraStr('');
    setFormTipo('Vacuna');
    setFormErrors({ titulo: null, fechaHora: null });
    setEventoEnEdicion(null);
    setModalModo('añadir');
    setModalVisible(true);
  };

  const abrirModalEditar = (evento) => {
    const d = new Date(evento.fecha_hora);
    setFormTitulo(evento.titulo);
    setFormDesc(evento.descripcion ?? '');
    setFormFechaHora(d);
    setFormFechaStr(
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    );
    setFormHoraStr(
      `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    );
    setFormTipo(evento.tipo);
    setFormErrors({ titulo: null, fechaHora: null });
    setEventoEnEdicion(evento);
    setModalModo('editar');
    setModalVisible(true);
  };

  // ── Parseo de los inputs de texto a un Date ──────────────────────────────────
  // Llama esto al cambiar fecha u hora para mantener formFechaHora sincronizado
  const actualizarFechaHora = (fechaStr, horaStr) => {
    // Espera "DD/MM/AAAA" y "HH:MM"
    const fechaReg = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const horaReg  = /^(\d{2}):(\d{2})$/;
    const fMatch = fechaStr.trim().match(fechaReg);
    const hMatch = horaStr.trim().match(horaReg);
    if (fMatch && hMatch) {
      const d = new Date(
        parseInt(fMatch[3]),
        parseInt(fMatch[2]) - 1,
        parseInt(fMatch[1]),
        parseInt(hMatch[1]),
        parseInt(hMatch[2]),
        0
      );
      if (!isNaN(d.getTime())) {
        setFormFechaHora(d);
        setFormErrors(e => ({ ...e, fechaHora: null }));
        return;
      }
    }
    setFormFechaHora(null);
  };

  const onChangeFecha = (text) => {
    // Auto-insertar las barras al tipear: "01" → "01/" → "01/03" → "01/03/"
    let cleaned = text.replace(/[^\d]/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length >= 3) formatted = cleaned.slice(0,2) + '/' + cleaned.slice(2);
    if (cleaned.length >= 5) formatted = cleaned.slice(0,2) + '/' + cleaned.slice(2,4) + '/' + cleaned.slice(4);
    setFormFechaStr(formatted);
    actualizarFechaHora(formatted, formHoraStr);
  };

  const onChangeHora = (text) => {
    // Auto-insertar los dos puntos: "14" → "14:" → "14:30"
    let cleaned = text.replace(/[^\d]/g, '');
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
    let formatted = cleaned;
    if (cleaned.length >= 3) formatted = cleaned.slice(0,2) + ':' + cleaned.slice(2);
    setFormHoraStr(formatted);
    actualizarFechaHora(formFechaStr, formatted);
  };

  // ── Guardar evento (añadir o editar) ─────────────────────────────────────────
  const guardarEvento = async () => {
    const errors = { titulo: null, fechaHora: null };
    if (!formTitulo.trim()) errors.titulo = 'Este campo es requerido';
    if (!formFechaHora)     errors.fechaHora = 'Seleccioná fecha y hora';
    if (errors.titulo || errors.fechaHora) {
      setFormErrors(errors);
      return;
    }

    setGuardando(true);

    // Simula latencia de red
    await new Promise(r => setTimeout(r, 400));

    // TODO: reemplazar el bloque siguiente con createEvento/updateEvento cuando se conecte la BD
    if (modalModo === 'añadir') {
      const nuevo = {
        id: _nextId++,
        titulo: formTitulo.trim(),
        descripcion: formDesc.trim() || null,
        fecha_hora: formFechaHora.toISOString(),
        tipo: formTipo,
      };
      setEventos(prev =>
        [...prev, nuevo].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
      );
      mostrarToast('Evento registrado correctamente');
    } else {
      const actualizado = {
        ...eventoEnEdicion,
        titulo: formTitulo.trim(),
        descripcion: formDesc.trim() || null,
        fecha_hora: formFechaHora.toISOString(),
        tipo: formTipo,
      };
      setEventos(prev =>
        prev.map(e => e.id === actualizado.id ? actualizado : e)
           .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
      );
      mostrarToast('Evento actualizado correctamente');
    }

    setGuardando(false);
    setModalVisible(false);
  };

  // ── Eliminar evento (optimistic UI) ──────────────────────────────────────────
  const eliminarEvento = (eventoId) => {
    Alert.alert(
      'Eliminar evento',
      '¿Estás seguro de que querés eliminar este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => {
            // TODO: agregar deleteEvento(petId, eventoId) cuando se conecte la BD
            setEventos(prev => prev.filter(e => e.id !== eventoId));
            mostrarToast('Evento eliminado', '#E63946');
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Toast */}
      <Toast visible={toast.visible} mensaje={toast.mensaje} color={toast.color} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Volver"
        >
          <Ionicons name="menu" size={26} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      {/* ── Título ── */}
      <Text style={styles.screenTitle}>Calendario de Cuidados</Text>

      {/* ── Lista de eventos / estados ── */}
      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : !tieneEventos ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay eventos programados.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {eventos.map((evento, idx) => (
            <EventoCard
              key={evento.id}
              evento={evento}
              onEditar={abrirModalEditar}
              onEliminar={eliminarEvento}
              entryDelay={idx * 70}
            />
          ))}
          {/* Espacio al fondo para que el FAB no tape el último card */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Ilustración de pasto (absoluta, fondo) ── */}
      <View style={styles.grassContainer} pointerEvents="none">
        <View style={styles.grassBar} />
        <View style={styles.grassBarLight} />
      </View>

      {/* ── FAB ── */}
      <Animated.View style={[styles.fab, { right: fabRight, bottom: fabBottom }]}>
        <TouchableOpacity
          style={styles.fabInner}
          onPress={abrirModalAñadir}
          activeOpacity={0.85}
          accessibilityLabel="Agregar evento"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Modal añadir / editar ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.modalCard}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Título del modal */}
            <Text style={styles.modalTitulo}>
              {modalModo === 'añadir' ? 'Nuevo evento' : 'Editar evento'}
            </Text>

            {/* Campo: título */}
            <TextInput
              style={[
                styles.input,
                formErrors.titulo && styles.inputError,
              ]}
              placeholder="Título del evento"
              placeholderTextColor="#AAAAAA"
              value={formTitulo}
              onChangeText={t => {
                setFormTitulo(t);
                if (t.trim()) setFormErrors(e => ({ ...e, titulo: null }));
              }}
              maxLength={150}
              returnKeyType="next"
            />
            {!!formErrors.titulo && (
              <Text style={styles.errorText}>{formErrors.titulo}</Text>
            )}

            {/* Campo: descripción */}
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Descripción opcional"
              placeholderTextColor="#AAAAAA"
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Campo: fecha y hora — dos inputs de texto */}
            <View style={styles.fechaHoraRow}>
              <View style={[
                styles.fechaInput,
                formErrors.fechaHora && styles.inputError,
              ]}>
                <Ionicons name="calendar-outline" size={15} color="#6B6B6B" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.fechaInputText}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#AAAAAA"
                  value={formFechaStr}
                  onChangeText={onChangeFecha}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>
              <View style={[
                styles.horaInput,
                formErrors.fechaHora && styles.inputError,
              ]}>
                <Ionicons name="time-outline" size={15} color="#6B6B6B" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.fechaInputText}
                  placeholder="HH:MM"
                  placeholderTextColor="#AAAAAA"
                  value={formHoraStr}
                  onChangeText={onChangeHora}
                  keyboardType="numeric"
                  maxLength={5}
                  returnKeyType="done"
                />
              </View>
            </View>
            {!!formErrors.fechaHora && (
              <Text style={styles.errorText}>{formErrors.fechaHora}</Text>
            )}

            {/* Campo: tipo de evento — chips */}
            <Text style={styles.tipoLabel}>Tipo de evento</Text>
            <View style={styles.tiposGrid}>
              {TIPOS_EVENTO.map(tipo => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.tipoChip,
                    formTipo === tipo && styles.tipoChipActivo,
                  ]}
                  onPress={() => setFormTipo(tipo)}
                >
                  <Text style={[
                    styles.tipoChipText,
                    formTipo === tipo && styles.tipoChipTextActivo,
                  ]}>
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Botón Guardar */}
            <TouchableOpacity
              style={styles.btnGuardar}
              onPress={guardarEvento}
              disabled={guardando}
              activeOpacity={0.88}
            >
              {guardando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnGuardarText}>
                  {modalModo === 'añadir' ? 'Guardar' : 'Guardar cambios'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Botón Cancelar */}
            <TouchableOpacity
              style={styles.btnCancelar}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#C8F0D8',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C2C2C',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 200,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    height: 90,
    marginBottom: 12,
  },

  // Card de evento
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBorder: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  cardTitulo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    marginRight: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  cardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingLeft: 8,
  },
  cardTipo: {
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFecha: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 4,
    paddingLeft: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
    paddingLeft: 8,
  },

  // FAB
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 6,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ilustración de pasto (simulada con bandas de color)
  grassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    overflow: 'hidden',
    zIndex: 0,
  },
  grassBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#A8D8B8',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    opacity: 0.5,
  },
  grassBarLight: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 50,
    backgroundColor: '#7FCFA0',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    opacity: 0.4,
  },

  // Toast
  toast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2DBD72',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Inputs
  input: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2C2C2C',
    marginBottom: 12,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#E63946',
  },
  inputRow: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputRowText: {
    fontSize: 14,
    color: '#2C2C2C',
    flex: 1,
  },
  // Fecha y hora como dos inputs side-by-side
  fechaHoraRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  fechaInput: {
    flex: 2,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  horaInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fechaInputText: {
    flex: 1,
    fontSize: 14,
    color: '#2C2C2C',
    padding: 0,
  },  errorText: {
    fontSize: 11,
    color: '#E63946',
    marginTop: -8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  picker: {
    flex: 1,
    color: '#2C2C2C',
    height: 44,
    marginVertical: -10,
  },
  pickerItem: {
    fontSize: 14,
    color: '#2C2C2C',
  },
  // Tipo de evento — chips
  tipoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  tiposGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tipoChip: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F7F7F7',
  },
  tipoChipActivo: {
    borderColor: '#2DBD72',
    backgroundColor: '#E8F9F0',
  },
  tipoChipText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  tipoChipTextActivo: {
    color: '#2DBD72',
    fontWeight: '700',
  },

  // Botones del modal
  btnGuardar: {
    width: '100%',
    height: 48,
    borderRadius: 30,
    backgroundColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 4,
  },
  btnGuardarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnCancelar: {
    width: '100%',
    height: 44,
    borderRadius: 30,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnCancelarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2C',
  },
});
