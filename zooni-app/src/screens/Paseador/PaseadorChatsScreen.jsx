/**
 * PaseadorChatsScreen.jsx — Inbox de chats de Zooni Paseadores
 *
 * Todas las conversaciones con dueños: solicitudes que te llegaron, paseos
 * agendados, en curso y terminados con mensajes. Se abre desde el ícono de
 * chat del header (no es un tab: el bottom nav tiene los 5 del diseño).
 */

import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { C } from '../../components/paseador/PaseadorUI';
import ChatsPaseoLista from '../../components/paseador/ChatsPaseoLista';

export default function PaseadorChatsScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Chats</Text>
          <Text style={s.sub}>Tus conversaciones con los dueños</Text>
        </View>
      </View>
      <ChatsPaseoLista rol="paseador" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.texto2, marginTop: 1 },
});
