/**
 * MatchProfileSetup.jsx — Formulario que completa el perfil de Match
 *
 * MatchScreen lo muestra en vez del swipe mientras al usuario le falte
 * algo de esto: foto de perfil, fecha de nacimiento, género o intereses
 * (ninguno de estos datos se pide en el registro).
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import FilterChip from './FilterChip';
import { INTEREST_OPTIONS, GENDER_OPTIONS } from '../../data/matchDemo';
import { guardarPerfilMatch } from '../../services/matchApi';

const GENEROS = GENDER_OPTIONS.filter((g) => g.key !== 'todos');
const EDAD_MINIMA = 18;

function edadDesde(dia, mes, anio) {
  const nacimiento = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy.getMonth() < nacimiento.getMonth()
    || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1;
  }
  return edad;
}

/** Va insertando las barras mientras se tipea: "20032005" -> "20/03/2005". */
function formatearFecha(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length > 4) return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
  if (digitos.length > 2) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return digitos;
}

/** Parsea "DD/MM/AAAA" a { dia, mes, anio } numéricos, o null si está incompleta/mal escrita. */
function parsearFecha(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = Number(m[3]);
  if (mes < 1 || mes > 12 || anio < 1900) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null; // ej: 31/02
  return { dia, mes, anio };
}

export default function MatchProfileSetup({ onListo }) {
  const [fotoUri, setFotoUri] = useState(null);
  const [fechaTexto, setFechaTexto] = useState('');
  const [genero, setGenero] = useState(null);
  const [intereses, setIntereses] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const fechaParseada = useMemo(() => parsearFecha(fechaTexto), [fechaTexto]);
  const fechaValida = fechaParseada != null
    && edadDesde(fechaParseada.dia, fechaParseada.mes, fechaParseada.anio) >= EDAD_MINIMA;

  const toggleInteres = (label) => {
    setIntereses((list) => (list.includes(label) ? list.filter((i) => i !== label) : [...list, label]));
    setErrores((e) => ({ ...e, intereses: null }));
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) { setFotoUri(res.assets[0].uri); setErrores((e) => ({ ...e, foto: null })); }
  };

  const abrirCamara = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la cámara desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) { setFotoUri(res.assets[0].uri); setErrores((e) => ({ ...e, foto: null })); }
  };

  const handleContinuar = async () => {
    const errs = {};
    if (!fotoUri) errs.foto = 'Agregá una foto de perfil';
    if (!fechaTexto) errs.fecha = 'Ingresá tu fecha de nacimiento';
    else if (!fechaParseada) errs.fecha = 'Fecha inválida';
    else if (!fechaValida) errs.fecha = `Tenés que ser mayor de ${EDAD_MINIMA} años`;
    if (!genero) errs.genero = 'Seleccioná tu género';
    if (!intereses.length) errs.intereses = 'Elegí al menos un interés';
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    setGuardando(true);
    try {
      const { dia, mes, anio } = fechaParseada;
      const fechaNacimiento = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      await guardarPerfilMatch({ fechaNacimiento, genero, intereses, fotoUri });
      onListo();
    } catch {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Revisá tu internet e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Ionicons name="heart" size={40} color="#2DBD72" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={s.titulo}>Completá tu perfil de Match</Text>
          <Text style={s.subtitulo}>Necesitamos estos datos para mostrarte a otros dueños y mostrarte a vos los suyos.</Text>

          <View style={s.card}>
            <Text style={s.label}>Foto de perfil</Text>
            {fotoUri && <Image source={{ uri: fotoUri }} style={s.preview} />}
            <View style={s.fotoBtnsRow}>
              <TouchableOpacity style={s.btnFoto} onPress={elegirDeGaleria} activeOpacity={0.85}>
                <Text style={s.btnFotoText}>Seleccionar archivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnFoto} onPress={abrirCamara} activeOpacity={0.85}>
                <Text style={s.btnFotoText}>📷 Abrir cámara</Text>
              </TouchableOpacity>
            </View>
            {errores.foto && <Text style={s.errorTxt}>{errores.foto}</Text>}

            <Text style={s.label}>Fecha de nacimiento</Text>
            <TextInput
              style={[s.inputFecha, errores.fecha && s.inputError]}
              placeholder="DD/MM/AAAA" placeholderTextColor="#AAAAAA"
              value={fechaTexto}
              onChangeText={(v) => { setFechaTexto(formatearFecha(v)); setErrores((e) => ({ ...e, fecha: null })); }}
              keyboardType="number-pad"
              maxLength={10}
            />
            {errores.fecha && <Text style={s.errorTxt}>{errores.fecha}</Text>}

            <Text style={s.label}>Género</Text>
            <View style={s.chipsWrap}>
              {GENEROS.map((g) => (
                <FilterChip key={g.key} label={g.label} selected={genero === g.key}
                  onPress={() => { setGenero(g.key); setErrores((e) => ({ ...e, genero: null })); }} />
              ))}
            </View>
            {errores.genero && <Text style={s.errorTxt}>{errores.genero}</Text>}

            <Text style={s.label}>Intereses</Text>
            <View style={s.chipsWrap}>
              {INTEREST_OPTIONS.map((label) => (
                <FilterChip key={label} label={label} selected={intereses.includes(label)} onPress={() => toggleInteres(label)} />
              ))}
            </View>
            {errores.intereses && <Text style={s.errorTxt}>{errores.intereses}</Text>}
          </View>
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} disabled={guardando} activeOpacity={0.85}>
          {guardando ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.btnContinuarTxt}>Continuar a Match</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#D4F5E2' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  titulo: { fontSize: 20, fontWeight: '800', color: '#2C2C2C', textAlign: 'center', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginBottom: 20, lineHeight: 20 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#2DBD72', marginBottom: 10, marginTop: 16 },

  preview: { width: 90, height: 90, borderRadius: 45, alignSelf: 'center', marginBottom: 12, backgroundColor: '#EFEFEF' },
  fotoBtnsRow: { flexDirection: 'row', gap: 8 },
  btnFoto: { flex: 1, backgroundColor: '#F5C842', borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  btnFotoText: { fontSize: 13, fontWeight: '700', color: '#2C2C2C' },

  inputFecha: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, textAlign: 'center', fontSize: 15, color: '#2C2C2C',
  },
  inputError: { borderColor: '#E63946' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  errorTxt: { fontSize: 12, color: '#E63946', marginTop: 6 },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
