/**
 * RegisterStep2Screen.jsx — Registro Paso 2: sexo, raza, peso, nacimiento, foto
 * (Login4/Login5 de Figma)
 *
 * Las razas se cargan de la tabla `razas` de Supabase según la especie
 * elegida en el Paso 1 (services/authApi.js → fetchRazas).
 *
 * Se pide la FECHA DE NACIMIENTO y no la edad: guardar "8 meses" congela un
 * dato que envejece: al año siguiente la mascota seguiría teniendo 8 meses.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
// alerta() y no Alert.alert: en react-native-web Alert.alert es un NO-OP y
// estos avisos no se veían (mismo problema que trababa el registro sin explicar).
import { alerta } from '../utils/dialogo';
import { resolveCajaImage } from '../constants/registroImages';
import { calcularEdad } from '../utils/calcularEdad';
import { toISODateLocal } from '../utils/fechaLocal';
import { formatearPeso, pesoValido, rangoPeso, textoRangoPeso } from '../constants/pesoPorEspecie';
import OpcionPicker from '../components/OpcionPicker';
import FechaPicker from '../components/FechaPicker';
import SliderAmarillo from '../components/SliderAmarillo';

const SEXOS = ['Macho', 'Hembra'];

function capitalizar(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export default function RegisterStep2Screen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { nombre, especie } = route.params ?? {};

  const [sexo, setSexo] = useState(null);
  const [raza, setRaza] = useState(null);           // { id, nombre }
  const [razas, setRazas] = useState([]);
  const [cargandoRazas, setCargandoRazas] = useState(true);
  // El rango del peso depende de la especie: un hámster no puede pesar 50 kg y
  // un canario no entra en un slider que avanza de a medio kilo.
  const rango = rangoPeso(especie);
  const [peso, setPeso] = useState(rango.inicial);   // kg
  // Guardamos la FECHA DE NACIMIENTO, no la edad: una edad fija en meses queda
  // vieja al día siguiente. Con la fecha, la edad se recalcula sola en toda la
  // app (calcularEdad) y sigue siendo correcta con el paso del tiempo.
  const [fechaNacimiento, setFechaNacimiento] = useState(null);
  const [showFecha, setShowFecha] = useState(false);
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
          alerta('Error', 'No se pudieron cargar las razas. Revisá tu conexión.');
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
        alerta('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
    } catch {
      alerta('Error', 'No se pudo abrir la galería.');
    }
  };

  const abrirCamara = async () => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        alerta('Sin permiso', 'Habilitá el acceso a la cámara desde la configuración del dispositivo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
    } catch {
      alerta('Error', 'No se pudo abrir la cámara.');
    }
  };

  const handleContinuar = () => {
    const errs = {};
    if (!sexo) errs.sexo = 'Seleccioná el sexo';
    if (!raza) errs.raza = 'Seleccioná una raza';
    if (!pesoValido(peso, especie)) errs.peso = `El peso tiene que estar entre ${textoRangoPeso(especie)}`;
    if (!fechaNacimiento) errs.fechaNacimiento = 'Elegí cuándo nació';
    // Foto REAL obligatoria: es la que se ve en Match
    if (!fotoUri) errs.foto = 'Agregá una foto real de tu mascota';
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    navigation.navigate('RegisterStep3', {
      nombre,
      especie,
      sexo,
      razaId: raza.id,
      razaNombre: raza.nombre,
      pesoKg: peso,
      fechaNacimiento: toISODateLocal(fechaNacimiento),
      fotoUri,
    });
  };

  const pesoFmt = formatearPeso(peso);
  const fechaFmt = fechaNacimiento
    ? fechaNacimiento.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

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
            <Text style={s.sliderLabel}>Peso</Text>
            <SliderAmarillo
              value={peso} min={rango.min} max={rango.max} step={rango.step}
              onChange={(v) => { setPeso(v); setErrores((p2) => ({ ...p2, peso: null })); }}
              etiquetaMenos="Bajar el peso" etiquetaMas="Subir el peso"
            />
            <Text style={s.sliderValor}>{pesoFmt}</Text>
            <Text style={s.sliderAyuda}>Habitual en {especie}s: {textoRangoPeso(especie)}</Text>
            {errores.peso && <Text style={[s.errorTxt, { textAlign: 'center' }]}>{errores.peso}</Text>}

            {/* Fecha de nacimiento (en vez de una edad fija, que se desactualiza) */}
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

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} activeOpacity={0.85}>
          <Text style={s.btnContinuarTxt}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Hasta 30 años atrás cubre cualquier especie de la app (tortugas, loros…) */}
      <FechaPicker
        visible={showFecha}
        titulo="¿Cuándo nació?"
        valor={fechaNacimiento ?? new Date()}
        aniosAtras={30}
        sinFuturo
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
  sliderValor: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center' },
  sliderAyuda: { fontSize: 11, color: '#9A9A9A', textAlign: 'center', marginTop: 2, marginBottom: 12 },

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
