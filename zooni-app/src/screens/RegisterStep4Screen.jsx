/**
 * RegisterStep4Screen.jsx — Registro Paso 4: ubicación + registro final
 * (Login7/Login8 de Figma)
 *
 * Al confirmar, llama a services/authApi.js → registro() (usuario + mascota
 * en Supabase) y vuelve al Login con el banner de éxito.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { registro } from '../services/authApi';
import { PAISES } from '../constants/registroAssets';
import { resolvePetImage } from '../constants/petImages';

const ASSET_POR_ESPECIE = {
  perro: 'perro_default',
  gato: 'gato_default',
  conejo: 'conejo_default',
  ave: 'pajaro_default',
  hamster: 'hamster_default',
  raton: 'hamster_default',
};

function PaisPicker({ visible, valor, onSeleccionar, onCerrar }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <TouchableOpacity style={pp.overlay} activeOpacity={1} onPress={onCerrar}>
        <View style={pp.container}>
          <Text style={pp.titulo}>Elegí tu país</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {PAISES.map((pais) => (
              <TouchableOpacity key={pais.codigo}
                style={[pp.item, valor?.codigo === pais.codigo && pp.itemOn]}
                onPress={() => onSeleccionar(pais)}>
                <Text style={pp.itemTxt}>
                  {pais.bandera}  <Text style={pp.itemCodigo}>{pais.codigo}</Text>  {pais.nombre}
                </Text>
                {valor?.codigo === pais.codigo && <Ionicons name="checkmark" size={16} color="#2DBD72" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const pp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#FFF', borderRadius: 16, width: '82%', paddingVertical: 12 },
  titulo: { fontSize: 15, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 6 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18 },
  itemOn: { backgroundColor: '#F0FFF6' },
  itemTxt: { fontSize: 15, color: '#2C2C2C' },
  itemCodigo: { fontSize: 12, color: '#6B6B6B' },
});

export default function RegisterStep4Screen() {
  const navigation = useNavigation();
  const route = useRoute();
  const datos = route.params ?? {};

  const [pais, setPais] = useState(null);
  const [provincia, setProvincia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoAuto, setCodigoAuto] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [showPais, setShowPais] = useState(false);
  const [errPais, setErrPais] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [focus, setFocus] = useState(null);

  const petImg = resolvePetImage(ASSET_POR_ESPECIE[datos.especie] ?? 'perro_default');

  const seleccionarPais = (p) => {
    setPais(p);
    setErrPais(false);
    setCodigo(p.callingCode);
    setCodigoAuto(true);
    setShowPais(false);
  };

  const handleContinuar = async () => {
    if (!pais) { setErrPais(true); return; }
    setCargando(true);
    try {
      await registro({
        mascota: {
          nombre: datos.nombre,
          especie: datos.especie,
          sexo: datos.sexo,
          razaId: datos.razaId,
          razaNombre: datos.razaNombre,
          pesoKg: datos.pesoKg,
          edadMeses: datos.edadMeses,
          fotoUri: datos.fotoUri,
        },
        usuario: {
          nombre: datos.usuarioNombre,
          apellido: datos.usuarioApellido,
          email: datos.email,
          password: datos.password,
          pais: pais.nombre,
          paisCodigo: pais.codigo,
          provincia: provincia || null,
          ciudad: ciudad || null,
          codigoTelefono: codigo || null,
          telefono: telefono || null,
        },
      });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: { registroExitoso: true } }],
      });
    } catch (err) {
      if (err?.message === 'email_existente') {
        Alert.alert('Email en uso', 'Ya existe una cuenta con ese email.');
      } else if (err?.message === 'password_corta') {
        Alert.alert('Contraseña inválida', 'La contraseña debe tener al menos 6 caracteres.');
      } else {
        Alert.alert('Error', 'No se pudo crear la cuenta. Revisá tu internet e intentá de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#C8F0D8" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={s.zooni}>Zooni</Text>
          <Text style={s.registrate}>¡Registrate!</Text>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Volver al paso anterior"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={22} color="#2DBD72" />
              </TouchableOpacity>
              <Text style={s.mascotaNombre}>{datos.nombre}</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={s.petWrap}>
              <View style={s.petCircle} />
              <Image source={petImg} style={s.petImg} resizeMode="contain"
                accessibilityLabel={`Ilustración de ${datos.nombre}`} />
            </View>

            <Text style={s.subtitulo}>¡Ya falta poco!</Text>

            {/* País */}
            <TouchableOpacity
              style={[s.input, s.inputPais, pais && s.inputPaisOn, errPais && s.inputError]}
              onPress={() => setShowPais(true)}
            >
              <Text style={[s.paisTxt, !pais && s.placeholder]}>
                {pais ? `${pais.bandera}  ${pais.codigo}  ${pais.nombre}` : 'País'}
              </Text>
            </TouchableOpacity>
            {errPais && <Text style={s.errorTxt}>Seleccioná tu país</Text>}

            <TextInput
              style={[s.input, focus === 'provincia' && s.inputFocus]}
              placeholder="Provincia" placeholderTextColor="#AAAAAA"
              value={provincia} onChangeText={setProvincia}
              onFocus={() => setFocus('provincia')} onBlur={() => setFocus(null)} returnKeyType="next"
            />

            <TextInput
              style={[s.input, focus === 'ciudad' && s.inputFocus]}
              placeholder="Ciudad / Barrio" placeholderTextColor="#AAAAAA"
              value={ciudad} onChangeText={setCiudad}
              onFocus={() => setFocus('ciudad')} onBlur={() => setFocus(null)} returnKeyType="next"
            />

            <TextInput
              style={[s.input, codigoAuto && s.inputCodigoAuto, focus === 'codigo' && s.inputFocus]}
              placeholder="Código" placeholderTextColor="#AAAAAA"
              value={codigo}
              onChangeText={(v) => { setCodigo(v); setCodigoAuto(false); }}
              keyboardType="phone-pad"
              onFocus={() => setFocus('codigo')} onBlur={() => setFocus(null)} returnKeyType="next"
            />

            <TextInput
              style={[s.input, focus === 'telefono' && s.inputFocus]}
              placeholder="Teléfono" placeholderTextColor="#AAAAAA"
              value={telefono} onChangeText={setTelefono}
              keyboardType="phone-pad"
              onFocus={() => setFocus('telefono')} onBlur={() => setFocus(null)} returnKeyType="done"
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} disabled={cargando} activeOpacity={0.85}>
          {cargando
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.btnContinuarTxt}>Continuar</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <PaisPicker visible={showPais} valor={pais} onSeleccionar={seleccionarPais} onCerrar={() => setShowPais(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#C8F0D8' },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },

  zooni: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', textAlign: 'center', marginTop: 16 },
  registrate: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginBottom: 16 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mascotaNombre: { fontSize: 18, fontWeight: '700', color: '#2C2C2C', textAlign: 'center' },

  petWrap: { width: 140, height: 140, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  petCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#A8E6C0', opacity: 0.35 },
  petImg: { width: 120, height: 120 },

  subtitulo: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 20 },

  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#2C2C2C', marginBottom: 10, textAlign: 'center',
  },
  inputPais: { justifyContent: 'center' },
  inputPaisOn: { borderColor: '#2DBD72', borderWidth: 1.5 },
  paisTxt: { fontSize: 15, color: '#2C2C2C', textAlign: 'center' },
  placeholder: { color: '#AAAAAA' },
  inputCodigoAuto: { color: '#2DBD72', fontWeight: '700' },
  inputFocus: { borderColor: '#2DBD72' },
  inputError: { borderColor: '#E63946' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -6, marginBottom: 8, marginLeft: 4 },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
