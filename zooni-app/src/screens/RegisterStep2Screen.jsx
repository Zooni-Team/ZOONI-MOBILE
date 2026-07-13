/**
 * RegisterStep2Screen.jsx — Registro Paso 2: sexo, raza, peso, edad, foto
 * (Login4/Login5 de Figma)
 *
 * Las razas se cargan de la tabla `razas` de Supabase según la especie
 * elegida en el Paso 1 (services/authApi.js → fetchRazas).
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { fetchRazas } from '../services/authApi';
import { resolveCajaImage } from '../constants/registroImages';
import OpcionPicker from '../components/OpcionPicker';

const SEXOS = ['Macho', 'Hembra'];

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/** Slider amarillo (thumb + track activo #F5C842) sin dependencias externas. */
function SliderAmarillo({ value, min, max, step, onChange }) {
  const [trackWidth, setTrackWidth] = useState(1);

  const updateFromX = (x) => {
    if (trackWidth <= 1) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  const ratio = (value - min) / (max - min);

  return (
    <View
      style={sl.hit}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => updateFromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => updateFromX(e.nativeEvent.locationX)}
    >
      <View style={sl.track}>
        <View style={[sl.fill, { width: `${ratio * 100}%` }]} />
        <View style={[sl.thumb, { left: `${ratio * 100}%`, marginLeft: -11 }]} />
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  hit: { height: 40, justifyContent: 'center', width: '100%' },
  track: { height: 6, backgroundColor: '#DDDDDD', borderRadius: 3, width: '100%' },
  fill: { position: 'absolute', left: 0, height: 6, backgroundColor: '#F5C842', borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F5C842', borderWidth: 2, borderColor: '#FFFFFF', top: -8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
  },
});

export default function RegisterStep2Screen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { nombre, especie } = route.params ?? {};

  const [sexo, setSexo] = useState(null);
  const [raza, setRaza] = useState(null);           // { id, nombre }
  const [razas, setRazas] = useState([]);
  const [cargandoRazas, setCargandoRazas] = useState(true);
  const [peso, setPeso] = useState(0);              // kg
  const [edad, setEdad] = useState(0);              // meses
  const [fotoUri, setFotoUri] = useState(null);
  const [showSexo, setShowSexo] = useState(false);
  const [showRaza, setShowRaza] = useState(false);
  const [errores, setErrores] = useState({});

  useEffect(() => {
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
  }, [especie]);

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

  const handleContinuar = () => {
    const errs = {};
    if (!sexo) errs.sexo = 'Seleccioná el sexo';
    if (!raza) errs.raza = 'Seleccioná una raza';
    if (peso <= 0) errs.peso = 'Ajustá el peso';
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    navigation.navigate('RegisterStep3', {
      nombre,
      especie,
      sexo,
      razaId: raza.id,
      razaNombre: raza.nombre,
      pesoKg: peso,
      edadMeses: edad,
      fotoUri,
    });
  };

  const pesoFmt = peso.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
  const edadFmt = edad < 12 ? `${edad} meses` : `${(edad / 12).toFixed(1)} años`;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#C8F0D8" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Volver al paso anterior"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color="#2DBD72" />
            </TouchableOpacity>
            <Text style={s.headerTxt}>Completá los datos de tu {capitalizar(especie)} 🐾</Text>
          </View>

          <Image source={resolveCajaImage(especie)} style={s.sorpresa} resizeMode="contain"
            accessibilityLabel={`${capitalizar(especie)} en caja`} />

          <View style={s.card}>
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
            <SliderAmarillo value={peso} min={0} max={100} step={0.5} onChange={(v) => { setPeso(v); setErrores((p2) => ({ ...p2, peso: null })); }} />
            <Text style={s.sliderValor}>{pesoFmt}</Text>
            {errores.peso && <Text style={[s.errorTxt, { textAlign: 'center' }]}>{errores.peso}</Text>}

            {/* Edad */}
            <Text style={s.sliderLabel}>Edad</Text>
            <SliderAmarillo value={edad} min={0} max={240} step={1} onChange={setEdad} />
            <Text style={s.sliderValor}>{edadFmt}</Text>

            {/* Foto */}
            <Text style={s.fotoLabel}>📷 Agregá una foto de tu mascota</Text>
            {fotoUri && (
              <View style={s.previewWrap}>
                <Image source={{ uri: fotoUri }} style={s.preview} />
                <TouchableOpacity style={s.previewQuitar} onPress={() => setFotoUri(null)}
                  accessibilityLabel="Quitar foto">
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={s.btnFoto} onPress={elegirDeGaleria} activeOpacity={0.85}>
              <Text style={s.btnFotoTxt}>Seleccionar archivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnFoto} onPress={abrirCamara} activeOpacity={0.85}>
              <Text style={s.btnFotoTxt}>📷 Abrir cámara</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} activeOpacity={0.85}>
          <Text style={s.btnContinuarTxt}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#C8F0D8' },
  scroll: { flexGrow: 1, paddingBottom: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginTop: 16, marginBottom: 16,
  },
  headerTxt: { flex: 1, fontSize: 16, fontWeight: '700', color: '#2DBD72' },

  sorpresa: { width: 140, height: 140, alignSelf: 'center', marginBottom: 16 },

  card: {
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
  inputError: { borderColor: '#E63946' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -8, marginBottom: 8, marginLeft: 4 },

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
  btnFotoTxt: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
