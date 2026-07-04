/**
 * RegisterStep1Screen.jsx — Registro Paso 1: nombre + tipo de mascota
 * (Login2/Login3 de Figma)
 */

import { useRef, useState } from 'react';
import {
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

import { ESPECIES } from '../constants/registroAssets';

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
      <TouchableOpacity
        style={[s.tile, seleccionada && s.tileOn]}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityLabel={`Tipo de mascota: ${especie.label}`}
      >
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

export default function RegisterStep1Screen() {
  const navigation = useNavigation();

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
    navigation.navigate('RegisterStep2', { nombre: nombre.trim(), especie });
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
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Volver al login"
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
                <EspecieTile
                  key={e.key}
                  especie={e}
                  seleccionada={especie === e.key}
                  onPress={() => setEspecie(e.key)}
                />
              ))}
            </Animated.View>
          </View>
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={handleContinuar} activeOpacity={0.85}>
          <Text style={s.btnContinuarTxt}>Continuar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#C8F0D8' },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },

  zooni: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', textAlign: 'center', marginTop: 16 },
  registrate: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginBottom: 20 },

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

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
