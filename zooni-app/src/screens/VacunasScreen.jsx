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
import { parseFechaLocal } from '../utils/fechaLocal';
import { resolveMascotaVisual } from '../constants/petImages';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import {
  fetchVacunas,
  crearVacunaAplicada,
  marcarVacunaSugerida,
  editarVacunaAplicada,
  eliminarVacunaAplicada,
} from '../services/fichaMedicaApi';

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

function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = parseFechaLocal(fechaISO); fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

/** Color de la línea "Próxima dosis" de un card aplicado. */
function colorProximaDosis(fechaISO) {
  if (!fechaISO) return '#6B6B6B';
  const dias = diasHasta(fechaISO);
  if (dias < 0) return '#E63946';
  if (dias <= 30) return '#F5A623';
  return '#6B6B6B';
}

/** Estado + color de una vacuna sugerida (calendario). */
function estadoSugerida(sugerida) {
  if (!sugerida.applied) return { texto: 'Aún no corresponde', color: '#6B6B6B' };
  const dias = diasHasta(sugerida.proximo_refuerzo);
  if (dias === null) return { texto: 'Al día', color: '#2DBD72' };
  if (dias < 0) return { texto: 'Vencida', color: '#E63946' };
  if (dias <= 30) return { texto: 'Refuerzo próximo', color: '#F5A623' };
  return { texto: 'Al día', color: '#2DBD72' };
}

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

// ─── COMPONENTE: IMAGEN MASCOTA (sin sombra, evita el artefacto rectangular) ──

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
        <Text style={s.cardField}>Aplicada: {formatFecha(vacuna.fecha_aplicacion) ?? '—'}</Text>
        <Text style={[s.cardField, { color: colorProximaDosis(vacuna.proximo_refuerzo) }]}>
          Próxima dosis: {vacuna.proximo_refuerzo ? formatFecha(vacuna.proximo_refuerzo) : '—'}
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
            <Ionicons name="create-outline" size={18} color="#FFF" />
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
            <Ionicons name="trash-outline" size={18} color="#FFF" />
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
      </View>
      <View style={s.cardSugeridoRight}>
        <Text style={[s.sugeridoEstado, { color: estado.color }]}>{estado.texto}</Text>
        <Text style={s.sugeridoFrec}>{sugerido.frecuencia_descripcion}</Text>
        {sugerido.applied ? (
          <View style={s.badgeAplicada}>
            <Ionicons name="checkmark" size={12} color="#2DBD72" />
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

// ─── COMPONENTE: FECHA PICKER (modal propio, sin dependencias externas) ──────

function FechaPicker({ visible, valor, onConfirmar, onCancelar }) {
  const hoy = new Date();

  const [dia,  setDia]  = useState((valor ?? hoy).getDate());
  const [mes,  setMes]  = useState((valor ?? hoy).getMonth() + 1);
  const [anio, setAnio] = useState((valor ?? hoy).getFullYear());

  useEffect(() => {
    const v = valor ?? hoy;
    setDia(v.getDate());
    setMes(v.getMonth() + 1);
    setAnio(v.getFullYear());
  }, [valor, visible]); // eslint-disable-line

  const diasEnMes = new Date(anio, mes, 0).getDate();
  const dias  = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const hoyAnio = hoy.getFullYear();
  const anios = Array.from({ length: 21 }, (_, i) => hoyAnio - i); // vacunas no pueden ser futuras

  const confirmar = () => onConfirmar(new Date(anio, mes - 1, Math.min(dia, diasEnMes)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={fp.overlay}>
        <View style={fp.container}>
          <Text style={fp.titulo}>Fecha de aplicación</Text>
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


// ─── DATOS DEMO (sin backend de vacunas conectado) ───────────────────────────

const DEMO_MASCOTA = {
  id: 1, nombre: 'Titán', especie: 'perro',
  raza: 'Labrador Retriever', peso: 20.40,
  fecha_nacimiento: '2022-02-15', imagen_asset: 'perro_default',
};

const DEMO_APLICADAS = [
  {
    id: 1,
    nombre: 'Rabia',
    descripcion: null,
    fecha_aplicacion: '2026-01-15',
    proximo_refuerzo: '2027-01-15',
    tipo: 'Vacuna',
    veterinaria: 'Clínica Veterinaria del Centro',
    vacuna_sugerida_id: 7,
  },
];

const DEMO_SUGERIDAS = [
  { id: 1, nombre: 'Moquillo Canino (Distemper)',                      frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 2, nombre: 'Parvovirus Canino',                                frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 3, nombre: 'Hepatitis Infecciosa Canina (Adenovirus tipo 1)',  frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 4, nombre: 'Adenovirus tipo 2 (Tos de las Perreras)',          frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 5, nombre: 'Parainfluenza Canina',                             frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 6, nombre: 'Leptospirosis',                                    frecuencia_descripcion: 'Cada 1 año(s)', applied: false, proximo_refuerzo: null },
  { id: 7, nombre: 'Rabia',                                            frecuencia_descripcion: 'Cada 1 año(s)', applied: true,  proximo_refuerzo: '2027-01-15' },
  { id: 8, nombre: 'Bordetella (Tos de las Perreras)',                 frecuencia_descripcion: 'Cada 6 meses',  applied: false, proximo_refuerzo: null },
];

// ─── SCREEN PRINCIPAL ─────────────────────────────────────────────────────────

export default function VacunasScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const petId = route.params?.petId;

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

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastColor,   setToastColor]   = useState('#2DBD72');
  const toastTimer = useRef(null);

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
        setMascota(DEMO_MASCOTA);
        setVacunasAplicadas(DEMO_APLICADAS);
        setVacunasSugeridas(DEMO_SUGERIDAS);
      }
    } catch {
      setMascota(DEMO_MASCOTA);
      setVacunasAplicadas(DEMO_APLICADAS);
      setVacunasSugeridas(DEMO_SUGERIDAS);
    }
    setLoading(false);
    Animated.parallel([
      Animated.timing(heroScale,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [idMascota]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar(true);
    setRefreshing(false);
  }, [cargar]);

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
    setFormTitulo(''); setFormDescripcion(''); setFormFecha(null);
    setFormTipo('Vacuna'); setFormVeterinaria(''); setFormErrors({});
    setVacunaEnEdicion(null); setVacunaPreseleccionada(null);
    setModalModo('añadir');
    abrirModal();
  }

  function abrirModalMarcar(sugerida) {
    setFormTitulo(sugerida.nombre); setFormDescripcion(''); setFormFecha(null);
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

    const fechaISO = toISO(formFecha);
    const frecuenciaMeses = vacunaPreseleccionada?.frecuencia_descripcion?.includes('6 meses') ? 6 : 12;
    const proximoRefuerzo = (() => {
      const d = new Date(formFecha);
      d.setMonth(d.getMonth() + frecuenciaMeses);
      return toISO(d);
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
        mostrarToast('Vacuna registrada correctamente', '#2DBD72');
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
        mostrarToast('Vacuna registrada correctamente', '#2DBD72');
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
        mostrarToast('Vacuna actualizada correctamente', '#2DBD72');
      }
    } catch {
      mostrarToast('No se pudo guardar la vacuna', '#E63946');
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
      mostrarToast('Vacuna eliminada', '#E63946');
    } catch {
      mostrarToast('No se pudo eliminar la vacuna', '#E63946');
    }
  }

  // ── Datos de la mascota ────────────────────────────────────────────────────
  const m = mascota ?? mascotaActivaDemo ?? {
    nombre: 'Tu mascota', especie: 'perro', raza: null,
    peso: null, fecha_nacimiento: null, imagen_asset: 'perro_default',
  };
  const edad    = calcularEdad(m.fecha_nacimiento);
  const petImg  = resolveMascotaVisual(m);
  const pesoFmt = m.peso != null
    ? parseFloat(m.peso).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
    : '—';

  const tituloModal = modalModo === 'editar' ? 'Editar vacuna'
    : modalModo === 'marcar' ? 'Marcar vacuna'
    : 'Nueva vacuna';
  const tituloEditable = modalModo === 'añadir' || modalModo === 'editar';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Toast visible={toastVisible} mensaje={toastMensaje} color={toastColor} />

      <View style={s.screenBg}>

        {/* Header mínimo */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
            accessibilityLabel="Volver" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={26} color="#2C2C2C" />
          </TouchableOpacity>
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
                Vacunas de {m.nombre}
              </Text>
              <View style={s.heroInfo}>
                <Text style={s.heroInfoTxt}>Edad: {edad}</Text>
                <Text style={s.heroInfoTxt}>Peso: {pesoFmt}</Text>
                <Text style={s.heroInfoTxt}>Raza: {m.raza ?? '—'}</Text>
              </View>
            </Animated.View>
          </View>

          {/* ── SECCIÓN VACUNAS APLICADAS ── */}
          <View style={s.secRow}>
            <Text style={s.secTitulo}>Vacunas</Text>
            <TouchableOpacity style={s.btnAnadir} onPress={abrirModalAnadir}>
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={s.btnAnadirTxt}>Añadir</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View><SkeletonCard /><SkeletonCard /></View>
          ) : vacunasAplicadas.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="create-outline" size={14} color="#6B6B6B" />
              <Text style={s.emptyTxt}>No hay vacunas registradas</Text>
            </View>
          ) : (
            vacunasAplicadas.map((v) => (
              <CardAplicado key={v.id} vacuna={v} onEditar={abrirModalEditar} onEliminar={eliminarVacuna} />
            ))
          )}

          {/* ── SECCIÓN CALENDARIO SUGERIDO ── */}
          <View style={s.secSugeridosRow}>
            <Ionicons name="calendar-outline" size={16} color="#2C2C2C" />
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
                    placeholderTextColor="#AAAAAA"
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
                    placeholderTextColor="#AAAAAA"
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
                    <Text style={[s.inputFechaTxt, !formFecha && { color: '#AAAAAA' }]}>
                      {formFecha ? toISO(formFecha).split('-').reverse().join('/').replace(/^(\d+)\/(\d+)\/(\d+)$/, (_, d, mo, y) => `${parseInt(d)}/${parseInt(mo)}/${y}`) : 'dd/mm/aaaa'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#6B6B6B" />
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
                    placeholderTextColor="#AAAAAA"
                    value={formVeterinaria}
                    onChangeText={setFormVeterinaria}
                    returnKeyType="done"
                  />

                  {/* Botón Guardar */}
                  <TouchableOpacity style={s.btnGuardar} onPress={guardarVacuna} disabled={guardando}>
                    {guardando
                      ? <ActivityIndicator size="small" color="#FFF" />
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
        valor={formFecha}
        onConfirmar={(d) => { setFormFecha(d); setShowFechaPicker(false); if (formErrors.fecha) setFormErrors((p) => ({ ...p, fecha: null })); }}
        onCancelar={() => setShowFechaPicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#C8F0D8' },
  screenBg:      { flex: 1, width: '100%', backgroundColor: '#C8F0D8' },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },

  // Hero card blanco flotante
  hero: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingTop: 20, paddingBottom: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  petCircle:    { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#A8E6C0', opacity: 0.45, top: -15, alignSelf: 'center' },
  petImg:       { width: 110, height: 110, zIndex: 1 },
  heroTitulo:   { fontSize: 24, fontWeight: '800', color: '#2C2C2C', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  heroInfo:     { alignItems: 'center', marginTop: 6, gap: 2 },
  heroInfoTxt:  { fontSize: 13, color: '#6B6B6B' },

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
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 18 },
  emptyTxt: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginTop: 4, marginBottom: 18 },

  // Card aplicado
  cardAplicado: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: '#EFEFEF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardLeft:   { flex: 1, paddingRight: 10, gap: 3 },
  cardRight:  { flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' },
  cardNombre: { fontSize: 14, fontWeight: '700', color: '#2C2C2C', marginBottom: 4 },
  cardDesc:   { fontSize: 12, color: '#2C2C2C', fontStyle: 'italic', marginBottom: 4 },
  cardField:  { fontSize: 12, color: '#6B6B6B' },

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

  // Card sugerido
  cardSugerido: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#EFEFEF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
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
  sugeridoNombre: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  sugeridoEstado: { fontSize: 12, textAlign: 'right' },
  sugeridoFrec:   { fontSize: 12, color: '#6B6B6B', textAlign: 'right' },

  btnMarcar: {
    backgroundColor: '#2DBD72', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2,
  },
  btnMarcarTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

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

  // Modal
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 20,
    width: Math.min(SCREEN_WIDTH * 0.88, 360),
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
  inputDisabled: { backgroundColor: '#F5F5F5', color: '#2C2C2C' },
  inputError:    { borderColor: '#E63946' },
  inputMulti:    { height: 80, textAlignVertical: 'top' },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, backgroundColor: '#FFF',
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: '#2C2C2C' },
  errorTxt:      { fontSize: 11, color: '#E63946', marginTop: -8, marginBottom: 8, marginLeft: 4 },

  btnGuardar: {
    width: '100%', height: 48, borderRadius: 30,
    backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnCancelar:   { width: '100%', height: 44, borderRadius: 30, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
});
