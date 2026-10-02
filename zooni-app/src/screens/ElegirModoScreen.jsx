/**
 * ElegirModoScreen.jsx — "¿Cómo querés entrar hoy?"
 *
 * Para cuentas que son dueño Y paseador a la vez. Aparece al abrir la app con
 * la sesión guardada y después del login de dueños: así la misma cuenta tiene
 * las dos apps (Zooni y Zooni Paseadores) y elige cada vez.
 *
 * Si elige paseador y la cuenta tiene el rol pero todavía no el perfil (ej.
 * rol asignado a mano en la base), primero completa el perfil.
 */

import { useState } from 'react';
import {
  ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, sombra } from '../components/paseador/PaseadorUI';
import { MASCOTAS_BIENVENIDA } from '../constants/registroImages';
import { clearCurrentUserId, setModo, MODO_DUENO, MODO_PASEADOR } from '../config/session';
import { fetchRolesCuenta } from '../services/paseadorApi';

const OPCIONES = [
  {
    key: MODO_DUENO, titulo: 'Como dueño', texto: 'Tus mascotas, ficha médica, comunidad y match.',
    icono: 'paw', fondo: C.amarillo,
  },
  {
    key: MODO_PASEADOR, titulo: 'Como paseador', texto: 'Solicitudes, paseos en el mapa y tus ganancias.',
    icono: 'walk', fondo: C.menta,
  },
];

export default function ElegirModoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [eligiendo, setEligiendo] = useState(null);

  const elegir = async (modo) => {
    setEligiendo(modo);
    try {
      if (modo === MODO_DUENO) {
        await setModo(MODO_DUENO);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }
      // tienePerfil puede venir del arranque; si no, se consulta acá
      const tienePerfil = route.params?.tienePerfil ?? (await fetchRolesCuenta())?.tienePerfil;
      if (tienePerfil === false) {
        navigation.navigate('PaseadorRegistro', { completar: true });
        return;
      }
      await setModo(MODO_PASEADOR);
      navigation.reset({ index: 0, routes: [{ name: 'PaseadorApp' }] });
    } finally {
      setEligiendo(null);
    }
  };

  const salir = async () => {
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.marca}>Zooni</Text>
        <Image source={MASCOTAS_BIENVENIDA} style={s.ilustracion} resizeMode="contain" />

        <Text style={s.titulo}>¿Cómo querés entrar hoy?</Text>
        <Text style={s.subtitulo}>Tu cuenta tiene las dos apps. Podés cambiar cuando quieras.</Text>

        {OPCIONES.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={s.opcion}
            onPress={() => elegir(o.key)}
            disabled={!!eligiendo}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={o.titulo}
          >
            <View style={[s.icono, { backgroundColor: o.fondo }]}>
              <Ionicons name={o.icono} size={30} color={C.texto} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.opcionTitulo}>{o.titulo}</Text>
              <Text style={s.opcionTexto}>{o.texto}</Text>
            </View>
            {eligiendo === o.key
              ? <ActivityIndicator color={C.teal} />
              : <Ionicons name="chevron-forward" size={24} color={C.teal} />}
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={salir} style={s.salir}>
          <Text style={s.salirTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  marca: { fontSize: 36, fontWeight: '800', color: '#5C3D1E', textAlign: 'center' },
  ilustracion: { width: '100%', height: 140, marginVertical: 18 },
  titulo: { fontSize: 22, fontWeight: '800', color: C.texto, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card,
    borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: C.menta, ...sombra,
  },
  icono: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  opcionTitulo: { fontSize: 18, fontWeight: '800', color: C.texto },
  opcionTexto: { fontSize: 13, color: C.texto2, marginTop: 3, lineHeight: 18 },
  salir: { alignSelf: 'center', padding: 12, marginTop: 6 },
  salirTxt: { fontSize: 14, fontWeight: '700', color: C.texto2 },
});
