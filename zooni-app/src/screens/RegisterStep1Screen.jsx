/**
 * RegisterStep1Screen.jsx — Registro Paso 1: nombre + tipo de mascota
 * (Login2/Login3 de Figma)
 *
 * Con route.params.social ({ email, nombre, apellido, foto, proveedor }) viene
 * de "Continuar con Google / Facebook / Apple" y la cuenta todavía no existe:
 * se pasa por todos los pasos y el 3 ya no pide mail ni contraseña.
 */

import { useRef, useState } from 'react';
import {
  Animated,
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

import { ESPECIES } from '../constants/registroAssets';
import { volverOLogin } from '../utils/volverOLogin';
import BotonesSociales from '../components/BotonesSociales';
import { colores } from '../theme';
import EspecieTile from '../components/EspecieTile';

export default function RegisterStep1Screen() {
  const navigation = useNavigation();
  const { social } = useRoute().params ?? {};

  const [nombre, setNombre] = useState('');
  const [especie, setEspecie] = useState(null);
  const [errNombre, setErrNombre] = useState(false);
  const [focusNombre, setFocusNombre] = useState(false);

  const gridShake = useRef(new Animated.Value(0)).current;

  const shakeGrid = () => {
    Animated.sequence([
      Animated.timing(gridShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleContinuar = () => {
    const nombreOk = nombre.trim().length > 0;
    setErrNombre(!nombreOk);
    if (!especie) shakeGrid();
    if (!nombreOk || !especie) return;
    navigation.navigate('RegisterStep2', { nombre: nombre.trim(), especie, social });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colores.menta} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={s.zooni}>Zooni</Text>
          <Text style={s.registrate}>¡Registrate!</Text>
          {social ? (
            <Text style={s.social}>
              ¡Hola{social.nombre ? `, ${social.nombre}` : ''}! Entraste con {social.proveedor}. Contanos sobre tu mascota para terminar.
            </Text>
          ) : null}

          <View style={s.card}>
            <View style={s.cardHeader}>
              <TouchableOpacity onPress={() => volverOLogin(navigation)} accessibilityLabel="Volver al login"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={22} color={colores.verde} />
              </TouchableOpacity>
              <Text style={s.cardHeaderTxt}>Contanos sobre tu mascota 🐾</Text>
            </View>

            <TextInput
              style={[s.input, focusNombre && s.inputFocus, errNombre && s.inputError]}
              placeholder="Nombre de tu mascota"
              placeholderTextColor={colores.textoTenue}
              value={nombre}
              onChangeText={(v) => { setNombre(v); setErrNombre(false); }}
              onFocus={() => setFocusNombre(true)}
              onBlur={() => setFocusNombre(false)}
              returnKeyType="done"
            />
            {errNombre && <Text style={s.errorTxt}>Ingresá el nombre de tu mascota</Text>}

            <Animated.View style={[s.grid, { transform: [{ translateX: gridShake }] }]}>
              {ESPECIES.map((e) => (
                <EspecieTile
                  key={e.key}
                  especie={e}
                  seleccionada={especie === e.key}
                  onPress={() => setEspecie(e.key)}
                />
              ))}
            </Animated.View>
          </View>
          {!social && <BotonesSociales intencion="dueno" titulo="O registrate con" />}
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} activeOpacity={0.85}>
          <Text style={s.btnContinuarTxt}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.menta },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },

  zooni: { fontSize: 26, fontWeight: '800', color: colores.marron, textAlign: 'center', marginTop: 16 },
  registrate: { fontSize: 15, color: colores.textoSecundario, textAlign: 'center', marginBottom: 20 },
  social: {
    fontSize: 14, color: colores.texto, textAlign: 'center', marginTop: -10, marginBottom: 16,
    backgroundColor: colores.blanco, borderRadius: 14, padding: 12, fontWeight: '600',
  },

  card: {
    backgroundColor: colores.blanco, borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colores.gris150, marginBottom: 14,
  },
  cardHeaderTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: colores.verde },

  input: {
    borderWidth: 1, borderColor: colores.gris500, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colores.texto, marginBottom: 18,
  },
  inputFocus: { borderColor: colores.verde },
  inputError: { borderColor: colores.rojo },
  errorTxt: { fontSize: 11, color: colores.rojo, marginTop: -12, marginBottom: 12, marginLeft: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  btnContinuar: {
    backgroundColor: colores.verde, borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: colores.blanco },
});
