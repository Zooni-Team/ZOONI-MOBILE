/**
 * RegisterStep3Screen.jsx — Registro Paso 3: datos personales del dueño
 * (Login6 de Figma)
 */

import { useMemo, useState } from 'react';
import {
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { resolveMascotaBasicoImage } from '../constants/registroImages';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 7;

export default function RegisterStep3Screen() {
  const navigation = useNavigation();
  const route = useRoute();
  const datosPrevios = route.params ?? {};

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [errores, setErrores] = useState({});
  const [focus, setFocus] = useState(null);

  const petImg = resolveMascotaBasicoImage(datosPrevios.especie, datosPrevios.razaNombre);

  // Validaciones en vivo: se muestran mientras el campo tiene contenido inválido,
  // y desaparecen apenas se corrige (no hace falta esperar a tocar "Continuar").
  const mailValido = EMAIL_REGEX.test(mail.trim());
  const mostrarErrorMail = mail.length > 0 && !mailValido;

  const passwordValida = password.length >= PASSWORD_MIN;
  const mostrarErrorPassword = password.length > 0 && !passwordValida;

  const confirmarValido = confirmar === password;
  const mostrarErrorConfirmar = confirmar.length > 0 && !confirmarValido;

  const puedeAvanzar = useMemo(() => (
    nombre.trim().length > 0
    && apellido.trim().length > 0
    && mailValido
    && passwordValida
    && confirmarValido
  ), [nombre, apellido, mailValido, passwordValida, confirmarValido]);

  const handleContinuar = () => {
    const errs = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá tu nombre';
    if (!apellido.trim()) errs.apellido = 'Ingresá tu apellido';
    setErrores(errs);
    if (Object.keys(errs).length > 0 || !puedeAvanzar) return;

    navigation.navigate('RegisterStep4', {
      ...datosPrevios,
      usuarioNombre: nombre.trim(),
      usuarioApellido: apellido.trim(),
      email: mail.trim(),
      password,
    });
  };

  const inputStyle = (key) => ([
    s.input,
    focus === key && s.inputFocus,
    errores[key] && s.inputError,
  ]);

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
              <Text style={s.mascotaNombre}>{datosPrevios.nombre}</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={s.petWrap}>
              <View style={s.petCircle} />
              <Image source={petImg} style={s.petImg} resizeMode="contain"
                accessibilityLabel={`Ilustración de ${datosPrevios.nombre}`} />
            </View>

            <Text style={s.subtitulo}>¡Ahora ingresá tus datos!</Text>

            <TextInput style={inputStyle('nombre')} placeholder="Nombre" placeholderTextColor="#AAAAAA"
              value={nombre} onChangeText={(v) => { setNombre(v); setErrores((p) => ({ ...p, nombre: null })); }}
              onFocus={() => setFocus('nombre')} onBlur={() => setFocus(null)} returnKeyType="next" />
            {errores.nombre && <Text style={s.errorTxt}>{errores.nombre}</Text>}

            <TextInput style={inputStyle('apellido')} placeholder="Apellido" placeholderTextColor="#AAAAAA"
              value={apellido} onChangeText={(v) => { setApellido(v); setErrores((p) => ({ ...p, apellido: null })); }}
              onFocus={() => setFocus('apellido')} onBlur={() => setFocus(null)} returnKeyType="next" />
            {errores.apellido && <Text style={s.errorTxt}>{errores.apellido}</Text>}

            <TextInput style={[s.input, focus === 'mail' && s.inputFocus, mostrarErrorMail && s.inputError]}
              placeholder="Mail" placeholderTextColor="#AAAAAA"
              value={mail} onChangeText={setMail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              onFocus={() => setFocus('mail')} onBlur={() => setFocus(null)} returnKeyType="next" />
            {mostrarErrorMail && <Text style={s.errorTxt}>Ingresá un email válido</Text>}

            <View style={[s.inputRow, focus === 'password' && s.inputFocus, mostrarErrorPassword && s.inputError]}>
              <TextInput style={s.inputPass} placeholder="Contraseña" placeholderTextColor="#AAAAAA"
                value={password} onChangeText={setPassword}
                secureTextEntry={!verPassword} autoCapitalize="none"
                onFocus={() => setFocus('password')} onBlur={() => setFocus(null)} returnKeyType="next" />
              <TouchableOpacity onPress={() => setVerPassword((v) => !v)}
                accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={verPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B6B6B" />
              </TouchableOpacity>
            </View>
            {mostrarErrorPassword && (
              <Text style={s.errorTxt}>{`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`}</Text>
            )}

            <View style={[s.inputRow, focus === 'confirmar' && s.inputFocus, mostrarErrorConfirmar && s.inputError]}>
              <TextInput style={s.inputPass} placeholder="Confirmar contraseña" placeholderTextColor="#AAAAAA"
                value={confirmar} onChangeText={setConfirmar}
                secureTextEntry={!verConfirmar} autoCapitalize="none"
                onFocus={() => setFocus('confirmar')} onBlur={() => setFocus(null)} returnKeyType="done" />
              <TouchableOpacity onPress={() => setVerConfirmar((v) => !v)}
                accessibilityLabel={verConfirmar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={verConfirmar ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B6B6B" />
              </TouchableOpacity>
            </View>
            {mostrarErrorConfirmar && <Text style={s.errorTxt}>Las contraseñas no coinciden</Text>}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[s.btnContinuar, !puedeAvanzar && s.btnContinuarOff]}
          onPress={handleContinuar}
          disabled={!puedeAvanzar}
          activeOpacity={0.85}
        >
          <Text style={s.btnContinuarTxt}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 14, marginBottom: 10,
  },
  inputPass: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#2C2C2C', textAlign: 'center' },
  inputFocus: { borderColor: '#2DBD72' },
  inputError: { borderColor: '#E63946' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -6, marginBottom: 8, marginLeft: 4 },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarOff: { backgroundColor: '#A8D8B8', shadowOpacity: 0, elevation: 0 },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
