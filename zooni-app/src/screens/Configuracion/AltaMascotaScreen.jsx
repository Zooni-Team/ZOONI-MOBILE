/**
 * AltaMascotaScreen.jsx — Agregar nueva mascota desde Configuración
 *
 * Mismo recorrido que crear la mascota en el REGISTRO:
 *   Paso 1 (= RegisterStep1): nombre + grilla de especies con ilustraciones
 *   Paso 2 (= RegisterStep2): sexo y raza (dropdowns), slider amarillo de peso,
 *   fecha de nacimiento y foto — con la mascota "en caja" arriba.
 * La única diferencia es el final: acá se guarda la mascota del usuario
 * logueado (crearMascota → Supabase) en vez de seguir a los pasos de cuenta.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { ESPECIES } from '../../constants/registroAssets';
import { resolveCajaImage } from '../../constants/registroImages';
import OpcionPicker from '../../components/OpcionPicker';
import FechaPicker from '../../components/FechaPicker';
import SliderAmarillo from '../../components/SliderAmarillo';
import { fetchRazas } from '../../services/authApi';
import { crearMascota } from '../../services/petsApi';
import { toISODateLocal } from '../../utils/fechaLocal';
import { calcularEdad } from '../../utils/calcularEdad';
import { alerta, confirmar } from '../../utils/dialogo';

const SEXOS = ['Macho', 'Hembra'];

// Mismo mapa que usa el registro (authApi.js)
const IMAGEN_ASSET_POR_ESPECIE = {
  perro: 'perro_default',
  gato: 'gato_default',
  conejo: 'conejo_default',
  ave: 'pajaro_default',
  reptil: 'perro_default',
  pez: 'perro_default',
  hamster: 'hamster_default',
  raton: 'hamster_default',
};

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/** Tile de especie — igual que en RegisterStep1 */
function EspecieTile({ especie, seleccionada, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={[s.tileWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity style={[s.tile, seleccionada && s.tileOn]} onPress={handlePress}
        activeOpacity={0.85} accessibilityLabel={`Tipo de mascota: ${especie.label}`}>
        {especie.imagen ? (
          <Image source={especie.imagen} style={s.tileImg} resizeMode="contain" />
        ) : (
          <Text style={s.tileEmoji}>{especie.icono}</Text>
        )}
        <Text style={[s.tileLabel, seleccionada && s.tileLabelOn]}>{especie.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AltaMascotaScreen() {
  const navigation = useNavigation();
  const [paso, setPaso] = useState(1);
  const [guardando, setGuardando] = useState(false);

  // Paso 1 (= RegisterStep1)
  const [nombre, setNombre] = useState('');
  const [especie, setEspecie] = useState(null);
  const [errNombre, setErrNombre] = useState(false);
  const [focusNombre, setFocusNombre] = useState(false);
  const gridShake = useRef(new Animated.Value(0)).current;

  // Paso 2 (= RegisterStep2)
  const [sexo, setSexo] = useState(null);
  const [raza, setRaza] = useState(null);           // { id, nombre }
  const [razas, setRazas] = useState([]);
  const [cargandoRazas, setCargandoRazas] = useState(true);
  const [peso, setPeso] = useState(0);              // kg
  // Fecha de nacimiento, no edad: una edad en meses queda vieja sola (ver el
  // comentario del Paso 2 del registro)
  const [fechaNacimiento, setFechaNacimiento] = useState(null);
  const [showFecha, setShowFecha] = useState(false);
  const [fotoUri, setFotoUri] = useState(null);
  const [showSexo, setShowSexo] = useState(false);
  const [showRaza, setShowRaza] = useState(false);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (paso !== 2 || !especie) return;
    let cancelado = false;
    (async () => {
      setCargandoRazas(true);
      try {
        const { razas: lista } = await fetchRazas(especie);
        if (!cancelado) setRazas(lista.length ? lista : [{ id: null, nombre: 'Sin raza definida' }]);
      } catch {
        if (!cancelado) {
          Alert.alert('Error', 'No se pudieron cargar las razas. Revisá tu conexión.');
          setRazas([{ id: null, nombre: 'Sin raza definida' }]);
        }
      } finally {
        if (!cancelado) setCargandoRazas(false);
      }
    })();
    return () => { cancelado = true; };
  }, [paso, especie]);

  const shakeGrid = () => {
    Animated.sequence([
      Animated.timing(gridShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const continuarPaso1 = () => {
    const nombreOk = nombre.trim().length > 0;
    setErrNombre(!nombreOk);
    if (!especie) shakeGrid();
    if (!nombreOk || !especie) return;
    setPaso(2);
  };

  const elegirDeGaleria = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería.');
    }
  };

  const abrirCamara = async () => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Sin permiso', 'Habilitá el acceso a la cámara desde la configuración del dispositivo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  const guardar = async () => {
    const errs = {};
    if (!sexo) errs.sexo = 'Seleccioná el sexo';
    if (!raza) errs.raza = 'Seleccioná una raza';
    if (peso <= 0) errs.peso = 'Ajustá el peso';
    if (!fechaNacimiento) errs.fechaNacimiento = 'Elegí cuándo nació';
    // Foto REAL obligatoria: es la que se ve en Match
    if (!fotoUri) errs.foto = 'Agregá una foto real de tu mascota';
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    setGuardando(true);
    try {
      const mascota = await crearMascota({
        nombre: nombre.trim(),
        especie,
        sexo,
        raza: raza.nombre,
        peso,
        fechaNacimiento: toISODateLocal(fechaNacimiento),
        imagenAsset: IMAGEN_ASSET_POR_ESPECIE[especie] ?? 'perro_default',
        fotoUri, // se sube a Storage y se guarda en Mascota.Foto (la de Match)
      });
      // confirmar() funciona también en web (Alert.alert ahí es un no-op y
      // dejaba el botón cargando para siempre con la mascota ya creada)
      const irAFicha = await confirmar(
        `¡${mascota.nombre} ya es parte de Zooni!`,
        `${capitalizar(mascota.especie)}${mascota.raza ? ` · ${mascota.raza}` : ''}\n¿Querés completar su ficha médica ahora?`,
        { textoOk: 'Completar ficha médica', textoCancelar: 'Listo' }
      );
      if (irAFicha) {
        navigation.replace('FichaMedica', { mascotaId: mascota.id });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      setGuardando(false);
      if (e?.code === 'LIMITE_ACTIVAS') {
        alerta('Llegaste al máximo de mascotas activas', 'Archivá alguna para agregar otra.');
      } else {
        alerta('No pudimos guardar la mascota', 'Revisá tu conexión y probá de nuevo.');
      }
    }
  };

  const pesoFmt = peso.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
  const fechaFmt = fechaNacimiento
    ? fechaNacimiento.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── PASO 1: nombre + especie (mismo layout que RegisterStep1) ──
  if (paso === 1) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#C8F0D8" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <Text style={s.zooni}>Zooni</Text>
            <Text style={s.subtitulo}>Nueva mascota</Text>

            <View style={s.card}>
              <View style={s.cardHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Volver"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={22} color="#2DBD72" />
                </TouchableOpacity>
                <Text style={s.cardHeaderTxt}>Contanos sobre tu mascota 🐾</Text>
              </View>

              <TextInput
                style={[s.input, focusNombre && s.inputFocus, errNombre && s.inputError]}
                placeholder="Nombre de tu mascota"
                placeholderTextColor="#AAAAAA"
                value={nombre}
                onChangeText={(v) => { setNombre(v); setErrNombre(false); }}
                onFocus={() => setFocusNombre(true)}
                onBlur={() => setFocusNombre(false)}
                returnKeyType="done"
              />
              {errNombre && <Text style={s.errorTxt}>Ingresá el nombre de tu mascota</Text>}

              <Animated.View style={[s.grid, { transform: [{ translateX: gridShake }] }]}>
                {ESPECIES.map((e) => (
                  <EspecieTile key={e.key} especie={e} seleccionada={especie === e.key}
                    onPress={() => { setEspecie(e.key); setRaza(null); }} />
                ))}
              </Animated.View>
            </View>
          </ScrollView>

          <TouchableOpacity style={s.btnContinuar} onPress={continuarPaso1} activeOpacity={0.85}>
            <Text style={s.btnContinuarTxt}>Continuar</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── PASO 2: datos (mismo layout que RegisterStep2) ──
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#C8F0D8" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scrollPaso2} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={s.header}>
            <TouchableOpacity onPress={() => setPaso(1)} accessibilityLabel="Volver al paso anterior"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color="#2DBD72" />
            </TouchableOpacity>
            <Text style={s.headerTxt}>Completá los datos de tu {capitalizar(especie)} 🐾</Text>
          </View>

          <Image source={resolveCajaImage(especie)} style={s.sorpresa} resizeMode="contain"
            accessibilityLabel={`${capitalizar(especie)} en caja`} />

          <View style={s.cardPaso2}>
            {/* Sexo */}
            <TouchableOpacity style={[s.dropdown, errores.sexo && s.inputError]} onPress={() => setShowSexo(true)}>
              <Text style={[s.dropdownTxt, !sexo && s.placeholder]}>{sexo ?? 'Sexo'}</Text>
              <Ionicons name="chevron-down" size={16} color="#6B6B6B" />
            </TouchableOpacity>
            {errores.sexo && <Text style={s.errorTxt}>{errores.sexo}</Text>}

            {/* Raza */}
            <TouchableOpacity
              style={[s.dropdown, raza && s.dropdownSeleccionado, errores.raza && s.inputError]}
              onPress={() => setShowRaza(true)}
            >
              {cargandoRazas
                ? <ActivityIndicator size="small" color="#2DBD72" />
                : <Text style={[s.dropdownTxt, !raza && s.placeholder]}>{raza?.nombre ?? 'Seleccioná una opción'}</Text>}
              <Ionicons name="chevron-down" size={16} color="#6B6B6B" />
            </TouchableOpacity>
            {errores.raza && <Text style={s.errorTxt}>{errores.raza}</Text>}

            {/* Peso */}
            <Text style={s.sliderLabel}>Peso (kg)</Text>
            <SliderAmarillo value={peso} min={0} max={100} step={0.5}
              onChange={(v) => { setPeso(v); setErrores((p2) => ({ ...p2, peso: null })); }}
              etiquetaMenos="Bajar medio kilo" etiquetaMas="Subir medio kilo" />
            <Text style={s.sliderValor}>{pesoFmt}</Text>
            {errores.peso && <Text style={[s.errorTxt, { textAlign: 'center' }]}>{errores.peso}</Text>}

            {/* Fecha de nacimiento (igual que el Paso 2 del registro) */}
            <Text style={s.sliderLabel}>¿Cuándo nació?</Text>
            <TouchableOpacity
              style={[s.dropdown, fechaNacimiento && s.dropdownSeleccionado, errores.fechaNacimiento && s.inputError]}
              onPress={() => setShowFecha(true)}
            >
              <Text style={[s.dropdownTxt, !fechaNacimiento && s.placeholder]}>
                {fechaFmt ?? 'Elegí la fecha de nacimiento'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#6B6B6B" />
            </TouchableOpacity>
            {errores.fechaNacimiento && <Text style={[s.errorTxt, { textAlign: 'center' }]}>{errores.fechaNacimiento}</Text>}
            {fechaNacimiento && <Text style={s.sliderValor}>{calcularEdad(fechaNacimiento)}</Text>}

            {/* Foto REAL (obligatoria) */}
            <Text style={s.fotoLabel}>📷 Agregá una foto real de tu mascota</Text>
            {fotoUri && (
              <View style={s.previewWrap}>
                <Image source={{ uri: fotoUri }} style={s.preview} />
                <TouchableOpacity style={s.previewQuitar} onPress={() => setFotoUri(null)}
                  accessibilityLabel="Quitar foto">
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[s.btnFoto, errores.foto && s.btnFotoError]}
              onPress={() => { elegirDeGaleria(); setErrores((p2) => ({ ...p2, foto: null })); }} activeOpacity={0.85}>
              <Text style={s.btnFotoTxt}>Seleccionar archivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnFoto, errores.foto && s.btnFotoError]}
              onPress={() => { abrirCamara(); setErrores((p2) => ({ ...p2, foto: null })); }} activeOpacity={0.85}>
              <Text style={s.btnFotoTxt}>📷 Abrir cámara</Text>
            </TouchableOpacity>
            {errores.foto && <Text style={[s.errorTxt, { textAlign: 'center' }]}>{errores.foto}</Text>}
          </View>
        </ScrollView>

        <TouchableOpacity style={[s.btnContinuar, guardando && { opacity: 0.6 }]}
          onPress={guardar} disabled={guardando} activeOpacity={0.85}>
          {guardando
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.btnContinuarTxt}>Guardar mascota</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <FechaPicker
        visible={showFecha}
        titulo="¿Cuándo nació?"
        valor={fechaNacimiento ?? new Date()}
        aniosAtras={30}
        onConfirmar={(d) => { setFechaNacimiento(d); setShowFecha(false); setErrores((p2) => ({ ...p2, fechaNacimiento: null })); }}
        onCancelar={() => setShowFecha(false)}
      />

      <OpcionPicker
        visible={showSexo}
        titulo="Sexo"
        opciones={SEXOS}
        valor={sexo}
        onSeleccionar={(v) => { setSexo(v); setShowSexo(false); setErrores((p2) => ({ ...p2, sexo: null })); }}
        onCerrar={() => setShowSexo(false)}
      />
      <OpcionPicker
        visible={showRaza}
        titulo="Raza"
        opciones={razas}
        valor={raza?.nombre}
        cargando={cargandoRazas}
        onSeleccionar={(v) => { setRaza(v); setShowRaza(false); setErrores((p2) => ({ ...p2, raza: null })); }}
        onCerrar={() => setShowRaza(false)}
      />
    </SafeAreaView>
  );
}

// Estilos calcados de RegisterStep1 / RegisterStep2
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#C8F0D8' },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  scrollPaso2: { flexGrow: 1, paddingBottom: 16 },

  zooni: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', textAlign: 'center', marginTop: 16 },
  subtitulo: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginBottom: 20 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 14,
  },
  cardHeaderTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: '#2DBD72' },

  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#2C2C2C', marginBottom: 18,
  },
  inputFocus: { borderColor: '#2DBD72' },
  inputError: { borderColor: '#E63946' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -12, marginBottom: 12, marginLeft: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { width: '47%', flexGrow: 1 },
  tile: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#EFEFEF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    minHeight: 92,
  },
  tileOn: { backgroundColor: '#2DBD72', borderColor: '#2DBD72' },
  tileEmoji: { fontSize: 32, marginBottom: 6 },
  tileImg: { width: 40, height: 40, marginBottom: 6 },
  tileLabel: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  tileLabelOn: { color: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginTop: 16, marginBottom: 16,
  },
  headerTxt: { flex: 1, fontSize: 16, fontWeight: '700', color: '#2DBD72' },

  sorpresa: { width: 140, height: 140, alignSelf: 'center', marginBottom: 16 },

  cardPaso2: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    marginHorizontal: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },

  dropdown: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  dropdownSeleccionado: { borderColor: '#2DBD72', borderWidth: 1.5 },
  dropdownTxt: { fontSize: 15, color: '#2C2C2C', flex: 1, textAlign: 'center' },
  placeholder: { color: '#AAAAAA' },

  sliderLabel: { fontSize: 14, fontWeight: '700', color: '#2DBD72', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  sliderValor: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 12 },

  fotoLabel: { fontSize: 14, color: '#2C2C2C', marginTop: 8, marginBottom: 10, textAlign: 'center', fontWeight: '600' },
  previewWrap: { alignSelf: 'center', marginBottom: 10 },
  preview: { width: 80, height: 80, borderRadius: 10 },
  previewQuitar: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#E63946',
    alignItems: 'center', justifyContent: 'center',
  },
  btnFoto: {
    backgroundColor: '#F5C842', borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 20,
    alignSelf: 'center', marginBottom: 10, minWidth: 190, alignItems: 'center',
  },
  btnFotoError: { borderWidth: 1.5, borderColor: '#E63946' },
  btnFotoTxt: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
