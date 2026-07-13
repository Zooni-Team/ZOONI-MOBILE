/**
 * LoginScreen.jsx — Puerta de entrada de Zooni (Login1/9/10 de Figma)
 *
 * Fondo blanco y título "Zooni" marrón (#5C3D1E): paleta propia de este
 * flujo, distinta del verde menta del resto de la app.
 * Autentica contra Supabase (services/authApi.js) y guarda la sesión en
 * config/session.js. Social login y proveedor son placeholders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { login } from '../services/authApi';
import { MASCOTAS_BIENVENIDA, GOOGLE_ICON, FACEBOOK_ICON, APPLE_ICON } from '../constants/registroImages';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function proximamente() {
  Alert.alert('Próximamente', 'Esta opción estará disponible pronto.');
}

export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorLogin, setErrorLogin] = useState(null);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass] = useState(false);
  const [errEmail, setErrEmail] = useState(false);
  const [errPass, setErrPass] = useState(false);

  // ── Banner de registro exitoso ─────────────────────────────────────────────
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!route.params?.registroExitoso) return;
    setBannerVisible(true);
    navigation.setParams({ registroExitoso: undefined });
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bannerY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(bannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
        .start(() => setBannerVisible(false));
    }, 4000);
    return () => clearTimeout(timer);
  }, [route.params?.registroExitoso]); // eslint-disable-line

  // ── Ingresar ───────────────────────────────────────────────────────────────
  const handleIngresar = useCallback(async () => {
    const mail = email.trim();
    const emailOk = EMAIL_REGEX.test(mail);
    const passOk = password.length > 0;
    setErrEmail(!emailOk);
    setErrPass(!passOk);
    setErrorLogin(null);
    if (!emailOk || !passOk) return;

    setCargando(true);
    try {
      await login(mail, password);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      if (err?.message === 'credenciales') {
        setErrorLogin('Email o contraseña incorrectos');
      } else {
        setErrorLogin('No se pudo conectar. Revisá tu internet e intentá de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  }, [email, password, navigation]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.titulo}>Zooni</Text>

          <Image source={MASCOTAS_BIENVENIDA} style={s.illustration} resizeMode="contain"
            accessibilityLabel="Zooni mascotas" />

          {bannerVisible && (
            <Animated.View style={[s.banner, { opacity: bannerOpacity, transform: [{ translateY: bannerY }] }]}>
              <Ionicons name="checkmark-circle" size={20} color="#2DBD72" />
              <Text style={s.bannerTxt}>¡Cuenta creada exitosamente!</Text>
            </Animated.View>
          )}

          <Text style={s.subtitulo}>Iniciá sesión</Text>

          <TextInput
            style={[s.input, focusEmail && s.inputFocus, errEmail && s.inputError]}
            placeholder="Correo electrónico"
            placeholderTextColor="#AAAAAA"
            value={email}
            onChangeText={(v) => { setEmail(v); setErrEmail(false); setErrorLogin(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setFocusEmail(true)}
            onBlur={() => setFocusEmail(false)}
            returnKeyType="next"
          />
          {errEmail && <Text style={s.errorTxt}>Ingresá un email válido</Text>}

          <View style={[s.inputRow, focusPass && s.inputFocus, errPass && s.inputError]}>
            <TextInput
              style={s.inputPass}
              placeholder="Contraseña"
              placeholderTextColor="#AAAAAA"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrPass(false); setErrorLogin(null); }}
              secureTextEntry={!verPassword}
              autoCapitalize="none"
              onFocus={() => setFocusPass(true)}
              onBlur={() => setFocusPass(false)}
              returnKeyType="done"
              onSubmitEditing={handleIngresar}
            />
            <TouchableOpacity onPress={() => setVerPassword((v) => !v)}
              accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={verPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B6B6B" />
            </TouchableOpacity>
          </View>
          {errPass && <Text style={s.errorTxt}>Ingresá tu contraseña</Text>}

          <TouchableOpacity style={s.btnIngresar} onPress={handleIngresar} disabled={cargando} activeOpacity={0.85}>
            {cargando
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={s.btnIngresarTxt}>Ingresar</Text>}
          </TouchableOpacity>
          {errorLogin && <Text style={s.errorLoginTxt}>{errorLogin}</Text>}

          <Text style={s.oRegistrate}>O registrate gratis</Text>

          <TouchableOpacity style={s.btnCrear} onPress={() => navigation.navigate('RegisterStep1')} activeOpacity={0.85}>
            <Text style={s.btnCrearTxt}>Crear cuenta</Text>
          </TouchableOpacity>

          <View style={s.separador} />

          <Text style={s.proveedorPregunta}>¿Sos proveedor de servicios?</Text>
          <TouchableOpacity style={s.btnProveedor} onPress={proximamente} activeOpacity={0.85}>
            <Text style={s.btnProveedorTxt}>Registrarse como Proveedor</Text>
          </TouchableOpacity>

          <View style={s.socialRow}>
            <TouchableOpacity onPress={proximamente} accessibilityLabel="Ingresar con Google">
              <Image source={GOOGLE_ICON} style={s.socialImg} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity onPress={proximamente} accessibilityLabel="Ingresar con Facebook">
              <Image source={FACEBOOK_ICON} style={s.socialImg} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity onPress={proximamente} accessibilityLabel="Ingresar con Apple">
              <Image source={APPLE_ICON} style={s.socialImg} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  titulo: {
    fontSize: 36, fontWeight: '800', color: '#5C3D1E',
    textAlign: 'center', marginBottom: 8,
  },

  illustration: { width: '100%', height: 160, alignSelf: 'center', marginBottom: 20 },

  banner: {
    backgroundColor: '#F0FFF8', borderWidth: 1.5, borderColor: '#2DBD72', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  bannerTxt: { fontSize: 14, fontWeight: '700', color: '#2DBD72' },

  subtitulo: { fontSize: 18, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 16 },

  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#2C2C2C', backgroundColor: '#FFFFFF', marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 16, backgroundColor: '#FFFFFF', marginBottom: 16,
  },
  inputPass: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#2C2C2C' },
  inputFocus: { borderColor: '#2DBD72' },
  inputError: { borderColor: '#E63946' },
  errorTxt: { fontSize: 11, color: '#E63946', marginTop: -6, marginBottom: 8, marginLeft: 4 },

  btnIngresar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnIngresarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  errorLoginTxt: { fontSize: 13, color: '#E63946', textAlign: 'center', marginTop: 10 },

  oRegistrate: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginVertical: 14 },

  btnCrear: {
    backgroundColor: '#F5C842', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
  },
  btnCrearTxt: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },

  separador: { height: 1, backgroundColor: '#EFEFEF', marginVertical: 20 },

  proveedorPregunta: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginBottom: 10 },
  btnProveedor: {
    backgroundColor: '#4A4A4A', borderRadius: 30, height: 48,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 28,
  },
  btnProveedorTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginTop: 16 },
  socialImg: { width: 42, height: 42 },
});
