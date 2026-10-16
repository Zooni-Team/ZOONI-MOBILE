/**
 * NegocioLoginScreen.jsx — Ingreso a Zooni Negocios (veterinaria, peluquería, pet shop)
 *
 * Igual que el ingreso de paseadores: mismo backend que el login de dueños
 * (RPC login_user). Si la cuenta existe pero todavía no tiene un negocio de
 * este tipo (un dueño, un paseador o alguien con otro negocio), en vez de un
 * error se le ofrece sumarlo a su misma cuenta.
 *
 * Params: { tipo: 'veterinaria' | 'peluqueria' | 'petshop' }
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, PillButton, sombra } from '../../components/paseador/PaseadorUI';
import { loginNegocio } from '../../services/negocioApi';
import { getUltimoMail, getUltimoMailWeb } from '../../config/session';
import { MASCOTAS_BIENVENIDA } from '../../constants/registroImages';
import { configNegocio } from '../../constants/negocios';
import { volverOLogin } from '../../utils/volverOLogin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NegocioLoginScreen() {
  const navigation = useNavigation();
  const { tipo = 'veterinaria' } = useRoute().params ?? {};
  const cfg = configNegocio(tipo);

  const [email, setEmail] = useState(getUltimoMailWeb);
  useEffect(() => {
    getUltimoMail().then((m) => { if (m) setEmail((actual) => actual || m); });
  }, []);
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [activar, setActivar] = useState(null); // { email, hash, nombre }

  const ingresar = useCallback(async () => {
    const mail = email.trim();
    if (!EMAIL_REGEX.test(mail)) return setError('Ingresá un email válido');
    if (!password) return setError('Ingresá tu contraseña');
    setError(null);
    setActivar(null);
    setCargando(true);
    try {
      const res = await loginNegocio(mail, password, tipo);
      if (res.necesitaActivar) {
        setActivar(res);
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'NegocioApp', params: { tipo } }] });
    } catch (err) {
      setError(err?.message === 'credenciales'
        ? 'Email o contraseña incorrectos'
        : err?.message === 'migracion_pendiente'
          ? 'A la base de datos le falta Zooni Negocios: es necesario correr la migración 046 en Supabase.'
          : 'No se pudo conectar. Revisá tu internet e intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [email, password, navigation, tipo]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => volverOLogin(navigation, 'ProveedorTipo')} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={C.teal} />
          </TouchableOpacity>

          <Text style={s.marca}>Zooni</Text>
          <View style={s.subRow}>
            <View style={[s.subIcono, { backgroundColor: cfg.fondoIcono }]}>
              <Ionicons name={cfg.icono} size={14} color={cfg.color} />
            </View>
            <Text style={s.submarca}>{cfg.app.replace('Zooni ', '')}</Text>
          </View>

          <Image source={MASCOTAS_BIENVENIDA} style={s.ilustracion} resizeMode="contain" />

          <Text style={s.titulo}>Iniciá sesión en tu {cfg.label.toLowerCase()}</Text>

          <TextInput
            style={s.input}
            placeholder="Correo electrónico"
            placeholderTextColor={C.gris}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); setActivar(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
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

          {activar && (
            <View style={s.activar}>
              <Ionicons name={cfg.icono} size={22} color={cfg.color} />
              <View style={{ flex: 1 }}>
                <Text style={s.activarTitulo}>¡Hola{activar.nombre ? `, ${activar.nombre}` : ''}!</Text>
                <Text style={s.activarTxt}>
                  Tu cuenta todavía no tiene una {cfg.label.toLowerCase()} en Zooni. Podés sumarla sin perder
                  lo que ya tenés: vas a poder cambiar de app con la misma cuenta.
                </Text>
                <PillButton
                  titulo={`Sumar mi ${cfg.label.toLowerCase()}`}
                  chico
                  style={{ marginTop: 12 }}
                  onPress={() => navigation.navigate('NegocioRegistro', { tipo, activar })}
                />
              </View>
            </View>
          )}

          <View style={s.separador} />

          <Text style={s.pregunta}>¿Todavía no tenés tu {cfg.label.toLowerCase()} en Zooni?</Text>
          <PillButton
            titulo={`Registrar mi ${cfg.label.toLowerCase()}`}
            onPress={() => navigation.navigate('NegocioRegistro', { tipo })}
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
  subIcono: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
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
