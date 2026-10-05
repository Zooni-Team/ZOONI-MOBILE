/**
 * PaseadorLoginScreen.jsx — Ingreso a Zooni Paseadores
 *
 * Mismo backend que el login de dueños (RPC login_user). Si la cuenta existe
 * pero todavía no es paseador (un dueño que quiere trabajar paseando), en vez
 * de un error se le ofrece sumar el perfil de paseador a su misma cuenta.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, PillButton, sombra } from '../../components/paseador/PaseadorUI';
import { loginPaseador } from '../../services/paseadorApi';
import { getUltimoMail, getUltimoMailWeb } from '../../config/session';
import { MASCOTAS_BIENVENIDA } from '../../constants/registroImages';
import BotonesSociales from '../../components/BotonesSociales';
import { volverOLogin } from '../../utils/volverOLogin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PaseadorLoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Mail de la cuenta que acaba de cerrar sesión, ya escrito. En web se lee
  // sincrónico para que el navegador no rellene un usuario guardado viejo.
  const [email, setEmail] = useState(getUltimoMailWeb);
  useEffect(() => {
    getUltimoMail().then((m) => { if (m) setEmail((actual) => actual || m); });
  }, []);
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  // Si volvió de Google / Facebook / Apple con un error, se muestra acá
  const [error, setError] = useState(route.params?.errorSocial ?? null);
  const [activar, setActivar] = useState(null); // { email, hash, nombre }

  const ingresar = useCallback(async () => {
    const mail = email.trim();
    if (!EMAIL_REGEX.test(mail)) return setError('Ingresá un email válido');
    if (!password) return setError('Ingresá tu contraseña');
    setError(null);
    setActivar(null);
    setCargando(true);
    try {
      const res = await loginPaseador(mail, password);
      if (res.necesitaCompletar) {
        navigation.reset({ index: 0, routes: [{ name: 'PaseadorRegistro', params: { completar: true } }] });
        return;
      }
      if (res.necesitaActivar) {
        setActivar(res);
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'PaseadorApp' }] });
    } catch (err) {
      setError(err?.message === 'credenciales'
        ? 'Email o contraseña incorrectos'
        : 'No se pudo conectar. Revisá tu internet e intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [email, password, navigation]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => volverOLogin(navigation)} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={C.teal} />
          </TouchableOpacity>

          <Text style={s.marca}>Zooni</Text>
          <View style={s.subRow}>
            <Ionicons name="walk" size={16} color={C.teal} />
            <Text style={s.submarca}>Paseadores</Text>
          </View>

          <Image source={MASCOTAS_BIENVENIDA} style={s.ilustracion} resizeMode="contain" />

          <Text style={s.titulo}>Iniciá sesión para trabajar</Text>

          <TextInput
            style={s.input}
            placeholder="Correo electrónico"
            placeholderTextColor={C.gris}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); setActivar(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // El gestor de contraseñas guarda/rellena el MAIL como usuario
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <View style={s.inputRow}>
            <TextInput
              style={s.inputPass}
              placeholder="Contraseña"
              placeholderTextColor={C.gris}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry={!verPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={ingresar}
            />
            <TouchableOpacity onPress={() => setVerPassword((v) => !v)} hitSlop={8}
              accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <Ionicons name={verPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.texto2} />
            </TouchableOpacity>
          </View>

          <PillButton titulo="Ingresar" variante="teal" onPress={ingresar} cargando={cargando} />
          {error && <Text style={s.error}>{error}</Text>}
          <BotonesSociales intencion="paseador" titulo="O entrá con" />

          {activar && (
            <View style={s.activar}>
              <Ionicons name="paw" size={22} color={C.teal} />
              <View style={{ flex: 1 }}>
                <Text style={s.activarTitulo}>¡Hola{activar.nombre ? `, ${activar.nombre}` : ''}!</Text>
                <Text style={s.activarTxt}>
                  Tu cuenta todavía no es de paseador. Podés sumarlo sin perder tu perfil de dueño.
                </Text>
                <PillButton
                  titulo="Activar perfil de paseador"
                  chico
                  style={{ marginTop: 12 }}
                  onPress={() => navigation.navigate('PaseadorRegistro', { activar })}
                />
              </View>
            </View>
          )}

          <View style={s.separador} />

          <Text style={s.pregunta}>¿Todavía no paseás con Zooni?</Text>
          <PillButton
            titulo="Crear cuenta de paseador"
            onPress={() => navigation.navigate('PaseadorRegistro')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  volver: { width: 44, height: 44, justifyContent: 'center' },

  marca: { fontSize: 36, fontWeight: '800', color: '#5C3D1E', textAlign: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -2 },
  submarca: { fontSize: 15, fontWeight: '800', color: C.teal, letterSpacing: 0.5 },
  ilustracion: { width: '100%', height: 130, marginVertical: 18 },

  titulo: { fontSize: 18, fontWeight: '700', color: C.texto, marginBottom: 16, textAlign: 'center' },

  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.texto,
    backgroundColor: '#FFFFFF', marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF', marginBottom: 16,
  },
  inputPass: { flex: 1, paddingVertical: 14, fontSize: 15, color: C.texto },
  error: { fontSize: 13, color: C.rojo, textAlign: 'center', marginTop: 10 },

  activar: {
    flexDirection: 'row', gap: 12, marginTop: 16, padding: 16, borderRadius: 18,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.menta, ...sombra,
  },
  activarTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  activarTxt: { fontSize: 13, color: C.texto2, marginTop: 2, lineHeight: 18 },

  separador: { height: 1, backgroundColor: '#EFEFEF', marginVertical: 22 },
  pregunta: { fontSize: 14, color: C.texto2, textAlign: 'center', marginBottom: 12 },
});
